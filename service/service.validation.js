import {
  validateString,
  validateNumber,
  validateBoolean,
  validatePagination,
  validateDateRange,
  parseAndValidateId,
  VALIDATION_CONFIG,
  createValidationResult,
} from "../utils/validation.js";

const parseBoolean = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return false;
};

export const validateServiceData = (data, imageFile, isPartial = false) => {
  const errors = [];
  const sanitized = {};

  // Handle tags as comma-separated string
  if (data.tags && typeof data.tags === "string") {
    data.tags = data.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  if (!isPartial || data.service_name !== undefined) {
    const nameValidation = validateString(data.service_name, "Service name", {
      required: !isPartial,
      minLength: VALIDATION_CONFIG.SERVICE_NAME.MIN_LENGTH || 1,
      maxLength: VALIDATION_CONFIG.SERVICE_NAME.MAX_LENGTH || 255,
      sanitize: true,
    });
    errors.push(...nameValidation.errors);
    sanitized.service_name = nameValidation.sanitizedValue;
  }

  if (!isPartial || data.description !== undefined) {
    const descValidation = validateString(data.description, "Description", {
      maxLength: VALIDATION_CONFIG.DESCRIPTION.MAX_LENGTH || 5000,
      sanitize: true,
    });
    errors.push(...descValidation.errors);
    sanitized.description = data.description?.trim() || null;
  }

  if (!isPartial || data.setup_time !== undefined) {
    const setupValidation = validateNumber(data.setup_time, "Setup time", {
      min: VALIDATION_CONFIG.SETUP_TIME.MIN || 0,
      max: VALIDATION_CONFIG.SETUP_TIME.MAX || 1000,
    });
    errors.push(...setupValidation.errors);
    sanitized.setup_time =
      data.setup_time !== undefined ? Number(data.setup_time) : undefined;
  }

  if (!isPartial || data.is_available !== undefined) {
    const availableValidation = validateBoolean(
      parseBoolean(data.is_available),
      "Is available"
    );
    errors.push(...availableValidation.errors);
    sanitized.is_available =
      data.is_available !== undefined
        ? parseBoolean(data.is_available)
        : undefined;
  }

  if (!isPartial || data.is_active !== undefined) {
    const activeValidation = validateBoolean(
      parseBoolean(data.is_active),
      "Is active"
    );
    errors.push(...activeValidation.errors);
    sanitized.is_active =
      data.is_active !== undefined ? parseBoolean(data.is_active) : undefined;
  }

  if (!isPartial || data.service_type_id !== undefined) {
    const typeIdValidation = parseAndValidateId(
      data.service_type_id,
      "Service Type ID"
    );
    if (!typeIdValidation) errors.push("Invalid Service Type ID.");
    sanitized.service_type_id =
      data.service_type_id !== undefined
        ? Number(data.service_type_id) || null
        : undefined;
  }

  if (!isPartial || data.tags !== undefined) {
    if (data.tags && !Array.isArray(data.tags)) {
      errors.push("Tags must be an array of strings.");
    } else if (data.tags) {
      const cleanedTags = [];
      data.tags.forEach((tag, index) => {
        const tagValidation = validateString(tag, `Tag ${index + 1}`, {
          maxLength: VALIDATION_CONFIG.TAG.MAX_LENGTH || 50,
          sanitize: true,
        });
        errors.push(...tagValidation.errors);
        if (tagValidation.sanitizedValue) {
          cleanedTags.push(tagValidation.sanitizedValue);
        }
      });
      sanitized.tags = cleanedTags;
    }
  }

  if (imageFile && Array.isArray(imageFile)) {
    for (const file of imageFile) {
      if (!file.mimetype.startsWith("image/")) {
        errors.push(`Invalid image file type for file ${file.originalname}.`);
      }
    }
  } else if (imageFile && !imageFile.mimetype.startsWith("image/")) {
    errors.push("Invalid image file type.");
  }

  if (data.replaceImages !== undefined) {
    sanitized.replaceImages = parseBoolean(data.replaceImages);
  }

  if (errors.length > 0) {
    return { isValid: false, errors, sanitizedData: null };
  }

  return {
    isValid: true,
    errors: [],
    sanitizedData: sanitized,
  };
};

export const validateServiceFilters = (filters) => {
  const {
    page = 1,
    limit = 20,
    minSetupTime,
    maxSetupTime,
    minPrice,
    maxPrice,
    serviceTypeId,
    createdFrom,
    createdTo,
    updatedFrom,
    updatedTo,
    minRating,
    maxRating,
    tags,
    search,
    searchFields = ["service_name", "description", "tags"],
    isActive,
    isAvailable,
    includeInactive,
    hasReviews,
    includeStats,
    includeReviews,
    includeVariations,
    includeImages,
  } = filters;

  const paginationValidation = validatePagination(page, limit);
  if (paginationValidation.errors.length > 0)
    return createValidationResult(false, paginationValidation.errors);

  const errors = [];

  if (minSetupTime !== undefined) {
    const setupMinValidation = validateNumber(
      minSetupTime,
      "Minimum setup time",
      {
        min: VALIDATION_CONFIG.SETUP_TIME.MIN || 0,
      }
    );
    errors.push(...setupMinValidation.errors);
  }

  if (maxSetupTime !== undefined) {
    const setupMaxValidation = validateNumber(
      maxSetupTime,
      "Maximum setup time",
      {
        min: VALIDATION_CONFIG.SETUP_TIME.MIN || 0,
      }
    );
    errors.push(...setupMaxValidation.errors);
  }

  if (minPrice !== undefined) {
    const priceMinValidation = validateNumber(minPrice, "Minimum price", {
      min: 0,
    });
    errors.push(...priceMinValidation.errors);
  }

  if (maxPrice !== undefined) {
    const priceMaxValidation = validateNumber(maxPrice, "Maximum price", {
      min: 0,
    });
    errors.push(...priceMaxValidation.errors);
  }

  if (minRating !== undefined) {
    const ratingMinValidation = validateNumber(minRating, "Minimum rating", {
      min: 0,
      max: 5,
    });
    errors.push(...ratingMinValidation.errors);
  }

  if (maxRating !== undefined) {
    const ratingMaxValidation = validateNumber(maxRating, "Maximum rating", {
      min: 0,
      max: 5,
    });
    errors.push(...ratingMaxValidation.errors);
  }

  if (serviceTypeId !== undefined) {
    const typeIdValidation = parseAndValidateId(
      serviceTypeId,
      "Service Type ID"
    );
    if (!typeIdValidation) errors.push("Invalid Service Type ID.");
  }

  if (createdFrom || createdTo) {
    const dateValidation = validateDateRange(
      createdFrom,
      createdTo,
      "Created Date"
    );
    errors.push(...dateValidation.errors);
  }

  if (updatedFrom || updatedTo) {
    const dateValidation = validateDateRange(
      updatedFrom,
      updatedTo,
      "Updated Date"
    );
    errors.push(...dateValidation.errors);
  }

  if (tags && !Array.isArray(tags)) {
    errors.push("Tags must be an array of strings.");
  } else if (tags) {
    tags.forEach((tag, index) => {
      const tagValidation = validateString(tag, `Tag ${index + 1}`, {
        maxLength: VALIDATION_CONFIG.TAG.MAX_LENGTH || 50,
        sanitize: true,
      });
      errors.push(...tagValidation.errors);
    });
  }

  if (search && !Array.isArray(searchFields)) {
    errors.push("Search fields must be an array.");
  }

  if (errors.length > 0) return createValidationResult(false, errors);

  return createValidationResult(true, [], {
    page: Number(page),
    limit: Number(limit),
    minSetupTime: minSetupTime !== undefined ? Number(minSetupTime) : undefined,
    maxSetupTime: maxSetupTime !== undefined ? Number(maxSetupTime) : undefined,
    minPrice: minPrice !== undefined ? Number(minPrice) : undefined,
    maxPrice: maxPrice !== undefined ? Number(maxPrice) : undefined,
    minRating: minRating !== undefined ? Number(minRating) : undefined,
    maxRating: maxRating !== undefined ? Number(maxRating) : undefined,
    serviceTypeId:
      serviceTypeId !== undefined ? Number(serviceTypeId) : undefined,
    createdFrom,
    createdTo,
    updatedFrom,
    updatedTo,
    tags,
    search: search?.trim(),
    searchFields,
    isActive: isActive !== undefined ? Boolean(isActive) : undefined,
    isAvailable: isAvailable !== undefined ? Boolean(isAvailable) : undefined,
    includeInactive: Boolean(includeInactive),
    hasReviews: hasReviews !== undefined ? Boolean(hasReviews) : undefined,
    includeStats: Boolean(includeStats),
    includeReviews: Boolean(includeReviews),
    includeVariations: Boolean(includeVariations),
    includeImages: Boolean(includeImages),
  });
};

export const validateServiceTypeData = (data) => {
  const errors = [];
  const sanitizedData = {};

  const nameValidation = validateString(
    data.service_type_name,
    "Service Type Name",
    {
      required: true,
      minLength: 2,
      maxLength: 255,
      sanitize: true,
    }
  );
  if (!nameValidation.isValid) {
    errors.push(...nameValidation.errors);
  } else {
    sanitizedData.service_type_name = nameValidation.sanitizedValue;
  }

  const categoryValidation = validateString(data.category, "Category", {
    required: true,
    minLength: 2,
    maxLength: 255,
    sanitize: true,
  });
  if (!categoryValidation.isValid) {
    errors.push(...categoryValidation.errors);
  } else {
    sanitizedData.category = categoryValidation.sanitizedValue;
  }

  if (data.description !== undefined) {
    const descValidation = validateString(data.description, "Description", {
      maxLength: 5000,
      sanitize: true,
      required: false,
    });
    if (!descValidation.isValid) {
      errors.push(...descValidation.errors);
    } else {
      sanitizedData.description = descValidation.sanitizedValue;
    }
  }

  if (data.is_active !== undefined) {
    const activeValidation = validateBoolean(data.is_active, "Is Active");
    if (!activeValidation.isValid) {
      errors.push(...activeValidation.errors);
    } else {
      sanitizedData.is_active = activeValidation.sanitizedValue;
    }
  } else {
    sanitizedData.is_active = true;
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData,
  };
};
