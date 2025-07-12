import express from "express";
import { getAnalytics } from "../controller/analyticsController.js";
import { validateToken, validateAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// Admin analytics endpoint (only admin can access)
router.get("/admin", validateToken, validateAdmin, getAnalytics);


// import { getUserAnalytics } from "../controller/analyticsController.js";
// router.get("/user", validateToken, getUserAnalytics);

export default router;