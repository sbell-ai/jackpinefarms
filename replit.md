# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Building the Jack Pine Farm digital platform:
- **Jack Pine Farm Store** — ecommerce for pastured eggs/meat (deposit model, pickup-only)
- **FarmOps** — farm management SaaS (future)

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (API server), Vite (frontend)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server (port 8080, path /api)
│   └── store/              # Jack Pine Farm Store React + Vite frontend (path /)
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, session, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers
  - `src/routes/health.ts` → `GET /api/healthz`
  - `src/routes/products.ts` → product CRUD + notify-me
  - `src/routes/admin.ts` → admin login/logout/me
- Middleware: `src/middlewares/require-admin.ts` — session-based admin guard
- Session type extension: `src/types/session.d.ts` — adds `admin: boolean` to SessionData
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.mjs`)
- Admin auth: session-based (express-session). Password from `ADMIN_PASSWORD` env var (dev: `jackpine2026`)

### `artifacts/store` (`@workspace/store`)

Jack Pine Farm Store — React + Vite frontend.

- Pages: Home, Shop, ProductDetail, HowWeRaiseThem, About, Faq, Contact, NotFound
- Admin pages: Login, ProductList, ProductForm
- Layouts: PublicLayout (public nav + footer), AdminLayout (sidebar, auth guard via useAdminMe)
- Router: wouter, base path from `BASE_PATH` env var (set to `/`)
- API client: `@workspace/api-client-react` (React Query hooks)
- CSS: Tailwind v4, custom theme (farm green palette, serif display font)

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/products.ts` — products table with enums (productType, pricingType, availability)
- `src/schema/notify-me.ts` — notify_me subscriptions table
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec. Used by `api-server` for request/response validation.
**Important**: Only export from `./generated/api` in `src/index.ts` — do NOT also export from `./generated/types` (duplicates).

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec.
When calling hooks with query options in React Query v5, always pass `queryKey` explicitly using the exported `get<HookName>QueryKey()` helper functions.

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.

Available scripts:
- `seed-products` — seeds the 4 initial products (Chicken Eggs, Duck Eggs, Pastured Chicken, Pastured Turkey)

## Product Catalog

4 products seeded:
| Product | Type | Pricing | Availability | Price |
|---|---|---|---|---|
| Chicken Eggs | eggs_chicken | unit | taking_orders | $7.00/dozen |
| Duck Eggs | eggs_duck | unit | taking_orders | $6.00/half-dozen |
| Pastured Chicken | meat_chicken | deposit | preorder | $25 deposit |
| Pastured Turkey | meat_turkey | deposit | preorder | $50 deposit |

## Availability States

- `taking_orders` — active, add to cart
- `preorder` — preorder open, pay deposit
- `sold_out` — display only, show notify-me
- `disabled` — hidden from public

## Admin

- Password: set via `ADMIN_PASSWORD` env var (dev default: `jackpine2026`)
- Session: express-session with `SESSION_SECRET` env var
- Admin UI at `/admin` and `/admin/products`

## Business Rules

- Pickup-only, no shipping ever
- Deposit products (chicken, turkey): non-refundable deposit, final price by weight invoiced day before pickup
- Eggs: fixed unit price
- Notify-me: email subscription for sold-out products
