import { Router } from "express";
import { db, farmopsTenantsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";

const router = Router();

// Public — returns only the fields the storefront UI needs.
// Used by StoreTenantProvider to validate the slug on mount.
router.get("/storefront/:slug", async (req, res): Promise<void> => {
  const { slug } = req.params;
  const [tenant] = await db
    .select({
      id: farmopsTenantsTable.id,
      slug: farmopsTenantsTable.slug,
      name: farmopsTenantsTable.name,
      storefrontEnabled: farmopsTenantsTable.storefrontEnabled,
    })
    .from(farmopsTenantsTable)
    .where(
      and(
        eq(farmopsTenantsTable.slug, slug),
        eq(farmopsTenantsTable.storefrontEnabled, true)
      )
    )
    .limit(1);

  if (!tenant) {
    res.status(404).json({ error: "Storefront not found" });
    return;
  }

  res.json({ id: tenant.id, slug: tenant.slug, name: tenant.name });
});

export default router;
