import { PrismaClient } from "@prisma/client";
import {
  validateString,
  parseAndValidateId,
  createValidationResult,
  validatePagination,
  validateBoolean,
} from "../utils/validation.js";
import { createNotification } from "../utils/notification.js";

const prisma = new PrismaClient();

// ===== Helper Functions =====
const handleError = (context, error) => {
  console.error(`Error in ${context}:`, error);
  return createValidationResult(false, [error.message]);
};

const validateEventTypeData = (eventTypeData) => {
  const errors = [];

  // Required fields
  const nameValidation = validateString(eventTypeData.type_name, "Event type name", {
    required: true,
    minLength: 3,
    maxLength: 255,
    sanitize: true,
  });

  errors.push(...nameValidation.errors);

  // Optional fields
  if (eventTypeData.description) {
    const descValidation = validateString(eventTypeData.description, "Description", {
      maxLength: 1000,
      sanitize: true,
    });
    errors.push(...descValidation.errors);
  }

  if (eventTypeData.is_active !== undefined) {
    const isActiveValidation = validateBoolean(eventTypeData.is_active, "is_active");
    errors.push(...isActiveValidation.errors);
  }

  return errors;
};

// ===== Get Event Type by ID =====
export const getEventTypeById = async (eventTypeId) => {
  try {
    const validEventTypeId = parseAndValidateId(eventTypeId, "Event Type ID");

    const eventType = await prisma.eventType.findUnique({
      where: { type_id: validEventTypeId },
      include: {
        events: {
          select: { event_id: true, event_name: true, status: true },
        },
      },
    });

    if (!eventType) {
      return createValidationResult(false, ["Event type not found"]);
    }

    return createValidationResult(true, [], {
      ...eventType,
      eventsCount: eventType.events.length,
    });
  } catch (error) {
    return handleError("getEventTypeById", error);
  }
};

// ===== Get All Event Types =====
export const getAllEventTypes = async (filters = {}) => {
  try {
    const {
      search,
      is_active,
      page = 1,
      limit = 20,
      sortBy = "type_name",
      sortOrder = "asc",
    } = filters;

    // Validate pagination
    const { page: validPage, limit: validLimit, errors: paginationErrors } = validatePagination(page, limit);
    if (paginationErrors.length > 0) {
      return createValidationResult(false, paginationErrors);
    }

    // Build where clause
    const where = {};
    if (search && search.trim()) {
      where.type_name = { contains: search.trim(), mode: "insensitive" };
    }
    if (is_active !== undefined) {
      where.is_active = is_active;
    }

    const skip = (validPage - 1) * validLimit;
    const orderBy = { [sortBy]: sortOrder.toLowerCase() || "asc" };

    const [eventTypes, totalCount] = await Promise.all([
      prisma.eventType.findMany({
        where,
        include: {
          events: {
            select: { event_id: true, event_name: true, status: true },
          },
        },
        skip,
        take: validLimit,
        orderBy,
      }),
      prisma.eventType.count({ where }),
    ]);

    const processedEventTypes = eventTypes.map((eventType) => ({
      ...eventType,
      eventsCount: eventType.events.length,
    }));

    return createValidationResult(true, [], {
      eventTypes: processedEventTypes,
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
    return handleError("getAllEventTypes", error);
  }
};


// ===== Create Event Type =====
export const createEventType = async (eventTypeData) => {
  try {
    if (eventTypeData.is_active !== undefined) {
      eventTypeData.is_active = eventTypeData.is_active === "true" || eventTypeData.is_active === true;
    }
    const { type_name, description, is_active } = eventTypeData;

    // Validate data
    const validationErrors = validateEventTypeData(eventTypeData);
    if (validationErrors.length > 0) {
      return createValidationResult(false, validationErrors);
    }

    const newEventType = await prisma.eventType.create({
      data: {
        type_name: type_name.trim(),
        description: description?.trim() || null,
        is_active,
      },
    });

    return createValidationResult(true, [], newEventType);
  } catch (error) {
    return handleError("createEventType", error);
  }
};

// ===== Update Event Type =====
export const updateEventType = async (eventTypeId, updateData) => {
  try {
    if (updateData.is_active !== undefined) {
      updateData.is_active = updateData.is_active === "true" || updateData.is_active === true;
    }

    const validEventTypeId = parseAndValidateId(eventTypeId, "Event Type ID");

    // Check if event type exists
    const existingEventType = await prisma.eventType.findUnique({
      where: { type_id: validEventTypeId },
    });
    if (!existingEventType) {
      return createValidationResult(false, ["Event type not found"]);
    }

    // Validate update data
    const validationErrors = validateEventTypeData(updateData);
    if (validationErrors.length > 0) {
      return createValidationResult(false, validationErrors);
    }

    const { type_name, description, is_active } = updateData;

    const updateFields = {};
    if (type_name !== undefined) updateFields.type_name = type_name.trim();
    if (description !== undefined) updateFields.description = description?.trim() || null;
    if (is_active !== undefined) updateFields.is_active = is_active;

    const updatedEventType = await prisma.eventType.update({
      where: { type_id: validEventTypeId },
      data: updateFields,
    });

    return createValidationResult(true, [], updatedEventType);
  } catch (error) {
    return handleError("updateEventType", error);
  }
};

// ===== Delete Event Type =====
export const deleteEventType = async (eventTypeId, options = {}) => {
  try {
    const validEventTypeId = parseAndValidateId(eventTypeId, "Event Type ID");
    const { forceDelete = false } = options;

    // Check if event type exists
    const existingEventType = await prisma.eventType.findUnique({
      where: { type_id: validEventTypeId },
      include: {
        events: { select: { event_id: true } },
      },
    });

    if (!existingEventType) {
      return createValidationResult(false, ["Event type not found"]);
    }

    // Check for dependencies
    if (existingEventType.events.length > 0 && !forceDelete) {
      return createValidationResult(false, [
        `Cannot delete event type. It is associated with ${existingEventType.events.length} events. Use forceDelete to delete anyway.`,
      ]);
    }

    await prisma.$transaction(async (tx) => {
      if (forceDelete) {
        // Delete related events
        await tx.event.deleteMany({
          where: { event_type_id: validEventTypeId },
        });
      }

      // Delete the event type
      await tx.eventType.delete({
        where: { type_id: validEventTypeId },
      });
    });

    return createValidationResult(true, [], { type_id: validEventTypeId });
  } catch (error) {
    return handleError("deleteEventType", error);
  }
};