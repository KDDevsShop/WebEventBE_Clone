import { PrismaClient } from '@prisma/client';
import {
  validateNumber,
  validateString,
  parseAndValidateId,
  createValidationResult,
  validatePagination,
} from '../utils/validation.js';
import { createNotification } from '../utils/notification.js';

const prisma = new PrismaClient();

// ===== Helper Functions =====
const handleError = (context, error) => {
  console.error(`Error in ${context}:`, error);
  return createValidationResult(false, [error.message]);
};

export const validateEventServiceData = (serviceData) => {
  const errors = [];
  console.log('serviceData', serviceData);

  // Required fields validation
  const quantityValidation = validateNumber(serviceData.quantity, 'Quantity', {
    min: 1,
    integer: true,
  });
  const serviceIdValidation = parseAndValidateId(
    serviceData.service_id,
    'Service ID'
  );

  console.log('serviceIdValidation', serviceIdValidation);

  errors.push(...quantityValidation.errors);
  if (typeof serviceIdValidation !== 'number')
    errors.push('Invalid service ID');

  // Optional fields validation
  if (serviceData.event_id) {
    const eventIdValidation = parseAndValidateId(
      serviceData.event_id,
      'Event ID'
    );
    if (typeof eventIdValidation !== 'number') errors.push('Invalid event ID');
  }

  if (serviceData.variation_id) {
    const variationIdValidation = parseAndValidateId(
      serviceData.variation_id,
      'Variation ID'
    );
    if (typeof variationIdValidation !== 'number')
      errors.push('Invalid variation ID');
  }

  if (serviceData.custom_price) {
    const priceValidation = validateNumber(
      serviceData.custom_price,
      'Custom price',
      {
        min: 0,
      }
    );
    errors.push(...priceValidation.errors);
  }

  if (serviceData.notes) {
    const notesValidation = validateString(serviceData.notes, 'Notes', {
      maxLength: 1000,
      sanitize: true,
    });
    errors.push(...notesValidation.errors);
  }

  if (serviceData.status) {
    const validStatuses = ['CONFIRMED', 'PENDING', 'CANCELLED'];
    if (!validStatuses.includes(serviceData.status)) {
      errors.push('Invalid event service status');
    }
  }

  return errors;
};

// ===== Check Variation Availability =====
export const checkVariationAvailability = async (
  variation_id,
  scheduled_time,
  duration_hours,
  tx = prisma
) => {
  try {
    // Validate inputs
    if (!variation_id || !scheduled_time || !duration_hours) {
      return createValidationResult(false, [
        'Variation ID, scheduled time, and duration are required',
      ]);
    }

    const requestedStart = new Date(scheduled_time);
    const requestedEnd = new Date(
      requestedStart.getTime() + duration_hours * 3600 * 1000
    );

    // Check if variation exists and is active
    const variation = await tx.variation.findUnique({
      where: { variation_id: Number(variation_id) },
      select: { variation_id: true, is_active: true },
    });

    if (!variation || !variation.is_active) {
      return createValidationResult(false, ['Variation not found or inactive']);
    }

    // Find all confirmed event services for this variation that might overlap
    const candidates = await tx.eventService.findMany({
      where: {
        variation_id: Number(variation_id),
        status: 'CONFIRMED',
        scheduled_time: {
          lte: requestedEnd, // Existing booking starts before requested end
        },
      },
      select: {
        event_service_id: true,
        scheduled_time: true,
        duration_hours: true,
      },
    });

    // Check for overlap in JS
    const conflictingEvents = candidates.filter((ev) => {
      const evStart = new Date(ev.scheduled_time);
      const evEnd = new Date(
        evStart.getTime() + (ev.duration_hours || 0) * 3600 * 1000
      );
      // Overlap if requestedStart < evEnd && requestedEnd > evStart
      return requestedStart < evEnd && requestedEnd > evStart;
    });

    if (conflictingEvents.length > 0) {
      return createValidationResult(
        false,
        ['Variation is busy during the requested time slot'],
        {
          conflictingEvents,
        }
      );
    }

    return createValidationResult(true, [], { variation_id });
  } catch (error) {
    console.error('Error in checkVariationAvailability:', error);
    return createValidationResult(false, [error.message]);
  }
};

// ===== Create Event Service =====
export const createEventService = async (serviceData, user = null) => {
  try {
    const {
      event_id,
      service_id,
      variation_id,
      quantity = 1,
      custom_price,
      notes,
      status = 'CONFIRMED',
      scheduled_time,
      duration_hours,
    } = serviceData;

    // Validate data
    const validationErrors = validateEventServiceData(serviceData);
    if (validationErrors.length > 0) {
      return createValidationResult(false, validationErrors);
    }

    // Validate references
    const event = await prisma.event.findUnique({
      where: { event_id: Number(event_id) },
      select: { event_id: true, status: true, account_id: true },
    });
    if (!event || event.status === 'CANCELLED') {
      return createValidationResult(false, ['Event not found or cancelled']);
    }

    const service = await prisma.service.findUnique({
      where: { service_id: Number(service_id) },
      select: { service_id: true, is_active: true },
    });
    if (!service || !service.is_active) {
      return createValidationResult(false, ['Service not found or inactive']);
    }

    if (variation_id) {
      const variation = await prisma.variation.findUnique({
        where: { variation_id: Number(variation_id) },
        select: { variation_id: true, is_active: true, service_id: true },
      });
      if (
        !variation ||
        !variation.is_active ||
        variation.service_id !== Number(service_id)
      ) {
        return createValidationResult(false, [
          'Variation not found, inactive, or does not belong to the specified service',
        ]);
      }

      // Check availability if scheduled_time and duration_hours are provided
      if (scheduled_time && duration_hours) {
        const availabilityCheck = await checkVariationAvailability(
          variation_id,
          scheduled_time,
          duration_hours
        );
        if (!availabilityCheck.isValid) {
          return availabilityCheck;
        }
      }
    }

    const newEventService = await prisma.eventService.create({
      data: {
        event_id: Number(event_id),
        service_id: Number(service_id),
        variation_id: variation_id ? Number(variation_id) : null,
        quantity: Number(quantity),
        custom_price: custom_price ? Number(custom_price) : null,
        notes: notes?.trim() || null,
        status,
        scheduled_time: scheduled_time ? new Date(scheduled_time) : null,
        duration_hours: duration_hours ? Number(duration_hours) : null,
      },
      include: {
        event: {
          select: { event_id: true, event_name: true, account_id: true },
        },
        service: { select: { service_id: true, service_name: true } },
        variation: { select: { variation_id: true, variation_name: true } },
      },
    });

    // Notification logic: send notification to user if booking is successful
    if (user && user.account_id) {
      await createNotification({
        account_id: user.account_id,
        title: 'Service Booked',
        message: `You have booked "${newEventService.service.service_name}" for event "${newEventService.event.event_name}".`,
        type: 'CONFIRMATION',
      });
    }

    return createValidationResult(true, [], newEventService);
  } catch (error) {
    return handleError('createEventService', error);
  }
};

// ===== Update Event Service =====
export const updateEventService = async (eventServiceId, updateData) => {
  try {
    const validEventServiceId = parseAndValidateId(
      eventServiceId,
      'Event Service ID'
    );

    // Check if event service exists
    const existingEventService = await prisma.eventService.findUnique({
      where: { event_service_id: validEventServiceId },
    });

    if (!existingEventService) {
      return createValidationResult(false, ['Event service not found']);
    }

    // Validate update data
    const validationErrors = validateEventServiceData(updateData);
    if (validationErrors.length > 0) {
      return createValidationResult(false, validationErrors);
    }

    const {
      event_id,
      service_id,
      variation_id,
      quantity,
      custom_price,
      notes,
      status,
      scheduled_time,
      duration_hours,
    } = updateData;

    // Validate references
    if (event_id && event_id !== existingEventService.event_id) {
      const event = await prisma.event.findUnique({
        where: { event_id: Number(event_id) },
        select: { event_id: true, status: true },
      });
      if (!event || event.status === 'CANCELLED') {
        return createValidationResult(false, ['Event not found or cancelled']);
      }
    }

    if (service_id && service_id !== existingEventService.service_id) {
      const service = await prisma.service.findUnique({
        where: { service_id: Number(service_id) },
        select: { service_id: true, is_active: true },
      });
      if (!service || !service.is_active) {
        return createValidationResult(false, ['Service not found or inactive']);
      }
    }

    if (variation_id && variation_id !== existingEventService.variation_id) {
      const variation = await prisma.variation.findUnique({
        where: { variation_id: Number(variation_id) },
        select: { variation_id: true, is_active: true, service_id: true },
      });
      if (
        !variation ||
        !variation.is_active ||
        variation.service_id !==
          Number(service_id || existingEventService.service_id)
      ) {
        return createValidationResult(false, [
          'Variation not found, inactive, or does not belong to the specified service',
        ]);
      }

      // Check availability if scheduled_time and duration_hours are provided
      if (scheduled_time && duration_hours) {
        const availabilityCheck = await checkVariationAvailability(
          variation_id,
          scheduled_time,
          duration_hours
        );
        if (!availabilityCheck.isValid) {
          return availabilityCheck;
        }
      }
    } else if (variation_id && (scheduled_time || duration_hours)) {
      // Check availability if scheduled_time or duration_hours are updated
      const effectiveScheduledTime =
        scheduled_time || existingEventService.scheduled_time;
      const effectiveDurationHours =
        duration_hours || existingEventService.duration_hours;
      if (effectiveScheduledTime && effectiveDurationHours) {
        const availabilityCheck = await checkVariationAvailability(
          variation_id,
          effectiveScheduledTime,
          effectiveDurationHours
        );
        if (!availabilityCheck.isValid) {
          return availabilityCheck;
        }
      }
    }

    // Prepare update data
    const updateFields = {};
    if (event_id !== undefined) updateFields.event_id = Number(event_id);
    if (service_id !== undefined) updateFields.service_id = Number(service_id);
    if (variation_id !== undefined)
      updateFields.variation_id = variation_id ? Number(variation_id) : null;
    if (quantity !== undefined) updateFields.quantity = Number(quantity);
    if (custom_price !== undefined)
      updateFields.custom_price = custom_price ? Number(custom_price) : null;
    if (notes !== undefined) updateFields.notes = notes?.trim() || null;
    if (status !== undefined) updateFields.status = status;
    if (scheduled_time !== undefined)
      updateFields.scheduled_time = scheduled_time
        ? new Date(scheduled_time)
        : null;
    if (duration_hours !== undefined)
      updateFields.duration_hours = duration_hours
        ? Number(duration_hours)
        : null;

    const updatedEventService = await prisma.eventService.update({
      where: { event_service_id: validEventServiceId },
      data: updateFields,
      include: {
        event: { select: { event_id: true, event_name: true } },
        service: { select: { service_id: true, service_name: true } },
        variation: { select: { variation_id: true, variation_name: true } },
      },
    });

    return createValidationResult(true, [], updatedEventService);
  } catch (error) {
    return handleError('updateEventService', error);
  }
};

// ===== Get All Event Services =====
export const getAllEventServices = async (filters = {}) => {
  try {
    const {
      event_id,
      service_id,
      variation_id,
      status,
      page = 1,
      limit = 20,
      sortBy = 'created_at',
      sortOrder = 'asc',
    } = filters;

    // Validate pagination
    const {
      page: validPage,
      limit: validLimit,
      errors: paginationErrors,
    } = validatePagination(page, limit);
    if (paginationErrors.length > 0) {
      return createValidationResult(false, paginationErrors);
    }

    // Build where clause
    const where = {};
    if (event_id) where.event_id = parseAndValidateId(event_id, 'Event ID');
    if (service_id)
      where.service_id = parseAndValidateId(service_id, 'Service ID');
    if (variation_id)
      where.variation_id = parseAndValidateId(variation_id, 'Variation ID');
    if (status) where.status = status;

    const skip = (validPage - 1) * validLimit;
    const orderBy = { [sortBy]: sortOrder?.toLowerCase() || 'asc' };

    const [eventServices, totalCount] = await Promise.all([
      prisma.eventService.findMany({
        where,
        include: {
          event: { select: { event_id: true, event_name: true } },
          service: { select: { service_id: true, service_name: true } },
          variation: { select: { variation_id: true, variation_name: true } },
        },
        skip,
        take: validLimit,
        orderBy,
      }),
      prisma.eventService.count({ where }),
    ]);

    return createValidationResult(true, [], {
      eventServices,
      pagination: {
        page: validPage,
        limit: validLimit,
        totalCount,
        totalPages: Math.ceil(totalCount / validLimit),
        hasNextPage: validPage < Math.ceil(totalCount / validLimit),
        hasPreviousPage: validPage > 1,
      },
    });
  } catch (error) {
    return handleError('getAllEventServices', error);
  }
};

// ===== Get Event Service by ID =====
export const getEventServiceById = async (eventServiceId) => {
  try {
    const validEventServiceId = parseAndValidateId(
      eventServiceId,
      'Event Service ID'
    );

    const eventService = await prisma.eventService.findUnique({
      where: { event_service_id: validEventServiceId },
      include: {
        event: { select: { event_id: true, event_name: true } },
        service: { select: { service_id: true, service_name: true } },
        variation: { select: { variation_id: true, variation_name: true } },
      },
    });

    if (!eventService) {
      return createValidationResult(false, ['Event service not found']);
    }

    return createValidationResult(true, [], eventService);
  } catch (error) {
    return handleError('getEventServiceById', error);
  }
};

// ===== Delete Event Service =====
export const deleteEventService = async (eventServiceId) => {
  try {
    const validEventServiceId = parseAndValidateId(
      eventServiceId,
      'Event Service ID'
    );

    // Check if event service exists
    const existingEventService = await prisma.eventService.findUnique({
      where: { event_service_id: validEventServiceId },
    });

    if (!existingEventService) {
      return createValidationResult(false, ['Event service not found']);
    }

    await prisma.eventService.delete({
      where: { event_service_id: validEventServiceId },
    });

    return createValidationResult(true, [], {
      event_service_id: validEventServiceId,
    });
  } catch (error) {
    return handleError('deleteEventService', error);
  }
};

export const getEventServiceStats = async (filter = {}) => {
  try {
    // Optional: filter by account_id for user analytics
    let where = {};
    if (filter.account_id) {
      // Join through Event to filter by account_id
      where = {
        event: { account_id: filter.account_id },
      };
    }

    // Aggregate stats
    const [
      totalEventServices,
      confirmedCount,
      pendingCount,
      cancelledCount,
      totalCustomPrice,
      mostPopularService,
    ] = await Promise.all([
      prisma.eventService.count({ where }),
      prisma.eventService.count({ where: { ...where, status: 'CONFIRMED' } }),
      prisma.eventService.count({ where: { ...where, status: 'PENDING' } }),
      prisma.eventService.count({ where: { ...where, status: 'CANCELLED' } }),
      prisma.eventService.aggregate({
        _sum: { custom_price: true },
        where: { ...where, status: 'CONFIRMED' },
      }),
      prisma.eventService.groupBy({
        by: ['service_id'],
        _count: { service_id: true },
        where,
        orderBy: { _count: { service_id: 'desc' } },
        take: 1,
      }),
    ]);

    // Get service name for most popular service
    let popularService = null;
    if (mostPopularService.length > 0) {
      const service = await prisma.service.findUnique({
        where: { service_id: mostPopularService[0].service_id },
        select: { service_id: true, service_name: true },
      });
      popularService = {
        service_id: service.service_id,
        service_name: service.service_name,
        count: mostPopularService[0]._count.service_id,
      };
    }

    return {
      totalEventServices,
      confirmedCount,
      pendingCount,
      cancelledCount,
      totalCustomPrice: totalCustomPrice._sum.custom_price || 0,
      mostPopularService: popularService,
    };
  } catch (error) {
    console.error('Error in getEventServiceStats:', error);
    throw error;
  }
};
