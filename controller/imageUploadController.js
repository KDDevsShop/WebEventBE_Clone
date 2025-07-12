import { PrismaClient } from "@prisma/client";
import {
  validateString,
  parseAndValidateId,
  createValidationResult,
  validatePagination,
} from "../utils/validation.js";
import { validateToken } from "../middleware/authMiddleware.js";

const prisma = new PrismaClient();

// Helper function to handle errors
const handleError = (context, error) => {
  console.error(`Error in ${context}:`, error);
  return createValidationResult(false, [error.message]);
};

// Validate image data
const validateImageData = (imageData) => {
  const errors = [];

  // Required fields
  const urlValidation = validateString(imageData.url, "Image URL", {
    required: true,
    maxLength: 255,
    sanitize: true,
  });
  errors.push(...urlValidation.errors);

  // Optional fields
  if (imageData.caption) {
    const captionValidation = validateString(imageData.caption, "Caption", {
      maxLength: 255,
      sanitize: true,
    });
    errors.push(...captionValidation.errors);
  }

  if (imageData.variation_id) {
    const variationIdValidation = parseAndValidateId(imageData.variation_id, "Variation ID");
    if (typeof variationIdValidation !== 'number') {
      errors.push("Invalid variation ID");
    }
  }

  if (imageData.service_id) {
    const serviceIdValidation = parseAndValidateId(imageData.service_id, "Service ID");
    if (typeof serviceIdValidation !== 'number') {
      errors.push("Invalid service ID");
    }
  }

  return errors;
};

// POST /images - Create a new image
export const createImage = [validateToken, async (req, res) => {
  try {
    const { url, caption, variation_id, service_id } = req.body;
    const imageData = { url, caption, variation_id, service_id };

    // Validate data
    const validationErrors = validateImageData(imageData);
    if (validationErrors.length > 0) {
      return res.status(400).json(createValidationResult(false, validationErrors));
    }

    // Validate references
    const result = await prisma.$transaction(async (tx) => {
      if (variation_id) {
        const variation = await tx.variation.findUnique({
          where: { variation_id: Number(variation_id) },
          select: { variation_id: true },
        });
        if (!variation) {
          return createValidationResult(false, ["Variation not found"]);
        }
      }

      if (service_id) {
        const service = await tx.service.findUnique({
          where: { service_id: Number(service_id) },
          select: { service_id: true },
        });
        if (!service) {
          return createValidationResult(false, ["Service not found"]);
        }
      }

      const newImage = await tx.image.create({
        data: {
          url: url.trim(),
          caption: caption?.trim() || null,
          variation_id: variation_id ? Number(variation_id) : null,
          service_id: service_id ? Number(service_id) : null,
        },
        include: {
          variation: { select: { variation_id: true, name: true } },
          service: { select: { service_id: true, service_name: true } },
        },
      });

      return createValidationResult(true, [], {
        ...newImage,
        message: "Image created successfully",
      });
    });

    return res.status(result.isValid ? 201 : 400).json(result);
  } catch (error) {
    return res.status(500).json(handleError("createImage", error));
  }
}];

// GET /images - Get all images with filters and pagination
export const getAllImages = async (req, res) => {
  try {
    const { variation_id, service_id, page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'desc' } = req.query;

    // Validate pagination
    const { page: validPage, limit: validLimit, errors: paginationErrors } = validatePagination(page, limit);
    if (paginationErrors.length > 0) {
      return res.status(400).json(createValidationResult(false, paginationErrors));
    }

    // Build where clause
    const where = {};
    if (variation_id) {
      where.variation_id = parseAndValidateId(variation_id, "Variation ID");
    }
    if (service_id) {
      where.service_id = parseAndValidateId(service_id, "Service ID");
    }

    // Build include clause
    const include = {
      variation: { select: { variation_id: true, name: true } },
      service: { select: { service_id: true, service_name: true } },
    };

    const skip = (validPage - 1) * validLimit;
    const orderBy = {
      [sortBy || 'created_at']: sortOrder?.toLowerCase() === 'asc' ? 'asc' : 'desc',
    };

    const [images, totalCount] = await Promise.all([
      prisma.image.findMany({
        where,
        include,
        skip,
        take: validLimit,
        orderBy,
      }),
      prisma.image.count({ where }),
    ]);

    return res.status(200).json(
      createValidationResult(true, [], {
        images,
        pagination: {
          page: validPage,
          limit: validLimit,
          totalCount,
          totalPages: Math.ceil(totalCount / validLimit),
          hasNextPage: validPage < Math.ceil(totalCount / validLimit),
          hasPreviousPage: validPage > 1,
        },
        message: "Images retrieved successfully",
      })
    );
  } catch (error) {
    return res.status(500).json(handleError("getAllImages", error));
  }
};

// GET /images/:id - Get image by ID
export const getImageById = async (req, res) => {
  try {
    const { id } = req.params;
    const validImageId = parseAndValidateId(id, "Image ID");

    const image = await prisma.image.findUnique({
      where: { image_id: validImageId },
      include: {
        variation: { select: { variation_id: true, name: true } },
        service: { select: { service_id: true, service_name: true } },
      },
    });

    if (!image) {
      return res.status(404).json(createValidationResult(false, ["Image not found"]));
    }

    return res.status(200).json(
      createValidationResult(true, [], {
        ...image,
        message: "Image retrieved successfully",
      })
    );
  } catch (error) {
    return res.status(500).json(handleError("getImageById", error));
  }
};

// PATCH /images/:id - Update image
export const updateImage = [validateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const validImageId = parseAndValidateId(id, "Image ID");

    const { url, caption, variation_id, service_id } = req.body;
    const imageData = { url, caption, variation_id, service_id };

    // Validate data
    const validationErrors = validateImageData(imageData);
    if (validationErrors.length > 0) {
      return res.status(400).json(createValidationResult(false, validationErrors));
    }

    // Check if image exists
    const existingImage = await prisma.image.findUnique({
      where: { image_id: validImageId },
      select: { image_id: true },
    });

    if (!existingImage) {
      return res.status(404).json(createValidationResult(false, ["Image not found"]));
    }

    // Validate references
    const result = await prisma.$transaction(async (tx) => {
      if (variation_id) {
        const variation = await tx.variation.findUnique({
          where: { variation_id: Number(variation_id) },
          select: { variation_id: true },
        });
        if (!variation) {
          return createValidationResult(false, ["Variation not found"]);
        }
      }

      if (service_id) {
        const service = await tx.service.findUnique({
          where: { service_id: Number(service_id) },
          select: { service_id: true },
        });
        if (!service) {
          return createValidationResult(false, ["Service not found"]);
        }
      }

      const updatedImage = await tx.image.update({
        where: { image_id: validImageId },
        data: {
          url: url !== undefined ? url.trim() : undefined,
          caption: caption !== undefined ? caption?.trim() || null : undefined,
          variation_id: variation_id !== undefined ? (variation_id ? Number(variation_id) : null) : undefined,
          service_id: service_id !== undefined ? (service_id ? Number(service_id) : null) : undefined,
        },
        include: {
          variation: { select: { variation_id: true, name: true } },
          service: { select: { service_id: true, service_name: true } },
        },
      });

      return createValidationResult(true, [], {
        ...updatedImage,
        message: "Image updated successfully",
      });
    });

    return res.status(result.isValid ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json(handleError("updateImage", error));
  }
}];

// DELETE /images/:id - Delete image
export const deleteImage = [validateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const validImageId = parseAndValidateId(id, "Image ID");

    const existingImage = await prisma.image.findUnique({
      where: { image_id: validImageId },
      select: { image_id: true },
    });

    if (!existingImage) {
      return res.status(404).json(createValidationResult(false, ["Image not found"]));
    }

    await prisma.image.delete({
      where: { image_id: validImageId },
    });

    return res.status(200).json(
      createValidationResult(true, [], {
        image_id: validImageId,
        message: "Image deleted successfully",
      })
    );
  } catch (error) {
    return res.status(500).json(handleError("deleteImage", error));
  }
}];