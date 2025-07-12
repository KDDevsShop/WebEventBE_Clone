import { PrismaClient } from "@prisma/client";
import {
  validateNumber,
  validateString,
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

const validateReviewData = (reviewData) => {
  const errors = [];

  // Required fields
  const rateValidation = validateNumber(reviewData.rate, "Rating", {
    required: true,
    min: 1,
    max: 5,
    integer: true,
  });
  const accountIdValidation = parseAndValidateId(reviewData.account_id, "Account ID");

  errors.push(...rateValidation.errors);
  if (typeof accountIdValidation !== "number") errors.push("Invalid account ID");

  // Optional fields
  if (reviewData.service_id) {
    const serviceIdValidation = parseAndValidateId(reviewData.service_id, "Service ID");
    if (typeof serviceIdValidation !== "number") errors.push("Invalid service ID");
  }

  if (reviewData.event_id) {
    const eventIdValidation = parseAndValidateId(reviewData.event_id, "Event ID");
    if (typeof eventIdValidation !== "number") errors.push("Invalid event ID");
  }

  if (reviewData.comment) {
    const commentValidation = validateString(reviewData.comment, "Comment", {
      maxLength: 1000,
      sanitize: true,
    });
    errors.push(...commentValidation.errors);
  }

  if (reviewData.is_verified !== undefined) {
    if (typeof reviewData.is_verified !== "boolean") {
      errors.push("is_verified must be a boolean");
    }
  }

  if (!reviewData.service_id && !reviewData.event_id) {
    errors.push("At least one of service_id or event_id must be provided");
  }

  return errors;
};

// ===== Create Review =====
export const createReview = async (reviewData) => {
  try {
    const { account_id, service_id, event_id, rate, comment, is_verified = false } = reviewData;

    // Validate data
    const validationErrors = validateReviewData(reviewData);
    if (validationErrors.length > 0) {
      return createValidationResult(false, validationErrors);
    }

    // Validate references
    const account = await prisma.account.findUnique({
      where: { account_id: Number(account_id) },
      select: { account_id: true },
    });
    if (!account) {
      return createValidationResult(false, ["Account not found"]);
    }

    if (service_id) {
      const service = await prisma.service.findUnique({
        where: { service_id: Number(service_id) },
        select: { service_id: true, is_active: true },
      });
      if (!service || !service.is_active) {
        return createValidationResult(false, ["Service not found or inactive"]);
      }
    }

    if (event_id) {
      const event = await prisma.event.findUnique({
        where: { event_id: Number(event_id) },
        select: { event_id: true, status: true },
      });
      if (!event || event.status === "CANCELLED") {
        return createValidationResult(false, ["Event not found or cancelled"]);
      }
    }

    const newReview = await prisma.$transaction(async (tx) => {
      const review = await tx.reviews.create({
        data: {
          account_id: Number(account_id),
          service_id: service_id ? Number(service_id) : null,
          event_id: event_id ? Number(event_id) : null,
          rate: Number(rate),
          comment: comment?.trim() || null,
          is_verified,
          review_date: new Date(),
        },
        include: {
          account: { select: { account_id: true, username: true } },
          service: { select: { service_id: true, service_name: true } },
          event: { select: { event_id: true, event_name: true } },
        },
      });

      // Send notification for review submission
      const notification = await createNotification(
        {
          account_id: review.account_id,
          title: "Review Submitted",
          message: `Your review for ${review.event?.event_name || review.service?.service_name || "an item"} has been submitted successfully.`,
          type: "REVIEW_SUBMITTED",
        },
        tx
      );

      if (!notification.isValid) {
        console.warn("Failed to send review submission notification:", notification.errors);
      }

      return review;
    });

    return createValidationResult(true, [], newReview);
  } catch (error) {
    return handleError("createReview", error);
  }
};

// ===== Update Review =====
export const updateReview = async (reviewId, updateData) => {
  try {
    const validReviewId = parseAndValidateId(reviewId, "Review ID");

    // Check if review exists
    const existingReview = await prisma.reviews.findUnique({
      where: { review_id: validReviewId },
    });
    if (!existingReview) {
      return createValidationResult(false, ["Review not found"]);
    }

    // Validate update data
    const validationErrors = validateReviewData(updateData);
    if (validationErrors.length > 0) {
      return createValidationResult(false, validationErrors);
    }

    const { account_id, service_id, event_id, rate, comment, is_verified } = updateData;

    // Validate references
    if (account_id && account_id !== existingReview.account_id) {
      const account = await prisma.account.findUnique({
        where: { account_id: Number(account_id) },
        select: { account_id: true },
      });
      if (!account) {
        return createValidationResult(false, ["Account not found"]);
      }
    }

    if (service_id && service_id !== existingReview.service_id) {
      const service = await prisma.service.findUnique({
        where: { service_id: Number(service_id) },
        select: { service_id: true, is_active: true },
      });
      if (!service || !service.is_active) {
        return createValidationResult(false, ["Service not found or inactive"]);
      }
    }

    if (event_id && event_id !== existingReview.event_id) {
      const event = await prisma.event.findUnique({
        where: { event_id: Number(event_id) },
        select: { event_id: true, status: true },
      });
      if (!event || event.status === "CANCELLED") {
        return createValidationResult(false, ["Event not found or cancelled"]);
      }
    }

    const updateFields = {};
    if (account_id !== undefined) updateFields.account_id = Number(account_id);
    if (service_id !== undefined) updateFields.service_id = service_id ? Number(service_id) : null;
    if (event_id !== undefined) updateFields.event_id = event_id ? Number(event_id) : null;
    if (rate !== undefined) updateFields.rate = Number(rate);
    if (comment !== undefined) updateFields.comment = comment?.trim() || null;
    if (is_verified !== undefined) updateFields.is_verified = is_verified;

    const updatedReview = await prisma.$transaction(async (tx) => {
      const review = await tx.reviews.update({
        where: { review_id: validReviewId },
        data: updateFields,
        include: {
          account: { select: { account_id: true, username: true } },
          service: { select: { service_id: true, service_name: true } },
          event: { select: { event_id: true, event_name: true } },
        },
      });

      // Send notification if review is verified
      if (is_verified === true && !existingReview.is_verified) {
        const notification = await createNotification(
          {
            account_id: review.account_id,
            title: "Review Verified",
            message: `Your review for ${review.event?.event_name || review.service?.service_name || "an item"} has been verified.`,
            type: "REVIEW_VERIFIED",
          },
          tx
        );

        if (!notification.isValid) {
          console.warn("Failed to send review verified notification:", notification.errors);
        }
      }

      return review;
    });

    return createValidationResult(true, [], updatedReview);
  } catch (error) {
    return handleError("updateReview", error);
  }
};

// ===== Get Review by ID =====
export const getReviewById = async (reviewId) => {
  try {
    const validReviewId = parseAndValidateId(reviewId, "Review ID");

    const review = await prisma.reviews.findUnique({
      where: { review_id: validReviewId },
      include: {
        account: { select: { account_id: true, username: true } },
        service: { select: { service_id: true, service_name: true } },
        event: { select: { event_id: true, event_name: true } },
      },
    });

    if (!review) {
      return createValidationResult(false, ["Review not found"]);
    }

    return createValidationResult(true, [], review);
  } catch (error) {
    return handleError("getReviewById", error);
  }
};

// ===== Get All Reviews =====
export const getAllReviews = async (filters = {}) => {
  try {
    const {
      account_id,
      service_id,
      event_id,
      is_verified,
      page = 1,
      limit = 20,
      sortBy = "review_date",
      sortOrder = "desc",
    } = filters;

    // Validate pagination
    const { page: validPage, limit: validLimit, errors: paginationErrors } = validatePagination(page, limit);
    if (paginationErrors.length > 0) {
      return createValidationResult(false, paginationErrors);
    }

    // Build where clause
    const where = {};
    if (account_id) where.account_id = parseAndValidateId(account_id, "Account ID");
    if (service_id) where.service_id = parseAndValidateId(service_id, "Service ID");
    if (event_id) where.event_id = parseAndValidateId(event_id, "Event ID");
    if (is_verified !== undefined) where.is_verified = is_verified;

    const skip = (validPage - 1) * validLimit;
    const orderBy = { [sortBy]: sortOrder?.toLowerCase() || "desc" };

    const [reviews, totalCount] = await Promise.all([
      prisma.reviews.findMany({
        where,
        include: {
          account: { select: { account_id: true, username: true } },
          service: { select: { service_id: true, service_name: true } },
          event: { select: { event_id: true, event_name: true } },
        },
        skip,
        take: validLimit,
        orderBy,
      }),
      prisma.reviews.count({ where }),
    ]);

    return createValidationResult(true, [], {
      reviews,
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
    return handleError("getAllReviews", error);
  }
};

// ===== Delete Review =====
export const deleteReview = async (reviewId) => {
  try {
    const validReviewId = parseAndValidateId(reviewId, "Review ID");

    const existingReview = await prisma.reviews.findUnique({
      where: { review_id: validReviewId },
    });
    if (!existingReview) {
      return createValidationResult(false, ["Review not found"]);
    }

    await prisma.reviews.delete({
      where: { review_id: validReviewId },
    });

    return createValidationResult(true, [], { review_id: validReviewId });
  } catch (error) {
    return handleError("deleteReview", error);
  }
};