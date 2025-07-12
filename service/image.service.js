import { PrismaClient } from "@prisma/client";
import {
  validateString,
  validateNumber,
  validateBoolean,
  parseAndValidateId,
  createValidationResult,
  validatePagination,
} from "../utils/validation.js";
import { createNotification } from "../utils/notification.js";

const prisma = new PrismaClient();

// ===== Helper Functions =====
const handleError = (context, error) => {
  console.error(`Error in ${context}:`, error);
  return createValidationResult(false, [error.message]);
};

const validateImageData = (imageData) => {
  const errors = [];

  // Required fields
  const urlValidation = validateString(imageData.image_url, "Image URL", {
    required: true,
    maxLength: 500,
    sanitize: true,
  });

  errors.push(...urlValidation.errors);

  // Optional fields
  if (imageData.alt_text) {
    const altTextValidation = validateString(imageData.alt_text, "Alt text", {
      maxLength: 255,
      sanitize: true,
    });
    errors.push(...altTextValidation.errors);
  }

  if (imageData.service_id) {
    const serviceIdValidation = parseAndValidateId(imageData.service_id, "Service ID");
    if (typeof serviceIdValidation !== "number") errors.push("Invalid service ID");
  }

  if (imageData.room_id) {
    const roomIdValidation = parseAndValidateId(imageData.room_id, "Room ID");
    if (typeof roomIdValidation !== "number") errors.push("Invalid room ID");
  }

  if (imageData.sort_order !== undefined) {
    const sortOrderValidation = validateNumber(imageData.sort_order, "Sort order", {
      integer: true,
      min: 0,
    });
    errors.push(...sortOrderValidation.errors);
  }

  if (imageData.is_primary !== undefined) {
    if (typeof imageData.is_primary !== "boolean") {
      errors.push("is_primary must be a boolean");
    }
  }

  if (!imageData.service_id && !imageData.room_id) {
    errors.push("At least one of service_id or room_id must be provided");
  }

  if (imageData.service_id && imageData.room_id) {
    errors.push("Only one of service_id or room_id can be provided");
  }

  return errors;
};

// ===== Create Image =====
export const createImage = async (imageData) => {
  try {
    const { image_url, alt_text, service_id, room_id, sort_order = 0, is_primary = false } = imageData;

    // Validate data
    const validationErrors = validateImageData(imageData);
    if (validationErrors.length > 0) {
      return createValidationResult(false, validationErrors);
    }

    // Validate references
    if (service_id) {
      const service = await prisma.service.findUnique({
        where: { service_id: Number(service_id) },
        select: { service_id: true, is_active: true },
      });
      if (!service || !service.is_active) {
        return createValidationResult(false, ["Service not found or inactive"]);
      }
    }

    if (room_id) {
      const room = await prisma.room.findUnique({
        where: { room_id: Number(room_id) },
        select: { room_id: true, is_active: true },
      });
      if (!room || !room.is_active) {
        return createValidationResult(false, ["Room not found or inactive"]);
      }
    }

    // If is_primary is true, ensure no other image is primary for the same service/room
    if (is_primary) {
      if (service_id) {
        await prisma.image.updateMany({
          where: { service_id: Number(service_id), is_primary: true },
          data: { is_primary: false },
        });
      } else if (room_id) {
        await prisma.image.updateMany({
          where: { room_id: Number(room_id), is_primary: true },
          data: { is_primary: false },
        });
      }
    }

    const newImage = await prisma.$transaction(async (tx) => {
      const image = await tx.image.create({
        data: {
          image_url: image_url.trim(),
          alt_text: alt_text?.trim() || null,
          service_id: service_id ? Number(service_id) : null,
          room_id: room_id ? Number(room_id) : null,
          sort_order: Number(sort_order),
          is_primary,
          created_at: new Date(),
        },
        include: {
          service: { select: { service_id: true, service_name: true } },
          room: { select: { room_id: true, room_name: true } },
        },
      });

      // Send notification for image upload
      const notification = await createNotification(
        {
          account_id: null, // System notification
          title: "New Image Uploaded",
          message: `A new image has been uploaded for ${image.service?.service_name || image.room?.room_name || "an item"}.`,
          type: "IMAGE_UPLOADED",
        },
        tx
      );

      if (!notification.isValid) {
        console.warn("Failed to send image upload notification:", notification.errors);
      }

      return image;
    });

    return createValidationResult(true, [], newImage);
  } catch (error) {
    return handleError("createImage", error);
  }
};

// ===== Update Image =====
export const updateImage = async (imageId, updateData) => {
  try {
    const valid Problema đã được nêu ra: Tôi sẽ cập nhật file `event.service.js` để tích hợp logic gửi thông báo khi tạo sự kiện thành công, như bạn yêu cầu. Dưới đây là phiên bản cập nhật của file `event.service.js` với hàm `createNotification` được tích hợp trong hàm `createEvent`. Tôi sẽ giữ nguyên cấu trúc hiện có và chỉ thêm logic gửi thông báo để đảm bảo tính tương thích.

<xaiArtifact artifact_id="67a02c6e-33d2-466c-ba51-7f43fe07bad4" artifact_version_id="711c2b45-feb3-40ed-980f-71d6b3b1b67a" title="event.service.js" contentType="text/javascript">
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
import { createNotification } from "../utils/notification.js";

const prisma = new PrismaClient();

// ===== Helper Functions =====
const handleError = (context, error) => {
  console.error(`Error in ${context}:`, error);
  return createValidationResult(false, [error.message]);
};

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
    eventData.event_date,
    eventData.start_time,
    eventData.end_time,
    "Event date",
    { required: true }
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
    const validStatuses = ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'];
    if (!validStatuses.includes(eventData.status)) {
      errors.push("Invalid event status");
    }
  }

  return errors;
};

const validateEventServiceData = (serviceData) => {
  const errors = [];

  const quantityValidation = validateNumber(serviceData.quantity, "Quantity", {
    min: 1,
    integer: true,
  });
  const serviceIdValidation = parseAndValidateId(serviceData.service_id, "Service ID");

  errors.push(...quantityValidation.errors);
  if (typeof serviceIdValidation !== 'number') errors.push("Invalid service ID");

  if (serviceData.variation_id) {
    const variationIdValidation = parseAndValidateId(serviceData.variation_id, "Variation ID");
    if (typeof variationIdValidation !== 'number') errors.push("Invalid variation ID");
  }

  if (serviceData.custom_price) {
    const priceValidation = validateNumber(serviceData.custom_price, "Custom price", {
      min: 0,
    });
    errors.push(...priceValidation.errors);
  }

  return errors;
};

const buildSortOrder = (sortBy, sortOrder) => {
  const validSortFields = [
    'event_name',
    'event_date',
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

// ===== Check Room Availability =====
const checkRoomAvailability = async (room_id, start_time, duration_hours, tx = prisma) => {
  try {
    const startTime = new Date(start_time);
    const endTime = new Date(startTime.getTime() + duration_hours * 3600 * 1000);

    const room = await tx.room.findUnique({
      where: { room_id: Number(room_id) },
      select: { room_id: true, is_active: true, status: true },
    });

    if (!room || !room.is_active || room.status !== 'AVAILABLE') {
      return createValidationResult(false, ["Room not found, inactive, or unavailable"]);
    }

    const conflictingEvents = await tx.event.findMany({
      where: {
        room_id: Number(room_id),
        status: { not: 'CANCELLED' },
        OR: [
          {
            AND: [
              { start_time: { lte: endTime } },
              { end_time: { gte: startTime } },
            ],
          },
        ],
      },
      select: { event_id: true, event_name: true, start_time: true, end_time: true },
    });

    if (conflictingEvents.length > 0) {
      return createValidationResult(false, ["Room is busy during the requested time slot"], {
        conflictingEvents,
      });
    }

    return createValidationResult(true, [], { room_id });
  } catch (error) {
    return handleError("checkRoomAvailability", error);
  }
};

// ===== Check Variation Availability =====
const checkVariationAvailability = async (variation_id, scheduled_time, duration_hours, tx = prisma) => {
  try {
    // Validate inputs
    if (!variation_id || !scheduled_time || !duration_hours) {
      return createValidationResult(false, ["Variation ID, scheduled time, and duration are required"]);
    }

    const startTime = new Date(scheduled_time);
    const endTime = new Date(startTime.getTime() + duration_hours * 3600 * 1000);

    // Check if variation exists and is active
    const variation = await tx.variation.findUnique({
      where: { variation_id: Number(variation_id) },
      select: { variation_id: true, is_active: true },
    });

    if (!variation || !variation.is_active) {
      return createValidationResult(false, ["Variation not found or inactive"]);
    }

    // Find conflicting EventServices
    const conflictingEvents = await tx.eventService.findMany({
      where: {
        variation_id: Number(variation_id),
        status: "CONFIRMED",
        OR: [
          {
            AND: [
              { scheduled_time: { lte: endTime } },
              {
                OR: [
                  { end_time: { gte: startTime } },
                  {
                    AND: [
                      { end_time: null },
                      {
                        scheduled_time: {
                          gte: new Date(startTime.getTime() - duration_hours * 3600 * 1000),
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      select: { event_service_id: true, scheduled_time: true, duration_hours: true, end_time: true },
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
      event_date,
      start_time,
      end_time,
      estimated_cost,
      final_cost,
      room_service_fee,
      account_id,
      room_id,
      event_type_id,
      status = 'PENDING',
      event_services = [],
      guest_count,
      duration_hours,
    } = eventData;

    // Validate data
    const validationErrors = validateEventData(eventData);
    if (validationErrors.length > 0) {
      return createValidationResult(false, validationErrors);
    }

    // Validate references
    if (account_id) {
      const account = await prisma.account.findUnique({
        where: { account_id: Number(account_id) },
        select: { account_id: true },
      });
      if (!account) {
        return createValidationResult(false, ["Account not found"]);
      }
    }

    if (room_id) {
      const room = await prisma.room.findUnique({
        where: { room_id: Number(room_id) },
        select: { room_id: true, is_active: true, status: true, guest_capacity: true, base_price: true, hourly_rate: true },
      });
      if (!room || !room.is_active || room.status !== 'AVAILABLE') {
        return createValidationResult(false, ["Room not found, inactive, or unavailable"]);
      }
      if (guest_count && room.guest_capacity < Number(guest_count)) {
        return createValidationResult(false, ["Room capacity insufficient for guest count"]);
      }
      if (start_time && duration_hours) {
        const availabilityCheck = await checkRoomAvailability(room_id, start_time, duration_hours);
        if (!availabilityCheck.isValid) {
          return availabilityCheck;
        }
      }
    }

    if (event_type_id) {
      const eventType = await prisma.eventType.findUnique({
        where: { type_id: Number(event_type_id) },
        select: { type_id: true, is_active: true },
      });
      if (!eventType || !eventType.is_active) {
        return createValidationResult(false, ["Event type not found or inactive"]);
      }
    }

    // Calculate estimated cost
    let calculatedEstimatedCost = estimated_cost || 0;
    if (room_id) {
      const room = await prisma.room.findUnique({
        where: { room_id: Number(room_id) },
        select: { base_price: true, hourly_rate: true },
      });
      calculatedEstimatedCost += Number(room.base_price || 0);
      if (duration_hours && room.hourly_rate) {
        calculatedEstimatedCost += Number(room.hourly_rate) * Number(duration_hours);
      }
    }

    // Validate and calculate cost for event services
    for (const service of event_services) {
      const serviceErrors = validateEventServiceData(service);
      if (serviceErrors.length > 0) {
        return createValidationResult(false, serviceErrors);
      }
      if (service.variation_id && service.scheduled_time && service.duration_hours) {
        const availabilityCheck = await checkVariationAvailability(service.variation_id, service.scheduled_time, service.duration_hours);
        if (!availabilityCheck.isValid) {
          return availabilityCheck;
        }
      }
      const variation = await prisma.variation.findUnique({
        where: { variation_id: Number(service.variation_id) },
        select: { base_price: true },
      });
      calculatedEstimatedCost += Number(service.custom_price || variation?.base_price || 0) * Number(service.quantity || 1);
    }

    const newEvent = await prisma.$transaction(async (tx) => {
      const event = await tx.event.create({
        data: {
          event_name: event_name.trim(),
          description: description?.trim() || null,
          event_date: new Date(event_date),
          start_time: start_time ? new Date(start_time) : null,
          end_time: end_time ? new Date(end_time) : null,
          estimated_cost: Number(calculatedEstimatedCost),
          final_cost: final_cost ? Number(final_cost) : null,
          room_service_fee: room_service_fee ? Number(room_service_fee) : null,
          status,
          account_id: account_id ? Number(account_id) : null,
          room_id: room_id ? Number(room_id) : null,
          event_type_id: event_type_id ? Number(event_type_id) : null,
        },
        include: {
          account: { select: { account_id: true, username: true } },
          room: { select: { room_id: true, room_name: true, is_active: true } },
          event_type: { select: { type_id: true, type_name: true, is_active: true } },
          event_services: { select: { service_id: true, variation_id: true } },
        },
      });

      // Create EventServices
      if (event_services.length > 0) {
        await tx.eventService.createMany({
          data: event_services.map((service) => ({
            event_id: event.event_id,
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
            event_id: event.event_id,
            account_id: event.account_id,
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
            const variation = await tx.variation.findUnique({
              where: { variation_id: Number(service.variation_id) },
              select: { variation_name: true, base_price: true },
            });
            await tx.invoiceDetail.create({
              data: {
                invoice_id: invoice.invoice_id,
                item_name: variation?.variation_name || "Service",
                quantity: Number(service.quantity || 1),
                unit_price: Number(service.custom_price || variation?.base_price || 0),
                subtotal: Number(service.custom_price || variation?.base_price || 0) * Number(service.quantity || 1),
                item_type: 'SERVICE',
                service_id: Number(service.service_id),
                variation_id: Number(service.variation_id),
              },
            });
          }
        }
      }

      // Create notification for event creation
      if (event.account_id) {
        const notification = await createNotification({
          account_id: event.account_id,
          title: "Event Created Successfully",
          message: `Your event "${event.event_name}" has been created successfully for ${new Date(event.event_date).toLocaleDateString()}.`,
          type: "EVENT_CREATION",
        }, tx);

        if (!notification.isValid) {
          console.warn("Failed to send event creation notification:", notification.errors);
        }
      }

      return event;
    });

    return createValidationResult(true, [], {
      ...newEvent,
      eventServicesCount: newEvent.event_services.length,
    });
  } catch (error) {
    return handleError("createEvent", error);
  }
};

// ===== Update Event =====
export const updateEvent = async (eventId, updateData) => {
  try {
    const validEventId = parseAndValidateId(eventId, "Event ID");

    // Check if event exists
    const existingEvent = await prisma.event.findUnique({
      where: { event_id: validEventId },
    });

    if (!existingEvent) {
      return createValidationResult(false, ["Event not found"]);
    }

    // Validate update data
    const validationErrors = validateEventData(updateData);
    if (validationErrors.length > 0) {
      return createValidationResult(false, validationErrors);
    }

    const {
      event_name,
      description,
      event_date,
      start_time,
      end_time,
      estimated_cost,
      final_cost,
      room_service_fee,
      account_id,
      room_id,
      event_type_id,
      status,
      event_services = [],
      guest_count,
      duration_hours,
    } = updateData;

    // Validate references
    if (account_id) {
      const account = await prisma.account.findUnique({
        where: { account_id: Number(account_id) },
        select: { account_id: true },
      });
      if (!account) {
        return createValidationResult(false, ["Account not found"]);
      }
    }

    if (room_id && room_id !== existingEvent.room_id) {
      const room = await prisma.room.findUnique({
        where: { room_id: Number(room_id) },
        select: { room_id: true, is_active: true, status: true, guest_capacity: true, base_price: true, hourly_rate: true },
      });
      if (!room || !room.is_active || room.status !== 'AVAILABLE') {
        return createValidationResult(false, ["Room not found, inactive, or unavailable"]);
      }
      if (guest_count && room.guest_capacity < Number(guest_count)) {
        return createValidationResult(false, ["Room capacity insufficient for guest count"]);
      }
      if (start_time && duration_hours) {
        const availabilityCheck = await checkRoomAvailability(room_id, start_time, duration_hours);
        if (!availabilityCheck.isValid) {
          return availabilityCheck;
        }
      }
    }

    if (event_type_id) {
      const eventType = await prisma.eventType.findUnique({
        where: { type_id: Number(event_type_id) },
        select: { type_id: true, is_active: true },
      });
      if (!eventType || !eventType.is_active) {
        return createValidationResult(false, ["Event type not found or inactive"]);
      }
    }

    // Calculate estimated cost
    let calculatedEstimatedCost = estimated_cost || existingEvent.estimated_cost || 0;
    if (room_id && room_id !== existingEvent.room_id) {
      const room = await prisma.room.findUnique({
        where: { room_id: Number(room_id) },
        select: { base_price: true, hourly_rate: true },
      });
      calculatedEstimatedCost = Number(room.base_price || 0);
      if (duration_hours && room.hourly_rate) {
        calculatedEstimatedCost += Number(room.hourly_rate) * Number(duration_hours);
      }
    }

    // Validate and calculate cost for event services
    for (const service of event_services) {
      const serviceErrors = validateEventServiceData(service);
      if (serviceErrors.length > 0) {
        return createValidationResult(false, serviceErrors);
      }
      if (service.variation_id && service.scheduled_time && service.duration_hours) {
        const availabilityCheck = await checkVariationAvailability(service.variation_id, service.scheduled_time, service.duration_hours);
        if (!availabilityCheck.isValid) {
          return availabilityCheck;
        }
      }
      const variation = await prisma.variation.findUnique({
        where: { variation_id: Number(service.variation_id) },
        select: { base_price: true },
      });
      calculatedEstimatedCost += Number(service.custom_price || variation?.base_price || 0) * Number(service.quantity || 1);
    }

    const updatedEvent = await prisma.$transaction(async (tx) => {
      const event = await tx.event.update({
        where: { event_id: validEventId },
        data: {
          event_name: event_name?.trim(),
          description: description !== undefined ? description?.trim() || null : undefined,
          event_date: event_date ? new Date(event_date) : undefined,
          start_time: start_time !== undefined ? (start_time ? new Date(start_time) : null) : undefined,
          end_time: end_time !== undefined ? (end_time ? new Date(end_time) : null) : undefined,
          estimated_cost: calculatedEstimatedCost !== undefined ? Number(calculatedEstimatedCost) : undefined,
          final_cost: final_cost !== undefined ? Number(final_cost) : undefined,
          room_service_fee: room_service_fee !== undefined ? Number(room_service_fee) : undefined,
          status,
          account_id: account_id !== undefined ? (account_id ? Number(account_id) : null) : undefined,
          room_id: room_id !== undefined ? (room_id ? Number(room_id) : null) : undefined,
          event_type_id: event_type_id !== undefined ? (event_type_id ? Number(event_type_id) : null) : undefined,
        },
        include: {
          account: { select: { account_id: true, username: true } },
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
            event_id: event.event_id,
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

          if (room_id) {
            const room = await tx.room.findUnique({
              where: { room_id: Number(room_id) },
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
              const variation = await tx.variation.findUnique({
                where: { variation_id: Number(service.variation_id) },
                select: { variation_name: true, base_price: true },
              });
              await tx.invoiceDetail.create({
                data: {
                  invoice_id: existingInvoice.invoice_id,
                  item_name: variation?.variation_name || "Service",
                  quantity: Number(service.quantity || 1),
                  unit_price: Number(service.custom_price || variation?.base_price || 0),
                  subtotal: Number(service.custom_price || variation?.base_price || 0) * Number(service.quantity || 1),
                  item_type: 'SERVICE',
                  service_id: Number(service.service_id),
                  variation_id: Number(service.variation_id),
                },
              });
            }
          }
        }
      }

      return event;
    });

    return createValidationResult(true, [], {
      ...updatedEvent,
      eventServicesCount: updatedEvent.event_services.length,
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
      where.event_date = {};
      if (dateMin) where.event_date.gte = new Date(dateMin);
      if (dateMax) where.event_date.lte = new Date(dateMax);
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
      include.account = { select: { account_id: true, username: true } };
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
    if (includeAccount) {
      include.account = { select: { account_id: true, username: true } };
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

    // Check if event exists
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

    // Check for dependencies
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

    // Use transaction to ensure data consistency
    await prisma.$transaction(async (tx) => {
      if (forceDelete) {
        // Delete related event services
        await tx.eventService.deleteMany({
          where: { event_id: validEventId },
        });

        // Delete related payments
        await tx.payment.deleteMany({
          where: { event_id: validEventId },
        });

        // Delete related reviews
        await tx.reviews.deleteMany({
          where: { event_id: validEventId },
        });

        // Delete related invoice
        if (existingEvent.invoice) {
          await tx.invoice.delete({
            where: { invoice_id: existingEvent.invoice.invoice_id },
          });
        }
      }

      // Delete the event
      await tx.event.delete({
        where: { event_id: validEventId },
      });
    });

    return createValidationResult(true, [], {
      event_id: validEventId,
      deletedEventServices: forceDelete ? existingEvent.event_services.length : 0,
      deletedPayments: forceDelete ? existingEvent.payments.length : 0,
      deletedReviews: forceDelete ? existingEvent.reviews.length : 0,
      deletedInvoice: forceDelete && existingEvent.invoice ? 1 : 0,
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
        account: { select: { account_id: true, username: true } },
        room: { select: { room_id: true, room_name: true } },
        event_type: { select: { type_id: true, type_name: true } },
      },
    });

    return createValidationResult(true, [], updatedEvent);
  } catch (error) {
    return handleError("toggleEventStatus", error);
  }
};

// ===== Get Events by Event Type ID =====
export const getEventsByEventTypeId = async (eventTypeId, options = {}) => {
  try {
    const validEventTypeId = parseAndValidateId(eventTypeId, "Event Type ID");
    const { includeAccount = false, includeRoom = false, sortBy = 'event_date', sortOrder = 'asc' } = options;

    const where = { event_type_id: validEventTypeId };
    const include = {};
    if (includeAccount) {
      include.account = { select: { account_id: true, username: true } };
    }
    if (includeRoom) {
      include.room = { select: { room_id: true, room_name: true, is_active: true } };
    }

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
    });
  } catch (error) {
    return handleError("getEventsByEventTypeId", error);
  }
};