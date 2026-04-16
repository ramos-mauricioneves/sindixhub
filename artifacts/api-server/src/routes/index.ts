import { Router, type IRouter } from "express";
import healthRouter from "./health";
import reportRouter from "./report";
import usersRouter from "./users";
import inspectionsRouter from "./inspections";
import condominiosRouter from "./condominios";
import assetsRouter from "./assets";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(reportRouter);
router.use(usersRouter);
router.use(inspectionsRouter);
router.use(condominiosRouter);
router.use(assetsRouter);
router.use(dashboardRouter);

export default router;
