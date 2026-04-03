import "express-session";
import type { FarmopsTenant, FarmopsUser } from "@workspace/db";

interface SessionCartItem {
  productId: number;
  quantity: number;
  addGiblets: boolean;
}

declare global {
  namespace Express {
    interface Request {
      farmopsTenant?: FarmopsTenant;
      farmopsUser?: FarmopsUser;
    }
  }
}

declare module "express-session" {
  interface SessionData {
    // Jack Pine Farm storefront
    platformAdminId?: number;
    customerId?: number;
    cart?: SessionCartItem[];
    appliedCouponCode?: string | null;
    // FarmOps SaaS
    farmopsUserId?: number;
    farmopsTenantId?: number;
  }
}
