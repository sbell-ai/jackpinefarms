import "express-session";
import type { FarmopsTenant, FarmopsUser } from "@workspace/db";

interface SessionCartItem {
  productId: number;
  quantity: number;
  addGiblets: boolean;
}

interface PlatformAdminRecord {
  id: number;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  mustChangePassword: boolean;
}

declare global {
  namespace Express {
    interface Request {
      farmopsTenant?: FarmopsTenant;
      farmopsUser?: FarmopsUser;
      platformAdmin?: PlatformAdminRecord;
      storeTenant?: FarmopsTenant;
    }
  }
}

declare module "express-session" {
  interface SessionData {
    // Jack Pine Farm storefront
    admin?: boolean;
    platformAdminId?: number;
    customerId?: number;
    cart?: SessionCartItem[];
    appliedCouponCode?: string | null;
    // FarmOps SaaS
    farmopsUserId?: number;
    farmopsTenantId?: number;
  }
}
