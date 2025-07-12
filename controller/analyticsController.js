import { getEventServiceStats } from "../service/event_service.service.js";
import { getPaymentStats } from "../service/payment.service.js";
import { getInvoiceStats } from "../service/invoice.service.js";
import { sendResponse } from "../utils/response.js";

export const getAnalytics = async (req, res) => {
  try {
    const [eventServiceStats, paymentStats, invoiceStats] = await Promise.all([
      getEventServiceStats(),
      getPaymentStats(),
      getInvoiceStats()
    ]);
    return sendResponse(res, 200, "Analytics fetched successfully", {
      eventServiceStats,
      paymentStats,
      invoiceStats
    });
  } catch (error) {
    return sendResponse(res, 500, "Failed to fetch analytics");
  }
};