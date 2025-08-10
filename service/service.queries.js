import { PrismaClient } from "@prisma/client";
import {
  handleImageUpload,
  calculateAverageRating,
  getServiceStatistics,
} from "./service.utils.js";
import {
  createValidationResult,
  parseAndValidateId,
  handleError,
} from "../utils/validation.js";
import { getServiceTypeByName } from "./serviceType.service.js";

const prisma = new PrismaClient();

export const createServiceQuery = async (serviceData, imageFiles) => {
  try {
    const {
      service_name,
      description,
      setup_time,
      is_available,
      is_active,
      service_type_id,
    } = serviceData;

    let imagesData = [];
    if (imageFiles && imageFiles.length > 0) {
      for (const [index, file] of imageFiles.entries()) {
        const uploadResult = await handleImageUpload(
          file,
          `services/${service_name.replace(
            /[^a-zA-Z0-9]/g,
            "_"
          )}_${Date.now()}_${index}`
        );
        imagesData.push({
          image_url: uploadResult.secure_url,
          image_public_id: uploadResult.image_public_id,
        });
      }
    }

    const newService = await prisma.$transaction(async (tx) => {
      return await tx.service.create({
        data: {
          service_name: service_name.trim(),
          description: description?.trim() || null,
          setup_time: Number(setup_time),
          is_available: Boolean(is_available),
          is_active: Boolean(is_active),
          service_type: service_type_id
            ? { connect: { service_type_id: Number(service_type_id) } }
            : undefined,
          images: imagesData.length > 0 ? { create: imagesData } : undefined,
        },
        include: {
          images: true,
          service_type: true,
          variations: {
            select: {
              variation_id: true,
              variation_name: true,
              base_price: true,
            },
          },
          reviews: { select: { rate: true } },
        },
      });
    });

    return createValidationResult(true, [], {
      ...newService,
      averageRating: calculateAverageRating(newService.reviews),
      reviewCount: newService.reviews?.length || 0,
      variationCount: newService.variations?.length || 0,
    });
  } catch (error) {
    return handleError("createServiceQuery", error);
  }
};

export const getAllServicesQuery = async (filters = {}) => {
  try {
    const {
      isActive,
      isAvailable,
      serviceTypeId,
      includeInactive,
      search,
      searchFields,
      createdFrom,
      createdTo,
      updatedFrom,
      updatedTo,
      minRating,
      maxRating,
      hasReviews,
      minSetupTime,
      maxSetupTime,
      minPrice,
      maxPrice,
      page,
      limit,
      sortBy,
      sortOrder,
      includeStats,
      includeReviews,
      includeVariations,
      includeImages,
    } = filters;

    const where = {};
    if (isActive !== undefined) where.is_active = Boolean(isActive);
    if (isAvailable !== undefined) where.is_available = Boolean(isAvailable);
    if (serviceTypeId !== undefined)
      where.service_type_id = Number(serviceTypeId);
    if (!includeInactive) where.is_active = true;

    if (search?.trim()) {
      const searchConditions = searchFields.map((field) => ({
        [field]: { contains: search.trim(), mode: "insensitive" },
      }));
      where.OR = searchConditions;
    }

    if (createdFrom || createdTo) {
      const dateFilter = {
        gte: createdFrom ? new Date(createdFrom) : undefined,
        lte: createdTo
          ? new Date(createdTo).setHours(23, 59, 59, 999)
          : undefined,
      };
      if (dateFilter.gte || dateFilter.lte) where.updated_at = dateFilter;
    }

    if (updatedFrom || updatedTo) {
      const dateFilter = {
        gte: updatedFrom ? new Date(updatedFrom) : undefined,
        lte: updatedTo
          ? new Date(updatedTo).setHours(23, 59, 59, 999)
          : undefined,
      };
      if (dateFilter.gte || dateFilter.lte) where.updated_at = dateFilter;
    }

    if (minSetupTime !== undefined || maxSetupTime !== undefined) {
      where.setup_time = {};
      if (minSetupTime !== undefined)
        where.setup_time.gte = Number(minSetupTime);
      if (maxSetupTime !== undefined)
        where.setup_time.lte = Number(maxSetupTime);
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.variations = {
        some: {
          ...(minPrice !== undefined && {
            base_price: { gte: Number(minPrice) },
          }),
          ...(maxPrice !== undefined && {
            base_price: { lte: Number(maxPrice) },
          }),
        },
      };
    }

    const include = {
      service_type: true,
      ...(includeImages && { images: true }),
      ...(includeVariations && {
        variations: {
          select: {
            variation_id: true,
            variation_name: true,
            base_price: true,
          },
        },
      }),
      reviews: includeReviews
        ? {
            include: {
              user: { select: { user_id: true, username: true, avatar: true } },
            },
            orderBy: { review_date: "desc" },
          }
        : { select: { rate: true } },
    };

    const pageNum = Number(page) > 0 ? Number(page) : 1;
    const limitNum = Number(limit) > 0 ? Number(limit) : 10;
    const skip = (pageNum - 1) * limitNum;
    const orderByObj = {
      [sortBy || "updated_at"]:
        sortOrder?.toLowerCase() === "asc" ? "asc" : "desc",
    };

    const [services, totalCount] = await Promise.all([
      prisma.service.findMany({
        where,
        include,
        skip,
        take: limitNum,
        orderBy: orderByObj,
      }),
      prisma.service.count({ where }),
    ]);

    const processedServices = services
      .map((service) => {
        const averageRating = calculateAverageRating(service.reviews);
        const reviewCount = service.reviews?.length || 0;

        if (minRating !== undefined && averageRating < Number(minRating))
          return null;
        if (maxRating !== undefined && averageRating > Number(maxRating))
          return null;
        if (hasReviews !== undefined && Boolean(hasReviews) !== reviewCount > 0)
          return null;

        const processedService = {
          ...service,
          averageRating,
          reviewCount,
          variationCount: service.variations?.length || 0,
          // tags: removed, not in schema
        };

        if (includeStats) {
          processedService.statistics = {
            totalVariations: service.variations?.length || 0,
            totalImages: service.images?.length || 0,
            priceRange: service.variations?.length
              ? {
                  min: Math.min(
                    ...service.variations.map((v) => Number(v.base_price))
                  ),
                  max: Math.max(
                    ...service.variations.map((v) => Number(v.base_price))
                  ),
                }
              : null,
          };
        }

        return processedService;
      })
      .filter(Boolean);

    return createValidationResult(true, [], {
      services: processedServices,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalCount,
        totalPages: Math.ceil(totalCount / limitNum),
        hasNextPage: pageNum < Math.ceil(totalCount / limitNum),
        hasPreviousPage: pageNum > 1,
      },
      filters: {
        applied: Object.keys(filters).length,
        search: search || null,
        sortBy,
        sortOrder,
      },
    });
  } catch (error) {
    return handleError("getAllServicesQuery", error);
  }
};

export const getServiceByIdQuery = async (serviceId, options) => {
  try {
    const validServiceId = parseAndValidateId(serviceId, "Service ID");
    if (!validServiceId)
      return createValidationResult(false, ["Invalid Service ID."]);

    const {
      includeReviews = true,
      includeVariations = true,
      includeImages = true,
      includeStats = false,
      includeRelated = false,
    } = options;

    const include = {
      service_type: true,
      ...(includeImages && { images: true }),
      ...(includeVariations && {
        variations: {
          select: {
            variation_id: true,
            variation_name: true,
            base_price: true,
          },
        },
      }),
      reviews: includeReviews
        ? {
            include: {
              account: {
                select: {
                  account_id: true,
                  account_name: true,
                  avatar_url: true,
                },
              },
            },
            orderBy: { review_date: "desc" },
          }
        : { select: { rate: true } },
    };

    const service = await prisma.service.findUnique({
      where: { service_id: validServiceId },
      include: {
        images: true, // important to include images!
        // variations, etc. if needed
      },
    });

    if (!service) return createValidationResult(false, ["Service not found."]);

    const result = {
      ...service,
      averageRating: calculateAverageRating(service.reviews),
      reviewCount: service.reviews?.length || 0,
      variationCount: service.variations?.length || 0,
      tags: service.tags ? service.tags.split(",").filter(Boolean) : [],
    };

    if (includeStats) {
      result.statistics = await getServiceStatistics(validServiceId);
    }

    if (includeRelated && service.service_type_id) {
      const relatedServices = await prisma.service.findMany({
        where: {
          service_type_id: service.service_type_id,
          service_id: { not: validServiceId },
          is_active: true,
        },
        include: {
          images: true,
          reviews: { select: { rate: true } },
          variations: {
            select: {
              variation_id: true,
              variation_name: true,
              base_price: true,
            },
          },
        },
        take: 5,
      });

      result.relatedServices = relatedServices.map((s) => ({
        ...s,
        averageRating: calculateAverageRating(s.reviews),
        reviewCount: s.reviews?.length || 0,
        variationCount: s.variations?.length || 0,
        tags: s.tags ? s.tags.split(",").filter(Boolean) : [],
      }));
    }

    return createValidationResult(true, [], result);
  } catch (error) {
    return handleError("getServiceByIdQuery", error);
  }
};

export const updateServiceQuery = async (serviceId, updateData, imageFile) => {
  try {
    const validServiceId = parseAndValidateId(serviceId, "Service ID");
    if (!validServiceId)
      return createValidationResult(false, ["Invalid Service ID."]);

    const existingService = await prisma.service.findUnique({
      where: { service_id: validServiceId },
      include: { images: true },
    });
    if (!existingService)
      return createValidationResult(false, ["Service not found."]);

    const {
      service_name,
      description,
      setup_time,
      is_available,
      is_active,
      service_type_id,
      replaceImages,
    } = updateData;
    let imageUrl = null;
    console.log(imageFile);
    if (imageFile && imageFile.length > 0) {
      const uploadPromises = imageFile.map((file) =>
        handleImageUpload(
          file,
          `services/${(service_name || existingService.service_name).replace(
            /[^a-zA-Z0-9]/g,
            "_"
          )}_${Date.now()}`
        )
      );
      const uploadResults = await Promise.all(uploadPromises);
      const imageUrls = uploadResults.map((res) => res.secure_url);
    }

    const updateFields = {};
    if (service_name !== undefined)
      updateFields.service_name = service_name.trim();
    if (description !== undefined)
      updateFields.description = description?.trim() || null;
    if (setup_time !== undefined) updateFields.setup_time = Number(setup_time);
    if (is_available !== undefined)
      updateFields.is_available = Boolean(is_available);
    if (is_active !== undefined) updateFields.is_active = Boolean(is_active);
    if (service_type_id !== undefined)
      updateFields.service_type_id = Number(service_type_id) || null;

    // Handle image update
    if (imageUrl) {
      updateFields.images = replaceImages
        ? { deleteMany: {}, create: [{ image_url: imageUrl }] }
        : { create: [{ image_url: imageUrl }] };
    }

    const updatedService = await prisma.$transaction(async (tx) => {
      // Optionally delete old images from cloud if replaceImages is true
      if (imageUrl && replaceImages && existingService.images.length > 0) {
        for (const image of existingService.images) {
          // Only delete from cloud if you have a public_id or similar
          // if (image.public_id) await deleteImageFromCloud(image.public_id);
        }
      }
      const service = await tx.service.update({
        where: { service_id: validServiceId },
        data: updateFields,
        include: {
          images: true,
          service_type: true,
          variations: {
            select: {
              variation_id: true,
              variation_name: true,
              base_price: true,
            },
          },
          reviews: { select: { rate: true } },
        },
      });
      return service;
    });

    return createValidationResult(true, [], {
      ...updatedService,
      averageRating: calculateAverageRating(updatedService.reviews),
      reviewCount: updatedService.reviews?.length || 0,
      variationCount: updatedService.variations?.length || 0,
    });
  } catch (error) {
    return handleError("updateServiceQuery", error);
  }
};

export const deleteServiceQuery = async (serviceId, options) => {
  try {
    const validServiceId = parseAndValidateId(serviceId, "Service ID");
    if (!validServiceId)
      return createValidationResult(false, ["Invalid Service ID."]);

    const { forceDelete = false } = options;

    const existingService = await prisma.service.findUnique({
      where: { service_id: validServiceId },
      include: {
        images: true,
        variations: { select: { variation_id: true } },
        reviews: { select: { review_id: true } },
      },
    });
    if (!existingService)
      return createValidationResult(false, ["Service not found."]);

    const hasDependencies =
      existingService.variations.length > 0 ||
      existingService.reviews.length > 0;
    if (hasDependencies && !forceDelete) {
      return createValidationResult(
        false,
        [
          `Cannot delete service. It has ${existingService.variations.length} variations and ${existingService.reviews.length} reviews. Use forceDelete option.`,
        ],
        {
          variationCount: existingService.variations.length,
          reviewCount: existingService.reviews.length,
        }
      );
    }

    await prisma.$transaction(async (tx) => {
      if (forceDelete) {
        await tx.reviews.deleteMany({ where: { service_id: validServiceId } });
        await tx.variation.deleteMany({
          where: { service_id: validServiceId },
        });
      }
      if (existingService.images.length > 0) {
        for (const image of existingService.images) {
          if (image.image_public_id)
            await deleteImageFromCloud(image.image_public_id);
        }
      }
      await tx.service.delete({ where: { service_id: validServiceId } });
    });

    return createValidationResult(true, [], { serviceId: validServiceId });
  } catch (error) {
    return handleError("deleteServiceQuery", error);
  }
};

export const bulkUpdateServicesQuery = async (
  serviceIds,
  updateData,
  tx = prisma
) => {
  try {
    if (!Array.isArray(serviceIds) || !serviceIds.length) {
      return createValidationResult(false, ["Service IDs array is required."]);
    }

    const validIds = [];
    const invalidIds = [];

    // Validate IDs
    for (const id of serviceIds) {
      const parsed = parseAndValidateId(id, "Service ID");
      if (parsed !== null) validIds.push(parsed);
      else invalidIds.push(id);
    }

    if (!validIds.length) {
      return createValidationResult(false, [
        `No valid service IDs provided. Invalid IDs: ${JSON.stringify(
          invalidIds
        )}`,
      ]);
    }

    // Kiểm tra sự tồn tại của serviceIds
    const existingServices = await tx.service.findMany({
      where: { service_id: { in: validIds }, is_active: true },
      select: { service_id: true },
    });
    const existingIds = existingServices.map((s) => s.service_id);
    const notFoundIds = validIds.filter((id) => !existingIds.includes(id));
    if (notFoundIds.length) {
      return createValidationResult(false, [
        `Some service IDs not found or inactive: ${JSON.stringify(
          notFoundIds
        )}`,
      ]);
    }

    const allowedFields = ["is_active", "is_available", "service_type_id"];
    const updateFields = {};

    for (const key of Object.keys(updateData)) {
      if (allowedFields.includes(key)) {
        if (key === "service_type_id") {
          const parsedId = parseAndValidateId(
            updateData[key],
            "Service Type ID"
          );
          if (parsedId === null) {
            return createValidationResult(false, ["Invalid service type ID"]);
          }
          // Kiểm tra service_type_id tồn tại
          const serviceType = await tx.serviceType.findUnique({
            where: { type_id: parsedId },
            select: { type_id: true },
          });
          if (!serviceType) {
            return createValidationResult(false, ["Service type not found"]);
          }
          updateFields[key] = parsedId;
        } else {
          updateFields[key] = updateData[key];
        }
      }
    }

    if (!Object.keys(updateFields).length) {
      return createValidationResult(false, [
        "No valid update fields provided.",
      ]);
    }

    const result = await tx.service.updateMany({
      where: { service_id: { in: validIds } },
      data: updateFields,
    });

    return createValidationResult(true, [], {
      updatedCount: result.count,
      serviceIds: validIds,
      updateData: updateFields,
      ...(invalidIds.length ? { invalidIds } : {}),
    });
  } catch (error) {
    return handleError("bulkUpdateServicesQuery", error);
  }
};

export const getServicesDashboardQuery = async (filters) => {
  try {
    const { dateFrom, dateTo, serviceTypeId } = filters;
    const where = {};

    if (dateFrom || dateTo) {
      const dateFilter = {
        gte: dateFrom ? new Date(dateFrom) : undefined,
        lte: dateTo ? new Date(dateTo).setHours(23, 59, 59, 999) : undefined,
      };
      if (dateFilter.gte || dateFilter.lte) where.updated_at = dateFilter;
    }
    if (serviceTypeId !== undefined)
      where.service_type_id = Number(serviceTypeId);

    const [
      totalServices,
      activeServices,
      inactiveServices,
      availableServices,
      servicesWithReviews,
      averageRating,
      servicesByType,
      recentServices,
      topRatedServices,
    ] = await Promise.all([
      prisma.service.count({ where }),
      prisma.service.count({ where: { ...where, is_active: true } }),
      prisma.service.count({ where: { ...where, is_active: false } }),
      prisma.service.count({ where: { ...where, is_available: true } }),
      prisma.service.count({ where: { ...where, reviews: { some: {} } } }),
      prisma.reviews.aggregate({
        where: { service: where },
        _avg: { rate: true },
      }),
      prisma.service.groupBy({
        by: ["service_type_id"],
        where,
        _count: true,
        orderBy: { _count: { service_type_id: "desc" } },
      }),
      prisma.service.findMany({
        where,
        include: {
          service_type: true,
          reviews: { select: { rate: true } },
          variations: {
            select: {
              variation_id: true,
              variation_name: true,
              base_price: true,
            },
          },
        },
        orderBy: { review_date: "desc" },
        take: 5,
      }),
      prisma.service.findMany({
        where: { ...where, reviews: { some: {} } },
        include: {
          service_type: true,
          reviews: { select: { rate: true } },
          variations: {
            select: {
              variation_id: true,
              variation_name: true,
              base_price: true,
            },
          },
        },
        orderBy: { reviews: { _count: "desc" } },
        take: 5,
      }),
    ]);

    return createValidationResult(true, [], {
      overview: {
        totalServices,
        activeServices,
        inactiveServices,
        availableServices,
        servicesWithReviews,
        averageRating: averageRating._avg?.rating
          ? Math.round(averageRating._avg.rating * 10) / 10
          : 0,
        reviewCoverage:
          totalServices > 0 ? (servicesWithReviews / totalServices) * 100 : 0,
      },
      servicesByType: servicesByType.map((item) => ({
        serviceTypeId: item.service_type_id,
        count: item._count,
      })),
      recentServices: recentServices.map((service) => ({
        ...service,
        averageRating: calculateAverageRating(service.reviews),
        reviewCount: service.reviews?.length || 0,
        variationCount: service.variations?.length || 0,
        tags: service.tags ? service.tags.split(",").filter(Boolean) : [],
      })),
      topRatedServices: topRatedServices.map((service) => ({
        ...service,
        averageRating: calculateAverageRating(service.reviews),
        reviewCount: service.reviews?.length || 0,
        variationCount: service.variations?.length || 0,
        tags: service.tags ? service.tags.split(",").filter(Boolean) : [],
      })),
    });
  } catch (error) {
    return handleError("getServicesDashboardQuery", error);
  }
};
