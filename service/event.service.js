import { PrismaClient } from "@prisma/client";
import {
  validateString,
  validateNumber,
  validateDateRange,
  validateBoolean,
  validatePagination,
  parseAndValidateId,
  createValidationResult,
  VALIDATION_CONFIG,
} from "../utils/validation.js";
import { checkRoomAvailability } from "./room.service.js";
import { validateEventServiceData } from "./event_service.service.js";
import { createNotification } from "../utils/notification.js";

const prisma = new PrismaClient();

// ===== Helper Functions =====
const handleError = (context, error) => {
  console.error(`Error in ${context}:`, error);
  return createValidationResult(false, [error.message]);
};

const EVENT_STATUSES = [
  'PENDING',
  'ACCEPTED',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'RESCHEDULED',
];

const validateEventData = (eventData) => {
  const errors = [];

  // Required fields validation
  const nameValidation = validateString(eventData.event_name, "Event name", {
    required: true,
    minLength: VALIDATION_CONFIG.VARIATION_NAME.MIN_LENGTH || 3,
    maxLength: VALIDATION_CONFIG.VARIATION_NAME.MAX_LENGTH || 1024,
    sanitize: true,
  });
  


  const dateValidation = validateDateRange(
    eventData.start_time,
    eventData.end_time,
    "Event "
  );

  errors.push(...nameValidation.errors, ...dateValidation.errors);

  // Optional fields validation
  if (eventData.description) {
    const descValidation = validateString(eventData.description, "Description", {
      maxLength: VALIDATION_CONFIG.DESCRIPTION.MAX_LENGTH || 1000,
      sanitize: true,
    });
    errors.push(...descValidation.errors);
  }

  if (eventData.estimated_cost) {
    const costValidation = validateNumber(eventData.estimated_cost, "Estimated cost", {
      min: 0,
    });
    errors.push(...costValidation.errors);
  }

  if (eventData.final_cost) {
    const costValidation = validateNumber(eventData.final_cost, "Final cost", {
      min: 0,
    });
    errors.push(...costValidation.errors);
  }

  if (eventData.room_service_fee) {
    const feeValidation = validateNumber(eventData.room_service_fee, "Room service fee", {
      min: 0,
    });
    errors.push(...feeValidation.errors);
  }

  if (eventData.account_id) {
    const accountValidation = parseAndValidateId(eventData.account_id, "Account ID");
    if (typeof accountValidation !== 'number') {
      errors.push("Invalid account ID");
    }
  }

  if (eventData.room_id) {
    const roomValidation = parseAndValidateId(eventData.room_id, "Room ID");
    if (typeof roomValidation !== 'number') {
      errors.push("Invalid room ID");
    }
  }

  if (eventData.event_type_id) {
    const typeValidation = parseAndValidateId(eventData.event_type_id, "Event Type ID");
    if (typeof typeValidation !== 'number') {
      errors.push("Invalid event type ID");
    }
  }

  if (eventData.status) {
    if (!EVENT_STATUSES.includes(eventData.status)) {
      errors.push("Invalid event status");
    }
  }

  return errors;
};

const buildSortOrder = (sortBy, sortOrder) => {
  const validSortFields = [
    'event_name',
    'start_time',
    'end_time',
    'estimated_cost',
    'final_cost',
    'room_service_fee',
    'date_create',
    'status',
  ];
  const validSortOrders = ['asc', 'desc'];

  const field = validSortFields.includes(sortBy) ? sortBy : 'date_create';
  const order = validSortOrders.includes(sortOrder?.toLowerCase()) ? sortOrder.toLowerCase() : 'asc';

  return { [field]: order };
};

// ===== Check Variation Availability =====
const checkVariationAvailability = async (variation_id, scheduled_time, duration_hours, tx = prisma) => {
  try {
    if (!variation_id || !scheduled_time || !duration_hours) {
      return createValidationResult(false, ["Variation ID, scheduled time, and duration are required"]);
    }

    const startTime = new Date(scheduled_time);
    const endTime = new Date(startTime.getTime() + duration_hours * 3600 * 1000);

    const variation = await tx.variation.findUnique({
      where: { variation_id: Number(variation_id) },
      select: { variation_id: true, is_active: true },
    });

    if (!variation || !variation.is_active) {
      return createValidationResult(false, ["Variation not found or inactive"]);
    }

    // Only fetch candidates that could possibly overlap
    const candidates = await tx.eventService.findMany({
      where: {
        variation_id: Number(variation_id),
        status: "CONFIRMED",
        scheduled_time: { lte: endTime }
      },
      select: {
        event_service_id: true,
        scheduled_time: true,
        duration_hours: true
      }
    });

    // Overlap logic in JS
    const conflictingEvents = candidates.filter(ev => {
      const evStart = new Date(ev.scheduled_time);
      const evEnd = new Date(evStart.getTime() + (ev.duration_hours || 0) * 3600 * 1000);
      // Overlap if startTime < evEnd && endTime > evStart
      return startTime < evEnd && endTime > evStart;
    });

    if (conflictingEvents.length > 0) {
      return createValidationResult(false, ["Variation is busy during the requested time slot"], {
        conflictingEvents,
      });
    }

    return createValidationResult(true, [], { variation_id });
  } catch (error) {
    console.error("Error in checkVariationAvailability:", error);
    return createValidationResult(false, [error.message]);
  }
};

// ===== Create Event =====
export const createEvent = async (eventData) => {
  try {
    const {
      event_name,
      description,
      start_time,
      end_time,
      event_date,
      estimated_cost,
      final_cost,
      room_service_fee,
      account_id,
      room_id,
      event_type_id,
      status = 'PENDING',
      event_services = [],
      duration_hours,
    } = eventData;

    // Validate data
    const validationErrors = validateEventData(eventData);
    if (validationErrors.length > 0) {
      return createValidationResult(false, validationErrors);
    }

    // Validate references
    return await prisma.$transaction(async (tx) => {
      if (account_id) {
        const account = await tx.account.findUnique({
          where: { account_id: Number(account_id) },
          select: { account_id: true },
        });
        if (!account) {
          return createValidationResult(false, ["Account not found"]);
        }
      }

      let calculatedEstimatedCost = estimated_cost || 0;
      if (room_id) {
        const room = await tx.room.findUnique({
          where: { room_id: Number(room_id) },
          select: { room_id: true, is_active: true, status: true, base_price: true, hourly_rate: true },
        });
        if (!room || !room.is_active || room.status !== "AVAILABLE") {
          return createValidationResult(false, ["Room not found, inactive, or unavailable"]);
        }
        if (start_time && duration_hours) {
          const availability = await checkRoomAvailability(room_id, start_time, null, duration_hours, null, tx);
          if (!availability.isValid || !availability.data.isAvailable) {
            return createValidationResult(false, [availability.data.reason || "Room is not available"]);
          }
        }
        calculatedEstimatedCost += Number(room.base_price || 0);
        if (duration_hours && room.hourly_rate) {
          calculatedEstimatedCost += Number(room.hourly_rate) * Number(duration_hours);
        }
      }

      if (event_type_id) {
        const eventType = await tx.eventType.findUnique({
          where: { type_id: Number(event_type_id) },
          select: { type_id: true, is_active: true },
        });
        if (!eventType || !eventType.is_active) {
          return createValidationResult(false, ["Event type not found or inactive"]);
        }
      }

      // Validate and calculate cost for event services
      for (const service of event_services) {
        const serviceErrors = validateEventServiceData(service);
        if (serviceErrors.length > 0) {
          return createValidationResult(false, serviceErrors);
        }
        if (service.variation_id && service.scheduled_time && service.duration_hours) {
          const availabilityCheck = await checkVariationAvailability(service.variation_id, service.scheduled_time, service.duration_hours, tx);
          if (!availabilityCheck.isValid) {
            return availabilityCheck;
          }
        }
        let variationBasePrice = 0;
        if (service.variation_id) {
          const variation = await tx.variation.findUnique({
            where: { variation_id: Number(service.variation_id) },
            select: { base_price: true },
          });
          variationBasePrice = variation?.base_price || 0;
        }
        calculatedEstimatedCost += Number(service.custom_price || variationBasePrice) * Number(service.quantity || 1);
      }

      const newEvent = await tx.event.create({
        data: {
          event_name: event_name.trim(),
          description: description?.trim() || null,
          start_time: start_time ? new Date(start_time) : null,
          end_time: end_time ? new Date(end_time) : null,
          event_date: event_date
            ? new Date(event_date)
            : new Date(new Date(start_time).setHours(0, 0, 0, 0)),
          estimated_cost: Number(calculatedEstimatedCost),
          final_cost: final_cost ? Number(final_cost) : null,
          room_service_fee: room_service_fee ? Number(room_service_fee) : null,
          status,
          account_id: account_id ? Number(account_id) : null,
          room_id: room_id ? Number(room_id) : null,
          event_type_id: event_type_id ? Number(event_type_id) : null,
        },
        include: {
          account: { select: { account_id: true, account_name: true } },
          room: { select: { room_id: true, room_name: true, is_active: true } },
          event_type: { select: { type_id: true, type_name: true, is_active: true } },
          event_services: { select: { service_id: true, variation_id: true } },
        },
      });

      // Create EventServices
      if (event_services.length > 0) {
        await tx.eventService.createMany({
          data: event_services.map((service) => ({
            event_id: newEvent.event_id,
            service_id: Number(service.service_id),
            variation_id: service.variation_id ? Number(service.variation_id) : null,
            quantity: Number(service.quantity || 1),
            custom_price: service.custom_price ? Number(service.custom_price) : null,
            notes: service.notes?.trim() || null,
            status: service.status || 'CONFIRMED',
            scheduled_time: service.scheduled_time ? new Date(service.scheduled_time) : null,
            duration_hours: service.duration_hours ? Number(service.duration_hours) : null,
          })),
        });
      }

      // Create Invoice
      if (calculatedEstimatedCost > 0) {
        const invoice = await tx.invoice.create({
          data: {
            invoice_number: `INV-${Date.now()}`,
            total_amount: Number(calculatedEstimatedCost),
            event_id: newEvent.event_id,
            account_id: newEvent.account_id,
            status: 'PENDING',
            issue_date: new Date(),
            due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Due in 7 days
          },
        });

        // Create InvoiceDetail for room
        if (room_id) {
          const room = await tx.room.findUnique({
            where: { room_id: Number(room_id) },
            select: { room_name: true, base_price: true },
          });
          await tx.invoiceDetail.create({
            data: {
              invoice_id: invoice.invoice_id,
              item_name: room.room_name,
              quantity: 1,
              unit_price: room.base_price,
              subtotal: room.base_price,
              item_type: 'ROOM',
            },
          });
        }

        // Create InvoiceDetail for services
        if (event_services.length > 0) {
          for (const service of event_services) {
            let variationName = "Service";
            let variationBasePrice = 0;
            if (service.variation_id) {
              const variation = await tx.variation.findUnique({
                where: { variation_id: Number(service.variation_id) },
                select: { variation_name: true, base_price: true },
              });
              variationName = variation?.variation_name || "Service";
              variationBasePrice = variation?.base_price || 0;
            }
            await tx.invoiceDetail.create({
              data: {
                invoice_id: invoice.invoice_id,
                item_name: variationName,
                quantity: Number(service.quantity || 1),
                unit_price: Number(service.custom_price || variationBasePrice),
                subtotal: Number(service.custom_price || variationBasePrice) * Number(service.quantity || 1),
                item_type: 'SERVICE',
                service_id: Number(service.service_id),
                variation_id: service.variation_id ? Number(service.variation_id) : null,
              },
            });
          }
        }
      }

      // === Notification logic: send notification to user if booking is successful ===
      if (newEvent.account_id) {
        await createNotification({
          account_id: newEvent.account_id,
          title: "Booking Successful",
          message: `Your event "${newEvent.event_name}" has been booked successfully!`,
          type: "CONFIRMATION"
        });
      }

      return createValidationResult(true, [], {
        ...newEvent,
        eventServicesCount: newEvent.event_services.length,
      });
    });
  } catch (error) {
    return handleError("createEvent", error);
  }
};

// ===== Update Event =====
export const updateEvent = async (eventId, updateData, user = null) => {
  try {
    const validEventId = parseAndValidateId(eventId, "Event ID");

    // Check if event exists
    const existingEvent = await prisma.event.findUnique({
      where: { event_id: validEventId },
      include: {
        event_services: { select: { service_id: true, variation_id: true } },
      },
    });

    if (!existingEvent) {
      return createValidationResult(false, ["Event not found"]);
    }

    // Ownership and time window check for user
    if (user && user.role === "CUSTOMER") {
      if (existingEvent.account_id !== user.account_id) {
        return createValidationResult(false, ["You can only update your own events."]);
      }
      const now = new Date();
      const eventStart = new Date(existingEvent.start_time);
      if ((eventStart - now) / (1000 * 60 * 60) < 24) {
        return createValidationResult(false, ["You can only update events at least 24 hours in advance."]);
      }
    }

    // Validate update data
    const validationErrors = validateEventData(updateData);
    if (validationErrors.length > 0) {
      return createValidationResult(false, validationErrors);
    }

    const {
      event_name,
      description,
      start_time,
      end_time,
      event_date,
      estimated_cost,
      final_cost,
      room_service_fee,
      account_id,
      room_id,
      event_type_id,
      status,
      event_services = [],
      duration_hours,
    } = updateData;

    // Validate references
    return await prisma.$transaction(async (tx) => {
      if (account_id) {
        const account = await tx.account.findUnique({
          where: { account_id: Number(account_id) },
          select: { account_id: true },
        });
        if (!account) {
          return createValidationResult(false, ["Account not found"]);
        }
      }

      let calculatedEstimatedCost = estimated_cost || existingEvent.estimated_cost || 0;
      if (room_id && room_id !== existingEvent.room_id) {
        const room = await tx.room.findUnique({
          where: { room_id: Number(room_id) },
          select: { room_id: true, is_active: true, status: true, base_price: true, hourly_rate: true },
        });
        if (!room || !room.is_active || room.status !== "AVAILABLE") {
          return createValidationResult(false, ["Room not found, inactive, or unavailable"]);
        }
        if (start_time && duration_hours) {
          const availability = await checkRoomAvailability(room_id, start_time, null, duration_hours, validEventId, tx);
          if (!availability.isValid || !availability.data.isAvailable) {
            return createValidationResult(false, [availability.data.reason || "Room is not available"]);
          }
        }
        calculatedEstimatedCost = Number(room.base_price || 0);
        if (duration_hours && room.hourly_rate) {
          calculatedEstimatedCost += Number(room.hourly_rate) * Number(duration_hours);
        }
      } else if ((updateData.start_time || updateData.duration_hours) && existingEvent.room_id) {
        const room = await tx.room.findUnique({
          where: { room_id: existingEvent.room_id },
          select: { room_id: true, is_active: true, status: true },
        });
        if (!room || !room.is_active || room.status !== "AVAILABLE") {
          return createValidationResult(false, ["Current room is not available"]);
        }
        if (start_time && duration_hours) {
          const availability = await checkRoomAvailability(existingEvent.room_id, start_time, null, duration_hours, validEventId, tx);
          if (!availability.isValid || !availability.data.isAvailable) {
            return createValidationResult(false, [availability.data.reason || "Room is not available"]);
          }
        }
      }

      if (event_type_id) {
        const eventType = await tx.eventType.findUnique({
          where: { type_id: Number(event_type_id) },
          select: { type_id: true, is_active: true },
        });
        if (!eventType || !eventType.is_active) {
          return createValidationResult(false, ["Event type not found or inactive"]);
        }
      }

      // Validate and calculate cost for event services
      for (const service of event_services) {
        const serviceErrors = validateEventServiceData(service);
        if (serviceErrors.length > 0) {
          return createValidationResult(false, serviceErrors);
        }
        if (service.variation_id && service.scheduled_time && service.duration_hours) {
          const availabilityCheck = await checkVariationAvailability(service.variation_id, service.scheduled_time, service.duration_hours, tx);
          if (!availabilityCheck.isValid) {
            return availabilityCheck;
          }
        }
        let variationBasePrice = 0;
        if (service.variation_id) {
          const variation = await tx.variation.findUnique({
            where: { variation_id: Number(service.variation_id) },
            select: { base_price: true },
          });
          variationBasePrice = variation?.base_price || 0;
        }
        calculatedEstimatedCost += Number(service.custom_price || variationBasePrice) * Number(service.quantity || 1);
      }

      const updatedEvent = await tx.event.update({
        where: { event_id: validEventId },
        data: {
          event_name: event_name?.trim(),
          description: description !== undefined ? description?.trim() || null : undefined,
          start_time: start_time !== undefined ? (start_time ? new Date(start_time) : null) : undefined,
          end_time: end_time !== undefined ? (end_time ? new Date(end_time) : null) : undefined,
          event_date: event_date
            ? new Date(event_date)
            : new Date(new Date(start_time).setHours(0, 0, 0, 0)),
          estimated_cost: calculatedEstimatedCost !== undefined ? Number(calculatedEstimatedCost) : undefined,
          final_cost: final_cost !== undefined ? Number(final_cost) : undefined,
          room_service_fee: room_service_fee !== undefined ? Number(room_service_fee) : undefined,
          status,
          account_id: account_id !== undefined ? (account_id ? Number(account_id) : null) : undefined,
          room_id: room_id !== undefined ? (room_id ? Number(room_id) : null) : undefined,
          event_type_id: event_type_id !== undefined ? (event_type_id ? Number(event_type_id) : null) : undefined,
        },
        include: {
          account: { select: { account_id: true, account_name: true } },
          room: { select: { room_id: true, room_name: true, is_active: true } },
          event_type: { select: { type_id: true, type_name: true, is_active: true } },
          event_services: { select: { service_id: true, variation_id: true } },
        },
      });

      // Update or create EventServices
      if (event_services.length > 0) {
        await tx.eventService.deleteMany({
          where: { event_id: validEventId },
        });
        await tx.eventService.createMany({
          data: event_services.map((service) => ({
            event_id: updatedEvent.event_id,
            service_id: Number(service.service_id),
            variation_id: service.variation_id ? Number(service.variation_id) : null,
            quantity: Number(service.quantity || 1),
            custom_price: service.custom_price ? Number(service.custom_price) : null,
            notes: service.notes?.trim() || null,
            status: service.status || 'CONFIRMED',
            scheduled_time: service.scheduled_time ? new Date(service.scheduled_time) : null,
            duration_hours: service.duration_hours ? Number(service.duration_hours) : null,
          })),
        });
      }

      // Update Invoice
      if (calculatedEstimatedCost !== existingEvent.estimated_cost) {
        const existingInvoice = await tx.invoice.findFirst({
          where: { event_id: validEventId },
        });

        if (existingInvoice) {
          await tx.invoice.update({
            where: { invoice_id: existingInvoice.invoice_id },
            data: { total_amount: Number(calculatedEstimatedCost) },
          });

          await tx.invoiceDetail.deleteMany({
            where: { invoice_id: existingInvoice.invoice_id },
          });

          if (room_id || existingEvent.room_id) {
            const room = await tx.room.findUnique({
              where: { room_id: Number(room_id || existingEvent.room_id) },
              select: { room_name: true, base_price: true },
            });
            await tx.invoiceDetail.create({
              data: {
                invoice_id: existingInvoice.invoice_id,
                item_name: room.room_name,
                quantity: 1,
                unit_price: room.base_price,
                subtotal: room.base_price,
                item_type: 'ROOM',
              },
            });
          }

          if (event_services.length > 0) {
            for (const service of event_services) {
              let variationName = "Service";
              let variationBasePrice = 0;
              if (service.variation_id) {
                const variation = await tx.variation.findUnique({
                  where: { variation_id: Number(service.variation_id) },
                  select: { variation_name: true, base_price: true },
                });
                variationName = variation?.variation_name || "Service";
                variationBasePrice = variation?.base_price || 0;
              }
              await tx.invoiceDetail.create({
                data: {
                  invoice_id: existingInvoice.invoice_id,
                  item_name: variationName,
                  quantity: Number(service.quantity || 1),
                  unit_price: Number(service.custom_price || variationBasePrice),
                  subtotal: Number(service.custom_price || variationBasePrice) * Number(service.quantity || 1),
                  item_type: 'SERVICE',
                  service_id: Number(service.service_id),
                  variation_id: service.variation_id ? Number(service.variation_id) : null,
                },
              });
            }
          }
        }
      }

      return createValidationResult(true, [], {
        ...updatedEvent,
        eventServicesCount: updatedEvent.event_services.length,
      });
    });
  } catch (error) {
    return handleError("updateEvent", error);
  }
};

// ===== Get All Events =====
export const getAllEvents = async (filters = {}) => {
  try {
    const {
      account_id,
      room_id,
      event_type_id,
      status,
      dateMin,
      dateMax,
      search,
      page = 1,
      limit = 20,
      sortBy = 'date_create',
      sortOrder = 'asc',
      includeAccount = false,
      includeRoom = false,
      includeEventType = false,
      includeEventServices = false,
    } = filters;

    // Validate pagination
    const { page: validPage, limit: validLimit, errors: paginationErrors } = validatePagination(page, limit);
    if (paginationErrors.length > 0) {
      return createValidationResult(false, paginationErrors);
    }

    // Build where clause
    const where = {};

    if (account_id) {
      where.account_id = parseAndValidateId(account_id, "Account ID");
    }
    if (room_id) {
      where.room_id = parseAndValidateId(room_id, "Room ID");
    }
    if (event_type_id) {
      where.event_type_id = parseAndValidateId(event_type_id, "Event Type ID");
    }
    if (status) {
      where.status = status;
    }

    if (dateMin || dateMax) {
      where.start_time = {};
      if (dateMin) where.start_time.gte = new Date(dateMin);
      if (dateMax) where.start_time.lte = new Date(dateMax);
    }

    if (search && search.trim()) {
      where.OR = [
        { event_name: { contains: search.trim(), mode: 'insensitive' } },
        { description: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    // Build include clause
    const include = {};
    if (includeAccount) {
      include.account = { select: { account_id: true, account_name: true } };
    }
    if (includeRoom) {
      include.room = { select: { room_id: true, room_name: true, is_active: true } };
    }
    if (includeEventType) {
      include.event_type = { select: { type_id: true, type_name: true, is_active: true } };
    }
    if (includeEventServices) {
      include.event_services = { select: { service_id: true, variation_id: true } };
    }

    const skip = (validPage - 1) * validLimit;
    const orderBy = buildSortOrder(sortBy, sortOrder);

    const [events, totalCount] = await Promise.all([
      prisma.event.findMany({
        where,
        include,
        skip,
        take: validLimit,
        orderBy,
      }),
      prisma.event.count({ where }),
    ]);

    const processedEvents = events.map((event) => ({
      ...event,
      eventServicesCount: event.event_services?.length || 0,
    }));

    return createValidationResult(true, [], {
      events: processedEvents,
      pagination: {
        page: validPage,
        limit: validLimit,
        totalCount,
        totalPages: Math.ceil(totalCount / validLimit),
        hasNextPage: validPage < Math.ceil(totalCount / validLimit),
        hasPreviousPage: validPage > 1,
      },
      message: "Events retrieved successfully",
    });
  } catch (error) {
    return handleError("getAllEvents", error);
  }
};

// ===== Get Event by ID =====
export const getEventById = async (eventId, options = {}) => {
  try {
    const validEventId = parseAndValidateId(eventId, "Event ID");
    const {
      includeAccount = true,
      includeRoom = true,
      includeEventType = true,
      includeEventServices = false,
    } = options;

    const include = {};
    if (includeAccount) include.account = { select: { account_id: true, account_name: true } };
    if (includeRoom) include.room = { select: { room_id: true, room_name: true, is_active: true } };
    if (includeEventType) include.event_type = { select: { type_id: true, type_name: true, is_active: true } };
    if (includeEventServices) include.event_services = { select: { service_id: true, variation_id: true } };

    const event = await prisma.event.findUnique({
      where: { event_id: validEventId },
      include,
    });

    if (!event) {
      return createValidationResult(false, ["Event not found"]);
    }

    return createValidationResult(true, [], {
      ...event,
      eventServicesCount: event.event_services?.length || 0,
      message: "Event retrieved successfully",
    });
  } catch (error) {
    return handleError("getEventById", error);
  }
};

// ===== Delete Event =====
export const deleteEvent = async (eventId, options = {}) => {
  try {
    const validEventId = parseAndValidateId(eventId, "Event ID");
    const { forceDelete = false } = options;

    // Check if event exists and gather dependencies
    const existingEvent = await prisma.event.findUnique({
      where: { event_id: validEventId },
      include: {
        event_services: { select: { service_id: true } },
        invoice: { select: { invoice_id: true } },
        payments: { select: { payment_id: true } },
        reviews: { select: { review_id: true } },
      },
    });

    if (!existingEvent) {
      return createValidationResult(false, ["Event not found"]);
    }

    const hasDependencies =
      existingEvent.event_services.length > 0 ||
      existingEvent.invoice ||
      existingEvent.payments.length > 0 ||
      existingEvent.reviews.length > 0;

    if (hasDependencies && !forceDelete) {
      return createValidationResult(false, [
        `Cannot delete event. It has ${existingEvent.event_services.length} services, ${existingEvent.payments.length} payments, ${existingEvent.reviews.length} reviews, and ${existingEvent.invoice ? 1 : 0} invoice. Use forceDelete to delete anyway.`,
      ], {
        eventServicesCount: existingEvent.event_services.length,
        paymentsCount: existingEvent.payments.length,
        reviewsCount: existingEvent.reviews.length,
        hasInvoice: !!existingEvent.invoice,
      });
    }

    // Transaction: delete dependencies if forceDelete, then delete event
    await prisma.$transaction(async (tx) => {
      if (forceDelete) {
        await tx.eventService.deleteMany({ where: { event_id: validEventId } });
        await tx.payment.deleteMany({ where: { event_id: validEventId } });
        await tx.reviews.deleteMany({ where: { event_id: validEventId } });
        if (existingEvent.invoice) {
          await tx.invoiceDetail.deleteMany({ where: { invoice_id: existingEvent.invoice.invoice_id } });
          await tx.invoice.delete({ where: { invoice_id: existingEvent.invoice.invoice_id } });
        }
      }
      await tx.event.delete({ where: { event_id: validEventId } });
    });

    return createValidationResult(true, [], {
      event_id: validEventId,
      deletedEventServices: forceDelete ? existingEvent.event_services.length : 0,
      deletedPayments: forceDelete ? existingEvent.payments.length : 0,
      deletedReviews: forceDelete ? existingEvent.reviews.length : 0,
      deletedInvoice: forceDelete && existingEvent.invoice ? 1 : 0,
      message: "Event deleted successfully",
    });
  } catch (error) {
    return handleError("deleteEvent", error);
  }
};

// ===== Toggle Event Status =====
export const toggleEventStatus = async (eventId) => {
  try {
    const validEventId = parseAndValidateId(eventId, "Event ID");
    const event = await prisma.event.findUnique({
      where: { event_id: validEventId },
      select: { status: true },
    });

    if (!event) {
      return createValidationResult(false, ["Event not found"]);
    }

    const newStatus = event.status === 'PENDING' ? 'CONFIRMED' : 'PENDING';

    const updatedEvent = await prisma.event.update({
      where: { event_id: validEventId },
      data: { status: newStatus },
      include: {
        account: { select: { account_id: true, account_name: true } },
        room: { select: { room_id: true, room_name: true } },
        event_type: { select: { type_id: true, type_name: true } },
      },
    });

    return createValidationResult(true, [], {
      ...updatedEvent,
      message: "Event status toggled",
    });
  } catch (error) {
    return handleError("toggleEventStatus", error);
  }
};

// ===== Get Events by Event Type ID =====
export const getEventsByEventTypeId = async (eventTypeId, options = {}) => {
  try {
    const validEventTypeId = parseAndValidateId(eventTypeId, "Event Type ID");
    const { includeAccount = false, includeRoom = false, sortBy = 'start_time', sortOrder = 'asc' } = options;

    const where = { event_type_id: validEventTypeId };
    const include = {};
    if (includeAccount) include.account = { select: { account_id: true, account_name: true } };
    if (includeRoom) include.room = { select: { room_id: true, room_name: true, is_active: true } };

    const orderBy = buildSortOrder(sortBy, sortOrder);

    const events = await prisma.event.findMany({
      where,
      include,
      orderBy,
    });

    const processedEvents = events.map((event) => ({
      ...event,
      eventServicesCount: event.event_services?.length || 0,
    }));

    return createValidationResult(true, [], {
      events: processedEvents,
      eventTypeId: validEventTypeId,
      totalCount: processedEvents.length,
      message: "Events by event type retrieved successfully",
    });
  } catch (error) {
    return handleError("getEventsByEventTypeId", error);
  }
};