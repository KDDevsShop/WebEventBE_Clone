import { PrismaClient } from "@prisma/client";
import { 
  validateString, 
  validateNumber, 
  validatePrice, 
  validateBoolean, 
  validatePagination,
  validateDateRange,
  parseAndValidateId,
  VALIDATION_CONFIG,
  VALIDATION_ERRORS,
  createValidationResult 
} from "../utils/validation.js";

const prisma = new PrismaClient();

// ===== Helper Functions =====
const handleError = (context, error) => {
  console.error(`Error in ${context}:`, error);
  return createValidationResult(false, [error.message]);
};

const validatePricingTierData = (tierData) => {
  const errors = [];
  
  // Required fields validation
  const nameValidation = validateString(tierData.tier_name, "Tier name", {
    required: true,
    minLength: 1,
    maxLength: 255,
    sanitize: true
  });
  
  const priceValidation = validatePrice(tierData.price, "Price", true);
  
  errors.push(...nameValidation.errors, ...priceValidation.errors);
  
  // Guest count validation
  if (tierData.guest_count !== undefined) {
    const guestCountValidation = validateNumber(tierData.guest_count, "Guest count", {
      min: VALIDATION_CONFIG.GUEST_COUNT.MIN,
      max: VALIDATION_CONFIG.GUEST_COUNT.MAX,
      integer: true
    });
    errors.push(...guestCountValidation.errors);
  }
  
  // Description validation
  if (tierData.description) {
    const descValidation = validateString(tierData.description, "Description", {
      maxLength: VALIDATION_CONFIG.DESCRIPTION.MAX_LENGTH,
      sanitize: true
    });
    errors.push(...descValidation.errors);
  }
  
  // Duration validation
  if (tierData.duration_hours !== undefined) {
    const durationValidation = validateNumber(tierData.duration_hours, "Duration hours", {
      min: 0.5,
      max: 168, // 7 days
      allowDecimals: true
    });
    errors.push(...durationValidation.errors);
  }
  
  // Active status validation
  if (tierData.is_active !== undefined) {
    const activeValidation = validateBoolean(tierData.is_active, "Active status");
    errors.push(...activeValidation.errors);
  }
  
  // Features validation (assuming it's a JSON array)
  if (tierData.features) {
    if (!Array.isArray(tierData.features)) {
      errors.push("Features must be an array");
    } else {
      tierData.features.forEach((feature, index) => {
        const featureValidation = validateString(feature, `Feature ${index + 1}`, {
          required: true,
          minLength: 1,
          maxLength: 255,
          sanitize: true
        });
        errors.push(...featureValidation.errors);
      });
    }
  }
  
  return createValidationResult(errors.length === 0, errors);
};

const buildPricingTierQuery = (filters = {}) => {
  const where = {};
  
  // Filter by active status
  if (filters.is_active !== undefined) {
    where.is_active = filters.is_active;
  }
  
  // Filter by price range
  if (filters.min_price !== undefined || filters.max_price !== undefined) {
    where.price = {};
    if (filters.min_price !== undefined) {
      where.price.gte = filters.min_price;
    }
    if (filters.max_price !== undefined) {
      where.price.lte = filters.max_price;
    }
  }
  
  // Filter by guest count range
  if (filters.min_guests !== undefined || filters.max_guests !== undefined) {
    where.guest_count = {};
    if (filters.min_guests !== undefined) {
      where.guest_count.gte = filters.min_guests;
    }
    if (filters.max_guests !== undefined) {
      where.guest_count.lte = filters.max_guests;
    }
  }
  
  // Search by name
  if (filters.search) {
    where.tier_name = {
      contains: filters.search,
      mode: 'insensitive'
    };
  }
  
  return where;
};

// ===== CRUD Operations =====

/**
 * Create a new pricing tier
 */
export const createPricingTier = async (tierData) => {
  try {
    // Validate input data
    const validation = validatePricingTierData(tierData);
    if (!validation.isValid) {
      return createValidationResult(false, validation.errors);
    }
    
    // Check if tier name already exists
    const existingTier = await prisma.pricingTier.findFirst({
      where: { tier_name: tierData.tier_name }
    });
    
    if (existingTier) {
      return createValidationResult(false, [VALIDATION_ERRORS.DUPLICATE_ENTRY]);
    }
    
    // Create new pricing tier
    const newTier = await prisma.pricingTier.create({
      data: {
        tier_name: tierData.tier_name,
        price: tierData.price,
        guest_count: tierData.guest_count || null,
        description: tierData.description || null,
        duration_hours: tierData.duration_hours || null,
        features: tierData.features || [],
        is_active: tierData.is_active !== undefined ? tierData.is_active : true,
        created_at: new Date(),
        updated_at: new Date()
      }
    });
    
    return createValidationResult(true, [], newTier);
  } catch (error) {
    return handleError('createPricingTier', error);
  }
};

/**
 * Get pricing tier by ID
 */
export const getPricingTierById = async (id) => {
  try {
    const idValidation = parseAndValidateId(id);
    if (!idValidation.isValid) {
      return createValidationResult(false, idValidation.errors);
    }
    
    const tier = await prisma.pricingTier.findUnique({
      where: { id: idValidation.data }
    });
    
    if (!tier) {
      return createValidationResult(false, [VALIDATION_ERRORS.NOT_FOUND]);
    }
    
    return createValidationResult(true, [], tier);
  } catch (error) {
    return handleError('getPricingTierById', error);
  }
};

/**
 * Get all pricing tiers with optional filtering and pagination
 */
export const getAllPricingTiers = async (options = {}) => {
  try {
    const { filters = {}, pagination = {} } = options;
    
    // Validate pagination
    const paginationValidation = validatePagination(pagination);
    if (!paginationValidation.isValid) {
      return createValidationResult(false, paginationValidation.errors);
    }
    
    // Build query
    const where = buildPricingTierQuery(filters);
    
    // Get total count
    const totalCount = await prisma.pricingTier.count({ where });
    
    // Get paginated results
    const tiers = await prisma.pricingTier.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: paginationValidation.data.skip,
      take: paginationValidation.data.take
    });
    
    const result = {
      data: tiers,
      pagination: {
        page: paginationValidation.data.page,
        limit: paginationValidation.data.limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / paginationValidation.data.limit)
      }
    };
    
    return createValidationResult(true, [], result);
  } catch (error) {
    return handleError('getAllPricingTiers', error);
  }
};

/**
 * Update an existing pricing tier
 */
export const updatePricingTier = async (id, tierData) => {
  try {
    const idValidation = parseAndValidateId(id);
    if (!idValidation.isValid) {
      return createValidationResult(false, idValidation.errors);
    }
    
    // Validate input data
    const validation = validatePricingTierData(tierData);
    if (!validation.isValid) {
      return createValidationResult(false, validation.errors);
    }
    
    // Check if tier exists
    const existingTier = await prisma.pricingTier.findUnique({
      where: { id: idValidation.data }
    });
    
    if (!existingTier) {
      return createValidationResult(false, [VALIDATION_ERRORS.NOT_FOUND]);
    }
    
    // Check if new name conflicts with existing tier (if name is being changed)
    if (tierData.tier_name && tierData.tier_name !== existingTier.tier_name) {
      const nameConflict = await prisma.pricingTier.findFirst({
        where: { 
          tier_name: tierData.tier_name,
          id: { not: idValidation.data }
        }
      });
      
      if (nameConflict) {
        return createValidationResult(false, [VALIDATION_ERRORS.DUPLICATE_ENTRY]);
      }
    }
    
    // Update tier
    const updatedTier = await prisma.pricingTier.update({
      where: { id: idValidation.data },
      data: {
        ...tierData,
        updated_at: new Date()
      }
    });
    
    return createValidationResult(true, [], updatedTier);
  } catch (error) {
    return handleError('updatePricingTier', error);
  }
};

/**
 * Delete a pricing tier
 */
export const deletePricingTier = async (id) => {
  try {
    const idValidation = parseAndValidateId(id);
    if (!idValidation.isValid) {
      return createValidationResult(false, idValidation.errors);
    }
    
    // Check if tier exists
    const existingTier = await prisma.pricingTier.findUnique({
      where: { id: idValidation.data }
    });
    
    if (!existingTier) {
      return createValidationResult(false, [VALIDATION_ERRORS.NOT_FOUND]);
    }
    
    // Check if tier is in use (assuming there's a bookings table)
    const tierInUse = await prisma.booking.findFirst({
      where: { pricing_tier_id: idValidation.data }
    });
    
    if (tierInUse) {
      return createValidationResult(false, ["Cannot delete pricing tier that is in use"]);
    }
    
    // Delete tier
    await prisma.pricingTier.delete({
      where: { id: idValidation.data }
    });
    
    return createValidationResult(true, [], { message: "Pricing tier deleted successfully" });
  } catch (error) {
    return handleError('deletePricingTier', error);
  }
};

/**
 * Toggle active status of a pricing tier
 */
export const togglePricingTierStatus = async (id) => {
  try {
    const idValidation = parseAndValidateId(id);
    if (!idValidation.isValid) {
      return createValidationResult(false, idValidation.errors);
    }
    
    // Check if tier exists
    const existingTier = await prisma.pricingTier.findUnique({
      where: { id: idValidation.data }
    });
    
    if (!existingTier) {
      return createValidationResult(false, [VALIDATION_ERRORS.NOT_FOUND]);
    }
    
    // Toggle status
    const updatedTier = await prisma.pricingTier.update({
      where: { id: idValidation.data },
      data: { 
        is_active: !existingTier.is_active,
        updated_at: new Date()
      }
    });
    
    return createValidationResult(true, [], updatedTier);
  } catch (error) {
    return handleError('togglePricingTierStatus', error);
  }
};

/**
 * Get active pricing tiers only
 */
export const getActivePricingTiers = async () => {
  try {
    const tiers = await prisma.pricingTier.findMany({
      where: { is_active: true },
      orderBy: { price: 'asc' }
    });
    
    return createValidationResult(true, [], tiers);
  } catch (error) {
    return handleError('getActivePricingTiers', error);
  }
};

/**
 * Get pricing tiers by price range
 */
export const getPricingTiersByPriceRange = async (minPrice, maxPrice) => {
  try {
    const minPriceValidation = validatePrice(minPrice, "Minimum price", true);
    const maxPriceValidation = validatePrice(maxPrice, "Maximum price", true);
    
    const errors = [...minPriceValidation.errors, ...maxPriceValidation.errors];
    
    if (minPrice >= maxPrice) {
      errors.push("Minimum price must be less than maximum price");
    }
    
    if (errors.length > 0) {
      return createValidationResult(false, errors);
    }
    
    const tiers = await prisma.pricingTier.findMany({
      where: {
        price: {
          gte: minPrice,
          lte: maxPrice
        },
        is_active: true
      },
      orderBy: { price: 'asc' }
    });
    
    return createValidationResult(true, [], tiers);
  } catch (error) {
    return handleError('getPricingTiersByPriceRange', error);
  }
};

/**
 * Close Prisma connection
 */
export const closePrismaConnection = async () => {
  await prisma.$disconnect();
};

// Default export for convenience
export default {
  createPricingTier,
  getPricingTierById,
  getAllPricingTiers,
  updatePricingTier,
  deletePricingTier,
  togglePricingTierStatus,
  getActivePricingTiers,
  getPricingTiersByPriceRange,
  closePrismaConnection
};