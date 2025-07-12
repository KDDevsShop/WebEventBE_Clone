import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { parseAndValidateId } from '../utils/validation.js'; 
import { createNotification } from "../utils/notification.js";

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET;

const handleError = (context, error) => {
  console.error(`Error in ${context}:`, error);
  return { isValid: false, errors: [error.message] };
};

const pickAccountFields = (data) => {
  let dateOfBirth = null;
  if (data.dateOfBirth) {
    const parsed = new Date(data.dateOfBirth);
    dateOfBirth = isNaN(parsed.getTime()) ? null : parsed;
  }
  return {
    email: data.email,
    account_name: data.account_name,
    role: data.role,
    is_active: data.is_active ?? true,
    avatar_url: data.avatar_url ?? null,
    phone: data.phone ?? null,
    gender: data.gender ?? null,
    dateOfBirth,
  };
};

// ===== Create Account =====
export const createAccount = async (accountData) => {
  try {
    if (!accountData.password_hash || !accountData.email) {
      return { isValid: false, errors: ["Email and password are required."] };
    }

    const hashedPassword = await bcrypt.hash(accountData.password_hash, SALT_ROUNDS);
    const newAccount = await prisma.account.create({
      data: {
        ...pickAccountFields(accountData),
        password_hash: hashedPassword,
        created_at: new Date().toISOString(),
      }
    });

    await createNotification({
      account_id: newAccount.account_id,
      title: "Welcome to Our Platform!",
      message: `Your account ${newAccount.account_name} has been created successfully.`,
      type: "WELCOME",
    });

    return { isValid: true, data: newAccount };
  } catch (error) {
    return handleError("createAccount", error);
  }
};

// ===== Login =====
export const loginAccount = async (email, password) => {
  try {
    if (!email || !password) {
      return { isValid: false, errors: ["Email and password are required."] };
    }

    const account = await prisma.account.findFirst({
      where: { email },
    });

    if (!account || !account.is_active) {
      return { isValid: false, errors: ["Invalid email or inactive account."] };
    }

    const match = await bcrypt.compare(password, account.password_hash);
    if (!match) {
      return { isValid: false, errors: ["Incorrect password."] };
    }

    const { password_hash, ...accountData } = account;
    const token = jwt.sign(
      { account_id: account.account_id, role: account.role, email: account.email },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return { isValid: true, data: accountData, token };
  } catch (error) {
    return handleError("loginAccount", error);
  }
};

// ===== Update Account =====
export const updateAccount = async (accountId, updateData) => {
  try {
    const updatedAccount = await prisma.account.update({
      where: { account_id: accountId },
      data: {
        ...pickAccountFields(updateData),
        updated_at: new Date().toISOString(),
      }
    });

    await createNotification({
      account_id: accountId,
      title: "Account Updated",
      message: `Your account ${updatedAccount.account_name} has been updated successfully.`,
      type: "ACCOUNT_UPDATE",
    });

    return { isValid: true, data: updatedAccount };
  } catch (error) {
    return handleError("updateAccount", error);
  }
};

// ===== Upload Avatar =====
export const uploadAvatar = async (accountId, avatarUrl) => {
  try {
    const validatedId = parseAndValidateId(accountId, "Account ID");

    const updated = await prisma.account.update({
      where: { account_id: validatedId },
      data: {
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString()
      }
    });

    return { isValid: true, data: updated };
  } catch (error) {
    return handleError("uploadAvatar", error);
  }
};

// ===== Update Password =====
export const updatePassword = async (accountId, currentPassword, newPassword) => {
  try {
    const account = await prisma.account.findFirst({
      where: { account_id: accountId }
    });

    if (!account) return { isValid: false, errors: ["Account not found."] };

    const match = await bcrypt.compare(currentPassword, account.password_hash);
    if (!match) return { isValid: false, errors: ["Current password is incorrect."] };

    const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);

    const updated = await prisma.account.update({
      where: { account_id: accountId },
      data: {
        password_hash: hashed,
        updated_at: new Date().toISOString()
      }
    });

    return { isValid: true, data: updated };
  } catch (error) {
    return handleError("updatePassword", error);
  }
};

// ===== Get All Accounts =====
export const getAllAccounts = async (filters = {}, page = 1, limit = 20) => {
  try {
    const skip = (page - 1) * limit;
    const accounts = await prisma.account.findMany({
      where: filters,
      skip,
      take: limit,
      orderBy: { created_at: "desc" }
    });
    const totalCount = await prisma.account.count({ where: filters });

    return { isValid: true, data: { accounts, totalCount, page, limit } };
  } catch (error) {
    return handleError("getAllAccounts", error);
  }
};

// ===== Get Account By ID =====
export const getAccountById = async (accountId) => {
  try {
    const account = await prisma.account.findFirst({
      where: { account_id: accountId },
      select: {
        account_id: true,
        email: true,
        role: true,
        account_name: true,
        gender: true,
        dateOfBirth: true,
        phone: true,
        is_active: true,
        created_at: true,
        avatar_url: true,
      }
    });
    if (!account) return { isValid: false, errors: ["Account not found."] };
    return { isValid: true, data: account };
  } catch (error) {
    return handleError("getAccountById", error);
  }
};

// ===== Return Current Account Info =====
export const returnAccountInformation = async (accountId) => {
  try {
    const account = await prisma.account.findFirst({
      where: { account_id: accountId },
      select: {
        account_id: true,
        email: true,
        role: true,
        account_name: true,
        gender: true,
        dateOfBirth: true,
        phone: true,
        is_active: true,
        created_at: true,
        avatar_url: true
      }
    });

    if (!account) {
      return { isValid: false, errors: ["Account not found."] };
    }

    return { isValid: true, data: account };
  } catch (error) {
    return handleError("returnAccountInformation", error);
  }
};

// ===== Delete Account =====
export const deleteAccount = async (accountId) => {
  try {
    const deleted = await prisma.account.delete({
      where: { account_id: accountId }
    });
    return { isValid: true, data: deleted };
  } catch (error) {
    return handleError("deleteAccount", error);
  }
};

// ===== Ban / Unban =====
export const banAccountUser = async (accountId) => {
  try {
    const updated = await prisma.account.update({
      where: { account_id: accountId },
      data: {
        is_active: false,
        updated_at: new Date().toISOString()
      }
    });
    return { isValid: true, data: updated };
  } catch (error) {
    return handleError("banAccountUser", error);
  }
};

export const unbanAccountUser = async (accountId) => {
  try {
    const updated = await prisma.account.update({
      where: { account_id: accountId },
      data: {
        is_active: true,
        updated_at: new Date().toISOString()
      }
    });
    return { isValid: true, data: updated };
  } catch (error) {
    return handleError("unbanAccountUser", error);
  }
};

// ===== Get by Email =====
export const getAccountByEmail = async (email) => {
  try {
    const account = await prisma.account.findFirst({
      where: { email },
      select: {
        account_id: true,
        email: true,
        role: true,
        account_name: true,
        is_active: true,
        created_at: true,
        updated_at: true,
        avatar_url: true
      }
    });
    if (!account) return { isValid: false, errors: ["Account not found."] };
    return { isValid: true, data: account };
  } catch (error) {
    return handleError("getAccountByEmail", error);
  }
};
