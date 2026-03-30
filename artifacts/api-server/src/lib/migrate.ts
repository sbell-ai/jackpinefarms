/**
 * Safe startup migration.
 * Runs entirely with IF NOT EXISTS / DO NOTHING — never drops anything.
 * This ensures every deployment picks up new tables and columns automatically,
 * regardless of whether drizzle-kit push has been run against that database.
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
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

    logger.info("Startup migrations complete.");
  } catch (err) {
    logger.error({ err }, "Startup migration failed — server will still start");
  }
}
