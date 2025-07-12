import {
  createPricingTier,
  getPricingTierById,
  getAllPricingTiers,
  updatePricingTier,
  deletePricingTier,
  togglePricingTierStatus,
  getActivePricingTiers,
  getPricingTiersByPriceRange
} from "../service/pricingTier.service.js";
import { sendResponse } from "../utils/response.js";


export const createPricingTierController = async (req, res) => {
  try {
    const { name, description, price, isActive } = req.body;
    const result = await createPricingTier({ name, description, price, isActive });
    if (!result.isValid) {
      return sendResponse(res, 400, result.errors);
    }
    return sendResponse(res, 201, "Pricing tier created successfully", result.data);
  } catch (error) {
    console.error("Error creating pricing tier:", error);
    return sendResponse(res, 500, error.message);
  }
}

export const getPricingTierByIdController = async (req, res) => {
  const { id } = req.params;
  if (isNaN(Number(id))) {
    return sendResponse(res, 400, "Invalid pricing tier ID");
  }
  try {
    const result = await getPricingTierById(id);
    if (!result.isValid) {
      return sendResponse(res, 404, result.errors);
    }
    return sendResponse(res, 200, "Pricing tier retrieved successfully", result.data);
  } catch (error) {
    console.error("Error retrieving pricing tier:", error);
    return sendResponse(res, 500, "Internal server error");
  }
}

export const getAllPricingTiersController = async (req, res) => {
  try {
    const result = await getAllPricingTiers(req.query);
    if (!result.isValid) {
      return sendResponse(res, 400, result.errors);
    }
    return sendResponse(res, 200, "Pricing tiers retrieved successfully", result.data);
  } catch (error) {
    console.error("Error retrieving pricing tiers:", error);
    return sendResponse(res, 500, error.message);
  }
}

export const updatePricingTierController = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, isActive } = req.body;
    const result = await updatePricingTier(id, { name, description, price, isActive });
    if (!result.isValid) {
      return sendResponse(res, 400, result.errors);
    }
    return sendResponse(res, 200, "Pricing tier updated successfully", result.data);
  } catch (error) {
    console.error("Error updating pricing tier:", error);
    return sendResponse(res, 500, error.message);
  }
}

export const deletePricingTierController = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await deletePricingTier(id);
    if (!result.isValid) {
      return sendResponse(res, 404, result.errors);
    }
    return sendResponse(res, 200, "Pricing tier deleted successfully", result.data);
  } catch (error) {
    console.error("Error deleting pricing tier:", error);
    return sendResponse(res, 500, error.message);
  }
}

export const togglePricingTierStatusController = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await togglePricingTierStatus(id);
    if (!result.isValid) {
      return sendResponse(res, 400, result.errors);
    }
    return sendResponse(res, 200, "Pricing tier status toggled successfully", result.data);
  } catch (error) {
    console.error("Error toggling pricing tier status:", error);
    return sendResponse(res, 500, error.message);
  }
}

export const getActivePricingTiersController = async (req, res) => {
  try {
    const result = await getActivePricingTiers();
    if (!result.isValid) {
      return sendResponse(res, 400, result.errors);
    }
    return sendResponse(res, 200, "Active pricing tiers retrieved successfully", result.data);
  } catch (error) {
    console.error("Error retrieving active pricing tiers:", error);
    return sendResponse(res, 500, error.message);
  }
}


export const getPricingTiersByPriceRangeController = async (req, res) => {
  const { minPrice, maxPrice } = req.query;
  if (isNaN(Number(minPrice)) || isNaN(Number(maxPrice))) {
    return sendResponse(res, 400, "Invalid price range");
  }
  try {
    const result = await getPricingTiersByPriceRange(minPrice, maxPrice);
    if (!result.isValid) {
      return sendResponse(res, 400, result.errors);
    }
    return sendResponse(res, 200, "Pricing tiers by price range retrieved successfully", result.data);
  } catch (error) {
    console.error("Error retrieving pricing tiers by price range:", error);
    return sendResponse(res, 500, "Internal server error");
  }
}


