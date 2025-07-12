import { PrismaClient } from "@prisma/client";
import {
  validateString,
  validateNumber,
  validatePrice,
  validatePagination,
  parseAndValidateId,
  VALIDATION_CONFIG,
  createValidationResult
} from "../utils/validation.js";
import { uploadImage, deleteImageFromCloud, getTransformedImageUrl } from "../utils/cloudinary.js";

const prisma = new PrismaClient();

// ===== Helper Functions =====
const handleError = (context, error) => {
  console.error(`Error in ${context}:`, error);
  return createValidationResult(false, [error.message]);
};

const validateVariationData = (variationData) => {
  const errors = [];

  // Required fields validation
  const nameValidation = validateString(variationData.variation_name, "Variation name", {
    required: true,
    minLength: VALIDATION_CONFIG.VARIATION_NAME.MIN_LENGTH,
    maxLength: VALIDATION_CONFIG.VARIATION_NAME.MAX_LENGTH,
    sanitize: true
  });

  const priceValidation = validatePrice(variationData.base_price, "Base price", true);

  errors.push(...nameValidation.errors, ...priceValidation.errors);

  if (variationData.duration_hours) {
    const durationValidation = validateNumber(variationData.duration_hours, "Duration hours", {
      min: VALIDATION_CONFIG.DURATION.MIN,
      max: VALIDATION_CONFIG.DURATION.MAX
    });
    errors.push(...durationValidation.errors);
  }
  return errors;
};

const buildSortOrder = (sortBy, sortOrder) => {
  const validSortFields = [
    'variation_name', 'base_price', 'duration_hours',
    'created_at', 'bookings_count', 'variation_id', 'is_active', 'updated_at', 'service_id'
  ];

  const validSortOrders = ['asc', 'desc'];

  const field = validSortFields.includes(sortBy) ? sortBy : 'variation_name';
  const order = validSortOrders.includes(sortOrder?.toLowerCase()) ? sortOrder.toLowerCase() : 'asc';

  if (field === 'bookings_count') {
    return { bookings: { _count: order } };
  }

  return { [field]: order };
};

// ===== Create Service Variation =====
export const createServiceVariation = async (variationData, imageFile = null) => {
  try {
    const {
      service_id,
      variation_name,
      base_price,
      duration_hours,
      is_active = true
    } = variationData;
    console.log('service_id received:', service_id, typeof service_id);
    if (
      service_id === undefined ||
      service_id === null ||
      service_id === "" ||
      isNaN(Number(service_id)) ||
      Number(service_id) <= 0
    ) {
      return createValidationResult(false, ["Valid service ID is required"]);
    }

    const existingService = await prisma.service.findUnique({
      where: { service_id: Number(service_id) },
      select: { service_id: true, is_active: true },
    });
    if (!existingService || !existingService.is_active) {
      return createValidationResult(false, ["Service not found or inactive"]);
    }

    // Validate variation data
    const validationErrors = validateVariationData(variationData);
    if (validationErrors.length > 0) {
      return createValidationResult(false, validationErrors);
    }

    // Check for duplicate variation name within the same service
    const existingVariation = await prisma.Variation.findFirst({
      where: {
        service_id: Number(service_id),
        variation_name: variation_name.trim()
      }
    });

    if (existingVariation) {
      return createValidationResult(false, ["Variation with this name already exists for this service"]);
    }

    // ===== TRANSACTION START =====
    const newVariation = await prisma.$transaction(async (tx) => {
      // Upload image if provided
      let cloudinaryPublicId = null;
      let cloudinaryImageUrl = null;
      if (imageFile) {
        const uploadResult = await uploadImage(
          imageFile.buffer,
          `services/${service_id}/variations`,
          `${variation_name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`,
          {
            width: 800,
            height: 600,
            crop: 'fill',
            quality: 'auto'
          }
        );
        cloudinaryPublicId = uploadResult.public_id;
        cloudinaryImageUrl = uploadResult.secure_url;
      }

      // Create variation
      return tx.Variation.create({
        data: {
          service_id: Number(service_id),
          variation_name: variation_name.trim(),
          base_price: Number(base_price),
          duration_hours: duration_hours ? Number(duration_hours) : null,
          is_active: Boolean(is_active),
          image_public_id: cloudinaryPublicId,
          image_url: cloudinaryImageUrl
        },
        include: {
          service: {
            select: {
              service_id: true,
              service_name: true,
              is_active: true
            }
          },
          pricing_tiers: {
            select: {
              tier_id: true,
              price_modifier: true,
              valid_from: true,
              valid_to: true,
              is_active: true,
              variation_id: true
            }
          }
        }
      });
    });

    return createValidationResult(true, [], {
      ...newVariation,
      pricingTiersCount: newVariation.pricing_tiers.length
    });
  } catch (error) {
    return handleError("createServiceVariation", error);
  }
};

// ===== Get All Service Variations =====
export const getAllServiceVariations = async (filters = {}) => {
  try {
    const {
      service_id,
      isActive,
      includeInactive = false,
      priceMin,
      priceMax,
      durationMin,
      durationMax,
      search,
      page = 1,
      limit = 20,
      sortBy = 'variation_name',
      sortOrder = 'asc',
      includeService = false,
      includePricingTiers = false
    } = filters;

    // Validate pagination
    const { page: validPage, limit: validLimit, errors: paginationErrors } = validatePagination(page, limit);
    if (paginationErrors.length > 0) {
      return createValidationResult(false, paginationErrors);
    }

    // Build where clause
    const where = {};

    if (service_id) {
      const serviceIdValidation = parseAndValidateId(service_id, "Service ID");
      where.service_id = serviceIdValidation;
    }

    if (isActive !== undefined) where.is_active = Boolean(isActive);
    if (!includeInactive) where.is_active = true;

    // Price range filter
    if (priceMin || priceMax) {
      where.base_price = {};
      if (priceMin) where.base_price.gte = Number(priceMin);
      if (priceMax) where.base_price.lte = Number(priceMax);
    }

    // Duration range filter
    if (durationMin || durationMax) {
      where.duration_hours = {};
      if (durationMin) where.duration_hours.gte = Number(durationMin);
      if (durationMax) where.duration_hours.lte = Number(durationMax);
    }

    // Search filter
    if (search && search.trim()) {
      where.OR = [
        { variation_name: { contains: search.trim(), mode: 'insensitive' } }
      ];
    }

    // Build include clause
    const include = {};

    if (includeService) {
      include.service = {
        select: {
          service_id: true,
          service_name: true,
          is_active: true,
          is_available: true
        }
      };
    }

    if (includePricingTiers) {
      include.pricing_tiers = {
        select: {
          tier_id: true,
          price_modifier: true,
          valid_from: true,
          valid_to: true,
          is_active: true,
          variation_id: true
        },
        orderBy: { price_modifier: 'asc' },
        take: 10,
      };
    }

    const skip = (validPage - 1) * validLimit;
    const orderBy = buildSortOrder(sortBy, sortOrder);

    const [variations, totalCount] = await Promise.all([
      prisma.Variation.findMany({
        where,
        include,
        skip,
        take: validLimit,
        orderBy
      }),
      prisma.Variation.count({ where })
    ]);

    const processedVariations = variations.map(variation => ({
      ...variation,
      pricingTiersCount: variation.pricing_tiers?.length || 0,
      transformedImageUrl: variation.image_url || (variation.image_public_id
        ? getTransformedImageUrl(variation.image_public_id, {
            width: 400,
            height: 300,
            crop: 'fill',
            quality: 'auto'
          })
        : null)
    }));

    return createValidationResult(true, [], {
      variations: processedVariations,
      pagination: {
        page: validPage,
        limit: validLimit,
        totalCount,
        totalPages: Math.ceil(totalCount / validLimit),
        hasNextPage: validPage < Math.ceil(totalCount / validLimit),
        hasPreviousPage: validPage > 1
      }
    });
  } catch (error) {
    return handleError("getAllServiceVariations", error);
  }
};

// ===== Get Service Variation by ID =====
export const getServiceVariationById = async (variationId, options = {}) => {
  try {
    const validVariationId = parseAndValidateId(variationId, "Variation ID");

    const {
      includeService = true,
      includePricingTiers = true,
      includeBookings = false,
      bookingsLimit = 10
    } = options;

    const include = {};

    if (includeService) {
      include.service = {
        select: {
          service_id: true,
          service_name: true,
          is_active: true,
          is_available: true
        }
      };
    }

    if (includePricingTiers) {
      include.pricing_tiers = {
        select: {
          tier_id: true,
          price_modifier: true,
          valid_from: true,
          valid_to: true,
          is_active: true,
          variation_id: true
        },
        orderBy: { price_modifier: 'asc' }
      };
    }

    if (includeBookings) {
      include.bookings = {
        select: {
          booking_id: true,
          guest_count: true,
          total_price: true,
          booking_status: true,
          created_at: true
        },
        orderBy: { created_at: 'desc' },
        take: bookingsLimit
      };
    }

    const variation = await prisma.Variation.findUnique({
      where: { variation_id: validVariationId },
      include
    });

    if (!variation) {
      return createValidationResult(false, ["Service variation not found"]);
    }

    const result = {
      ...variation,
      pricingTiersCount: variation.pricing_tiers?.length || 0,
      bookingsCount: variation.bookings?.length || 0,
      transformedImageUrl: variation.image_url || (variation.image_public_id
        ? getTransformedImageUrl(variation.image_public_id, {
            width: 800,
            height: 600,
            crop: 'fill',
            quality: 'auto'
          })
        : null)
    };

    return createValidationResult(true, [], result);
  } catch (error) {
    return handleError("getServiceVariationById", error);
  }
};

// ===== Update Service Variation =====
export const updateServiceVariation = async (variationId, updateData, imageFile = null) => {
  try {
    const validVariationId = parseAndValidateId(variationId, "Variation ID");

    // Check if variation exists
    const existingVariation = await prisma.Variation.findUnique({
      where: { variation_id: validVariationId }
    });

    if (!existingVariation) {
      return createValidationResult(false, ["Service variation not found"]);
    }

    // Validate update data
    const validationErrors = validateVariationData(updateData);
    if (validationErrors.length > 0) {
      return createValidationResult(false, validationErrors);
    }

    const {
      variation_name,
      base_price,
      duration_hours,
      is_active
    } = updateData;

    // Check for duplicate name if name is being updated
    if (variation_name && variation_name !== existingVariation.variation_name) {
      const duplicateCheck = await prisma.Variation.findFirst({
        where: {
          service_id: existingVariation.service_id,
          variation_name: variation_name.trim(),
          variation_id: { not: validVariationId }
        }
      });

      if (duplicateCheck) {
        return createValidationResult(false, ["Variation with this name already exists for this service"]);
      }
    }

    // Handle image upload if provided
    let cloudinaryPublicId = existingVariation.image_public_id;
    let cloudinaryImageUrl = existingVariation.image_url;

    if (imageFile) {
      try {
        // Delete old image if exists
        if (existingVariation.image_public_id) {
          await deleteImageFromCloud(existingVariation.image_public_id);
        }

        // Upload new image
        const uploadResult = await uploadImage(
          imageFile.buffer,
          `services/${existingVariation.service_id}/variations`,
          `${(variation_name || existingVariation.variation_name).replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`,
          {
            width: 800,
            height: 600,
            crop: 'fill',
            quality: 'auto'
          }
        );
        cloudinaryPublicId = uploadResult.public_id;
        cloudinaryImageUrl = uploadResult.secure_url;
      } catch (uploadError) {
        return createValidationResult(false, [`Image upload failed: ${uploadError.message}`]);
      }
    }

    // Prepare update data
    const updateFields = {};
    if (variation_name !== undefined) updateFields.variation_name = variation_name.trim();
    if (base_price !== undefined) updateFields.base_price = Number(base_price);
    if (duration_hours !== undefined) updateFields.duration_hours = duration_hours ? Number(duration_hours) : null;
    if (is_active !== undefined) updateFields.is_active = Boolean(is_active);
    if (cloudinaryPublicId !== undefined) updateFields.image_public_id = cloudinaryPublicId;
    if (cloudinaryImageUrl !== undefined) updateFields.image_url = cloudinaryImageUrl;

    const updatedVariation = await prisma.Variation.update({
      where: { variation_id: validVariationId },
      data: updateFields,
      include: {
        service: {
          select: {
            service_id: true,
            service_name: true,
            is_active: true
          }
        },
        pricing_tiers: {
          select: {
            tier_id: true,
            price_modifier: true,
            valid_from: true,
            valid_to: true,
            is_active: true,
            variation_id: true
          }
        }
      }
    });

    return createValidationResult(true, [], {
      ...updatedVariation,
      pricingTiersCount: updatedVariation.pricing_tiers.length
    });
  } catch (error) {
    return handleError("updateServiceVariation", error);
  }
};

export const deleteServiceVariation = async (variationId, options = {}) => {
  try {
    const validVariationId = parseAndValidateId(variationId, "Variation ID");
    const { forceDelete = false } = options;

    // Check if variation exists
    const existingVariation = await prisma.Variation.findUnique({
      where: { variation_id: validVariationId },
      include: {
        pricing_tiers: {
          select: { tier_id: true }
        }
      }
    });

    if (!existingVariation) {
      return createValidationResult(false, ["Service variation not found"]);
    }

    // Query Event (or Booking) model for related bookings
    const eventServices = await prisma.EventService.findMany({
      where: { variation_id: validVariationId },
      select: { event_id: true }
    });
    const uniqueEventIds = [...new Set(eventServices.map(es => es.event_id))];
    const bookingsCount = uniqueEventIds.length;

    // Check for dependencies
    const hasDependencies = existingVariation.pricing_tiers.length > 0 || bookingsCount > 0;

    if (hasDependencies && !forceDelete) {
      return createValidationResult(false, [
        `Cannot delete variation. It has ${existingVariation.pricing_tiers.length} pricing tiers and ${bookingsCount} bookings. Use forceDelete option to delete anyway.`
      ], {
        pricingTiersCount: existingVariation.pricing_tiers.length,
        bookingsCount: bookingsCount
      });
    }

    // Use transaction to ensure data consistency
    await prisma.$transaction(async (tx) => {
      if (forceDelete) {
        // Delete related pricing tiers
        await tx.pricingTier.deleteMany({
          where: { variation_id: validVariationId }
        });

        // Update events/bookings to remove variation reference
        await tx.Event.updateMany({
          where: { variation_id: validVariationId },
          data: { variation_id: null }
        });
      }

      // Delete the variation
      await tx.Variation.delete({
        where: { variation_id: validVariationId }
      });
    });

    // Delete image from Cloudinary if exists
    if (existingVariation.image_public_id) {
      try {
        await deleteImageFromCloud(existingVariation.image_public_id);
      } catch (cloudinaryError) {
        console.warn("Failed to delete image from Cloudinary:", cloudinaryError.message);
      }
    }

    return createValidationResult(true, [], {
      variation_id: validVariationId,
      deletedPricingTiers: forceDelete ? existingVariation.pricing_tiers.length : 0,
      affectedBookings: forceDelete ? bookingsCount : 0
    });
  } catch (error) {
    return handleError("deleteServiceVariation", error);
  }
};

// ===== Get Variations by Service ID =====
export const getVariationsByServiceId = async (serviceId, options = {}) => {
  try {
    const validServiceId = parseAndValidateId(serviceId, "Service ID");

    const {
      includeInactive = false,
      includePricingTiers = false,
      sortBy = 'variation_name',
      sortOrder = 'asc'
    } = options;

    const where = {
      service_id: validServiceId,
      ...(includeInactive ? {} : { is_active: true })
    };

    const include = {};

    if (includePricingTiers) {
      include.pricing_tiers = {
        select: {
          tier_id: true,
          price_modifier: true,
          valid_from: true,
          valid_to: true,
          is_active: true,
          variation_id: true
        },
        orderBy: { price_modifier: 'asc' }
      };
    }

    const orderBy = buildSortOrder(sortBy, sortOrder);

    const variations = await prisma.Variation.findMany({
      where,
      include,
      orderBy
    });

    const processedVariations = variations.map(variation => ({
      ...variation,
      pricingTiersCount: variation.pricing_tiers?.length || 0,
      transformedImageUrl: variation.image_url || (variation.image_public_id
        ? getTransformedImageUrl(variation.image_public_id, {
            width: 400,
            height: 300,
            crop: 'fill',
            quality: 'auto'
          })
        : null)
    }));

    return createValidationResult(true, [], {
      variations: processedVariations,
      serviceId: validServiceId,
      totalCount: processedVariations.length
    });
  } catch (error) {
    return handleError("getVariationsByServiceId", error);
  }
};

// ===== Toggle Variation Status =====
export const toggleVariationStatus = async (variationId) => {
  try {
    const validVariationId = parseAndValidateId(variationId, "Variation ID");

    const variation = await prisma.Variation.findUnique({
      where: { variation_id: validVariationId },
      select: { is_active: true }
    });

    if (!variation) {
      return createValidationResult(false, ["Service variation not found"]);
    }

    const updatedVariation = await prisma.Variation.update({
      where: { variation_id: validVariationId },
      data: { is_active: !variation.is_active },
      include: {
        service: {
          select: {
            service_id: true,
            service_name: true
          }
        },
        pricing_tiers: {
          select: {
            tier_id: true,
            price_modifier: true,
            valid_from: true,
            valid_to: true,
            is_active: true,
            variation_id: true
          }
        }
      }
    });

    return createValidationResult(true, [], {
      ...updatedVariation,
      pricingTiersCount: updatedVariation.pricing_tiers.length
    });
  } catch (error) {
    return handleError("toggleVariationStatus", error);
  }
};

// ===== Bulk Update Variations =====
export const bulkUpdateVariations = async (variationIds, updateData) => {
  try {
    if (!Array.isArray(variationIds) || variationIds.length === 0) {
      return createValidationResult(false, ["Variation IDs array is required"]);
    }

    const validIds = variationIds.filter(id => !isNaN(id) && id > 0);
    if (validIds.length === 0) {
      return createValidationResult(false, ["No valid variation IDs provided"]);
    }

    const allowedFields = ['is_active'];
    const updateFields = {};

    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key)) {
        updateFields[key] = updateData[key];
      }
    });

    if (Object.keys(updateFields).length === 0) {
      return createValidationResult(false, ["No valid update fields provided"]);
    }

    const result = await prisma.Variation.updateMany({
      where: {
        variation_id: {
          in: validIds.map(id => Number(id))
        }
      },
      data: updateFields
    });

    return createValidationResult(true, [], {
      updatedCount: result.count,
      variationIds: validIds,
      updateData: updateFields
    });
  } catch (error) {
    return handleError("bulkUpdateVariations", error);
  }
};