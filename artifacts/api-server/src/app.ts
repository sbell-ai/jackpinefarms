import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import cookieParser from "cookie-parser";
import connectPgSimple from "connect-pg-simple";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";

const PgSession = connectPgSimple(session);

const app: Express = express();

// Trust the first proxy hop (Replit's production reverse proxy).
// Without this, req.secure is false (the Node.js process receives plain HTTP
// from the proxy), and express-session with secure:true will refuse to set
// the Set-Cookie header — the browser never gets the session cookie.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
          host: req.headers?.host,
          xfh:  req.headers?.["x-forwarded-host"],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

const isProduction = process.env.NODE_ENV === "production";
// COOKIE_DOMAIN is set explicitly in production artifact config so the cookie
// is shared across all *.jackpinefarms.farm subdomains.  Falls back to the
// NODE_ENV-derived value for local development.
const cookieDomain =
  process.env.COOKIE_DOMAIN ?? (isProduction ? ".jackpinefarms.farm" : undefined);

const ALLOWED_ORIGINS = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(",")
  : [
      "http://localhost:3000",
      "http://localhost:5173",
      "http://localhost:5174",
      "https://jackpinefarms.farm",
      "https://farmops.jackpinefarms.farm",
    ];

app.use(
  cors({
    origin: ALLOWED_ORIGINS,
    credentials: true,
  }),
);

app.use(cookieParser());

app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      if ((req as any).url?.includes("/webhooks/stripe") || (req as any).url?.includes("/webhooks/farmops-stripe")) {
        (req as any).rawBody = buf;
      }
    },
  }),
);
app.use(express.urlencoded({ extended: true }));

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET environment variable is required");
}

app.use(
  session({
    store: new PgSession({
      pool,
      tableName: "session",
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      // Share sessions across all *.jackpinefarms.farm subdomains in production.
      // The leading dot allows farmops. and superadmin. to read the same cookie.
      domain: cookieDomain,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);

// Block FarmOps users from Jack Pine admin and operational routes.
// The /api/admin auth endpoints (login, logout, me) are always allowed so a
// user with a stale FarmOps session cookie can still reach the admin login page.
const farmopsBlockedPaths = [
  "/api/batches",
  "/api/pickup-events",
  "/api/admin-orders",
  "/api/admin-customers",
];
for (const blockedPath of farmopsBlockedPaths) {
  app.use(blockedPath, (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.session.farmopsUserId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  });
}

// Block FarmOps sessions from protected admin routes, but NOT from the
// auth endpoints (/login, /logout, /me) which must remain publicly accessible.
const adminAuthExempt = new Set(["/login", "/logout", "/me"]);
app.use("/api/admin", (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.session.farmopsUserId && !req.session.platformAdminId && req.session.admin !== true && !adminAuthExempt.has(req.path)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
});

app.use("/api", router);

const farmopsLandingDistPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../farmops-landing/dist",
);

const storeDistPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../store/dist/public",
);

// farmops.jackpinefarms.farm subdomain routing — must come BEFORE the
// /farmops redirect so requests arriving at the subdomain are handled here,
// not caught by the redirect below and sent into a loop.
//
// X-Forwarded-Host is checked first because Replit's proxy may rewrite the
// Host header to an internal value while preserving the original domain in
// X-Forwarded-Host. GET /api/admin/debug/request-info (platform-admin-only)
// can be used to inspect exactly which headers the proxy sets in production.
app.use((req, res, next) => {
  const rawHost = (req.headers.host ?? "").split(":")[0];
  const xfh     = ((req.headers["x-forwarded-host"] as string | undefined) ?? "")
                    .split(",")[0].trim().split(":")[0];
  const host = xfh || rawHost;

  if (host !== "farmops.jackpinefarms.farm") return next();
  logger.info({ rawHost, xfh, path: req.path }, "farmops subdomain: matched");
  // API calls always pass through
  if (req.path.startsWith("/api")) return next();
  // All other paths — serve the store SPA.
  // The React app detects isFarmOpsSubdomain and renders the FarmOps route
  // tree: Landing.tsx at /, /farmops/login, /farmops/dashboard, etc.
  return express.static(storeDistPath)(req, res, () => {
    res.sendFile(path.join(storeDistPath, "index.html"));
  });
});

// Redirect legacy /farmops/* paths to the FarmOps subdomain.
// req.url in a sub-mounted handler is the remainder after the mount point and
// already includes the query string (e.g. /reset-password?token=abc), so a
// single template literal is sufficient — no req.path + req.search needed.
// 302 (temporary) is used during migration; promote to 301 once stable.
app.use("/farmops", (req: express.Request, res: express.Response) => {
  res.redirect(302, `https://farmops.jackpinefarms.farm${req.url}`);
});

// Serve the farmops-landing marketing SPA at /farmops-landing/.
// The store's index.html contains a client-side redirect that sends any
// farmops.jackpinefarms.farm visitor here.  Replit's platform-level static
// handler intercepts HTML requests before Express, so this path-based approach
// is required — the subdomain middleware above only fires for requests that
// actually reach Express (i.e. /api/* and /farmops* requests).
// The SPA is built with BASE_PATH=/farmops-landing/ so all asset URLs are
// rooted at /farmops-landing/assets/... and resolve correctly.
app.use("/farmops-landing", express.static(farmopsLandingDistPath));
app.use("/farmops-landing", (_req: express.Request, res: express.Response) => {
  res.sendFile(path.join(farmopsLandingDistPath, "index.html"));
});

logger.info({ storeDistPath, farmopsLandingDistPath }, "Static file paths");

app.use(express.static(storeDistPath, {
  fallthrough: true,
}));

// Error-handler for static serving: logs the full path server-side but does
// not expose filesystem details to the client.
app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err, path: req.path, storeDistPath }, "Static file error");
  res.status(500).json({ error: "Internal server error" });
});

app.get("/{*path}", (req, res) => {
  const filePath = path.join(storeDistPath, "index.html");
  res.sendFile(filePath, (err) => {
    if (err) {
      logger.error({ err, filePath, storeDistPath }, "Failed to serve store index.html");
      res.status(500).json({ error: "index.html not found", attemptedPath: filePath });
    }
  });
});

export default app;
