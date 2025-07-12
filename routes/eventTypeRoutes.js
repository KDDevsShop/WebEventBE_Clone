import express from "express";
import {
    createEventTypeController,
    updateEventTypeController,
    getAllEventTypesController,
    getEventTypeByIdController,
    deleteEventTypeController
} from "../controller/eventTypeController.js";
import { validateAdmin, validateToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public routes
router.get("/", getAllEventTypesController);
router.get("/:id", getEventTypeByIdController);

// Admin routes
router.post("/", validateToken, validateAdmin, createEventTypeController);
router.delete("/:id", validateToken, validateAdmin, deleteEventTypeController);
router.put("/:id", validateToken, validateAdmin, updateEventTypeController);
export default router;