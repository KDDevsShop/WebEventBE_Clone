import {
    createEventType,
    updateEventType,
    getAllEventTypes,
    getEventTypeById,
    deleteEventType
} from "../service/eventType.service.js";
import { sendResponse } from "../utils/response.js";

// Create a new event type
export const createEventTypeController = async (req, res) => {
  try {
    const eventTypeData = req.body;
    const result = await createEventType(eventTypeData);

    if (!result.isValid) {
      return sendResponse(res, 400, result.errors);
    }

    return sendResponse(res, 201, "Event type created successfully", result.data);
  } catch (error) {
    console.error("Error in createEventType controller:", error);
    return sendResponse(res, 500, "Internal server error");
  }
};

// Update an existing event type
export const updateEventTypeController = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const result = await updateEventType(id, updateData);

    if (!result.isValid) {
      return sendResponse(res, 400, result.errors);
    }

    return sendResponse(res, 200, "Event type updated successfully", result.data);
  } catch (error) {
    console.error("Error in updateEventType controller:", error);
    return sendResponse(res, 500, "Internal server error");
  }
};

// Get all event types with filters
export const getAllEventTypesController = async (req, res) => {
  try {
    const filters = {
      search: req.query.search,
      is_active: req.query.is_active === "true" ? true : req.query.is_active === "false" ? false : undefined,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      sortBy: req.query.sortBy || "type_name",
      sortOrder: req.query.sortOrder || "asc",
    };

    const result = await getAllEventTypes(filters);

    if (!result.isValid) {
      return sendResponse(res, 400, result.errors);
    }

    return sendResponse(
      res,
      200,
      "Event types retrieved successfully",
      result.data.eventTypes,
      result.data.pagination
    );
  } catch (error) {
    console.error("Error in getAllEventTypes controller:", error);
    return sendResponse(res, 500, "Internal server error");
  }
};

// Get event type by ID
export const getEventTypeByIdController = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await getEventTypeById(id);

    if (!result.isValid) {
      return sendResponse(res, 404, result.errors);
    }

    return sendResponse(res, 200, "Event type retrieved successfully", result.data);
  } catch (error) {
    console.error("Error in getEventTypeById controller:", error);
    return sendResponse(res, 500, "Internal server error");
  }
};

// Delete an event type
export const deleteEventTypeController = async (req, res) => {
  try {
    const { id } = req.params;
    const options = {
      forceDelete: req.query.forceDelete === "true",
    };

    const result = await deleteEventType(id, options);

    if (!result.isValid) {
      return sendResponse(res, 400, result.errors);
    }

    return sendResponse(res, 200, "Event type deleted successfully", result.data);
  } catch (error) {
    console.error("Error in deleteEventType controller:", error);
    return sendResponse(res, 500, "Internal server error");
  }
};