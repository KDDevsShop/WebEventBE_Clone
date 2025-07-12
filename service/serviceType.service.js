import { PrismaClient } from '@prisma/client';
import { createValidationResult, validatePagination, validateString, validateBoolean, parseAndValidateId, validateNumber } from '../utils/validation.js';
import { validateServiceTypeData } from './service.validation.js';


const prisma = new PrismaClient();

export const getAllServiceTypes = async ({
  category,
  isActive = true, // Mặc định chỉ lấy ServiceType đang hoạt động
  search,
  service_type_id,
  page = 1,
  limit = 20,
  includeServices = true,
  includeStats = false,
  servicesLimit = 10,
}) => {
  try {
    // Validate pagination
    const pagination = validatePagination(page, limit);
    if (pagination.errors.length > 0) {
      return createValidationResult(false, pagination.errors);
    }

    // Validate servicesLimit
    const servicesLimitValidation = validateNumber(servicesLimit, 'Services Limit', {
      min: 1,
      max: 100,
      integer: true,
    });
    if (!servicesLimitValidation.isValid) {
      return createValidationResult(false, servicesLimitValidation.errors);
    }

    // Validate filters
    const where = {};
    if (service_type_id) {
      const validId = parseAndValidateId(service_type_id, 'Service Type ID');
      if (!validId) {
        return createValidationResult(false, ['Invalid Service Type ID']);
      }
      where.service_type_id = validId;
    }
    if (category) {
      const categoryValidation = validateString(category, 'Category', {
        minLength: VALIDATION_CONFIG.CATEGORY.MIN_LENGTH,
        maxLength: VALIDATION_CONFIG.CATEGORY.MAX_LENGTH,
        sanitize: true,
      });
      if (!categoryValidation.isValid) {
        return createValidationResult(false, categoryValidation.errors);
      }
      where.category = { equals: categoryValidation.sanitizedValue, mode: 'insensitive' };
    }
    if (isActive !== undefined) {
      const activeValidation = validateBoolean(isActive, 'Is Active');
      if (!activeValidation.isValid) {
        return createValidationResult(false, activeValidation.errors);
      }
      where.is_active = activeValidation.sanitizedValue;
    }
    if (search) {
      const searchValidation = validateString(search, 'Search', { maxLength: 255, sanitize: true });
      if (!searchValidation.isValid) {
        return createValidationResult(false, searchValidation.errors);
      }
      where.OR = [
        { service_type_name: { contains: searchValidation.sanitizedValue, mode: 'insensitive' } },
        { description: { contains: searchValidation.sanitizedValue, mode: 'insensitive' } },
      ];
    }

    // Build include clause
    const include = {
      services: includeServices
        ? {
            select: {
              service_id: true,
              service_name: true,
              is_active: true,
              is_available: true,
              ...(includeStats && {
                variations: { select: { base_price: true } },
                reviews: { select: { rating: true } },
              }),
            },
            orderBy: { updated_at: 'desc' },
            take: servicesLimitValidation.sanitizedValue,
          }
        : { select: { service_id: true } },
    };

    // Query ServiceTypes
    const [serviceTypes, total] = await Promise.all([
      prisma.serviceType.findMany({
        where,
        include,
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
        orderBy: { service_type_name: 'asc' },
      }),
      prisma.serviceType.count({ where }),
    ]);

    // Map results
    const result = serviceTypes.map((st) => {
      const baseResult = {
        ...st,
        servicesCount: st.services.length,
        activeServicesCount: st.services.filter((s) => s.is_active).length,
      };

      if (includeStats) {
        const totalReviews = st.services.reduce((sum, s) => sum + s.reviews.length, 0);
        const totalRating = st.services.reduce(
          (sum, s) => sum + s.reviews.reduce((rSum, r) => rSum + r.rating, 0),
          0
        );
        baseResult.statistics = {
          totalServices: st.services.length,
          activeServices: st.services.filter((s) => s.is_active).length,
          availableServices: st.services.filter((s) => s.is_available).length,
          totalVariations: st.services.reduce((sum, s) => sum + s.variations.length, 0),
          averageRating: totalReviews > 0 ? Math.round((totalRating / totalReviews) * 10) / 10 : 0,
          totalReviews,
          priceRange:
            st.services.length > 0
              ? {
                  min: Math.min(...st.services.flatMap((s) => s.variations.map((v) => Number(v.base_price)))),
                  max: Math.max(...st.services.flatMap((s) => s.variations.map((v) => Number(v.base_price)))),
                }
              : null,
        };
      }

      return baseResult;
    });

    return createValidationResult(true, [], {
      serviceTypes: result,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
        hasNextPage: pagination.page < Math.ceil(total / pagination.limit),
        hasPreviousPage: pagination.page > 1,
      },
    });
  } catch (error) {
    console.error('Error in getAllServiceTypes:', error);
    return createValidationResult(false, [error.message]);
  }
};



export const createServiceType = async ({
    service_type_name,
    category,
    description,
    is_active = true,
}) => {
  try {
    // Validate data
    const validation = validateServiceTypeData({
      service_type_name,
      category,
      description,
      is_active,
    });
    if (!validation.isValid) {
      return createValidationResult(false, validation.errors);
    }

    // Create ServiceType
    const newServiceType = await prisma.serviceType.create({
      data: validation.sanitizedData,
    });

    return createValidationResult(true, [], newServiceType);
  } catch (error) {
    console.error('Error creating service type:', error);
    return createValidationResult(false, [error.message]);
  }
}


export const getServiceTypeById = async (id) => {
  try {
    // Validate ID
    const validId = parseAndValidateId(id, 'Service Type ID');
    if (!validId) {
      return createValidationResult(false, ['Invalid Service Type ID']);
    }

    // Query ServiceType
    const serviceType = await prisma.serviceType.findFirst({
      where: { service_type_id: validId },
      include: {
        services: {
          select: {
            service_id: true,
            service_name: true,
            is_active: true,
            is_available: true,
          },
          orderBy: { updated_at: 'desc' },
        },
      },
    });

    if (!serviceType) {
      return createValidationResult(false, ['Service Type not found']);
    }

    return createValidationResult(true, [], serviceType);
  } catch (error) {
    console.error('Error retrieving service type:', error);
    return createValidationResult(false, [error.message]);
  }
}

export const getServiceTypeByName = async (name) => {
  try {
    // Validate name
    const nameValidation = validateString(name, 'Service Type Name', {
      minLength: 1,
      maxLength: 255,
      sanitize: true,
    });
    if (!nameValidation.isValid) {
      return createValidationResult(false, nameValidation.errors);
    }

    // Query ServiceType by name (case-insensitive)
    const serviceType = await prisma.serviceType.findFirst({
      where: {
        service_type_name: {
          equals: nameValidation.sanitizedValue,
          mode: 'insensitive',
        },
      },
      include: {
        services: {
          select: {
            service_id: true,
            service_name: true,
            is_active: true,
            is_available: true,
          },
          orderBy: { updated_at: 'desc' },
        },
      },
    });

    if (!serviceType) {
      return createValidationResult(false, ['Service Type not found']);
    }

    return createValidationResult(true, [], serviceType);
  } catch (error) {
    console.error('Error retrieving service type by name:', error);
    return createValidationResult(false, [error.message]);
  }
};


export const updateServiceType = async (id, updateData) => {
  try {
    // Validate ID
    const validId = parseAndValidateId(id, 'Service Type ID');
    if (!validId) {
      return createValidationResult(false, ['Invalid Service Type ID']);
    }

    // Validate update data
    const validation = validateServiceTypeData(updateData);
    if (!validation.isValid) {
      return createValidationResult(false, validation.errors);
    }

    // Update ServiceType
    const updatedServiceType = await prisma.serviceType.update({
      where: { service_type_id: validId },
      data: validation.sanitizedData,
    });

    return createValidationResult(true, [], updatedServiceType);
  } catch (error) {
    console.error('Error updating service type:', error);
    return createValidationResult(false, [error.message]);
  }
}

export const deleteServiceType = async (id) => {
    try {
        // Validate ID
        const validId = parseAndValidateId(id, 'Service Type ID');
        if (!validId) {
        return createValidationResult(false, ['Invalid Service Type ID']);
        }
    
        // Check if ServiceType exists
        const existingServiceType = await prisma.serviceType.findUnique({
        where: { service_type_id: validId },
        });
        if (!existingServiceType) {
        return createValidationResult(false, ['Service Type not found']);
        }
    
        // Delete ServiceType
        await prisma.serviceType.delete({
        where: { service_type_id: validId },
        });
    
        return createValidationResult(true, [], { message: 'Service Type deleted successfully' });
    } catch (error) {
        console.error('Error deleting service type:', error);
        return createValidationResult(false, [error.message]);
    }
    }