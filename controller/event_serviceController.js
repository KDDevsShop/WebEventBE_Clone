import {
  createEventService,
  updateEventService,
  getAllEventServices,
  getEventServiceById,
  deleteEventService,
  getEventServiceStats,
  checkVariationAvailability
} from "../service/event_service.service.js";
import { getEventById, getAllEvents } from "../service/event.service.js";

// ===== Create Event Service =====
export const createEventServiceController = async (req, res) => {
  try {
    const result = await createEventService(req.body, req.user);
    
    if (result.isValid) {
      res.status(201).json({
        success: true,
        message: "Event service created successfully",
        data: result.data,
      });
    } else {
      res.status(400).json({
        success: false,
        message: "Failed to create event service",
        errors: result.errors,
        data: result.data || null,
      });
    }
  } catch (error) {
    console.error("Error in createEventServiceController:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      errors: [error.message],
    });
  }
};

// ===== Update Event Service =====
export const updateEventServiceController = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await updateEventService(id, req.body);
    
    if (result.isValid) {
      res.status(200).json({
        success: true,
        message: "Event service updated successfully",
        data: result.data,
      });
    } else {
      res.status(400).json({
        success: false,
        message: "Failed to update event service",
        errors: result.errors,
      });
    }
  } catch (error) {
    console.error("Error in updateEventServiceController:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      errors: [error.message],
    });
  }
};

// ===== Get All Event Services =====
export const getAllEventServicesController = async (req, res) => {
  try {
    const filters = req.query;
    const result = await getAllEventServices(filters);
    
    if (result.isValid) {
      res.status(200).json({
        success: true,
        message: "Event services retrieved successfully",
        data: result.data.eventServices,
        pagination: result.data.pagination,
      });
    } else {
      res.status(400).json({
        success: false,
        message: "Failed to retrieve event services",
        errors: result.errors,
      });
    }
  } catch (error) {
    console.error("Error in getAllEventServicesController:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      errors: [error.message],
    });
  }
};

// ===== Get Event Service by ID =====
export const getEventServiceByIdController = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await getEventServiceById(id);
    
    if (result.isValid) {
      res.status(200).json({
        success: true,
        message: "Event service retrieved successfully",
        data: result.data,
      });
    } else {
      res.status(404).json({
        success: false,
        message: "Event service not found",
        errors: result.errors,
      });
    }
  } catch (error) {
    console.error("Error in getEventServiceByIdController:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      errors: [error.message],
    });
  }
};

// ===== Delete Event Service =====
export const deleteEventServiceController = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await deleteEventService(id);
    
    if (result.isValid) {
      res.status(200).json({
        success: true,
        message: "Event service deleted successfully",
        data: result.data,
      });
    } else {
      res.status(404).json({
        success: false,
        message: "Failed to delete event service",
        errors: result.errors,
      });
    }
  } catch (error) {
    console.error("Error in deleteEventServiceController:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      errors: [error.message],
    });
  }
};

// ===== Get Event Service Stats =====
export const getEventServiceStatsController = async (req, res) => {
  try {
    const filter = req.query;
    const stats = await getEventServiceStats(filter);
    
    res.status(200).json({
      success: true,
      message: "Event service statistics retrieved successfully",
      data: stats,
    });
  } catch (error) {
    console.error("Error in getEventServiceStatsController:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      errors: [error.message],
    });
  }
};

// ===== Check Variation Availability =====
export const checkVariationAvailabilityController = async (req, res) => {
  try {
    const { variation_id, scheduled_time, duration_hours } = req.body;
    const result = await checkVariationAvailability(variation_id, scheduled_time, duration_hours);
    
    if (result.isValid) {
      res.status(200).json({
        success: true,
        message: "Variation is available",
        data: result.data,
      });
    } else {
      res.status(400).json({
        success: false,
        message: "Variation availability check failed",
        errors: result.errors,
        data: result.data || null,
      });
    }
  } catch (error) {
    console.error("Error in checkVariationAvailabilityController:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      errors: [error.message],
    });
  }
};

// ===== Get Event Services by Event ID =====
export const getEventServicesByEventIdController = async (req, res) => {
  try {
    const { eventId } = req.params;
    
    // First check if event exists
    const eventResult = await getEventById(eventId, { includeEventServices: false });
    if (!eventResult.isValid) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
        errors: eventResult.errors,
      });
    }

    // Get event services for this event
    const result = await getAllEventServices({ event_id: eventId });
    
    if (result.isValid) {
      res.status(200).json({
        success: true,
        message: "Event services retrieved successfully",
        data: {
          event: eventResult.data,
          eventServices: result.data.eventServices,
          pagination: result.data.pagination,
        },
      });
    } else {
      res.status(400).json({
        success: false,
        message: "Failed to retrieve event services",
        errors: result.errors,
      });
    }
  } catch (error) {
    console.error("Error in getEventServicesByEventIdController:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      errors: [error.message],
    });
  }
};

// ===== Get User's Event Services =====
export const getUserEventServicesController = async (req, res) => {
  try {
    const userId = req.user.account_id;
    const filters = { ...req.query };

    // Get user's events first, then filter event services
    const userEventsResult = await getAllEvents({ 
      account_id: userId, 
      includeEventServices: false 
    });

    if (!userEventsResult.isValid) {
      return res.status(400).json({
        success: false,
        message: "Failed to retrieve user events",
        errors: userEventsResult.errors,
      });
    }

    // Extract event IDs
    const eventIds = userEventsResult.data.events.map(event => event.event_id);

    if (eventIds.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No event services found",
        data: { eventServices: [], pagination: { totalCount: 0 } },
      });
    }

    // Get all event services for user's events
    const result = await getAllEventServices(filters);
    
    // Filter to only include event services from user's events
    const userEventServices = result.data.eventServices.filter(
      service => eventIds.includes(service.event_id)
    );

    if (result.isValid) {
      res.status(200).json({
        success: true,
        message: "User event services retrieved successfully",
        data: {
          eventServices: userEventServices,
          totalUserEvents: eventIds.length,
        },
      });
    } else {
      res.status(400).json({
        success: false,
        message: "Failed to retrieve event services",
        errors: result.errors,
      });
    }
  } catch (error) {
    console.error("Error in getUserEventServicesController:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      errors: [error.message],
    });
  }
};