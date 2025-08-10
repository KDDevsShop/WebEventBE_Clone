import {
  createEvent,
  updateEvent,
  getAllEvents,
  getEventById,
  deleteEvent,
  toggleEventStatus,
  getEventsByEventTypeId,
} from '../service/event.service.js';
import { sendResponse } from '../utils/response.js';
import { createValidationResult } from '../utils/validation.js';
import { validateToken } from '../middleware/authMiddleware.js';
import { prisma } from '../prisma/prisma.js';
import { checkVariationAvailability } from '../service/event_service.service.js';

// Create a new event
export const createEventController = async (req, res) => {
  const eventData = req.body;
  const eventServices = eventData.service_variants || [];

  if (req.user?.account_id && !eventData.account_id) {
    eventData.account_id = req.user.account_id;
  }

  try {
    const result = await createEvent(eventData);

    if (!result.isValid) {
      return sendResponse(res, 400, result.errors);
    }

    const newEvent = result.data;
    let createdServicesCount = 0;

    // Create EventServices (with validation + invoice details)
    if (eventServices.length > 0) {
      await prisma.$transaction(async (tx) => {
        for (const { service_id, variant_id } of eventServices) {
          // Validate service
          const dbService = await tx.service.findUnique({
            where: { service_id: Number(service_id) },
            select: { service_id: true, is_active: true },
          });
          if (!dbService || !dbService.is_active) continue;

          // Validate variant
          const variation = await tx.variation.findUnique({
            where: { variation_id: Number(variant_id) },
            select: {
              variation_id: true,
              is_active: true,
              service_id: true,
              base_price: true,
              variation_name: true,
            },
          });
          if (
            !variation ||
            !variation.is_active ||
            variation.service_id !== Number(service_id)
          )
            continue;

          // Check variation availability
          if (newEvent.scheduled_time && newEvent.duration_hours) {
            const availabilityCheck = await checkVariationAvailability(
              variant_id,
              newEvent.scheduled_time,
              newEvent.duration_hours,
              tx
            );
            if (!availabilityCheck.isValid) continue;
          }

          // Create EventService
          await tx.eventService.create({
            data: {
              event_id: newEvent.event_id,
              service_id: Number(service_id),
              variation_id: Number(variant_id),
              quantity: 1,
              custom_price: null,
              status: 'CONFIRMED',
              scheduled_time: newEvent.scheduled_time,
              duration_hours: newEvent.duration_hours,
            },
          });

          // Create InvoiceDetail for service
          await tx.invoiceDetail.create({
            data: {
              invoice_id: (
                await tx.invoice.findFirst({
                  where: { event_id: newEvent.event_id },
                })
              ).invoice_id,
              item_name: variation.variation_name,
              quantity: 1,
              unit_price: variation.base_price || 0,
              subtotal: variation.base_price || 0,
              item_type: 'SERVICE',
              service_id: Number(service_id),
              variation_id: Number(variant_id),
            },
          });

          createdServicesCount++;
        }

        // Update estimated cost with services
        if (createdServicesCount > 0) {
          const totalServiceCost = await tx.invoiceDetail.aggregate({
            where: {
              item_type: 'SERVICE',
              invoice: { event_id: newEvent.event_id },
            },
            _sum: { subtotal: true },
          });

          await tx.event.update({
            where: { event_id: newEvent.event_id },
            data: {
              estimated_cost:
                Number(newEvent.estimated_cost) +
                Number(totalServiceCost._sum.subtotal || 0),
            },
          });
        }
      });
    }

    return sendResponse(res, 201, 'Event created successfully', {
      ...newEvent,
      eventServicesCount: createdServicesCount,
    });
  } catch (error) {
    console.error('Error in createEventController:', error);
    return sendResponse(res, 500, 'Internal server error');
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

    return sendResponse(res, 200, 'Event updated successfully', result.data);
  } catch (error) {
    console.error('Error in updateEvent controller:', error);
    return sendResponse(res, 500, 'Internal server error');
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
      sortBy: req.query.sortBy || 'date_create',
      sortOrder: req.query.sortOrder || 'asc',
      includeAccount: req.query.includeAccount === 'true',
      includeRoom: req.query.includeRoom === 'true',
      includeEventType: req.query.includeEventType === 'true',
      includeEventServices: req.query.includeEventServices === 'true',
    };

    const result = await getAllEvents(filters);

    if (!result.isValid) {
      return sendResponse(res, 400, result.errors);
    }

    return sendResponse(
      res,
      200,
      'Events retrieved successfully',
      result.data.events,
      result.data.pagination
    );
  } catch (error) {
    console.error('Error in getAllEvents controller:', error);
    return sendResponse(res, 500, 'Internal server error');
  }
};

// Get event by ID
export const getEventByIdController = async (req, res) => {
  try {
    const { id } = req.params;
    const options = {
      includeAccount: req.query.includeAccount === 'true',
      includeRoom: req.query.includeRoom === 'true',
      includeEventType: req.query.includeEventType === 'true',
      includeEventServices: req.query.includeEventServices === 'true',
    };

    const result = await getEventById(id, options);

    if (!result.isValid) {
      return sendResponse(res, 404, result.errors);
    }

    return sendResponse(res, 200, 'Event retrieved successfully', result.data);
  } catch (error) {
    console.error('Error in getEventById controller:', error);
    return sendResponse(res, 500, 'Internal server error');
  }
};

// Delete an event
export const deleteEventController = async (req, res) => {
  try {
    const { id } = req.params;
    const options = {
      forceDelete: req.query.forceDelete === 'true',
    };

    const result = await deleteEvent(id, options);

    if (!result.isValid) {
      return sendResponse(res, 400, result.errors);
    }

    return sendResponse(res, 200, 'Event deleted successfully', result.data);
  } catch (error) {
    console.error('Error in deleteEvent controller:', error);
    return sendResponse(res, 500, 'Internal server error');
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

    return sendResponse(res, 200, 'Event status toggled', result.data);
  } catch (error) {
    console.error('Error in toggleEventStatus controller:', error);
    return sendResponse(res, 500, 'Internal server error');
  }
};

// Get events by event type ID
export const getEventsByEventTypeIdController = async (req, res) => {
  try {
    const { eventTypeId } = req.params;
    const options = {
      includeAccount: req.query.includeAccount === 'true',
      includeRoom: req.query.includeRoom === 'true',
      sortBy: req.query.sortBy || 'event_date',
      sortOrder: req.query.sortOrder || 'asc',
    };

    const result = await getEventsByEventTypeId(eventTypeId, options);

    if (!result.isValid) {
      return sendResponse(res, 400, result.errors);
    }

    return sendResponse(
      res,
      200,
      'Events by event type retrieved successfully',
      result.data.events,
      { totalCount: result.data.totalCount }
    );
  } catch (error) {
    console.error('Error in getEventsByEventTypeId controller:', error);
    return sendResponse(res, 500, 'Internal server error');
  }
};

// Get event details (only owner or admin/staff)
export const getEventDetails = [
  validateToken,
  async (req, res) => {
    try {
      const { id } = req.params;
      const result = await getEventById(id);

      if (
        result.isValid &&
        result.data &&
        result.data.account_id !== req.user.account_id &&
        !['ADMIN', 'STAFF'].includes(req.user.role)
      ) {
        return res
          .status(403)
          .json(
            createValidationResult(false, [
              'Unauthorized: Cannot access this event',
            ])
          );
      }

      return res.status(result.isValid ? 200 : 404).json(result);
    } catch (error) {
      console.error('Error in getEventDetails:', error);
      return res
        .status(500)
        .json(
          createValidationResult(false, [
            'Error retrieving event',
            error.message,
          ])
        );
    }
  },
];
