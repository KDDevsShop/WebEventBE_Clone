// utils/middleware.js
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { sendResponse } from "../utils/response.js";
import { isAdmin, isStaffOrAdmin } from "../utils/authenticateRequest.js";

dotenv.config();
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not configured in .env");
}

const TOKEN_ERRORS = {
  NO_TOKEN: "Access denied. No token provided.",
  INVALID_FORMAT: "Access denied. Invalid token format.",
  INVALID_TOKEN: "Access denied. Invalid or expired token.",
  USER_NOT_FOUND: "Access denied. User not found.",
  USER_BANNED: "Access denied. Account has been banned.",
  NOT_AUTHENTICATED: "Access denied. User not authenticated.",
};

// ✅ Main token validator (no refresh, no cookies)
export const validateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return sendResponse(res, 401, TOKEN_ERRORS.NO_TOKEN);
    }

    const token = authHeader.split(" ")[1];
    let decoded;

    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return sendResponse(res, 401, TOKEN_ERRORS.INVALID_TOKEN);
    }

    const user = await prisma.account.findFirst({
      where: {
        account_id: decoded.account_id,
        is_active: true,
      },
      select: {
        account_id: true,
        email: true,
        role: true,
        account_name: true,
        is_active: true,
      },
    });

    if (!user) return sendResponse(res, 401, TOKEN_ERRORS.USER_NOT_FOUND);
    if (!user.is_active) return sendResponse(res, 403, TOKEN_ERRORS.USER_BANNED);

    req.user = {
      account_id: user.account_id,
      email: user.email,
      role: user.role,
      account_name: user.account_name,
    };

    next();
  } catch (err) {
    console.error("Token validation error:", err);
    return sendResponse(res, 500, "Internal server error during authentication");
  }
};

// ✅ Lightweight version (no DB check)
export const validateTokenLite = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return sendResponse(res, 401, TOKEN_ERRORS.NO_TOKEN);
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return sendResponse(res, 401, TOKEN_ERRORS.INVALID_TOKEN);
  }
};

// ✅ Optional token (for public access)
export const validateTokenOptional = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    req.user = null;
    return next();
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await prisma.account.findFirst({
      where: { account_id: decoded.account_id, is_active: true },
      select: {
        account_id: true,
        email: true,
        role: true,
        account_name: true,
      },
    });
    req.user = user || decoded;
  } catch (err) {
    req.user = null;
  }

  next();
};

// ✅ Rate-limited version
export const validateTokenWithRateLimit = (maxAttempts = 5, windowMs = 60000) => {
  const attempts = new Map();

  return async (req, res, next) => {
    const clientIp = req.ip || req.connection.remoteAddress;
    const now = Date.now();

    // Clean up expired attempts
    for (const [ip, data] of attempts.entries()) {
      if (now - data.firstAttempt > windowMs) {
        attempts.delete(ip);
      }
    }

    const clientAttempts = attempts.get(clientIp) || { count: 0, firstAttempt: now };

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      clientAttempts.count++;
      attempts.set(clientIp, clientAttempts);
      return sendResponse(res, 401, TOKEN_ERRORS.NO_TOKEN);
    }

    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      attempts.delete(clientIp);
      next();
    } catch (err) {
      clientAttempts.count++;
      attempts.set(clientIp, clientAttempts);
      return sendResponse(res, 401, TOKEN_ERRORS.INVALID_TOKEN);
    }
  };
};

// ✅ Role validations
export const validateAdmin = (req, res, next) => {
  if (!req.user) return sendResponse(res, 401, TOKEN_ERRORS.NOT_AUTHENTICATED);
  if (!isAdmin(req)) {
    return sendResponse(res, 403, "Access denied. Admin privileges required.");
  }
  next();
};

export const validateStaffOrAdmin = (req, res, next) => {
  if (!req.user) return sendResponse(res, 401, TOKEN_ERRORS.NOT_AUTHENTICATED);
  if (!isStaffOrAdmin(req)) {
    return sendResponse(res, 403, "Access denied. Staff or Admin privileges required.");
  }
  next();
};

export const validateRoles = (allowedRoles) => (req, res, next) => {
  if (!req.user) return sendResponse(res, 401, TOKEN_ERRORS.NOT_AUTHENTICATED);
  if (!Array.isArray(allowedRoles)) allowedRoles = [allowedRoles];
  if (!allowedRoles.includes(req.user.role.toLowerCase())) {
    return sendResponse(res, 403, `Access denied. Required role(s): ${allowedRoles.join(", ")}`);
  }
  next();
};

export const validateUser = (req, res, next) => {
  if (!req.user) return sendResponse(res, 401, TOKEN_ERRORS.NOT_AUTHENTICATED);
  if (req.user.role.toLowerCase() !== "customer") {
    return sendResponse(res, 403, "Access denied. Customer privileges required.");
  }
  next();
};

export default {
  validateToken,
  validateTokenLite,
  validateTokenOptional,
  validateTokenWithRateLimit,
  validateAdmin,
  validateStaffOrAdmin,
  validateRoles,
  validateUser,
};
