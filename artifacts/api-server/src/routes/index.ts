import { Hono } from "hono";
import type { AppEnv } from "../types";
import healthRouter from "./health";
import reportRouter from "./report";
import usersRouter from "./users";
import inspectionsRouter from "./inspections";
import condominiosRouter from "./condominios";
import assetsRouter from "./assets";
import publicAssetsRouter from "./public-assets";
import dashboardRouter from "./dashboard";
import assembleiasRouter from "./assembleias";

const router = new Hono<AppEnv>();

router.route("/", healthRouter);
router.route("/", reportRouter);
router.route("/", usersRouter);
router.route("/", inspectionsRouter);
router.route("/", condominiosRouter);
router.route("/", publicAssetsRouter);
router.route("/", assetsRouter);
router.route("/", dashboardRouter);
router.route("/", assembleiasRouter);

export default router;
