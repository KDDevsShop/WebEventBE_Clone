// Trong PaymentService.js
import { PrismaClient } from "@prisma/client";
import Stripe from 'stripe';
import {
  validateNumber,
  validateString,
  parseAndValidateId,
  createValidationResult,
  validatePagination,
} from "../utils/validation.js";
import { createNotification } from "../utils/notification.js";
import * as invoiceService from "./invoice.service.js";

const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const handleError = (context, error) => {
  console.error(`Error in ${context}:`, error);
  return createValidationResult(false, [error.message]);
};

const validatePaymentData = (paymentData) => {
  const errors = [];

  const amountValidation = validateNumber(paymentData.amount, "Payment amount", {
    min: 0,
  });
  const eventIdValidation = parseAndValidateId(paymentData.event_id, "Event ID");
  const accountIdValidation = parseAndValidateId(paymentData.account_id, "Account ID");

  errors.push(...amountValidation.errors);
  if (typeof eventIdValidation !== 'number') errors.push("Invalid event ID");
  if (typeof accountIdValidation !== 'number') errors.push("Invalid account ID");

  if (paymentData.payment_method) {
    const validMethods = ['CREDIT_CARD', 'BANK_TRANSFER', 'CASH', 'STRIPE'];
    if (!validMethods.includes(paymentData.payment_method)) {
      errors.push("Invalid payment method");
    }
  }

  if (paymentData.status) {
    const validStatuses = ['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED'];
    if (!validStatuses.includes(paymentData.status)) {
      errors.push("Invalid payment status");
    }
  }

  return errors;
};

// Create Stripe Checkout Session
export const createStripeCheckoutSession = async (userId, cartItems, sm_id, addressId, orderData) => {
  try {
    const lineItems = cartItems.map(item => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.item_name,
        },
        unit_amount: Math.round(Number(item.unit_price) * 100),
      },
      quantity: Number(item.quantity),
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `http://localhost:5173/payment/stripe-pay-callback?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `http://localhost:5173/payment/stripe-pay-callback?status=canceled`,
      metadata: {
        userId: String(userId),
        sm_id: String(sm_id || ''),
        addressId: String(addressId || ''),
        orderData: JSON.stringify(orderData || {}),
      },
    });

    return session;
  } catch (error) {
    throw new Error(`Failed to create Stripe checkout session: ${error.message}`);
  }
};

// Stripe Callback Handler
export const stripeCallbackHandler = async (sessionId) => {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return {
      orderId: session.metadata.orderData ? JSON.parse(session.metadata.orderData).orderId : session.id,
      paymentIntentId: session.payment_intent,
      amount: session.amount_total / 100,
    };
  } catch (error) {
    throw new Error(`Failed to handle Stripe callback: ${error.message}`);
  }
};

// Create Payment
export const createPayment = async (paymentData) => {
  try {
    const { event_id, account_id, amount, payment_method = 'CASH', status = 'PENDING', transaction_id, payment_date, invoice_id, stripe_payment_id } = paymentData;

    const validationErrors = validatePaymentData(paymentData);
    if (invoice_id) {
      const invoiceIdValidation = parseAndValidateId(invoice_id, "Invoice ID");
      if (typeof invoiceIdValidation !== 'number') validationErrors.push("Invalid invoice ID");
    }
    if (validationErrors.length > 0) {
      return createValidationResult(false, validationErrors);
    }

    const event = await prisma.event.findUnique({
      where: { event_id: Number(event_id) },
      select: { event_id: true, status: true, account_id: true },
    });
    if (!event || event.status === 'CANCELLED') {
      return createValidationResult(false, ["Event not found or cancelled"]);
    }
    if (event.account_id !== Number(account_id)) {
      return createValidationResult(false, ["Account does not match event"]);
    }

    if (invoice_id) {
      const invoice = await prisma.invoice.findUnique({
        where: { invoice_id: Number(invoice_id) },
        select: { invoice_id: true, status: true },
      });
      if (!invoice) {
        return createValidationResult(false, ["Invoice not found"]);
      }
      if (invoice.status === 'PAID') {
        return createValidationResult(false, ["Invoice already paid"]);
      }
    }

    const newPayment = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          event_id: Number(event_id),
          account_id: Number(account_id),
          amount: Number(amount),
          payment_method,
          payment_status: status,
          transaction_id: transaction_id?.trim(),
          stripe_payment_id,
          payment_date: payment_date ? new Date(payment_date) : new Date(),
          invoice_id: invoice_id ? Number(invoice_id) : null,
        },
        include: {
          event: { select: { event_id: true, event_name: true } },
          account: { select: { account_id: true, account_name: true } },
          invoice: { select: { invoice_id: true, invoice_number: true } },
        },
      });

      if (status === 'COMPLETED' && invoice_id) {
        const invoiceUpdate = await invoiceService.updateInvoice(
          invoice_id,
          { status: 'PAID', paid_at: new Date() },
          tx
        );
        if (!invoiceUpdate.isValid) {
          throw new Error(`Failed to update invoice: ${invoiceUpdate.errors.join(', ')}`);
        }
      }

      if (status === 'COMPLETED') {
        const notification = await createNotification({
          account_id: payment.account_id,
          title: "Payment Successful",
          message: `Your payment of ${payment.amount} for event "${payment.event.event_name}" has been processed successfully.`,
          type: "PAYMENT_SUCCESS",
        }, tx);

        if (!notification.isValid) {
          console.warn("Failed to send payment success notification:", notification.errors);
        }
      }

      return payment;
    });

    return createValidationResult(true, [], newPayment);
  } catch (error) {
    return handleError("createPayment", error);
  }
};

// Update Payment
export const updatePayment = async (paymentId, updateData) => {
  try {
    const validPaymentId = parseAndValidateId(paymentId, "Payment ID");

    const existingPayment = await prisma.payment.findUnique({
      where: { payment_id: validPaymentId },
    });
    if (!existingPayment) {
      return createValidationResult(false, ["Payment not found"]);
    }

    const validationErrors = validatePaymentData(updateData);
    if (updateData.invoice_id) {
      const invoiceIdValidation = parseAndValidateId(updateData.invoice_id, "Invoice ID");
      if (typeof invoiceIdValidation !== 'number') validationErrors.push("Invalid invoice ID");
    }
    if (validationErrors.length > 0) {
      return createValidationResult(false, validationErrors);
    }

    const { event_id, account_id, amount, payment_method, status, transaction_id, payment_date, invoice_id, stripe_payment_id } = updateData;

    if (event_id && event_id !== existingPayment.event_id) {
      const event = await prisma.event.findUnique({
        where: { event_id: Number(event_id) },
        select: { event_id: true, status: true, account_id: true },
      });
      if (!event || event.status === 'CANCELLED') {
        return createValidationResult(false, ["Event not found or cancelled"]);
      }
      if (account_id && event.account_id !== Number(account_id)) {
        return createValidationResult(false, ["Account does not match event"]);
      }
    }

    if (invoice_id && invoice_id !== existingPayment.invoice_id) {
      const invoice = await prisma.invoice.findUnique({
        where: { invoice_id: Number(invoice_id) },
        select: { invoice_id: true, status: true },
      });
      if (!invoice) {
        return createValidationResult(false, ["Invoice not found"]);
      }
      if (invoice.status === 'PAID') {
        return createValidationResult(false, ["Invoice already paid"]);
      }
    }

    const updateFields = {};
    if (event_id !== undefined) updateFields.event_id = Number(event_id);
    if (account_id !== undefined) updateFields.account_id = Number(account_id);
    if (amount !== undefined) updateFields.amount = Number(amount);
    if (payment_method !== undefined) updateFields.payment_method = payment_method;
    if (status !== undefined) updateFields.payment_status = status;
    if (transaction_id !== undefined) updateFields.transaction_id = transaction_id?.trim();
    if (payment_date !== undefined) updateFields.payment_date = payment_date ? new Date(payment_date) : null;
    if (stripe_payment_id !== undefined) updateFields.stripe_payment_id = stripe_payment_id?.trim();
    if (invoice_id !== undefined) updateFields.invoice_id = invoice_id ? Number(invoice_id) : null;

    const updatedPayment = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.update({
        where: { payment_id: validPaymentId },
        data: updateFields,
        include: {
          event: { select: { event_id: true, event_name: true } },
          account: { select: { account_id: true, account_name: true } },
          invoice: { select: { invoice_id: true, invoice_number: true } },
        },
      });

      if (status === 'COMPLETED' && invoice_id && existingPayment.payment_status !== 'COMPLETED') {
        const invoiceUpdate = await invoiceService.updateInvoice(
          invoice_id,
          { status: 'PAID', paid_at: new Date() },
          tx
        );
        if (!invoiceUpdate.isValid) {
          throw new Error(`Failed to update invoice: ${invoiceUpdate.errors.join(', ')}`);
        }
      }

      if (status === 'COMPLETED' && existingPayment.payment_status !== 'COMPLETED') {
        const notification = await createNotification({
          account_id: payment.account_id,
          title: "Payment Successful",
          message: `Your payment of ${payment.amount} for event "${payment.event.event_name}" has been processed successfully.`,
          type: "PAYMENT_SUCCESS",
        }, tx);

        if (!notification.isValid) {
          console.warn("Failed to send payment success notification:", notification.errors);
        }
      }

      return payment;
    });

    return createValidationResult(true, [], updatedPayment);
  } catch (error) {
    return handleError("updatePayment", error);
  }
};

// Get Payment by ID
export const getPaymentById = async (paymentId) => {
  try {
    const validPaymentId = parseAndValidateId(paymentId, "Payment ID");

    const payment = await prisma.payment.findUnique({
      where: { payment_id: validPaymentId },
      include: {
        event: { select: { event_id: true, event_name: true } },
        account: { select: { account_id: true, account_name: true } },
        invoice: { select: { invoice_id: true, invoice_number: true } },
      },
    });

    if (!payment) {
      return createValidationResult(false, ["Payment not found"]);
    }

    return createValidationResult(true, [], payment);
  } catch (error) {
    return handleError("getPaymentById", error);
  }
};

// Get All Payments
export const getAllPayments = async (filters = {}) => {
  try {
    const { event_id, account_id, status, invoice_id, page = 1, limit = 20, sortBy = 'payment_date', sortOrder = 'asc' } = filters;

    const { page: validPage, limit: validLimit, errors: paginationErrors } = validatePagination(page, limit);
    if (paginationErrors.length > 0) {
      return createValidationResult(false, paginationErrors);
    }

    const where = {};
    if (event_id) where.event_id = parseAndValidateId(event_id, "Event ID");
    if (account_id) where.account_id = parseAndValidateId(account_id, "Account ID");
    if (status) where.payment_status = status;
    if (invoice_id) where.invoice_id = parseAndValidateId(invoice_id, "Invoice ID");

    const skip = (validPage - 1) * validLimit;
    const orderBy = { [sortBy]: sortOrder?.toLowerCase() || 'asc' };

    const [payments, totalCount] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          event: { select: { event_id: true, event_name: true } },
          account: { select: { account_id: true, account_name: true } },
          invoice: { select: { invoice_id: true, invoice_number: true } },
        },
        skip,
        take: validLimit,
        orderBy,
      }),
      prisma.payment.count({ where }),
    ]);

    return createValidationResult(true, [], {
      payments,
      pagination: {
        page: validPage,
        limit: validLimit,
        totalCount,
        totalPages: Math.ceil(totalCount / validLimit),
        hasNextPage: validPage < Math.ceil(totalCount / validLimit),
        hasPreviousPage: validPage > 1,
      },
    });
  } catch (error) {
    return handleError("getAllPayments", error);
  }
};

// Delete Payment
export const deletePayment = async (paymentId) => {
  try {
    const validPaymentId = parseAndValidateId(paymentId, "Payment ID");

    const existingPayment = await prisma.payment.findUnique({
      where: { payment_id: validPaymentId },
      include: { invoice: { select: { invoice_id: true } } },
    });
    if (!existingPayment) {
      return createValidationResult(false, ["Payment not found"]);
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.payment.delete({
        where: { payment_id: validPaymentId },
      });

      if (existingPayment.invoice_id) {
        const invoiceUpdate = await invoiceService.updateInvoice(
          existingPayment.invoice_id,
          { status: 'PENDING', paid_at: null },
          tx
        );
        if (!invoiceUpdate.isValid) {
          throw new Error(`Failed to update invoice: ${invoiceUpdate.errors.join(', ')}`);
        }
      }

      return { payment_id: validPaymentId };
    });

    return createValidationResult(true, [], result);
  } catch (error) {
    return handleError("deletePayment", error);
  }
};

export const getPaymentStats = async (filter = {}) => {
  try {
    // Optional: filter by account_id for user analytics
    const where = {};
    if (filter.account_id) where.account_id = filter.account_id;

    // Aggregate stats
    const [
      totalPayments,
      totalAmount,
      completedPayments,
      pendingPayments,
      failedPayments,
      refundedPayments,
      cancelledPayments,
      totalCompletedAmount,
      totalRefundedAmount
    ] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.aggregate({ _sum: { amount: true }, where }),
      prisma.payment.count({ where: { ...where, payment_status: "COMPLETED" } }),
      prisma.payment.count({ where: { ...where, payment_status: "PENDING" } }),
      prisma.payment.count({ where: { ...where, payment_status: "FAILED" } }),
      prisma.payment.count({ where: { ...where, payment_status: "REFUNDED" } }),
      prisma.payment.count({ where: { ...where, payment_status: "CANCELLED" } }),
      prisma.payment.aggregate({ _sum: { amount: true }, where: { ...where, payment_status: "COMPLETED" } }),
      prisma.payment.aggregate({ _sum: { amount: true }, where: { ...where, payment_status: "REFUNDED" } }),
    ]);

    return {
      totalPayments,
      totalAmount: totalAmount._sum.amount || 0,
      completedPayments,
      pendingPayments,
      failedPayments,
      refundedPayments,
      cancelledPayments,
      totalCompletedAmount: totalCompletedAmount._sum.amount || 0,
      totalRefundedAmount: totalRefundedAmount._sum.amount || 0,
    };
  } catch (error) {
    console.error("Error in getPaymentStats:", error);
    throw error;
  }
};