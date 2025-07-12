import { PrismaClient } from "@prisma/client";
import {
  validateNumber,
  validateString,
  parseAndValidateId,
  createValidationResult,
  validatePagination,
} from "../utils/validation.js";
import { createNotification } from "../utils/notification.js";
import { validateToken } from "../middleware/authMiddleware.js";
const prisma = new PrismaClient();

// Helper function to handle errors
const handleError = (context, error) => {
  console.error(`Error in ${context}:`, error);
  return createValidationResult(false, [error.message]);
};

// Validate review data
const validateReviewData = (reviewData) => {
  const errors = [];

  // Required fields
  const ratingValidation = validateNumber(reviewData.rating, "Rating", {
    required: true,
    min: 1,
    max: 5,
    integer: true,
  });
  const accountIdValidation = parseAndValidateId(reviewData.account_id, "Account ID");
  const variationIdValidation = parseAndValidateId(reviewData.variation_id, "Variation ID");

  errors.push(...ratingValidation.errors);
  if (typeof accountIdValidation !== 'number') errors.push("Invalid account ID");
  if (typeof variationIdValidation !== 'number') errors.push("Invalid variation ID");

  // Optional fields
  if (reviewData.comment) {
    const commentValidation = validateString(reviewData.comment, "Comment", {
      maxLength: 1000,
      sanitize: true,
    });
    errors.push(...commentValidation.errors);
  }

  return errors;
};

// POST /reviews - Create a new review
export const createReview = [validateToken, async (req, res) => {
  try {
    const { account_id, variation_id, rating, comment } = req.body;

    const reviewData = { account_id, variation_id, rating, comment };

    // Validate data
    const validationErrors = validateReviewData(reviewData);
    if (validationErrors.length > 0) {
      return res.status(400).json(createValidationResult(false, validationErrors));
    }

    // Validate references
    const result = await prisma.$transaction(async (tx) => {
      const account = await tx.account.findUnique({
        where: { account_id: Number(account_id) },
        select: { account_id: true },
      });
      if (!account) {
        return createValidationResult(false, ["Account not found"]);
      }

      const variation = await tx.variation.findUnique({
        where: { variation_id: Number(variation_id) },
        select: { variation_id: true, name: true },
      });
      if (!variation) {
        return createValidationResult(false, ["Variation not found"]);
      }

      const newReview = await tx.review.create({
        data: {
          account_id: Number(account_id),
          variation_id: Number(variation_id),
          rating: Number(rating),
          comment: comment?.trim() || null,
        },
        include: {
          account: { select: { account_id: true, account_name: true } },
          variation: { select: { variation_id: true, name: true } },
        },
      });

      // Create notification for review
      const notification = await createNotification({
        account_id: Number(account_id),
        title: "Review Created",
        message: `You submitted a ${rating}-star review for variation ${variation.name}.`,
        type: "CONFIRMATION",
      }, tx);

      if (!notification.isValid) {
        console.warn("Failed to send review creation notification:", notification.errors);
      }

      return createValidationResult(true, [], {
        ...newReview,
        message: "Review created successfully",
      });
    });

    return res.status(result.isValid ? 201 : 400).json(result);
  } catch (error) {
    return res.status(500).json(handleError("createReview", error));
  }
}];

// GET /reviews - Get all reviews with filters and pagination
export const getAllReviews = async (req, res) => {
  try {
    const { account_id, variation_id, rating, page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'desc' } = req.query;

    // Validate pagination
    const { page: validPage, limit: validLimit, errors: paginationErrors } = validatePagination(page, limit);
    if (paginationErrors.length > 0) {
      return res.status(400).json(createValidationResult(false, paginationErrors));
    }

    // Build where clause
    const where = {};
    if (account_id) {
      where.account_id = parseAndValidateId(account_id, "Account ID");
    }
    if (variation_id) {
      where.variation_id = parseAndValidateId(variation_id, "Variation ID");
    }
    if (rating) {
      where.rating = parseAndValidateId(rating, "Rating");
    }

    // Build include clause
    const include = {
      account: { select: { account_id: true, account_name: true } },
      variation: { select: { variation_id: true, name: true } },
    };

    const skip = (validPage - 1) * validLimit;
    const orderBy = {
      [sortBy || 'created_at']: sortOrder?.toLowerCase() === 'asc' ? 'asc' : 'desc',
    };

    const [reviews, totalCount] = await Promise.all([
      prisma.review.findMany({
        where,
        include,
        skip,
        take: validLimit,
        orderBy,
      }),
      prisma.review.count({ where }),
    ]);

    return res.status(200).json(
      createValidationResult(true, [], {
        reviews,
        pagination: {
          page: validPage,
          limit: validLimit,
          totalCount,
          totalPages: Math.ceil(totalCount / validLimit),
          hasNextPage: validPage < Math.ceil(totalCount / validLimit),
          hasPreviousPage: validPage > 1,
        },
        message: "Reviews retrieved successfully",
      })
    );
  } catch (error) {
    return res.status(500).json(handleError("getAllReviews", error));
  }
};

// GET /reviews/:id - Get review by ID
export const getReviewById = async (req, res) => {
  try {
    const { id } = req.params;
    const validReviewId = parseAndValidateId(id, "Review ID");

    const review = await prisma.review.findUnique({
      where: { review_id: validReviewId },
      include: {
        account: { select: { account_id: true, account_name: true } },
        variation: { select: { variation_id: true, name: true } },
      },
    });

    if (!review) {
      return res.status(404).json(createValidationResult(false, ["Review not found"]));
    }

    return res.status(200).json(
      createValidationResult(true, [], {
        ...review,
        message: "Review retrieved successfully",
      })
    );
  } catch (error) {
    return res.status(500).json(handleError("getReviewById", error));
  }
};

// PATCH /reviews/:id - Update review
export const updateReview = [validateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const validReviewId = parseAndValidateId(id, "Review ID");

    const { account_id, variation_id, rating, comment } = req.body;
    const reviewData = { account_id, variation_id, rating, comment };

    // Validate data
    const validationErrors = validateReviewData(reviewData);
    if (validationErrors.length > 0) {
      return res.status(400).json(createValidationResult(false, validationErrors));
    }

    // Check if review exists
    const existingReview = await prisma.review.findUnique({
      where: { review_id: validReviewId },
      select: { review_id: true },
    });

    if (!existingReview) {
      return res.status(404).json(createValidationResult(false, ["Review not found"]));
    }

    // Validate references
    const result = await prisma.$transaction(async (tx) => {
      if (account_id) {
        const account = await tx.account.findUnique({
          where: { account_id: Number(account_id) },
          select: { account_id: true },
        });
        if (!account) {
          return createValidationResult(false, ["Account not found"]);
        }
      }

      if (variation_id) {
        const variation = await tx.variation.findUnique({
          where: { variation_id: Number(variation_id) },
          select: { variation_id: true, name: true },
        });
        if (!variation) {
          return createValidationResult(false, ["Variation not found"]);
        }
      }

      const updatedReview = await tx.review.update({
        where: { review_id: validReviewId },
        data: {
          account_id: account_id !== undefined ? Number(account_id) : undefined,
          variation_id: variation_id !== undefined ? Number(variation_id) : undefined,
          rating: rating !== undefined ? Number(rating) : undefined,
          comment: comment !== undefined ? comment?.trim() || null : undefined,
        },
        include: {
          account: { select: { account_id: true, account_name: true } },
          variation: { select: { variation_id: true, name: true } },
        },
      });

      // Create notification for review update
      if (account_id || updatedReview.account_id) {
        const notification = await createNotification({
          account_id: Number(account_id || updatedReview.account_id),
          title: "Review Updated",
          message: `Your ${updatedReview.rating}-star review for variation ${updatedReview.variation.name} has been updated.`,
          type: "CONFIRMATION",
        }, tx);

        if (!notification.isValid) {
          console.warn("Failed to send review update notification:", notification.errors);
        }
      }

      return createValidationResult(true, [], {
        ...updatedReview,
        message: "Review updated successfully",
      });
    });

    return res.status(result.isValid ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json(handleError("updateReview", error));
  }
}];

// DELETE /reviews/:id - Delete review
export const deleteReview = [validateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const validReviewId = parseAndValidateId(id, "Review ID");

    const existingReview = await prisma.review.findUnique({
      where: { review_id: validReviewId },
      select: { review_id: true },
    });

    if (!existingReview) {
      return res.status(404).json(createValidationResult(false, ["Review not found"]));
    }

    await prisma.review.delete({
      where: { review_id: validReviewId },
    });

    return res.status(200).json(
      createValidationResult(true, [], {
        review_id: validReviewId,
        message: "Review deleted successfully",
      })
    );
  } catch (error) {
    return res.status(500).json(handleError("deleteReview", error));
  }
}];