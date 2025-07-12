import {
    createEvent,
    updateEvent,
    getAllEvents,
    getEventById,
    deleteEvent,
    toggleEventStatus,
    getEventsByEventTypeId
} from "../service/event.service.js";
import { sendResponse } from "../utils/response.js";
import { createValidationResult } from "../utils/validation.js";
import { validateToken } from "../middleware/authMiddleware.js";

// Create a new event
export const createEventController = async (req, res) => {
  try {
    const eventData = req.body;
    // Attach user info if available (for notification)
    if (req.user && req.user.account_id && !eventData.account_id) {
      eventData.account_id = req.user.account_id;
    }
    const result = await createEvent(eventData);

    if (!result.isValid) {
      return sendResponse(res, 400, result.errors);
    }

    return sendResponse(res, 201, "Event created successfully", result.data);
  } catch (error) {
    console.error("Error in createEvent controller:", error);
    return sendResponse(res, 500, "Internal server error");
  }
};

// Update an existing event
export const updateEventController = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    // Attach user info if available (for ownership/time check)
    const user = req.user || null;
    const result = await updateEvent(id, updateData, user);

    if (!result.isValid) {
      return sendResponse(res, 400, result.errors);
    }

    return sendResponse(res, 200, "Event updated successfully", result.data);
  } catch (error) {
    console.error("Error in updateEvent controller:", error);
    return sendResponse(res, 500, "Internal server error");
  }
};

// Get all events with filters
export const getAllEventsController = async (req, res) => {
  try {
    const filters = {
      account_id: req.query.account_id,
      room_id: req.query.room_id,
      event_type_id: req.query.event_type_id,
      status: req.query.status,
      dateMin: req.query.dateMin,
      dateMax: req.query.dateMax,
      search: req.query.search,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      sortBy: req.query.sortBy || "date_create",
      sortOrder: req.query.sortOrder || "asc",
      includeAccount: req.query.includeAccount === "true",
      includeRoom: req.query.includeRoom === "true",
      includeEventType: req.query.includeEventType === "true",
      includeEventServices: req.query.includeEventServices === "true",
    };

    const result = await getAllEvents(filters);

    if (!result.isValid) {
      return sendResponse(res, 400, result.errors);
    }

    return sendResponse(
      res,
      200,
      "Events retrieved successfully",
      result.data.events,
      result.data.pagination
    );
  } catch (error) {
    console.error("Error in getAllEvents controller:", error);
    return sendResponse(res, 500, "Internal server error");
  }
};

// Get event by ID
export const getEventByIdController = async (req, res) => {
  try {
    const { id } = req.params;
    const options = {
      includeAccount: req.query.includeAccount === "true",
      includeRoom: req.query.includeRoom === "true",
      includeEventType: req.query.includeEventType === "true",
      includeEventServices: req.query.includeEventServices === "true",
    };

    const result = await getEventById(id, options);

    if (!result.isValid) {
      return sendResponse(res, 404, result.errors);
    }

    return sendResponse(res, 200, "Event retrieved successfully", result.data);
  } catch (error) {
    console.error("Error in getEventById controller:", error);
    return sendResponse(res, 500, "Internal server error");
  }
};

// Delete an event
export const deleteEventController = async (req, res) => {
  try {
    const { id } = req.params;
    const options = {
      forceDelete: req.query.forceDelete === "true",
    };

    const result = await deleteEvent(id, options);

    if (!result.isValid) {
      return sendResponse(res, 400, result.errors);
    }

    return sendResponse(res, 200, "Event deleted successfully", result.data);
  } catch (error) {
    console.error("Error in deleteEvent controller:", error);
    return sendResponse(res, 500, "Internal server error");
  }
};

// Toggle event status (PENDING <-> CONFIRMED)
export const toggleEventStatusController = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await toggleEventStatus(id);

    if (!result.isValid) {
      return sendResponse(res, 404, result.errors);
    }

    return sendResponse(res, 200, "Event status toggled", result.data);
  } catch (error) {
    console.error("Error in toggleEventStatus controller:", error);
    return sendResponse(res, 500, "Internal server error");
  }
};

// Get events by event type ID
export const getEventsByEventTypeIdController = async (req, res) => {
  try {
    const { eventTypeId } = req.params;
    const options = {
      includeAccount: req.query.includeAccount === "true",
      includeRoom: req.query.includeRoom === "true",
      sortBy: req.query.sortBy || "event_date",
      sortOrder: req.query.sortOrder || "asc",
    };

    const result = await getEventsByEventTypeId(eventTypeId, options);

    if (!result.isValid) {
      return sendResponse(res, 400, result.errors);
    }

    return sendResponse(
      res,
      200,
      "Events by event type retrieved successfully",
      result.data.events,
      { totalCount: result.data.totalCount }
    );
  } catch (error) {
    console.error("Error in getEventsByEventTypeId controller:", error);
    return sendResponse(res, 500, "Internal server error");
  }
};

// Get event details (only owner or admin/staff)
export const getEventDetails = [validateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await getEventById(id);

    if (
      result.isValid &&
      result.data &&
      result.data.account_id !== req.user.account_id &&
      !["ADMIN", "STAFF"].includes(req.user.role)
    ) {
      return res.status(403).json(createValidationResult(false, ["Unauthorized: Cannot access this event"]));
    }

    return res.status(result.isValid ? 200 : 404).json(result);
  } catch (error) {
    console.error("Error in getEventDetails:", error);
    return res.status(500).json(createValidationResult(false, ["Error retrieving event", error.message]));
  }
}];