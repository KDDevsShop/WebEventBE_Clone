import { PrismaClient } from "@prisma/client";
import {
  parseAndValidateId,
  createValidationResult,
  validatePagination,
} from "../utils/validation.js";

const prisma = new PrismaClient();

// ===== Helper Functions =====
const handleError = (context, error) => {
  console.error(`Error in ${context}:`, error);
  return createValidationResult(false, [error.message]);
};

// ===== Get All Notifications =====
export const getAllNotifications = async (filters = {}) => {
  try {
    const {
      account_id,
      is_read,
      type,
      page = 1,
      limit = 20,
      sortBy = "created_at",
      sortOrder = "desc",
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
    if (is_read !== undefined) {
      where.is_read = is_read;
    }
    if (type) {
      where.type = type;
    }

    const skip = (validPage - 1) * validLimit;
    const orderBy = { [sortBy]: sortOrder.toLowerCase() || "desc" };

    const [notifications, totalCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        include: {
          account: { select: { account_id: true, username: true } },
        },
        skip,
        take: validLimit,
        orderBy,
      }),
      prisma.notification.count({ where }),
    ]);

    return createValidationResult(true, [], {
      notifications,
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
    return handleError("getAllNotifications", error);
  }
};

// ===== Mark Notification as Read =====
export const markNotificationAsRead = async (notificationId) => {
  try {
    const validNotificationId = parseAndValidateId(notificationId, "Notification ID");

    const existingNotification = await prisma.notification.findUnique({
      where: { notification_id: validNotificationId },
    });
    if (!existingNotification) {
      return createValidationResult(false, ["Notification not found"]);
    }

    const updatedNotification = await prisma.notification.update({
      where: { notification_id: validNotificationId },
      data: { is_read: true },
      include: {
        account: { select: { account_id: true, username: true } },
      },
    });

    return createValidationResult(true, [], updatedNotification);
  } catch (error) {
    return handleError("markNotificationAsRead", error);
  }
};