import {
  createServiceVariation,
  getAllServiceVariations,
  getServiceVariationById,
  updateServiceVariation,
  deleteServiceVariation,
} from '../service/variation.service.js';
import { sendResponse } from '../utils/response.js';
import { parseAndValidateId, validateVariationData } from '../utils/validation.js';
import winston from 'winston';

// Setup logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ],
});

// Validate image file
const isValidImageFile = (file) => {
  const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const maxSize = 5 * 1024 * 1024; // 5MB
  return file && validTypes.includes(file.mimetype) && file.size <= maxSize;
};


export const createVariation = async (req, res) => {
  console.log('req.body:', req.body); 
  try {
    logger.info(`Creating variation with data: ${JSON.stringify(req.body)}`);

    const validation = validateVariationData(req.body);
    if (!validation.isValid) {
      logger.warn(`Validation failed: ${validation.errors}`);
      return sendResponse(res, 400, validation.errors);
    }

    if (req.file && !isValidImageFile(req.file)) {
      logger.warn('Invalid image file uploaded');
      return sendResponse(res, 400, 'Invalid image file. Only JPEG, PNG, or WebP files up to 5MB are allowed.');
    }

    const result = await createServiceVariation(validation.sanitizedData, req.file);
    if (!result.isValid) {
      logger.warn(`Service error: ${result.errors}`);
      return sendResponse(res, result.errors.includes('not found') ? 404 : 400, result.errors);
    }

    logger.info(`Variation created successfully: ${result.data.variation_id}`);
    return sendResponse(res, 201, 'Variation created successfully', result.data);
  } catch (error) {
    logger.error(`Error creating variation: ${error.message}`);
    return sendResponse(res, 500, error.message || 'Internal server error');
  }
};


export const getAllVariations = async (req, res) => {
  try {
    logger.info(`Fetching variations with filters: ${JSON.stringify(req.query)}`);
    const result = await getAllServiceVariations(req.query);
    if (!result.isValid) {
      logger.warn(`Service error: ${result.errors}`);
      return sendResponse(res, 400, result.errors);
    }

    logger.info(`Retrieved ${result.data.variations.length} variations`);
    return sendResponse(res, 200, 'Variations retrieved successfully', result.data);
  } catch (error) {
    logger.error(`Error fetching variations: ${error.message}`);
    return sendResponse(res, 500, error.message || 'Internal server error');
  }
};


export const getVariationById = async (req, res) => {
  try {
    logger.info(`Fetching variation with ID: ${req.params.id}`);
    const id = parseAndValidateId(req.params.id, 'Variation ID');
    const result = await getServiceVariationById(id, req.query);
    if (!result.isValid) {
      logger.warn(`Service error: ${result.errors}`);
      return sendResponse(res, result.errors.includes('not found') ? 404 : 400, result.errors);
    }

    logger.info(`Variation retrieved successfully: ${id}`);
    return sendResponse(res, 200, 'Variation retrieved successfully', result.data);
  } catch (error) {
    logger.error(`Error fetching variation: ${error.message}`);
    return sendResponse(res, 400, error.message || 'Invalid variation ID');
  }
};


export const updateVariation = async (req, res) => {
  try {
    logger.info(`Updating variation with ID: ${req.params.id}`);
    const id = parseAndValidateId(req.params.id, 'Variation ID');
    const validation = validateVariationData(req.body);
    if (!validation.isValid) {
      logger.warn(`Validation failed: ${validation.errors}`);
      return sendResponse(res, 400, validation.errors);
    }

    if (req.file && !isValidImageFile(req.file)) {
      logger.warn('Invalid image file uploaded');
      return sendResponse(res, 400, 'Invalid image file. Only JPEG, PNG, or WebP files up to 5MB are allowed.');
    }

    const result = await updateServiceVariation(id, validation.sanitizedData, req.file);
    if (!result.isValid) {
      logger.warn(`Service error: ${result.errors}`);
      return sendResponse(res, result.errors.includes('not found') ? 404 : 400, result.errors);
    }

    logger.info(`Variation updated successfully: ${id}`);
    return sendResponse(res, 200, 'Variation updated successfully', result.data);
  } catch (error) {
    logger.error(`Error updating variation: ${error.message}`);
    return sendResponse(res, 500, error.message || 'Internal server error');
  }
};


export const deleteVariation = async (req, res) => {
  try {
    logger.info(`Deleting variation with ID: ${req.params.id}`);
    const id = parseAndValidateId(req.params.id, 'Variation ID');
    const result = await deleteServiceVariation(id, req.query);
    if (!result.isValid) {
      logger.warn(`Service error: ${result.errors}`);
      return sendResponse(res, result.errors.includes('not found') ? 404 : 400, result.errors);
    }

    logger.info(`Variation deleted successfully: ${id}`);
    return sendResponse(res, 200, 'Variation deleted successfully', result.data);
  } catch (error) {
    logger.error(`Error deleting variation: ${error.message}`);
    return sendResponse(res, 500, error.message || 'Internal server error');
  }
};