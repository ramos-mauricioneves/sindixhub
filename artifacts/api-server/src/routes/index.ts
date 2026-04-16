import { Router, type IRouter } from "express";
import healthRouter from "./health";
import reportRouter from "./report";
import usersRouter from "./users";
import inspectionsRouter from "./inspections";

const router: IRouter = Router();

router.use(healthRouter);
router.use(reportRouter);
router.use(usersRouter);
router.use(inspectionsRouter);

export default router;
