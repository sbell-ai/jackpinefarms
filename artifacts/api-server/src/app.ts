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
  : ["http://localhost:3000"];

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

// Redirect legacy /farmops/* paths to the FarmOps subdomain.
// req.url in a sub-mounted handler is the remainder after the mount point and
// already includes the query string (e.g. /reset-password?token=abc), so a
// single template literal is sufficient — no req.path + req.search needed.
// 302 (temporary) is used during migration; promote to 301 once stable.
app.use("/farmops", (req: express.Request, res: express.Response) => {
  res.redirect(302, `https://farmops.jackpinefarms.farm${req.url}`);
});

const farmopsDistPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../farmops-landing/dist",
);

// Serve FarmOps frontend for subdomain requests.
// API calls always pass through to the router regardless of hostname.
// Static assets are served first; any unmatched path falls back to index.html
// so client-side SPA routing works correctly.
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  const host = req.hostname;
  if (host === "farmops.jackpinefarms.farm" || host === "farmops.jackpinefarms.farm.") {
    if (req.path.startsWith("/api")) return next();
    return express.static(farmopsDistPath)(req, res, () => {
      res.sendFile(path.join(farmopsDistPath, "index.html"));
    });
  }
  next();
});

const storeDistPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../store/dist/public",
);
app.use(express.static(storeDistPath));
app.get("/{*path}", (_req, res) => {
  res.sendFile(path.join(storeDistPath, "index.html"));
});

export default app;
