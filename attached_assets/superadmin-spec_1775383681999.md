# FarmOps Super Admin Dashboard — Implementation Spec

Hand this entire document to Claude in Replit Shell as your instruction.

---

## Objective

Build a completely separate React + Vite artifact at `artifacts/superadmin` that serves
as the FarmOps platform owner dashboard. It is isolated from the Jack Pine Farm store
and the FarmOps tenant UI. It will eventually be served at
`superadmin.jackpinefarms.farm`.

Authentication uses the existing `platform_admins` table and `platformAdminId` session
key — the same table that protects Jack Pine Farm admin routes.

Do NOT build impersonation in this phase.

---

## Phase 1 pages

1. **Login** — platform admin login
2. **Dashboard** — key metrics at a glance
3. **Tenant List** — all FarmOps tenants with filters
4. **Tenant Detail** — full tenant info + actions
5. **Billing Overview** — Stripe subscription and revenue data
6. **Platform Admins** — manage who has super admin access

---

## Step 1 — Create the artifact

Create a new directory `artifacts/superadmin` with this structure:

```
artifacts/superadmin/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css
│   └── pages/
│       ├── Login.tsx
│       ├── Dashboard.tsx
│       ├── TenantList.tsx
│       ├── TenantDetail.tsx
│       ├── Billing.tsx
│       └── PlatformAdmins.tsx
```

### `package.json`

```json
{
  "name": "@workspace/superadmin",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "build": "vite build",
    "serve": "vite preview --host 0.0.0.0",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@tailwindcss/vite": "catalog:",
    "@types/node": "catalog:",
    "@types/react": "catalog:",
    "@types/react-dom": "catalog:",
    "@vitejs/plugin-react": "catalog:",
    "lucide-react": "catalog:",
    "react": "catalog:",
    "react-dom": "catalog:",
    "tailwindcss": "catalog:",
    "vite": "catalog:"
  },
  "dependencies": {
    "wouter": "^3.0.0"
  }
}
```

### `tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"],
  "compilerOptions": {
    "noEmit": true,
    "jsx": "preserve",
    "lib": ["esnext", "dom", "dom.iterable"],
    "resolveJsonModule": true,
    "allowImportingTsExtensions": true,
    "moduleResolution": "bundler",
    "types": ["node", "vite/client"],
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### `vite.config.ts`

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const port = Number(process.env.PORT) || 5175;

export default defineConfig({
  base: process.env.BASE_PATH ?? "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
```

### `index.html`

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>FarmOps Super Admin</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

---

## Step 2 — Add to pnpm-workspace.yaml and root tsconfig.json

In `pnpm-workspace.yaml`, the `artifacts/*` glob already covers this — no change needed.

In the root `tsconfig.json`, add a reference if `artifacts/superadmin` has a composite
tsconfig. Since we set `noEmit: true` (not composite), no root reference is needed.

Add `artifacts/superadmin` to the `[[artifacts]]` list in `.replit`:

```toml
[[artifacts]]
id = "artifacts/superadmin"
```

---

## Step 3 — API routes needed on the API server

Add these routes to `artifacts/api-server/src/routes/` in a new file
`platform-admin-dashboard.ts`. All routes require `requirePlatformAdmin` middleware.

```
GET  /api/superadmin/me               — current platform admin info
POST /api/superadmin/login            — platform admin login
POST /api/superadmin/logout           — platform admin logout

GET  /api/superadmin/tenants          — list all tenants (with filters: status, plan, search)
GET  /api/superadmin/tenants/:id      — tenant detail + users + usage counts
POST /api/superadmin/tenants/:id/suspend    — set status to paused
POST /api/superadmin/tenants/:id/reactivate — set status back to active
POST /api/superadmin/tenants/:id/change-plan — change plan (body: { plan })

GET  /api/superadmin/billing          — Stripe subscriptions summary
GET  /api/superadmin/billing/mrr      — MRR calculation from active subscriptions

GET  /api/superadmin/admins           — list platform admins
POST /api/superadmin/admins           — create new platform admin
DELETE /api/superadmin/admins/:id     — deactivate platform admin
```

### Login route implementation note

The superadmin login should reuse the existing `admin.ts` login logic but respond to
`/api/superadmin/login`. It sets `req.session.platformAdminId` and clears
`farmopsUserId` and `farmopsTenantId` from the session.

### Tenant list query

```typescript
// Support these query params:
// ?status=trialing|active|past_due|canceled|paused
// ?plan=starter|growth|pro
// ?search=<string> (matches name or ownerEmail)
// ?page=<number>&limit=<number> (default limit 50)
```

### Billing MRR calculation

```typescript
// MRR = sum of (Stripe subscription amount / billing_period_months) for all active subs
// Pull from farmops_tenants where stripeSubscriptionId IS NOT NULL and status = 'active'
// Use Stripe API to get current subscription amounts
// Cache result for 5 minutes to avoid hammering Stripe
```

---

## Step 4 — Frontend pages

### Auth hook (`src/hooks/useSuperAdminAuth.ts`)

```typescript
import { useState, useEffect } from "react";

interface PlatformAdmin {
  id: number;
  email: string;
  name: string;
  role: string;
}

export function useSuperAdminMe() {
  const [admin, setAdmin] = useState<PlatformAdmin | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/superadmin/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setAdmin(data?.admin ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return { admin, loading };
}
```

### Layout (`src/components/SuperAdminLayout.tsx`)

Sidebar navigation with these items:
- Dashboard (LayoutDashboard icon) → `/`
- Tenants (Building2 icon) → `/tenants`
- Billing (CreditCard icon) → `/billing`
- Admins (Shield icon) → `/admins`
- Logout button at bottom

Use a dark sidebar — `bg-gray-900 text-white` — to visually distinguish this from both
the Jack Pine admin (green) and FarmOps tenant UI (emerald). This is intentional — super
admin should look different so you never confuse which interface you're in.

### `src/App.tsx`

```tsx
import { Route, Switch, Redirect } from "wouter";
import { useSuperAdminMe } from "@/hooks/useSuperAdminAuth";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import TenantList from "@/pages/TenantList";
import TenantDetail from "@/pages/TenantDetail";
import Billing from "@/pages/Billing";
import PlatformAdmins from "@/pages/PlatformAdmins";
import SuperAdminLayout from "@/components/SuperAdminLayout";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { admin, loading } = useSuperAdminMe();
  if (loading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Loading...</div>;
  if (!admin) return <Redirect to="/login" />;
  return <SuperAdminLayout>{children}</SuperAdminLayout>;
}

export default function App() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/">
        <AuthGuard><Dashboard /></AuthGuard>
      </Route>
      <Route path="/tenants">
        <AuthGuard><TenantList /></AuthGuard>
      </Route>
      <Route path="/tenants/:id">
        {(params) => <AuthGuard><TenantDetail id={Number(params.id)} /></AuthGuard>}
      </Route>
      <Route path="/billing">
        <AuthGuard><Billing /></AuthGuard>
      </Route>
      <Route path="/admins">
        <AuthGuard><PlatformAdmins /></AuthGuard>
      </Route>
    </Switch>
  );
}
```

### Dashboard page — key metrics to display

```
┌─────────────────────────────────────────────────────┐
│  Total Tenants    Active    Trialing    Past Due     │
│      [N]          [N]        [N]          [N]        │
├─────────────────────────────────────────────────────┤
│  MRR              Trials expiring in 7 days          │
│  $[N]/mo          [N] tenants need attention         │
├─────────────────────────────────────────────────────┤
│  Recent signups (last 7 days)                        │
│  [list of tenant name, plan, signed up X days ago]   │
└─────────────────────────────────────────────────────┘
```

### Tenant List page

- Table with columns: Farm Name, Owner Email, Plan, Status, Trial Ends, Created
- Status badge colors: trialing=yellow, active=green, past_due=red, canceled=gray, paused=orange
- Filter bar: status dropdown, plan dropdown, search input
- Each row links to `/tenants/:id`

### Tenant Detail page

```
┌─────────────────────────────────────────────────────┐
│  [Farm Name]                    [Status badge]       │
│  slug: [slug]   owner: [email]                       │
├─────────────────────────────────────────────────────┤
│  Plan: [plan]   Trial ends: [date]                   │
│  Stripe sub: [id]   Period ends: [date]              │
├─────────────────────────────────────────────────────┤
│  Users on this tenant                                │
│  [name] [email] [role] [last login]                  │
├─────────────────────────────────────────────────────┤
│  Usage                                               │
│  Expenses: [N]   Orders: [N]                         │
├─────────────────────────────────────────────────────┤
│  Actions                                             │
│  [Suspend]  [Reactivate]  [Change Plan]              │
└─────────────────────────────────────────────────────┘
```

Actions must show a confirmation dialog before executing.

### Billing page

- Summary cards: Total MRR, Active subscriptions, Past due count
- Table of all tenants with active Stripe subscriptions:
  columns: Farm Name, Plan, Amount/mo, Status, Period End, Stripe Customer ID
- Past due section highlighted in red at the top
- Note: if `STRIPE_SECRET_KEY` is not set, show a "Stripe not configured" message
  gracefully rather than erroring

### Platform Admins page

- Table: Name, Email, Role, Created, Active status
- Add Admin button → modal with name, email, password, role (owner/support)
- Deactivate button per row (cannot deactivate yourself)
- Role definitions shown:
  - `owner` — full access including adding/removing admins
  - `support` — read-only access to tenants and billing, cannot suspend or change plans

---

## Step 5 — Role enforcement for platform admins

In `platform-admins` table, add a `role` column if not already present:

```sql
ALTER TABLE platform_admins ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'owner';
```

Run this via `psql $DATABASE_URL` or the Replit database SQL editor.

In `requirePlatformAdmin` middleware, attach the admin's role to the request:

```typescript
req.platformAdmin = admin; // { id, email, name, role, isActive }
```

Add a `requirePlatformAdminRole` middleware factory similar to `requireFarmopsRole`:

```typescript
export function requirePlatformAdminRole(minimumRole: "support" | "owner") {
  return function(req, res, next) {
    const role = req.platformAdmin?.role;
    if (minimumRole === "owner" && role !== "owner") {
      res.status(403).json({ error: "Owner role required" });
      return;
    }
    next();
  };
}
```

Apply `requirePlatformAdminRole("owner")` to suspend, reactivate, change-plan, and
admin management routes.

---

## Step 6 — Add to session type definitions

In `artifacts/api-server/src/types/session.d.ts`, confirm or add:

```typescript
platformAdminId?: number;
```

This should already be present — verify only, do not duplicate.

---

## Step 7 — Mount routes in the API server

In `artifacts/api-server/src/routes/index.ts`, import and mount the new router:

```typescript
import platformAdminDashboard from "./platform-admin-dashboard.js";
// ...
router.use("/superadmin", platformAdminDashboard);
```

---

## Step 8 — Build and verify

```bash
pnpm install
pnpm run build
```

Verify:
1. `artifacts/superadmin` builds without TypeScript errors
2. All other artifacts still build cleanly
3. In dev, navigate to `http://localhost:5175` and confirm the login page loads
4. Log in with your platform admin credentials
5. Dashboard shows tenant counts
6. Tenant list shows your test FarmOps tenant
7. Billing page loads (may show $0 MRR if Stripe is in test mode)
8. Platform admins page shows your admin account

---

## What NOT to change

- Do not touch `artifacts/store` — the store is unaffected
- Do not touch `artifacts/farmops-landing`
- Do not add super admin routes to the existing `admin.ts` or `platform-admin-tenants.ts`
  route files — keep everything in the new `platform-admin-dashboard.ts`
- Do not build impersonation — that is phase 2

---

## Future phases (do not build now)

- **Impersonation** — log in as a tenant for support debugging
- **Audit log** — track all super admin actions (suspend, plan change, etc.)
- **Email tenants** — send announcements from super admin dashboard
- **Usage analytics** — charts of feature usage per tenant over time
- **IP allowlist** — restrict super admin access to specific IPs
