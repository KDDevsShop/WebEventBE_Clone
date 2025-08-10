import {
  createServiceQuery,
  getAllServicesQuery,
  getServiceByIdQuery,
  updateServiceQuery,
  deleteServiceQuery,
  bulkUpdateServicesQuery,
  getServicesDashboardQuery,
} from '../service/service.queries.js';

import { advancedSearchServicesQuery } from '../service/service.search.js';
import {
  validateServiceData,
  validateServiceFilters,
} from '../service/service.validation.js';
import { sendResponse } from '../utils/response.js';
import { isValidId } from '../utils/validation.js';
import { validateToken } from '../middleware/authMiddleware.js';
export const createService = async (req, res) => {
  try {
    const validation = validateServiceData(req.body, req.files); // pass files array
    if (!validation.isValid) return sendResponse(res, 422, validation.errors);
    if (!validation.sanitizedData || !validation.sanitizedData.service_name)
      return sendResponse(res, 400, 'Missing or invalid service_name.');

    const result = await createServiceQuery(
      validation.sanitizedData,
      req.files
    );
    if (!result.isValid) return sendResponse(res, 500, result.errors);
    return sendResponse(res, 201, 'Service created successfully', result.data);
  } catch (error) {
    return sendResponse(res, 500, error.message);
  }
};

export const getAllServices = async (req, res) => {
  try {
    const validation = validateServiceFilters(req.query);
    if (!validation.isValid) return sendResponse(res, 422, validation.errors);

    const result = await getAllServicesQuery(validation.sanitizedData);
    if (!result.isValid) return sendResponse(res, 500, result.errors);
    return sendResponse(
      res,
      200,
      'Services retrieved successfully',
      result.data
    );
  } catch (error) {
    return sendResponse(res, 500, error.message);
  }
};

export const getServiceById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return sendResponse(res, 400, 'Invalid service ID');

    const result = await getServiceByIdQuery(parseInt(id), req.query);
    if (!result.isValid) return sendResponse(res, 404, result.errors);
    return sendResponse(
      res,
      200,
      'Service retrieved successfully',
      result.data
    );
  } catch (error) {
    return sendResponse(res, 500, error.message);
  }
};

export const updateService = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(req.files);
    if (!isValidId(id)) return sendResponse(res, 400, 'Invalid service ID');

    // Pass req.files (array) instead of req.file
    const validation = validateServiceData(req.body, req.files);

    if (!validation.isValid) return sendResponse(res, 422, validation.errors);

    const result = await updateServiceQuery(
      parseInt(id),
      validation.sanitizedData,
      req.files
    );
    if (!result.isValid) return sendResponse(res, 500, result.errors);
    return sendResponse(res, 200, 'Service updated successfully', result.data);
  } catch (error) {
    return sendResponse(res, 500, error.message);
  }
};

export const deleteService = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return sendResponse(res, 400, 'Invalid service ID');

    const result = await deleteServiceQuery(parseInt(id), req.query);
    if (!result.isValid) return sendResponse(res, 404, result.errors);
    return sendResponse(res, 200, 'Service deleted successfully', result.data);
  } catch (error) {
    return sendResponse(res, 500, error.message);
  }
};

export const advancedSearchServices = async (req, res) => {
  try {
    const { query, ...filters } = req.query;
    const validation = validateServiceFilters(filters);
    if (!validation.isValid) return sendResponse(res, 422, validation.errors);
    if (!validation.isValid) return sendResponse(res, 422, validation.errors);

    const result = await advancedSearchServicesQuery(req.query);
    if (!result.isValid) return sendResponse(res, 500, result.errors);
    return sendResponse(res, 200, 'Advanced search completed', result.data);
  } catch (error) {
    return sendResponse(res, 500, error.message);
  }
};

export const getServicesDashboard = async (req, res) => {
  try {
    const result = await getServicesDashboardQuery(req.query);
    if (!result.isValid) return sendResponse(res, 500, result.errors);
    return sendResponse(res, 200, 'Dashboard data retrieved', result.data);
  } catch (error) {
    return sendResponse(res, 500, error.message);
  }
};

export const bulkUpdateServices = [
  validateToken,
  async (req, res) => {
    try {
      if (req.user.role.toLowerCase() !== 'admin') {
        return sendResponse(res, 403, 'Forbidden: Admin access required');
      }

      const { serviceIds, updateData } = req.body;
      const requestId = generateRequestId();
      console.log(`[${requestId}] Received serviceIds:`, serviceIds);
      console.log(`[${requestId}] Numeric serviceIds:`, serviceIds.map(Number));

      if (!Array.isArray(serviceIds) || !serviceIds.length) {
        return sendResponse(res, 400, 'serviceIds must be a non-empty array');
      }

      const invalidInputs = serviceIds.filter(
        (id) => id === null || id === undefined || id === ''
      );
      if (invalidInputs.length) {
        return sendResponse(
          res,
          400,
          `Invalid service IDs: ${JSON.stringify(invalidInputs)}`
        );
        return sendResponse(
          res,
          400,
          `Invalid service IDs: ${JSON.stringify(invalidInputs)}`
        );
      }

      const numericServiceIds = serviceIds.map((id) => Number(id));
      const invalidIds = numericServiceIds.filter((id) => !isValidId(id));
      if (invalidIds.length) {
        return sendResponse(
          res,
          400,
          `Invalid service IDs: ${JSON.stringify(invalidIds)}`
        );
        return sendResponse(
          res,
          400,
          `Invalid service IDs: ${JSON.stringify(invalidIds)}`
        );
      }

      const validation = validateServiceData(updateData, null, true);
      if (!validation.isValid) {
        return sendResponse(res, 422, validation.errors);
      }

      const result = await bulkUpdateServicesQuery(
        numericServiceIds,
        validation.sanitizedData
      );
      if (!result.isValid) {
        return sendResponse(res, 400, result.errors);
      }

      return sendResponse(res, 200, 'Bulk update successful', result.data);
    } catch (error) {
      console.error(`[${requestId}] Error in bulkUpdateServices:`, error);
      return sendResponse(res, 500, `Internal server error: ${error.message}`);
    }
  },
];

export const exportServices = async (req, res) => {
  try {
    const { format = 'json' } = req.query;
    const result = await getAllServicesQuery({
      ...req.query,
      limit: 1000,
      includeStats: true,
    });
    if (!result.isValid) return sendResponse(res, 500, result.errors);

    const exportData = (result.data.services || []).map((service) => ({
      service_id: service.service_id,
      service_name: service.service_name,
      description: service.description,
      setup_time: service.setup_time,
      is_active: service.is_active,
      is_available: service.is_available,
      service_type: service.service_type?.service_type_name || null,
      average_rating: service.averageRating,
      review_count: service.reviewCount,
      variation_count: service.variations?.length || 0,
      image_count: service.images?.length || 0,
      tags: service.tags?.join(', ') || '',
      created_at: service.created_at,
      updated_at: service.updated_at,
    }));

    return sendResponse(res, 200, 'Services exported', {
      services: exportData,
      format,
      exportedAt: new Date(),
      totalCount: exportData.length,
    });
  } catch (error) {
    return sendResponse(res, 500, error.message);
  }
};
