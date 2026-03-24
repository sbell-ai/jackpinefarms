import "express-session";

interface SessionCartItem {
  productId: number;
  quantity: number;
  addGiblets: boolean;
}

declare module "express-session" {
  interface SessionData {
    admin?: boolean;
    customerId?: number;
    cart?: SessionCartItem[];
  }
}
