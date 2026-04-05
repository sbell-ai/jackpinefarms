# Workspace

## Overview

This pnpm workspace monorepo, built with TypeScript, aims to develop the Jack Pine Farm digital platform. It includes the **Jack Pine Farm Store** for ecommerce (pastured eggs/meat with a deposit model and pickup-only) and **FarmOps**, an admin UI for managing farm operations like fulfillment, batches, and pickup events.

## User Preferences

- **Always build for persistence.** Any state that must survive a process restart — sessions, queues, caches, flags, counters — belongs in the PostgreSQL database, never in memory. In-memory stores (e.g. express-session's default MemoryStore) are forbidden in this project. Use `connect-pg-simple` for sessions, Drizzle for everything else.
- **Fail explicitly.** No silent fallbacks. If a required config is missing, throw or log an error — don't silently degrade.
- **Stripe-first, then mark success.** When an external call (Stripe refund, invoice, charge) must precede a DB state change, do the external call first. Only update the DB after the external call succeeds.
- **Look at all angles before acting.** Before adding a library or making a change that touches production, check how it behaves end-to-end: Does it do runtime file I/O that will break in an esbuild bundle? Does it need peer deps that aren't directly installed? Does it behave differently in prod vs dev? Catching this before deployment prevents duplicate fixes and wasted deploys. For `connect-pg-simple` specifically: the `createTableIfMissing` option reads a `table.sql` from the package directory — this breaks when bundled. Always create the `session` table via direct SQL and omit that option.
- **Always set `app.set("trust proxy", 1)` in Express when behind a reverse proxy.** In Replit's production environment (and most cloud platforms), Node.js runs behind a reverse proxy that terminates TLS. Without `trust proxy`, `req.secure` is always `false`, and express-session with `secure: true` silently refuses to set the `Set-Cookie` header — the browser never receives the session cookie and every request appears unauthenticated.

## System Architecture

The project is structured as a pnpm monorepo with separate `artifacts` for deployable applications (`api-server`, `store`) and `lib` for shared libraries.

**Core Technologies:**
- **Node.js**: 24
- **TypeScript**: 5.9
- **API Framework**: Express 5
- **Database**: PostgreSQL with Drizzle ORM
- **Validation**: Zod, `drizzle-zod`
- **API Codegen**: Orval (from OpenAPI spec)
- **Build Tools**: esbuild (API server), Vite (frontend)

**Monorepo Structure:**
- `artifacts/api-server`: Express API server (port 8080, paths `/api`, `/farmops`, `/farmops-landing`, `/superadmin/`)
- `artifacts/store`: React + Vite frontend (path `/`)
- `artifacts/superadmin`: FarmOps Super Admin SPA built with Vite — served as static build by the API server at `/superadmin/`. Uses `BASE_PATH=/superadmin/` so the wouter router uses that as its base. Dev workflow fails to restart (Replit health check limitation for non-8080 ports); the static build is always used for preview.
- `lib/api-spec`: OpenAPI spec and Orval config for codegen.
- `lib/api-client-react`: Generated React Query hooks.
- `lib/api-zod`: Generated Zod schemas for API validation.
- `lib/db`: Drizzle ORM schema and database connection.

**TypeScript & Composite Projects:**
- All packages extend `tsconfig.base.json` with `composite: true`.
- Root `tsconfig.json` lists all packages as project references for correct cross-package type checking and build order.
- `emitDeclarationOnly` is used for type checking; actual JS bundling is handled by esbuild/Vite.

**API Server (`api-server`):**
- Routes are organized by feature (e.g., `health`, `products`, `admin`, `orders`, `checkout`).
- Uses `@workspace/api-zod` for request/response validation and `@workspace/db` for persistence.
- Admin authentication is session-based using `express-session`.

**Frontend Store (`store`):**
- React + Vite application.
- Utilizes `wouter` for routing.
- Supports subdomain routing to differentiate between public store pages and FarmOps admin pages.
- API client is built using `@workspace/api-client-react` (React Query hooks).
- Styling with Tailwind v4 and a custom theme.

**Database (`db`):**
- Manages various tables for product catalog, customers, orders, inventory (eggs, flocks), preorder batches, pickup events, site settings, coupons, CMS pages, and contact submissions.
- `orders` table includes a 9-value status enum covering `pending_payment` to `no_show`.
- Inventory management uses a lot-based FIFO allocation system for eggs, tracking daily collections and adjustments.

**Product Catalog & Availability:**
- Supports various product types (eggs, meat).
- Pricing models include unit pricing and deposit-based preorders.
- Availability states: `taking_orders`, `preorder`, `sold_out` (with notify-me functionality), `disabled`.

**Admin Features:**
- Comprehensive admin UI (`FarmOps`) for managing orders, products, batches, pickup events, customers, inventory, expenses, coupons, and site content.
- Admin password set via `ADMIN_PASSWORD` environment variable.
- Site images are admin-editable, stored in object storage, and managed via `site_settings`.

**FarmOps Super Admin Dashboard (`/superadmin/`):**
- Separate SPA for platform-level administration (multi-tenant SaaS management).
- Login: `admin@jackpinefarms.farm` / `ADMIN_PASSWORD` env var.
- Pages: Dashboard (metrics, MRR, signups), Tenants, Tenant Detail, Billing, Platform Admins, Audit Logs, Change Password.
- Session auth via `platform_admins` table with `role` column (`owner` | `support`).
- Served as static build at `/superadmin/` through the API server (NOT via its own Vite dev server — that workflow fails due to Replit's health check only working for port 8080).
- `build-spas` in `api-server/package.json` builds it with `BASE_PATH=/superadmin/`.
- Production: same API server serves it at `superadmin.jackpinefarms.farm/superadmin/` (subdomain redirects root `/` to `/superadmin/`).

**Session Cookie Notes:**
- `cookieDomain` is `undefined` in development (so it works on any preview domain) and `.jackpinefarms.farm` in production.
- The `COOKIE_DOMAIN` env var in `[services.env]` artifact.toml is intentionally overridden in dev by the `isProduction` guard in `app.ts`.

## External Dependencies

- **PostgreSQL**: Primary database for all persistent data.
- **Stripe**: Payment gateway for deposits and checkout.
- **Orval**: API client and Zod schema generation from OpenAPI spec.
- **React Query**: Frontend data fetching and caching.
- **Tailwind CSS**: Utility-first CSS framework for styling.
- **connect-pg-simple**: PostgreSQL-backed session store for Express.
- **express-session**: Middleware for session management in Express.
- **Zod**: Schema declaration and validation library.
- **Drizzle ORM**: TypeScript ORM for PostgreSQL.
- **Vite**: Frontend build tool.
- **esbuild**: Bundler for API server.