import {
  createPayment,
  updatePayment,
  getPaymentById,
  getAllPayments,
  deletePayment
} from '../service/payment.service.js';
import { sendResponse } from '../utils/response.js';
import { validateToken } from '../middleware/authMiddleware.js';

// Create Payment
export const createPaymentController = [validateToken, async (req, res) => {
  try {
    const paymentData = req.body;
    paymentData.account_id = req.user.account_id;
    const result = await createPayment(paymentData);

    if (!result.isValid) {
      return sendResponse(res, 400, result.errors);
    }
    return sendResponse(res, 201, "Payment created successfully", result.data);
  } catch (error) {
    console.error('Error in createPayment:', error);
    return sendResponse(res, 500, "Error creating payment");
  }
}];

// Update Payment
export const updatePaymentController = [validateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await updatePayment(id, req.body);

    if (!result.isValid) {
      return sendResponse(res, 400, result.errors);
    }
    if (result.data.account_id !== req.user.account_id) {
      return sendResponse(res, 403, "Unauthorized: Cannot update this payment");
    }
    return sendResponse(res, 200, "Payment updated successfully", result.data);
  } catch (error) {
    console.error('Error in updatePayment:', error);
    return sendResponse(res, 500, "Error updating payment");
  }
}];

// Get Payment by ID
export const getPaymentByIdController = [validateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await getPaymentById(id);

    if (!result.isValid) {
      return sendResponse(res, 404, result.errors);
    }
    if (result.data.account_id !== req.user.account_id) {
      return sendResponse(res, 403, "Unauthorized: Cannot access this payment");
    }
    return sendResponse(res, 200, "Payment retrieved successfully", result.data);
  } catch (error) {
    console.error('Error in getPaymentById:', error);
    return sendResponse(res, 500, "Error retrieving payment");
  }
}];

// Get All Payments
export const getAllPaymentsController = [validateToken, async (req, res) => {
  try {
    const filters = { ...req.query, account_id: req.user.account_id };
    const result = await getAllPayments(filters);

    if (!result.isValid) {
      return sendResponse(res, 400, result.errors);
    }
    return sendResponse(res, 200, "Payments retrieved successfully", result.data.payments, result.data.pagination);
  } catch (error) {
    console.error('Error in getAllPayments:', error);
    return sendResponse(res, 500, "Error retrieving payments");
  }
}];

// Delete Payment
export const deletePaymentController = [validateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await deletePayment(id);

    if (!result.isValid) {
      return sendResponse(res, 404, result.errors);
    }
    if (result.data.account_id !== req.user.account_id) {
      return sendResponse(res, 403, "Unauthorized: Cannot delete this payment");
    }
    return sendResponse(res, 200, "Payment deleted successfully", result.data);
  } catch (error) {
    console.error('Error in deletePayment:', error);
    return sendResponse(res, 500, "Error deleting payment");
  }
}];