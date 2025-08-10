// filepath: e:\EventPlanner-BE\routes\event_serviceRoutes.js

import express from "express";
import {
  createEventServiceController,
  updateEventServiceController,
  getAllEventServicesController,
  getEventServiceByIdController,
  deleteEventServiceController,
  getEventServiceStatsController,
  checkVariationAvailabilityController,
  getEventServicesByEventIdController,
  getUserEventServicesController
} from "../controller/event_serviceController.js";
import { validateToken, validateStaffOrAdmin, validateUser } from "../middleware/authMiddleware.js";

const router = express.Router();

// ===== Event Service Routes =====

// POST /api/event-services - Create a new event service (customers can book services)
router.post("/", validateToken, createEventServiceController);

// GET /api/event-services - Get all event services with optional filters (staff/admin can see all)
router.get("/", validateToken, getAllEventServicesController);

// GET /api/event-services/stats - Get event service statistics (staff/admin only)
router.get("/stats", validateStaffOrAdmin, getEventServiceStatsController);

// GET /api/event-services/my-services - Get current user's event services
router.get("/my-services", validateToken, getUserEventServicesController);

// POST /api/event-services/check-availability - Check variation availability
router.post("/check-availability", validateToken, checkVariationAvailabilityController);

// GET /api/event-services/event/:eventId - Get all event services for a specific event
router.get("/event/:eventId", validateToken, getEventServicesByEventIdController);

// GET /api/event-services/:id - Get event service by ID
router.get("/:id", validateToken, getEventServiceByIdController);

// PUT /api/event-services/:id - Update event service (staff/admin can update any, customers can update their own)
router.put("/:id", validateToken, updateEventServiceController);

// DELETE /api/event-services/:id - Delete event service (staff/admin can delete any, customers can delete their own)
router.delete("/:id", validateToken, deleteEventServiceController);

export default router;