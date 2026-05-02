import { Router, type IRouter } from "express";
import healthRouter from "./health";
import promotionsRouter from "./promotions";
import sourcesRouter from "./sources";
import runsRouter from "./runs";

const router: IRouter = Router();

router.use(healthRouter);
router.use(promotionsRouter);
router.use(sourcesRouter);
router.use(runsRouter);

export default router;
