// routes/dashboardRoutes.js
import express from "express";
import { getAdminDashboard, getUserDashboard } from "../controller/dashboardController.js";
import { validateToken, validateAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/admin", validateToken, validateAdmin, getAdminDashboard);
router.get("/user", validateToken, getUserDashboard);

export default router;