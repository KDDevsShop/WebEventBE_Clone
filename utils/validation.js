// utils/validation.js
import crypto from 'crypto';

// Configuration constants
export const VALIDATION_CONFIG = {
  // Account validation
  ACCOUNT_NAME: {
    MIN_LENGTH: 2,
    MAX_LENGTH: 50,
    PATTERN: /^[a-zA-Z0-9_\-\s]+$/,
  },
  EMAIL: {
    MAX_LENGTH: 255,
    PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
  PASSWORD: {
    MIN_LENGTH: 8,
    MAX_LENGTH: 128,
    PATTERN:
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])[A-Za-z\d!@#$%^&*(),.?":{}|<>]/,
  },
  PHONE: {
    MAX_LENGTH: 20,
    PATTERN: /^[\+]?[0-9\s\-\(\)]{10,20}$/,
  },

  // Service validation
  SERVICE_NAME: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 1024,
  },
  SERVICE_TYPE_NAME: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 255,
  },
  VARIATION_NAME: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 255,
  },
  CATEGORY: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 255,
  },
  DESCRIPTION: {
    MAX_LENGTH: 5000,
  },

  // Room validation
  ROOM_NAME: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 1024,
  },
  ROOM_DESCRIPTION: {
    MAX_LENGTH: 1024,
  },
  GUEST_CAPACITY: {
    MIN: 1,
    MAX: 10000,
  },

  // Event validation
  EVENT_NAME: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 1024,
  },
  GUEST_COUNT: {
    MIN: 1,
    MAX: 10000,
  },

  // Pricing validation
  PRICE: {
    MIN: 0.01,
    MAX: 999999.99,
    DECIMAL_PLACES: 2,
  },
  DURATION: {
    MIN: 0.5,
    MAX: 168, // 1 week in hours
  },
  SETUP_TIME: {
    MIN: 0,
    MAX: 480, // 8 hours in minutes
  },
  ADVANCE_BOOKING: {
    MIN: 0,
    MAX: 365, // 1 year
  },

  // Pagination
  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
    MIN_PAGE: 1,
    MIN_LIMIT: 1,
  },

  // General
  SORT_ORDER: {
    MIN: -1000,
    MAX: 1000,
  },
};

// Error messages
export const VALIDATION_ERRORS = {
  // General
  REQUIRED_FIELD: (field) => `${field} is required`,
  INVALID_TYPE: (field, type) => `${field} must be a ${type}`,
  INVALID_FORMAT: (field) => `${field} has invalid format`,
  INVALID_LENGTH: (field, min, max) =>
    `${field} must be between ${min} and ${max} characters`,
  INVALID_RANGE: (field, min, max) =>
    `${field} must be between ${min} and ${max}`,
  INVALID_EMAIL: 'Email format is invalid',
  INVALID_PHONE: 'Phone number format is invalid',
  INVALID_PASSWORD:
    'Password must contain at least 8 characters with uppercase, lowercase, number and special character',
  INVALID_DATE: 'Invalid date format',
  INVALID_ENUM: (field, values) =>
    `${field} must be one of: ${values.join(', ')}`,

  // Business logic
  START_AFTER_END: 'Start time cannot be after end time',
  PAST_DATE: 'Date cannot be in the past',
  MIN_GREATER_THAN_MAX: (field) =>
    `Minimum ${field} cannot be greater than maximum ${field}`,
  DUPLICATE_ENTRY: (field) => `${field} already exists`,

  // Pagination
  INVALID_PAGE: 'Page number must be a positive integer',
  INVALID_LIMIT: 'Limit must be between 1 and 100',

  // File/URL validation
  INVALID_URL: 'Invalid URL format',
  INVALID_IMAGE_URL: 'Invalid image URL format',
};

// Sanitization functions
export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return input.trim().replace(/[<>\"'&]/g, '');
};

export const sanitizeHtml = (input) => {
  if (typeof input !== 'string') return input;
  return input
    .trim()
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/&/g, '&amp;');
};

export const validateVariationData = (data) => {
  return validateObject(data, VALIDATION_SCHEMAS.SERVICE_VARIATION);
};

// ID validation
export function parseAndValidateId(id, label = 'ID') {
  console.log(label, id);
  const num = Number(id);
  console.log(label, num);
  if (isNaN(num) || num <= 0) return null;
  return num;
}

// String validation
export const validateString = (value, fieldName, config = {}) => {
  const errors = [];

  if (config.required && (!value || typeof value !== 'string')) {
    errors.push(VALIDATION_ERRORS.REQUIRED_FIELD(fieldName));
    return { isValid: false, errors, sanitizedValue: null };
  }

  if (!value) {
    return { isValid: true, errors: [], sanitizedValue: null };
  }

  if (typeof value !== 'string') {
    errors.push(VALIDATION_ERRORS.INVALID_TYPE(fieldName, 'string'));
    return { isValid: false, errors, sanitizedValue: null };
  }

  const trimmedValue = value.trim();

  if (config.minLength && trimmedValue.length < config.minLength) {
    errors.push(
      VALIDATION_ERRORS.INVALID_LENGTH(
        fieldName,
        config.minLength,
        config.maxLength || 'unlimited'
      )
    );
  }

  if (config.maxLength && trimmedValue.length > config.maxLength) {
    errors.push(
      VALIDATION_ERRORS.INVALID_LENGTH(
        fieldName,
        config.minLength || 0,
        config.maxLength
      )
    );
  }

  if (config.pattern && !config.pattern.test(trimmedValue)) {
    errors.push(VALIDATION_ERRORS.INVALID_FORMAT(fieldName));
  }

  const sanitizedValue = config.sanitize
    ? sanitizeInput(trimmedValue)
    : trimmedValue;

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedValue,
  };
};

// Email validation
export const validateEmail = (email, required = true) => {
  return validateString(email, 'Email', {
    required,
    maxLength: VALIDATION_CONFIG.EMAIL.MAX_LENGTH,
    pattern: VALIDATION_CONFIG.EMAIL.PATTERN,
    sanitize: true,
  });
};

// Password validation
export const validatePassword = (password, required = true) => {
  if (!password && required) {
    return {
      isValid: false,
      errors: ['Password is required'],
      sanitizedValue: null,
    };
  }
  if (!password) {
    return { isValid: true, errors: [], sanitizedValue: null };
  }
  return validateString(password, 'Password', {
    required,
    minLength: VALIDATION_CONFIG.PASSWORD.MIN_LENGTH,
    maxLength: VALIDATION_CONFIG.PASSWORD.MAX_LENGTH,
    pattern: VALIDATION_CONFIG.PASSWORD.PATTERN,
  });
};

// Phone validation
export const validatePhone = (phone, required = true) => {
  // Đặt required = true theo yêu cầu
  return validateString(phone, 'Phone', {
    required,
    maxLength: VALIDATION_CONFIG.PHONE.MAX_LENGTH,
    pattern: VALIDATION_CONFIG.PHONE.PATTERN,
    sanitize: true,
  });
};

// Number validation
export const validateNumber = (value, fieldName, config = {}) => {
  const errors = [];

  if (config.required && (value === undefined || value === null)) {
    errors.push(VALIDATION_ERRORS.REQUIRED_FIELD(fieldName));
    return { isValid: false, errors, sanitizedValue: null };
  }

  if (value === undefined || value === null) {
    return { isValid: true, errors: [], sanitizedValue: null };
  }

  const numValue = parseFloat(value);
  if (isNaN(numValue)) {
    errors.push(VALIDATION_ERRORS.INVALID_TYPE(fieldName, 'number'));
    return { isValid: false, errors, sanitizedValue: null };
  }

  if (config.min !== undefined && numValue < config.min) {
    errors.push(
      VALIDATION_ERRORS.INVALID_RANGE(
        fieldName,
        config.min,
        config.max || 'unlimited'
      )
    );
  }

  if (config.max !== undefined && numValue > config.max) {
    errors.push(
      VALIDATION_ERRORS.INVALID_RANGE(
        fieldName,
        config.min || 'unlimited',
        config.max
      )
    );
  }

  if (config.integer && !Number.isInteger(numValue)) {
    errors.push(`${fieldName} must be an integer`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedValue: config.integer ? parseInt(numValue) : numValue,
  };
};

// Price validation
export const validatePrice = (price, fieldName = 'Price', required = true) => {
  return validateNumber(price, fieldName, {
    required,
    min: VALIDATION_CONFIG.PRICE.MIN,
    max: VALIDATION_CONFIG.PRICE.MAX,
  });
};

// Date validation
export const validateDate = (date, fieldName, config = {}) => {
  const errors = [];

  if (config.required && !date) {
    errors.push(VALIDATION_ERRORS.REQUIRED_FIELD(fieldName));
    return { isValid: false, errors, sanitizedValue: null };
  }

  if (!date) {
    return { isValid: true, errors: [], sanitizedValue: null };
  }

  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) {
    errors.push(VALIDATION_ERRORS.INVALID_DATE);
    return { isValid: false, errors, sanitizedValue: null };
  }

  if (config.notPast && dateObj < new Date()) {
    errors.push(VALIDATION_ERRORS.PAST_DATE);
  }

  if (config.minDate && dateObj < new Date(config.minDate)) {
    errors.push(`${fieldName} cannot be before ${config.minDate}`);
  }

  if (config.maxDate && dateObj > new Date(config.maxDate)) {
    errors.push(`${fieldName} cannot be after ${config.maxDate}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedValue: dateObj,
  };
};

// Boolean validation
export const validateBoolean = (value, fieldName, required = false) => {
  if (required && value === undefined) {
    return {
      isValid: false,
      errors: [VALIDATION_ERRORS.REQUIRED_FIELD(fieldName)],
      sanitizedValue: null,
    };
  }

  if (value === undefined) {
    return { isValid: true, errors: [], sanitizedValue: null };
  }

  return {
    isValid: true,
    errors: [],
    sanitizedValue: Boolean(value),
  };
};

// Enum validation
export const validateEnum = (
  value,
  fieldName,
  enumValues,
  required = false
) => {
  if (required && !value) {
    return {
      isValid: false,
      errors: [VALIDATION_ERRORS.REQUIRED_FIELD(fieldName)],
      sanitizedValue: null,
    };
  }

  if (!value) {
    return { isValid: true, errors: [], sanitizedValue: null };
  }

  if (!enumValues.includes(value)) {
    return {
      isValid: false,
      errors: [VALIDATION_ERRORS.INVALID_ENUM(fieldName, enumValues)],
      sanitizedValue: null,
    };
  }

  return {
    isValid: true,
    errors: [],
    sanitizedValue: value,
  };
};

// URL validation
export const validateUrl = (url, fieldName = 'URL', required = false) => {
  if (required && !url) {
    return {
      isValid: false,
      errors: [VALIDATION_ERRORS.REQUIRED_FIELD(fieldName)],
      sanitizedValue: null,
    };
  }

  if (!url) {
    return { isValid: true, errors: [], sanitizedValue: null };
  }

  try {
    new URL(url);
    return {
      isValid: true,
      errors: [],
      sanitizedValue: url.trim(),
    };
  } catch {
    return {
      isValid: false,
      errors: [VALIDATION_ERRORS.INVALID_URL],
      sanitizedValue: null,
    };
  }
};

// Pagination validation
export const validatePagination = (page, limit) => {
  const pageValidation = validateNumber(page, 'Page', {
    min: VALIDATION_CONFIG.PAGINATION.MIN_PAGE,
    integer: true,
  });

  const limitValidation = validateNumber(limit, 'Limit', {
    min: VALIDATION_CONFIG.PAGINATION.MIN_LIMIT,
    max: VALIDATION_CONFIG.PAGINATION.MAX_LIMIT,
    integer: true,
  });

  return {
    page:
      pageValidation.sanitizedValue ||
      VALIDATION_CONFIG.PAGINATION.DEFAULT_PAGE,
    limit:
      limitValidation.sanitizedValue ||
      VALIDATION_CONFIG.PAGINATION.DEFAULT_LIMIT,
    errors: [...pageValidation.errors, ...limitValidation.errors],
  };
};

// Date range validation
export const validateDateRange = (startDate, endDate, fieldPrefix = '') => {
  const errors = [];

  const startValidation = validateDate(startDate, `${fieldPrefix}Start Date`);
  const endValidation = validateDate(endDate, `${fieldPrefix}End Date`);

  errors.push(...startValidation.errors, ...endValidation.errors);

  if (
    startValidation.isValid &&
    endValidation.isValid &&
    startValidation.sanitizedValue &&
    endValidation.sanitizedValue &&
    startValidation.sanitizedValue > endValidation.sanitizedValue
  ) {
    errors.push(VALIDATION_ERRORS.START_AFTER_END);
  }

  return {
    isValid: errors.length === 0,
    errors,
    startDate: startValidation.sanitizedValue,
    endDate: endValidation.sanitizedValue,
  };
};

// Range validation (min/max values)
export const validateRange = (minValue, maxValue, fieldName) => {
  const errors = [];

  const minValidation = validateNumber(minValue, `Min ${fieldName}`);
  const maxValidation = validateNumber(maxValue, `Max ${fieldName}`);

  errors.push(...minValidation.errors, ...maxValidation.errors);

  if (
    minValidation.isValid &&
    maxValidation.isValid &&
    minValidation.sanitizedValue !== null &&
    maxValidation.sanitizedValue !== null &&
    minValidation.sanitizedValue > maxValidation.sanitizedValue
  ) {
    errors.push(VALIDATION_ERRORS.MIN_GREATER_THAN_MAX(fieldName));
  }

  return {
    isValid: errors.length === 0,
    errors,
    min: minValidation.sanitizedValue,
    max: maxValidation.sanitizedValue,
  };
};

// Complex validation composer
export const validateObject = (data, schema) => {
  const errors = [];
  const sanitizedData = {};

  for (const [field, config] of Object.entries(schema)) {
    const value = data[field];
    let validation;

    switch (config.type) {
      case 'string':
        validation = validateString(value, field, config);
        break;
      case 'number':
        validation = validateNumber(value, field, config);
        break;
      case 'boolean':
        validation = validateBoolean(value, field, config.required);
        break;
      case 'date':
        validation = validateDate(value, field, config);
        break;
      case 'enum':
        validation = validateEnum(value, field, config.values, config.required);
        break;
      case 'email':
        validation = validateEmail(value, config.required);
        break;
      case 'url':
        validation = validateUrl(value, field, config.required);
        break;
      case 'price':
        validation = validatePrice(value, field, config.required);
        break;
      default:
        validation = { isValid: true, errors: [], sanitizedValue: value };
    }

    errors.push(...validation.errors);
    if (validation.sanitizedValue !== undefined) {
      sanitizedData[field] = validation.sanitizedValue;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData,
  };
};

// Pre-defined validation schemas
export const VALIDATION_SCHEMAS = {
  ACCOUNT: {
    account_name: {
      type: 'string',
      required: true,
      minLength: VALIDATION_CONFIG.ACCOUNT_NAME.MIN_LENGTH,
      maxLength: VALIDATION_CONFIG.ACCOUNT_NAME.MAX_LENGTH,
      pattern: VALIDATION_CONFIG.ACCOUNT_NAME.PATTERN,
      sanitize: true,
    },
    email: {
      type: 'email',
      required: true,
    },
    phone: {
      type: 'string',
      required: true, // Đặt required = true theo yêu cầu
      maxLength: VALIDATION_CONFIG.PHONE.MAX_LENGTH,
      pattern: VALIDATION_CONFIG.PHONE.PATTERN,
      sanitize: true,
    },
    password: {
      type: 'password',
      required: true,
    },
    is_active: {
      type: 'boolean',
    },
  },

  SERVICE: {
    service_name: {
      type: 'string',
      required: true,
      minLength: VALIDATION_CONFIG.SERVICE_NAME.MIN_LENGTH, // 1
      maxLength: VALIDATION_CONFIG.SERVICE_NAME.MAX_LENGTH, // 1024
      sanitize: true,
    },
    //   description: {
    //     type: 'string',
    //     maxLength: VALIDATION_CONFIG.DESCRIPTION.MAX_LENGTH, // 5000
    //     sanitize: true
    //   },
    setup_time: {
      type: 'number',
      min: VALIDATION_CONFIG.SETUP_TIME.MIN, // 0
      max: VALIDATION_CONFIG.SETUP_TIME.MAX, // 480
      integer: true,
    },
    service_type_id: {
      type: 'number',
      min: 1,
      integer: true,
    },
    tags: {
      type: 'string',
      maxLength: 1000, // Arbitrary limit
      sanitize: true,
    },
    is_available: {
      type: 'boolean',
    },
    is_active: {
      type: 'boolean',
    },
  },

  SERVICE_VARIATION: {
    service_id: {
      type: 'number',
      required: true,
      min: 1,
      integer: true,
    },
    variation_name: {
      type: 'string',
      required: true,
      minLength: VALIDATION_CONFIG.VARIATION_NAME.MIN_LENGTH,
      maxLength: VALIDATION_CONFIG.VARIATION_NAME.MAX_LENGTH,
      sanitize: true,
    },
    base_price: {
      type: 'price',
      required: true,
    },
    duration_hours: {
      type: 'number',
      min: VALIDATION_CONFIG.DURATION.MIN,
      max: VALIDATION_CONFIG.DURATION.MAX,
    },
    min_guests: {
      type: 'number',
      min: VALIDATION_CONFIG.GUEST_COUNT.MIN,
      max: VALIDATION_CONFIG.GUEST_COUNT.MAX,
      integer: true,
    },
    max_guests: {
      type: 'number',
      min: VALIDATION_CONFIG.GUEST_COUNT.MIN,
      max: VALIDATION_CONFIG.GUEST_COUNT.MAX,
      integer: true,
    },
    is_active: {
      type: 'boolean',
    },
    is_default: {
      type: 'boolean',
    },
  },
  NOTIFICATION: {
    title: {
      type: 'string',
      required: true,
      maxLength: 255,
      sanitize: true,
    },
    message: {
      type: 'string',
      required: true,
      maxLength: 1000,
      sanitize: true,
    },
    type: {
      type: 'enum',
      required: true,
      values: [
        'REMINDER',
        'PAYMENT_SUCCESS',
        'CONFIRMATION',
        'WARNING',
        'ERROR',
      ],
    },
    account_id: {
      type: 'number',
      min: 1,
      integer: true,
    },
  },
};

// Generate request ID for logging
export const generateRequestId = () => crypto.randomUUID();

// Validation result helper
export const createValidationResult = (isValid, errors = [], data = null) => ({
  isValid,
  errors: Array.isArray(errors) ? errors : [errors],
  data,
});

export const handleError = (context, error) => {
  console.error(`[${context}]`, error);
  return {
    isValid: false,
    errors: [error.message || 'An unexpected error occurred.'],
    data: null,
  };
};

export const isValidId = (id) => {
  const parsed = Number(id);
  return !isNaN(parsed) && Number.isInteger(parsed) && parsed > 0;
};

// Export default validation function
export default {
  isValidId,
  handleError,
  validateString,
  validateNumber,
  validateEmail,
  validatePassword,
  validatePhone,
  validateDate,
  validateBoolean,
  validateEnum,
  validateUrl,
  validatePrice,
  validatePagination,
  validateDateRange,
  validateRange,
  validateObject,
  parseAndValidateId,
  sanitizeInput,
  sanitizeHtml,
  generateRequestId,
  createValidationResult,
  VALIDATION_CONFIG,
  VALIDATION_ERRORS,
  VALIDATION_SCHEMAS,
};
