import { Request, Response, NextFunction } from "express";
import { db, farmopsTenantsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";

// DEFAULT_STOREFRONT_TENANT_ID: the tenant that owns the legacy `/` storefront
// (Jack Pine Farm = 1). Set via env var so it can be changed without a deploy.
const DEFAULT_TENANT_ID = Number(process.env.DEFAULT_STOREFRONT_TENANT_ID ?? "1");

export async function resolveStoreTenant(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const slug = req.headers["x-store-slug"] as string | undefined;

  if (!slug) {
    // No slug header → legacy Jack Pine Farm storefront at `/`
    // Resolve to the default tenant so all queries stay scoped.
    const [tenant] = await db
      .select()
      .from(farmopsTenantsTable)
      .where(eq(farmopsTenantsTable.id, DEFAULT_TENANT_ID))
      .limit(1);
    req.storeTenant = tenant ?? undefined;
    return next();
  }

  const [tenant] = await db
    .select()
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

  req.storeTenant = tenant;
  next();
}
