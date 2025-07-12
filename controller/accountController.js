import {
  createAccount,
  loginAccount,
  getAccountById,
  updateAccount,
  updatePassword,
  uploadAvatar,
  getAllAccounts,
  deleteAccount,
  banAccountUser,
  unbanAccountUser,
  getAccountByEmail,
  returnAccountInformation,
} from "../service/account.service.js";
import { sendResponse } from "../utils/response.js";
import { validateEmail, validatePassword, parseAndValidateId } from "../utils/validation.js";

import { uploadImage } from "../utils/cloudinary.js"; 

// Create Account
export const createAccountController = async (req, res) => {
  try {
    const accountData = req.body;

    // Validate email format
    const emailValidation = validateEmail(accountData.email);
    if (!emailValidation.isValid) {
      return sendResponse(res, 400, emailValidation.errors);
    }

    // Validate password format
    const passwordValidation = validatePassword(accountData.password_hash);
    if (!passwordValidation.isValid) {
      return sendResponse(res, 400, passwordValidation.errors);
    }

    const result = await createAccount(accountData);
    if (!result.isValid) {
      return sendResponse(res, 400, result.errors);
    }

    return sendResponse(res, 201, "Account created successfully", result.data);
  } catch (error) {
    return sendResponse(res, 500, "Internal server error");
  }
};

// Login Account
export const loginAccountController = async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await loginAccount(email, password);
    if (!result.isValid) {
      return sendResponse(res, 401, "Login failed", null, result.errors);
    }

    const { data, token } = result;

   
    return sendResponse(res, 200, "Login successful", {
      ...data,   // account info (account_id, email, role...)
      token,     // token nằm ở cùng cấp
    });
  } catch (error) {
    console.error("Login error:", error);
    return sendResponse(res, 500, "Login error", null, [error.message]);
  }
};


// Get Account By ID (requires authentication)
export const getAccountByIdController = async (req, res) => {
  try {
    const accountId = parseAndValidateId(req.params.accountId, "Account ID");

    // Require authentication
    if (!req.user) {
      return sendResponse(res, 401, "Authentication required");
    }

    // Only allow self or admin (fixed case sensitivity)
    if (req.user.account_id !== accountId && (req.user.role.toLowerCase() !== "admin")) {
      return sendResponse(res, 403, "Forbidden");
    }

    const result = await getAccountById(accountId);
    if (!result.isValid) {
      return sendResponse(res, 404, result.errors);
    }

    return sendResponse(res, 200, "Account retrieved successfully", result.data);
  } catch (error) {
    if (error.message.includes("Account ID")) {
      return sendResponse(res, 400, error.message);
    }
    return sendResponse(res, 500, "Internal server error");
  }
};

// Get Account By Email (requires authentication)
export const getAccountByEmailController = async (req, res) => {
  try {
    const { email } = req.body;

    // Require authentication
    if (!req.user) {
      return sendResponse(res, 401, "Authentication required");
    }

    // Only allow admin and customer
    if (req.user.role !== "CUSTOMER" && (req.user.role.toLowerCase() !== "admin")) {
      return sendResponse(res, 403, "Forbidden");
    }

    // Validate email format
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      return sendResponse(res, 400, emailValidation.errors);
    }

    const result = await getAccountByEmail(email);
    if (!result.isValid) {
      return sendResponse(res, 404, result.errors);
    }

    return sendResponse(res, 200, "Account retrieved successfully", result.data);
  } catch (error) {
    return sendResponse(res, 500, "Internal server error");
  }
};

// Update Account (requires authentication)
export const updateAccountController = async (req, res) => {
  try {
    const accountId = parseAndValidateId(req.params.accountId, "Account ID");
    const accountData = req.body;

    // Require authentication
    if (!req.user) {
      return sendResponse(res, 401, "Authentication required");
    }

    // Only allow self or admin
    if (req.user.account_id !== accountId && (req.user.role.toLowerCase() !== "admin")) {
      return sendResponse(res, 403, "Forbidden");
    }

    const updatedAccount = await updateAccount(accountId, accountData);
    if (!updatedAccount.isValid) {
      return sendResponse(res, 400, updatedAccount.errors);
    }

    return sendResponse(res, 200, "Account updated successfully", updatedAccount.data);
  } catch (error) {
    if (error.message.includes("Account ID")) {
      return sendResponse(res, 400, error.message);
    }
    return sendResponse(res, 500, "Internal server error");
  }
};

// Update Password (requires authentication)
export const updatePasswordController = async (req, res) => {
  try {
    const accountId = parseAndValidateId(req.params.accountId, "Account ID");
    const { currentPassword, newPassword } = req.body;

    // Require authentication
    if (!req.user) {
      return sendResponse(res, 401, "Authentication required");
    }

    // Only allow self or admin
    if (req.user.account_id !== accountId && (req.user.role.toLowerCase() !== "admin")) {
      return sendResponse(res, 403, "Forbidden");
    }

    // Validate new password format
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return sendResponse(res, 400, passwordValidation.errors);
    }

    const result = await updatePassword(accountId, currentPassword, newPassword);
    if (!result.isValid) {
      return sendResponse(res, 400, result.errors);
    }

    return sendResponse(res, 200, "Password updated successfully");
  } catch (error) {
    if (error.message.includes("Account ID")) {
      return sendResponse(res, 400, error.message);
    }
    return sendResponse(res, 500, "Internal server error");
  }
};

// Upload Avatar (requires authentication)
export const uploadAvatarController = async (req, res) => {
  try {
    const accountId = parseAndValidateId(req.params.accountId, "Account ID");

    // Require authentication
    if (!req.user) {
      return sendResponse(res, 401, "Authentication required");
    }

    // Only allow self or admin
    if (req.user.account_id !== accountId && (req.user.role.toLowerCase() !== "admin")) {
      return sendResponse(res, 403, "Forbidden");
    }

    if (!req.file) {
      return sendResponse(res, 400, "No file uploaded");
    }

    // Upload to Cloudinary
    const uploadResult = await uploadImage(
      req.file.buffer,
      "avatars",
      `${accountId}_${Date.now()}`
    );

    // Save avatar URL to DB
    const result = await uploadAvatar(accountId, uploadResult.secure_url);
    if (!result.isValid) {
      return sendResponse(res, 400, result.errors);
    }

    return sendResponse(res, 200, "Avatar uploaded successfully", result.data);
  } catch (error) {
    if (error.message.includes("Account ID")) {
      return sendResponse(res, 400, error.message);
    }
    return sendResponse(res, 500, "Internal server error");
  }
};

// Get All Accounts (Admin only)
export const getAllAccountsController = async (req, res) => {
  try {
    // Require authentication
    if (!req.user) {
      return sendResponse(res, 401, "Authentication required");
    }

    // Only allow admin
    if (req.user.role.toLowerCase() !== "admin") {
      return sendResponse(res, 403, "Forbidden");
    }

    const result = await getAllAccounts();
    if (!result.isValid) {
      return sendResponse(res, 400, result.errors);
    }

    return sendResponse(res, 200, "Accounts retrieved successfully", result.data);
  } catch (error) {
    return sendResponse(res, 500, "Internal server error");
  }
};

// Delete Account (Admin only)
export const deleteAccountController = async (req, res) => {
  try {
    const accountId = parseAndValidateId(req.params.accountId, "Account ID");

    // Require authentication
    if (!req.user) {
      return sendResponse(res, 401, "Authentication required");
    }

    // Only allow admin
    if ((req.user.role.toLowerCase() !== "admin")) {
      return sendResponse(res, 403, "Forbidden");
    }

    const result = await deleteAccount(accountId);
    if (!result.isValid) {
      return sendResponse(res, 400, result.errors);
    }

    return sendResponse(res, 200, "Account deleted successfully");
  } catch (error) {
    if (error.message.includes("Account ID")) {
      return sendResponse(res, 400, error.message);
    }
    return sendResponse(res, 500, "Internal server error");
  }
};

// Ban Account (Admin only)
export const banAccountUserController = async (req, res) => {
  try {
    const accountId = parseAndValidateId(req.params.accountId, "Account ID");

    // Require authentication
    if (!req.user) {
      return sendResponse(res, 401, "Authentication required");
    }

    // Only allow admin
    if (req.user.role.toLowerCase() !== "admin") {
      return sendResponse(res, 403, "Forbidden");
    }

    const result = await banAccountUser(accountId);
    if (!result.isValid) {
      return sendResponse(res, 400, result.errors);
    }

    return sendResponse(res, 200, "Account banned successfully", result.data);
  } catch (error) {
    if (error.message.includes("Account ID")) {
      return sendResponse(res, 400, error.message);
    }
    return sendResponse(res, 500, "Internal server error");
  }
};

// Unban Account (Admin only)
export const unbanAccountUserController = async (req, res) => {
  try {
    const accountId = parseAndValidateId(req.params.accountId, "Account ID");

    // Require authentication
    if (!req.user) {
      return sendResponse(res, 401, "Authentication required");
    }

    // Only allow admin
    if (req.user.role.toLowerCase() !== "admin") {
      return sendResponse(res, 403, "Forbidden");
    }

    const result = await unbanAccountUser(accountId);
    if (!result.isValid) {
      return sendResponse(res, 400, result.errors);
    }

    return sendResponse(res, 200, "Account unbanned successfully", result.data);
  } catch (error) {
    if (error.message.includes("Account ID")) {
      return sendResponse(res, 400, error.message);
    }
    return sendResponse(res, 500, "Internal server error");
  }
};

// Get My Profile (authenticated user)
export const getMyProfile = async (req, res) => {
  try {
    // Require authentication
    if (!req.user) {
      return sendResponse(res, 401, "Authentication required");
    }

    const accountId = req.user.account_id;
    const result = await returnAccountInformation(accountId);
    if (!result.isValid) {
      return sendResponse(res, 404, result.errors);
    }

    return sendResponse(res, 200, "Profile retrieved successfully", result.data);
  } catch (error) {
    return sendResponse(res, 500, "Internal server error");
  }
};

