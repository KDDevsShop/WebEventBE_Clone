import express from 'express';
import {
  createEventController,
  updateEventController,
  deleteEventController,
  getAllEventsController,
  getEventByIdController,
  getEventsByEventTypeIdController,
  toggleEventStatusController,
  getEventDetails,
} from '../controller/eventController.js';
import { validateAdmin, validateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Create a new event (authenticated users)
router.post('/', validateToken, createEventController);

// Update an event (authenticated users)
router.put('/:id', validateToken, updateEventController);

// Get all events with filters (public or authenticated)
router.get('/', getAllEventsController);

// Get events by event type ID (public or authenticated)
router.get('/event-types/:eventTypeId', getEventsByEventTypeIdController);

// Get event details (authenticated users only, with role check)
router.get('/:id/details', validateToken, getEventDetails);

// Get event by ID (public or authenticated)
router.get('/:id', getEventByIdController);

// Delete an event (admin only)
router.delete('/:id', validateToken, validateAdmin, deleteEventController);

// Toggle event status (admin only)
router.patch(
  '/:id/toggle-status',
  validateToken,
  validateAdmin,
  toggleEventStatusController
);

export default router;
