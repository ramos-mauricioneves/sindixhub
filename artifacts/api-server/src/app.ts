import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";
import { ensureBypassUser } from "./middlewares/requireAuth";

const AUTH_BYPASS = process.env.AUTH_BYPASS === "true";
const BYPASS_CLERK_ID = "bypass-admin";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

if (!AUTH_BYPASS) {
  app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
}

app.use(cors({ credentials: true, origin: true }));

if (AUTH_BYPASS) {
  logger.info("Auth bypass mode enabled — Clerk is disabled");
  ensureBypassUser().catch((e) => logger.error(e, "Failed to ensure bypass user"));
  app.use((req, _res, next) => {
    (req as any).auth = {
      userId: BYPASS_CLERK_ID,
      sessionClaims: { email: "admin@local.dev", name: "Administrador" },
    };
    next();
  });
} else {
  app.use(clerkMiddleware());
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
