import { getEventServiceStats } from "../service/event_service.service.js";
import { getPaymentStats } from "../service/payment.service.js";
import { getInvoiceStats } from "../service/invoice.service.js";
import { PrismaClient } from "@prisma/client";
import { sendResponse } from "../utils/response.js";

const prisma = new PrismaClient();

// Admin dashboard
export const getAdminDashboard = async (req, res) => {
  try {
    const [userCount, eventServiceStats, paymentStats, invoiceStats] = await Promise.all([
      prisma.account.count(),
      getEventServiceStats(),
      getPaymentStats(),
      getInvoiceStats()
    ]);
    return sendResponse(res, 200, "Admin dashboard data", {
      userCount,
      eventServiceStats,
      paymentStats,
      invoiceStats
    });
  } catch (error) {
    return sendResponse(res, 500, "Failed to fetch dashboard data");
  }
};

// User dashboard
export const getUserDashboard = async (req, res) => {
  try {
    const account_id = req.user.account_id;
    const [eventServiceStats, paymentStats, invoiceStats] = await Promise.all([
      getEventServiceStats({ account_id }),
      getPaymentStats({ account_id }),
      getInvoiceStats({ account_id })
    ]);
    return sendResponse(res, 200, "User dashboard data", {
      eventServiceStats,
      paymentStats,
      invoiceStats
    });
  } catch (error) {
    return sendResponse(res, 500, "Failed to fetch dashboard data");
  }
};