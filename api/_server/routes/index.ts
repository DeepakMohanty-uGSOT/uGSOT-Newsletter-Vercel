import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import employeesRouter from "./employees.js";
import newslettersRouter from "./newsletters.js";
import emailLogsRouter from "./emailLogs.js";
import dashboardRouter from "./dashboard.js";
import adminsRouter from "./admins.js";
import themesRouter from "./themes.js";
import auditLogsRouter from "./auditLogs.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(employeesRouter);
router.use(newslettersRouter);
router.use(emailLogsRouter);
router.use(dashboardRouter);
router.use(adminsRouter);
router.use(themesRouter);
router.use(auditLogsRouter);

export default router;
