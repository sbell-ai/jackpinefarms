/**
 * Safe startup migration.
 * Runs entirely with IF NOT EXISTS / DO NOTHING — never drops anything.
 * This ensures every deployment picks up new tables and columns automatically,
 * regardless of whether drizzle-kit push has been run against that database.
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { logger } from "./logger.js";

export async function runMigrations(): Promise<void> {
  logger.info("Running startup migrations…");

  try {
    // ── Enum types ──────────────────────────────────────────────────────────

    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE flock_species AS ENUM ('chicken','duck','turkey');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE flock_status AS ENUM ('active','retired');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE flock_event_type AS ENUM ('acquired','hatched','culled','sold','died');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE egg_inventory_lot_status AS ENUM ('open','depleted');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE sex_enum AS ENUM ('hen','rooster','unknown');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE animal_status_enum AS ENUM ('active','sold','deceased');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    // ── Core tables (flocks, egg_types, etc.) ────────────────────────────────

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS flocks (
        id            SERIAL PRIMARY KEY,
        name          TEXT NOT NULL,
        species       flock_species NOT NULL,
        acquired_date DATE,
        status        flock_status NOT NULL DEFAULT 'active',
        notes         TEXT
      );
    `);

    // Columns added after initial schema
    const flockCols = [
      `ALTER TABLE flocks ADD COLUMN IF NOT EXISTS hen_count INTEGER`,
      `ALTER TABLE flocks ADD COLUMN IF NOT EXISTS rooster_count INTEGER`,
      `ALTER TABLE flocks ADD COLUMN IF NOT EXISTS hatch_date DATE`,
      `ALTER TABLE flocks ADD COLUMN IF NOT EXISTS age_months INTEGER`,
      `ALTER TABLE flocks ADD COLUMN IF NOT EXISTS breed TEXT`,
    ];
    for (const stmt of flockCols) {
      await db.execute(sql.raw(stmt));
    }

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS flock_events (
        id          SERIAL PRIMARY KEY,
        flock_id    INTEGER NOT NULL REFERENCES flocks(id),
        event_type  flock_event_type NOT NULL,
        count       INTEGER NOT NULL CHECK (count > 0),
        event_date  DATE NOT NULL,
        notes       TEXT
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS animals (
        id            SERIAL PRIMARY KEY,
        name          TEXT,
        species       flock_species NOT NULL,
        breed         TEXT,
        sex           sex_enum NOT NULL DEFAULT 'unknown',
        birth_date    DATE,
        acquired_date DATE,
        status        animal_status_enum NOT NULL DEFAULT 'active',
        flock_id      INTEGER REFERENCES flocks(id),
        notes         TEXT,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS egg_types (
        id       SERIAL PRIMARY KEY,
        name     TEXT NOT NULL,
        flock_id INTEGER REFERENCES flocks(id),
        active   BOOLEAN NOT NULL DEFAULT TRUE
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS daily_egg_collection (
        id              SERIAL PRIMARY KEY,
        egg_type_id     INTEGER NOT NULL REFERENCES egg_types(id),
        flock_id        INTEGER REFERENCES flocks(id),
        collection_date DATE NOT NULL,
        count_each      INTEGER NOT NULL CHECK (count_each >= 0),
        notes           TEXT,
        UNIQUE (egg_type_id, flock_id, collection_date)
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS egg_inventory_lots (
        id                  SERIAL PRIMARY KEY,
        egg_type_id         INTEGER NOT NULL REFERENCES egg_types(id),
        source_collection_id INTEGER REFERENCES daily_egg_collection(id),
        lot_date            DATE NOT NULL,
        initial_qty_each    INTEGER NOT NULL CHECK (initial_qty_each >= 0),
        remaining_qty_each  INTEGER NOT NULL CHECK (remaining_qty_each >= 0),
        status              egg_inventory_lot_status NOT NULL DEFAULT 'open',
        CHECK (remaining_qty_each <= initial_qty_each)
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS egg_inventory_adjustments (
        id          SERIAL PRIMARY KEY,
        egg_type_id INTEGER NOT NULL REFERENCES egg_types(id),
        lot_id      INTEGER REFERENCES egg_inventory_lots(id),
        qty_each    INTEGER NOT NULL,
        reason      TEXT NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS inventory_allocations (
        id                 SERIAL PRIMARY KEY,
        order_item_id      INTEGER NOT NULL REFERENCES order_items(id),
        lot_id             INTEGER NOT NULL REFERENCES egg_inventory_lots(id),
        allocated_qty_each INTEGER NOT NULL CHECK (allocated_qty_each > 0),
        allocated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (order_item_id, lot_id)
      );
    `);

    // ── Sale pricing columns (Task #11) ─────────────────────────────────────
    await db.execute(sql.raw(`ALTER TABLE products ADD COLUMN IF NOT EXISTS is_on_sale BOOLEAN NOT NULL DEFAULT FALSE`));
    await db.execute(sql.raw(`ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_price_cents INTEGER`));

    // ── product_images (Task #8) ─────────────────────────────────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS product_images (
        id          SERIAL PRIMARY KEY,
        product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        object_key  TEXT NOT NULL,
        url         TEXT NOT NULL,
        sort_order  INTEGER NOT NULL DEFAULT 0,
        alt_text    TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS product_images_product_id_idx
        ON product_images (product_id, sort_order);
    `);

    // ── Expenses (Accounting) ────────────────────────────────────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS expenses (
        id             SERIAL PRIMARY KEY,
        date           DATE NOT NULL,
        category       TEXT NOT NULL,
        description    TEXT NOT NULL,
        amount_cents   INTEGER NOT NULL CHECK (amount_cents >= 0),
        vendor         TEXT,
        payment_method TEXT,
        notes          TEXT,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS expenses_date_idx ON expenses (date DESC);
    `);

    // ── Contact submissions ──────────────────────────────────────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS contact_submissions (
        id         SERIAL PRIMARY KEY,
        name       TEXT NOT NULL,
        email      TEXT NOT NULL,
        subject    TEXT NOT NULL,
        message    TEXT NOT NULL,
        ip         TEXT,
        user_agent TEXT,
        status     TEXT NOT NULL DEFAULT 'sent',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS contact_submissions_created_at_idx
        ON contact_submissions (created_at DESC);
    `);

    await db.execute(sql.raw(
      `ALTER TABLE contact_submissions ADD COLUMN IF NOT EXISTS error TEXT`
    ));

    // ── Coupons (Task #12) ───────────────────────────────────────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS coupons (
        id                  SERIAL PRIMARY KEY,
        code                TEXT NOT NULL UNIQUE,
        description         TEXT,
        discount_type       TEXT NOT NULL,
        discount_value      INTEGER NOT NULL CHECK (discount_value > 0),
        max_redemptions     INTEGER,
        redemptions_count   INTEGER NOT NULL DEFAULT 0,
        starts_at           TIMESTAMPTZ,
        ends_at             TIMESTAMPTZ,
        is_active           BOOLEAN NOT NULL DEFAULT TRUE,
        stripe_coupon_id    TEXT,
        stripe_promotion_code_id TEXT,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Idempotent column additions / migrations for schema evolution
    await db.execute(sql.raw(
      `ALTER TABLE stripe_pending_checkouts ADD COLUMN IF NOT EXISTS applied_coupon_code TEXT`
    ));
    await db.execute(sql.raw(
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS applied_coupon_code TEXT`
    ));
    await db.execute(sql.raw(
      `ALTER TABLE coupons ADD COLUMN IF NOT EXISTS stripe_promotion_code_id TEXT`
    ));
    // Add starts_at / ends_at (v2 schema)
    await db.execute(sql.raw(
      `ALTER TABLE coupons ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ`
    ));
    await db.execute(sql.raw(
      `ALTER TABLE coupons ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ`
    ));
    // Migrate expires_at → ends_at for existing rows (only if expires_at column exists)
    await db.execute(sql`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'coupons' AND column_name = 'expires_at'
        ) THEN
          UPDATE coupons SET ends_at = expires_at WHERE expires_at IS NOT NULL AND ends_at IS NULL;
        END IF;
      END $$;
    `);
    // Migrate discount_type 'fixed_cents' → 'amount'
    await db.execute(sql.raw(
      `UPDATE coupons SET discount_type = 'amount' WHERE discount_type = 'fixed_cents'`
    ));
    // Add check constraint to enforce discount_type values at DB level
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE coupons
          ADD CONSTRAINT coupons_discount_type_check
          CHECK (discount_type IN ('percent', 'amount'));
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    // ── Customer schema evolution (Task #14) ────────────────────────────────
    // Make email nullable (storefront still requires it, admin-created customers may not have one)
    await db.execute(sql`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'customers' AND column_name = 'email' AND is_nullable = 'NO'
        ) THEN
          ALTER TABLE customers ALTER COLUMN email DROP NOT NULL;
        END IF;
      END $$;
    `);
    // Make password_hash nullable (admin-created customers don't have passwords)
    await db.execute(sql`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'customers' AND column_name = 'password_hash' AND is_nullable = 'NO'
        ) THEN
          ALTER TABLE customers ALTER COLUMN password_hash DROP NOT NULL;
        END IF;
      END $$;
    `);
    // Add notes column for admin-created customers
    await db.execute(sql.raw(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS notes TEXT`));
    // Replace blanket unique constraint with a partial unique index (unique only when not null)
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_email_unique;
      EXCEPTION WHEN undefined_object THEN NULL; END $$;
    `);
    await db.execute(sql.raw(
      `CREATE UNIQUE INDEX IF NOT EXISTS customers_email_unique_partial ON customers (email) WHERE email IS NOT NULL`
    ));

    // ── Pickup events schema evolution (Task #15) ────────────────────────────
    await db.execute(sql.raw(`ALTER TABLE pickup_events ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE`));
    await db.execute(sql.raw(`ALTER TABLE pickup_events ADD COLUMN IF NOT EXISTS capacity INTEGER`));
    await db.execute(sql.raw(`ALTER TABLE stripe_pending_checkouts ADD COLUMN IF NOT EXISTS pickup_event_id INTEGER REFERENCES pickup_events(id)`));

    // ── Order items schema evolution (Task #18) ──────────────────────────────
    // variant_label was added to the Drizzle schema but never migrated to the DB,
    // causing GET /admin/orders/:id to return 500 on every request.
    await db.execute(sql.raw(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_label TEXT`));

    // ── Orders schema evolution (Task #14) ──────────────────────────────────
    // Add source column to distinguish storefront vs admin-created orders
    await db.execute(sql.raw(
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'storefront'`
    ));
    // Add stripe_checkout_url for admin-generated Stripe payment links
    await db.execute(sql.raw(
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_checkout_url TEXT`
    ));

    // Create site_settings key-value table for admin-editable content
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS site_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL DEFAULT '',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `));
    // Seed the known image keys so they always exist (upsert — preserve any existing value)
    const imageKeys = [
      'image.hero_bg',
      'image.logo',
      'image.checkout_hero',
      'image.home_promise',
      'image.about_farm',
      'image.how_we_pasture',
      'image.how_we_feed',
      'image.product_fallback',
    ];
    for (const key of imageKeys) {
      await db.execute(
        sql`INSERT INTO site_settings (key, value) VALUES (${key}, '') ON CONFLICT (key) DO NOTHING`
      );
    }

    // ── CMS tables (Task #20) ────────────────────────────────────────────────
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS cms_pages (
        id SERIAL PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        content_html TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'draft',
        published_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `));

    // ── CMS Menus tables (Task #21) ──────────────────────────────────────────
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS cms_menus (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `));

    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS cms_menu_items (
        id SERIAL PRIMARY KEY,
        menu_id INTEGER NOT NULL REFERENCES cms_menus(id) ON DELETE CASCADE,
        label TEXT NOT NULL,
        url TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `));

    await db.execute(sql.raw(
      `INSERT INTO cms_menus (name) VALUES ('header'), ('footer') ON CONFLICT (name) DO NOTHING`
    ));

    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS cms_page_seo (
        page_id INTEGER PRIMARY KEY REFERENCES cms_pages(id) ON DELETE CASCADE,
        meta_title TEXT,
        meta_description TEXT,
        canonical_url TEXT,
        og_title TEXT,
        og_description TEXT,
        og_image_url TEXT,
        robots TEXT NOT NULL DEFAULT 'index_follow',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `));

    // ── FarmOps SaaS tables ──────────────────────────────────────────────────

    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE farmops_tenant_status AS ENUM ('trialing','active','past_due','canceled','paused');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE farmops_plan AS ENUM ('starter','growth','pro');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE farmops_addon_type AS ENUM ('custom_domain','sms_notifications','extra_admin_users','white_label');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE farmops_user_role AS ENUM ('owner','admin','member');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS farmops_tenants (
        id                          SERIAL PRIMARY KEY,
        slug                        TEXT NOT NULL UNIQUE,
        name                        TEXT NOT NULL,
        owner_email                 TEXT NOT NULL,
        status                      farmops_tenant_status NOT NULL DEFAULT 'trialing',
        plan                        farmops_plan NOT NULL DEFAULT 'starter',
        stripe_customer_id          TEXT UNIQUE,
        stripe_subscription_id      TEXT UNIQUE,
        stripe_subscription_status  TEXT,
        stripe_price_id             TEXT,
        trial_ends_at               TIMESTAMPTZ,
        current_period_ends_at      TIMESTAMPTZ,
        onboarding_purchased_at     TIMESTAMPTZ,
        stripe_onboarding_payment_id TEXT,
        created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS farmops_subscription_addons (
        id                          SERIAL PRIMARY KEY,
        tenant_id                   INTEGER NOT NULL REFERENCES farmops_tenants(id) ON DELETE CASCADE,
        addon_type                  farmops_addon_type NOT NULL,
        quantity                    INTEGER NOT NULL DEFAULT 1,
        stripe_subscription_item_id TEXT,
        created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, addon_type)
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS farmops_users (
        id                    SERIAL PRIMARY KEY,
        tenant_id             INTEGER NOT NULL REFERENCES farmops_tenants(id) ON DELETE CASCADE,
        email                 TEXT NOT NULL,
        password_hash         TEXT,
        name                  TEXT NOT NULL,
        role                  farmops_user_role NOT NULL DEFAULT 'member',
        email_verified        BOOLEAN NOT NULL DEFAULT FALSE,
        verification_token    TEXT,
        reset_token           TEXT,
        reset_token_expires_at TIMESTAMPTZ,
        last_login_at         TIMESTAMPTZ,
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, email)
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS farmops_invitations (
        id                  SERIAL PRIMARY KEY,
        tenant_id           INTEGER NOT NULL REFERENCES farmops_tenants(id) ON DELETE CASCADE,
        email               TEXT NOT NULL,
        role                farmops_user_role NOT NULL DEFAULT 'member',
        token               TEXT NOT NULL UNIQUE,
        invited_by_user_id  INTEGER REFERENCES farmops_users(id) ON DELETE SET NULL,
        accepted_at         TIMESTAMPTZ,
        expires_at          TIMESTAMPTZ NOT NULL,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── Indexes ──────────────────────────────────────────────────────────────

    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_farmops_users_tenant ON farmops_users (tenant_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_farmops_users_email ON farmops_users (email)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_farmops_tenants_stripe_customer ON farmops_tenants (stripe_customer_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_farmops_tenants_stripe_sub ON farmops_tenants (stripe_subscription_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_farmops_addons_tenant ON farmops_subscription_addons (tenant_id)`);

    // ── Seed Jack Pine Farm's own tenant record (id=1) ───────────────────────
    // This represents the farm itself using FarmOps. Existing flocks/animals/
    // expenses rows will be backfilled to this tenant below.

    await db.execute(sql`
      INSERT INTO farmops_tenants (id, slug, name, owner_email, status, plan)
      VALUES (1, 'jack-pine-farm', 'Jack Pine Farm', 'hello@jackpinefarms.farm', 'active', 'pro')
      ON CONFLICT (id) DO NOTHING
    `);

    // Reset sequence so new tenants start at 2
    await db.execute(sql`
      SELECT setval('farmops_tenants_id_seq', GREATEST((SELECT MAX(id) FROM farmops_tenants), 1))
    `);

    // ── Add tenant_id to FarmOps-managed tables ───────────────────────────────
    // Added as nullable; existing rows are backfilled to tenant 1 (Jack Pine Farm).

    for (const stmt of [
      `ALTER TABLE flocks              ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES farmops_tenants(id)`,
      `ALTER TABLE animals             ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES farmops_tenants(id)`,
      `ALTER TABLE egg_types           ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES farmops_tenants(id)`,
      `ALTER TABLE egg_inventory_lots  ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES farmops_tenants(id)`,
      `ALTER TABLE expenses            ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES farmops_tenants(id)`,
    ]) {
      await db.execute(sql.raw(stmt));
    }

    // Backfill: assign all unowned rows to the Jack Pine Farm tenant
    for (const table of ["flocks", "animals", "egg_types", "egg_inventory_lots", "expenses"]) {
      await db.execute(sql.raw(`UPDATE ${table} SET tenant_id = 1 WHERE tenant_id IS NULL`));
    }

    // ── Tenant-scoped indexes ─────────────────────────────────────────────────
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_flocks_tenant             ON flocks             (tenant_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_animals_tenant            ON animals            (tenant_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_egg_types_tenant          ON egg_types          (tenant_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_egg_inventory_lots_tenant ON egg_inventory_lots (tenant_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_expenses_tenant           ON expenses           (tenant_id)`);

    // ── Platform admins ───────────────────────────────────────────────────────
    // Replaces the shared ADMIN_PASSWORD env-var credential with a real user row.
    // The seed only runs once (ON CONFLICT DO NOTHING).
    // ADMIN_PASSWORD is bcrypt-hashed here — the raw value is never stored.

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS platform_admins (
        id              SERIAL PRIMARY KEY,
        email           TEXT NOT NULL UNIQUE,
        name            TEXT NOT NULL,
        password_hash   TEXT NOT NULL,
        is_active       BOOLEAN NOT NULL DEFAULT TRUE,
        last_login_at   TIMESTAMPTZ,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const rawAdminPassword = process.env.ADMIN_PASSWORD;
    if (rawAdminPassword) {
      const hash = await bcrypt.hash(rawAdminPassword, 12);
      await db.execute(sql`
        INSERT INTO platform_admins (email, name, password_hash)
        VALUES ('admin@jackpinefarms.farm', 'Jack Pine Admin', ${hash})
        ON CONFLICT (email) DO NOTHING
      `);
      logger.info("Platform admin seed: row ensured for admin@jackpinefarms.farm");
    } else {
      logger.warn("ADMIN_PASSWORD not set — platform_admins table seeded empty. Set the env var and restart to create the first admin.");
    }

    logger.info("Startup migrations complete.");
  } catch (err) {
    logger.error({ err }, "Startup migration failed — server will still start");
  }
}
