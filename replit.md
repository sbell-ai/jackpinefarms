# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Building the Jack Pine Farm digital platform:
- **Jack Pine Farm Store** — ecommerce for pastured eggs/meat (deposit model, pickup-only)
- **FarmOps** — admin UI for farm operations (fulfillment, batches, pickup events, invoicing)

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod, `drizzle-zod`
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
├── scripts/                # Utility scripts
└── ...
```

## Engineering Principles

- **Always build for persistence.** Any state that must survive a process restart — sessions, queues, caches, flags, counters — belongs in the PostgreSQL database, never in memory. In-memory stores (e.g. express-session's default MemoryStore) are forbidden in this project. Use `connect-pg-simple` for sessions, Drizzle for everything else.
- **Fail explicitly.** No silent fallbacks. If a required config is missing, throw or log an error — don't silently degrade.
- **Stripe-first, then mark success.** When an external call (Stripe refund, invoice, charge) must precede a DB state change, do the external call first. Only update the DB after the external call succeeds.
- **Look at all angles before acting.** Before adding a library or making a change that touches production, check how it behaves end-to-end: Does it do runtime file I/O that will break in an esbuild bundle? Does it need peer deps that aren't directly installed? Does it behave differently in prod vs dev? Catching this before deployment prevents duplicate fixes and wasted deploys. For `connect-pg-simple` specifically: the `createTableIfMissing` option reads a `table.sql` from the package directory — this breaks when bundled. Always create the `session` table via direct SQL and omit that option.
- **Always set `app.set("trust proxy", 1)` in Express when behind a reverse proxy.** In Replit's production environment (and most cloud platforms), Node.js runs behind a reverse proxy that terminates TLS. Without `trust proxy`, `req.secure` is always `false`, and express-session with `secure: true` silently refuses to set the `Set-Cookie` header — the browser never receives the session cookie and every request appears unauthenticated. This single missing line caused the admin login redirect loop.

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
  - `src/routes/products.ts` → product CRUD + notify-me; triggers restock emails on availability change
  - `src/routes/admin.ts` → admin login/logout/me
  - `src/routes/admin-orders.ts` → order list/detail + status update, refund-giblets, notes, events, assign-batch
  - `src/routes/batches.ts` → preorder batch CRUD (admin only)
  - `src/routes/pickup-events.ts` → pickup event CRUD + assign-order + send-invoices (admin only)
  - `src/routes/admin-customers.ts` → customer list + detail (admin only)
  - `src/routes/notify-me.ts` → public unsubscribe/resubscribe by token
  - `src/routes/auth.ts` → customer login/register/logout/me
  - `src/routes/cart.ts` → cart CRUD
  - `src/routes/checkout.ts` → Stripe checkout + cash orders
  - `src/routes/orders.ts` → order list/detail (customer)
  - `src/routes/webhooks.ts` → Stripe webhook handler
- Middleware: `src/middlewares/require-admin.ts` — session-based admin guard
- Session type extension: `src/types/session.d.ts` — adds `admin: boolean` to SessionData
- Depends on: `@workspace/db`, `@workspace/api-zod`
- Admin auth: session-based (express-session). Password from `ADMIN_PASSWORD` env var (dev: `jackpine2026`)

### `artifacts/store` (`@workspace/store`)

Jack Pine Farm Store — React + Vite frontend.

**Public pages**: Home, Shop, ProductDetail, Cart, Checkout, OrderConfirmation, HowWeRaiseThem, About, Faq, Contact, NotFound
**Auth pages**: Login, Register, ForgotPassword, ResetPassword, VerifyEmail, ClaimOrder
**Account pages**: Profile (order history, account management), OrderDetail
**Admin pages (FarmOps)**:
  - Dashboard — order status summary + quick navigation
  - Orders — list all orders; click through to detail
  - OrderDetail — full detail with events timeline, status update, giblets refund, add note
  - Products — product list + create/edit
  - Batches — preorder batch CRUD (create, edit, list with order counts)
  - PickupEvents — pickup event list + create
  - PickupEventDetail — assign orders to event, enter weights, send invoices
  - CustomerList — registered customer list
  - CustomerDetail — customer info + full order history
**Public utility page**: Unsubscribe — token-based email unsubscribe/global-unsubscribe (no login)

- Layouts: PublicLayout (public nav + footer), AdminLayout (sidebar with 6 nav items, auth guard)
- Router: wouter, base path from `BASE_URL` env var (set to `/`)
- API client: `@workspace/api-client-react` (React Query hooks)
- CSS: Tailwind v4, custom theme (farm green palette, serif display font)
- Toast: `@/hooks/use-toast` (not `@/components/ui/use-toast`)

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL.

**Tables**:
- `products` — product catalog (type, pricingType, availability, etc.)
- `customers` — registered customers (email, name, phone, emailVerified, etc.)
- `orders` — all orders (status enum with 9 values, batchId, pickupEventId, refundedGiblets, finalWeightLbs, stripeRefundId, stripeInvoiceId)
- `order_items` — line items (productId, quantity, unitPriceInCents, isGiblets, variantLabel)
- `order_events` — audit trail (orderId, eventType enum, body)
- `preorder_batches` — meat preorder batches (productId, name, status, capacityBirds, pricePerLbCents*)
- `pickup_events` — pickup event scheduling (name, scheduledAt, locationNotes, status)
- `notify_me` — restock subscriptions (email, productId, unsubscribeToken, globalUnsubscribe)
- `customer_carts` — shopping cart
- `stripe_pending` — Stripe payment intent tracking

**Order status enum (9 values)**:
`pending_payment | deposit_paid | cash_pending | pickup_assigned | weights_entered | invoice_sent | fulfilled | cancelled | no_show`

Run migrations: `pnpm --filter @workspace/db run push` (or `--force` to add enum values)

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
- `sold_out` — display only, show notify-me (triggers restock emails when changed to `taking_orders`)
- `disabled` — hidden from public

## Admin

- Password: set via `ADMIN_PASSWORD` env var (dev default: `jackpine2026`)
- Session: express-session with `SESSION_SECRET` env var
- Admin UI at `/admin` (dashboard), `/admin/orders`, `/admin/products`, `/admin/batches`, `/admin/pickup-events`, `/admin/customers`, `/admin/eggs` (egg inventory), `/admin/flocks`

## Egg & Flock Accounting

7 tables in the DB: `flocks`, `flock_events`, `egg_types`, `daily_egg_collection`, `egg_inventory_lots`, `egg_inventory_adjustments`, `inventory_allocations`

**Inventory model**: On-hand = sum(remaining_qty_each for non-depleted lots) + sum(qty_each for non-lot adjustments)

**Lot lifecycle**: Each daily collection creates one inventory lot. Adjustments can be lot-targeted (mutate lot.remaining_qty_each) or free-standing (signed delta, lot_id IS NULL). Orders are allocated via FIFO from lots.

**API endpoints** (all under `/api/admin/...`):
- GET/POST `/admin/flocks` — flock management
- GET/POST `/admin/egg-types` — egg type configuration
- GET/POST `/admin/egg-collection` — daily collection records
- GET/POST `/admin/egg-adjustments` — manual adjustments (breakage, donations, etc.)
- GET `/admin/egg-inventory/on-hand` — current on-hand per egg type
- POST `/admin/orders/:orderId/allocate-eggs` — FIFO allocation (idempotent, 409 if already allocated)
- GET `/admin/orders/:orderId/egg-allocations` — view allocations for an order

**Drizzle-zod schemas** used for body validation in route handlers (accept ISO date strings). Orval-generated schemas use `zod.date()` for `format: date` fields which rejects JSON strings — use drizzle-zod insert schemas instead.

**FIFO allocation**: Single transaction with `FOR UPDATE` row lock on lots, ordered by `lot_date ASC`. Rollback + HTTP 400 on insufficient inventory. 409 if any allocation rows already exist for the order items.

## Business Rules

- Pickup-only, no shipping ever
- Deposit products (chicken, turkey): non-refundable deposit, final price by weight invoiced at pickup
- Giblets: +$2.00 deposit, refundable if customer declines (admin can mark as refunded per order)
- Eggs: fixed unit price (chicken: step=12 min=12; duck: step=6 min=6)
- Notify-me: email subscription for sold-out products; token-based unsubscribe at `/unsubscribe`
- Stripe: deposit charging via PaymentIntent; invoice stubs (console.log) until email provider configured
- Cash orders: status=cash_pending, no Stripe

## Key Dev Notes

- `api-zod` barrel: ONLY `export * from "./generated/api"` — no types file
- After DB schema changes: `npx tsc --build lib/db && pnpm --filter @workspace/db run push`
- After codegen: rebuild `lib/api-zod lib/api-client-react` with `npx tsc --build`
- Auth hook: `useAuthMe` (not `useGetMe`) from `@workspace/api-client-react`
- Middleware path: `../middlewares/require-admin.js` (plural, kebab-case)
- Toast: import `useToast` from `@/hooks/use-toast` (not `@/components/ui/use-toast`)
