// Trong utils/notification.js
import { PrismaClient } from "@prisma/client";
import { validateString, createValidationResult, validateEnum } from "./validation.js";

const prisma = new PrismaClient();

const VALID_NOTIFICATION_TYPES = ['REMINDER', 'PAYMENT_SUCCESS', 'CONFIRMATION', 'WARNING', 'ERROR'];

export const createNotification = async ({ account_id, title, message, type = "REMINDER" }, tx = prisma) => {
  try {
    // Validate inputs
    const titleValidation = validateString(title, "Notification title", {
      required: true,
      maxLength: 255,
      sanitize: true,
    });
    const messageValidation = validateString(message, "Notification message", {
      required: true,
      maxLength: 1000,
      sanitize: true,
    });
    const typeValidation = validateEnum(type, "Notification type", VALID_NOTIFICATION_TYPES, true);

    const errors = [...titleValidation.errors, ...messageValidation.errors, ...typeValidation.errors];
    if (errors.length > 0) {
      return createValidationResult(false, errors);
    }

    // Nếu account_id được cung cấp, kiểm tra xem account có tồn tại không
    if (account_id) {
      const account = await tx.account.findUnique({
        where: { account_id: Number(account_id) },
        select: { account_id: true },
      });
      if (!account) {
        return createValidationResult(false, ["Account not found"]);
      }
    }

    // Tạo thông báo
    const notification = await tx.notification.create({
      data: {
        title: title.trim(),
        message: message.trim(),
        type,
        account_id: account_id ? Number(account_id) : null,
        sent_at: new Date(),
      },
    });

    return createValidationResult(true, [], notification);
  } catch (error) {
    console.error("Error in createNotification:", error);
    return createValidationResult(false, [error.message]);
  }
};