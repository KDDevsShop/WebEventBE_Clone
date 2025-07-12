
import {
    getAllNotificationsController,
    markNotificationAsReadController,
} from "../controller/notificationController.js";

import express from "express";
import { validateUser} from "../middleware/authMiddleware.js";
import e from "express";

const router = express.Router();


// Public routes
router.get("/", validateUser, getAllNotificationsController);
// User routes
router.put("/:id/read", validateUser, markNotificationAsReadController);

// 404 handler
router.use((req, res) => {
    res.status(404).json({
        status: 'error',
        message: `Route ${req.method} ${req.originalUrl} not found`
    });
});
 export default router;