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
// Use req.headers.host (raw Host header) rather than req.hostname because
// req.hostname reads X-Forwarded-Host when trust proxy is set, and Replit's
// reverse proxy may set that to an internal value, not the custom domain.
app.use((req, res, next) => {
  const host = (req.headers.host ?? "").split(":")[0];
  if (host !== "farmops.jackpinefarms.farm") return next();
  // API calls always pass through
  if (req.path.startsWith("/api")) return next();
  // FarmOps tenant UI routes — serve store SPA
  if (req.path.startsWith("/farmops")) {
    return express.static(storeDistPath)(req, res, () => {
      res.sendFile(path.join(storeDistPath, "index.html"));
    });
  }
  // Everything else — serve farmops-landing marketing page
  return express.static(farmopsLandingDistPath)(req, res, () => {
    res.sendFile(path.join(farmopsLandingDistPath, "index.html"));
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

logger.info({ storeDistPath, farmopsLandingDistPath }, "Static file paths");

app.use(express.static(storeDistPath, {
  fallthrough: true,
}));

// Error-handler for static serving: logs the attempted path before 500ing.
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err, path: req.path, storeDistPath }, "Static file error");
  res.status(500).json({ error: "Static file error", attemptedPath: path.join(storeDistPath, req.path) });
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
