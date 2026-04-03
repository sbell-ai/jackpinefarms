import "express-session";

interface SessionCartItem {
  productId: number;
  quantity: number;
  addGiblets: boolean;
}

declare module "express-session" {
  interface SessionData {
    // Jack Pine Farm storefront
    admin?: boolean;
    customerId?: number;
    cart?: SessionCartItem[];
    appliedCouponCode?: string | null;
    // FarmOps SaaS
    farmopsUserId?: number;
    farmopsTenantId?: number;
  }
}
