import cookieParser from "cookie-parser";
import express from "express";
import { pinoHttp } from "pino-http";
import { logger } from "./lib/logger.js";
import { optionalAuth } from "./middleware/auth.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { globalLimiter } from "./middleware/rate-limit.js";
import { corsPolicy, csrfGuard, securityHeaders } from "./middleware/security.js";
import { UPLOAD_DIR } from "./lib/uploads.js";
import { accountRouter } from "./modules/account/account.routes.js";
import { adminRouter } from "./modules/admin/admin.routes.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { adminOrdersRouter, ordersRouter } from "./modules/orders/orders.routes.js";
import { adminProductsRouter } from "./modules/products/admin-products.routes.js";
import { productsRouter } from "./modules/products/products.routes.js";
import { adminReviewsRouter, reviewsRouter } from "./modules/reviews/reviews.routes.js";
import { shopRouter } from "./modules/shop/shop.routes.js";
import { adminRentalsRouter } from "./modules/rentals/rentals.routes.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1); // behind Nginx (prod) or the Next.js rewrite (dev): use the first X-Forwarded-For hop
  app.set("query parser", "simple"); // no nested objects from query strings (prevents parameter-pollution tricks)

  // Uploaded photos. Production: Nginx serves /uploads directly (deploy/nginx-seamwell.conf); this covers dev.
  // Only our re-encoded .webp/.jpg files, never executed, nosniff + a CSP that allows nothing.
  app.use(
    "/uploads",
    (req, res, next) => (/^\/[0-9a-f-]{36}\.(webp|jpg)$/.test(req.path) ? next() : res.status(404).end()),
    express.static(UPLOAD_DIR, {
      index: false,
      dotfiles: "deny",
      maxAge: "30d",
      immutable: true,
      setHeaders: (res) => {
        res.set("X-Content-Type-Options", "nosniff");
        res.set("Content-Security-Policy", "default-src 'none'");
        res.set("Cross-Origin-Resource-Policy", "same-site");
      },
    }),
    (_req: express.Request, res: express.Response) => res.status(404).end(), // deleted / never existed
  );
  app.use(securityHeaders);
  app.use(corsPolicy);
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === "/api/health" } }));
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());
  app.use(globalLimiter);
  app.use(csrfGuard);
  app.use(optionalAuth);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });
  app.use("/api/auth", authRouter);
  app.use("/api/products", productsRouter);
  app.use("/api/orders", ordersRouter);
  app.use("/api/account", accountRouter);
  app.use("/api/reviews", reviewsRouter);
  app.use("/api/shop", shopRouter);
  app.use("/api/admin/orders", adminOrdersRouter);
  app.use("/api/admin/reviews", adminReviewsRouter);
  app.use("/api/admin/products", adminProductsRouter);
  app.use("/api/admin/rentals", adminRentalsRouter);
  app.use("/api/admin", adminRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
