import {
  createServiceType,
  getServiceTypeById,
  updateServiceType,
  deleteServiceType,
  getAllServiceTypes,
  getServiceTypeByName
} from "../service/serviceType.service.js";
import { sendResponse } from "../utils/response.js";
import { createValidationResult } from '../utils/validation.js';
import { parseAndValidateId } from '../utils/validation.js';



// Create ServiceType
export const createServiceTypeController = async (req, res) => {
  try {
    const { service_type_name, category, description, is_active } = req.body;
    const result = await createServiceType({
      service_type_name,
      category,
      description,
      is_active,
    });
    if (!result.isValid)
      return sendResponse(res, 400, result.errors);
    return sendResponse(res, 201, "Service type created successfully", result.data);
  } catch (error) {
    console.error("Error creating service type:", error);
    return sendResponse(res, 500, error.message);
  }
};

// Get all ServiceTypes
export const getAllServiceTypesController = async (req, res) => {
  try {
    const result = await getAllServiceTypes(req.query);
    if (!result.isValid)
      return sendResponse(res, 400, result.errors);
    return sendResponse(res, 200, "Service types retrieved successfully", result.data);
  } catch (error) {
    console.error("Error retrieving service types:", error);
    return sendResponse(res, 500, error.message);
  }
};

// Get ServiceType by ID
export const getServiceTypeByIDController = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await getServiceTypeById(id);
    if (!result.isValid)
      return sendResponse(res, 404, result.errors);
    return sendResponse(res, 200, "Service type retrieved successfully", result.data);
  } catch (error) {
    console.error("Error retrieving service type:", error);
    return sendResponse(res, 500, error.message);
  }
};


//get ServiceType by Name
export const getServiceTypeByNameController = async (req, res) => {
  try {
    const { service_type_name } = req.params;
    const result = await getServiceTypeByName(service_type_name);
    if (!result.isValid)
      return sendResponse(res, 404, result.errors);
    return sendResponse(res, 200, "Service type retrieved successfully", result.data);
  } catch (error) {
    console.error("Error retrieving service type by name:", error);
    return sendResponse(res, 500, error.message);
  }
}


// Update ServiceType
export const updateServiceTypeController = async (req, res) => {
  try {
    const { id } = req.params;
    const { service_type_name, category, description, is_active } = req.body;
    const result = await updateServiceType(id, {
      service_type_name,
      category,
      description,
      is_active,
    });
    if (!result.isValid)
      return sendResponse(res, 400, result.errors);
    return sendResponse(res, 200, "Service type updated successfully", result.data);
  } catch (error) {
    console.error("Error updating service type:", error);
    return sendResponse(res, 500, error.message);
  }
};

// Delete ServiceType
export const deleteServiceTypeController = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await deleteServiceType(id);
    if (!result.isValid)
      return sendResponse(res, 404, result.errors);
    return sendResponse(res, 200, "Service type deleted successfully", result.data);
  } catch (error) {
    console.error("Error deleting service type:", error);
    return sendResponse(res, 500, error.message);
  }
};

