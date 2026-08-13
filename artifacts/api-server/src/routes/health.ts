import { Hono } from "hono";
import { HealthCheckResponse } from "@workspace/api-zod";
import type { AppEnv } from "../types";

const router = new Hono<AppEnv>();

router.get("/healthz", (c) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  return c.json(data);
});

export default router;
