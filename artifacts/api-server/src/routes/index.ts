import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import productsRouter from "./products.js";
import adminRouter from "./admin.js";
import authRouter from "./auth.js";
import cartRouter from "./cart.js";
import checkoutRouter from "./checkout.js";
import ordersRouter from "./orders.js";
import adminOrdersRouter from "./admin-orders.js";
import webhooksRouter from "./webhooks.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(productsRouter);
router.use(adminRouter);
router.use(authRouter);
router.use(cartRouter);
router.use(checkoutRouter);
router.use(ordersRouter);
router.use(adminOrdersRouter);
router.use(webhooksRouter);

export default router;
