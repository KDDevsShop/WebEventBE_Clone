import {
    getAllNotifications,
    markNotificationAsRead,
} from "../service/notification.service.js";
import { sendResponse } from "../utils/response.js";

// Get all notifications for a user
export const getAllNotificationsController = async (req, res) => {
  try {
    const filters = {
      account_id: req.query.account_id || req.user?.account_id,
      is_read: req.query.is_read === "true" ? true : req.query.is_read === "false" ? false : undefined,
      type: req.query.type,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      sortBy: req.query.sortBy || "created_at",
      sortOrder: req.query.sortOrder || "desc",
    };

    const result = await getAllNotifications(filters);

    if (!result.isValid) {
      return sendResponse(res, 400, result.errors);
    }

    return sendResponse(
      res,
      200,
      "Notifications retrieved successfully",
      { notifications: result.data.notifications },
      result.data.pagination
    );
  } catch (error) {
    console.error("Error in getAllNotifications controller:", error);
    return sendResponse(res, 500, "Internal server error");
  }
};

// Mark notification as read
export const markNotificationAsReadController = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await markNotificationAsRead(id);

    if (!result.isValid) {
      return sendResponse(res, 400, result.errors);
    }

    return sendResponse(res, 200, "Notification marked as read", result.data);
  } catch (error) {
    console.error("Error in markNotificationAsRead controller:", error);
    return sendResponse(res, 500, "Internal server error");
    }
}