import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import {
  createStripeCheckoutSession,
  stripeCallbackHandler,
} from '../service/payment.service.js';
import { updateInvoice } from '../service/invoice.service.js';
import { createValidationResult } from '../utils/validation.js';
import { sendResponse } from '../utils/response.js';
import { validateToken } from '../middleware/authMiddleware.js';
import { createNotification } from '../utils/notification.js';

const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || undefined);

// Create Stripe Checkout Session
export const createCheckoutSession = [
  validateToken,
  async (req, res) => {
    try {
      const {
        userId,
        cartItems,
        sm_id,
        addressId,
        orderData,
        invoice_id,
        event_id,
      } = req.body;

      if (
        !userId ||
        !cartItems ||
        !Array.isArray(cartItems) ||
        cartItems.length === 0 ||
        !invoice_id ||
        !event_id
      ) {
        return sendResponse(
          res,
          400,
          'Missing required parameters: userId, cartItems, invoice_id, or event_id'
        );
      }

      if (Number(userId) !== req.user.account_id) {
        return sendResponse(
          res,
          403,
          'Unauthorized: User ID does not match authenticated user'
        );
      }

      const event = await prisma.event.findUnique({
        where: { event_id: Number(event_id) },
        select: { event_id: true, account_id: true, status: true },
      });
      if (!event || event.status === 'CANCELLED') {
        return sendResponse(res, 404, 'Event not found or cancelled');
      }
      if (event.account_id !== Number(userId)) {
        return sendResponse(res, 403, 'Event does not belong to user');
      }

      const invoice = await prisma.invoice.findUnique({
        where: { invoice_id: Number(invoice_id) },
        select: {
          invoice_id: true,
          total_amount: true,
          status: true,
          account_id: true,
        },
      });
      if (!invoice) {
        return sendResponse(res, 404, 'Invoice not found');
      }
      if (invoice.status === 'PAID') {
        return sendResponse(res, 400, 'Invoice already paid');
      }
      if (invoice.account_id !== Number(userId)) {
        return sendResponse(res, 403, 'Invoice does not belong to user');
      }

      const totalAmount = cartItems.reduce(
        (sum, item) => sum + Number(item.quantity) * Number(item.unit_price),
        0
      );
      if (totalAmount > Number(invoice.total_amount)) {
        return sendResponse(res, 400, 'Cart total exceeds invoice total');
      }

      // Use your payment service to create the Stripe session
      const stripeResponse = await createStripeCheckoutSession(
        userId,
        cartItems,
        sm_id,
        addressId,
        orderData
      );

      // Create a pending payment record
      const payment = await prisma.$transaction(async (tx) => {
        const newPayment = await tx.payment.create({
          data: {
            amount: totalAmount,
            payment_method: 'STRIPE',
            payment_status: 'PENDING',
            stripe_payment_id: stripeResponse.id,
            account_id: Number(userId),
            invoice_id: Number(invoice_id),
            event_id: Number(event_id),
            payment_date: new Date(),
          },
          include: {
            account: { select: { account_id: true, account_name: true } },
            invoice: { select: { invoice_id: true, invoice_number: true } },
            event: { select: { event_id: true, event_name: true } },
          },
        });
        return newPayment;
      });

      return sendResponse(
        res,
        200,
        'Stripe checkout session created successfully',
        {
          stripeSession: stripeResponse,
          payment_id: payment.payment_id,
        }
      );
    } catch (error) {
      console.error('Error in createCheckoutSession:', error);
      return sendResponse(res, 500, 'Error creating Stripe checkout session');
    }
  },
];

// Stripe Callback (for Stripe redirect)
export const stripeCallback = async (req, res) => {
  try {
    const { status, session_id } = req.query;

    if (!status || !session_id) {
      return res.redirect(
        `http://localhost:5173/payment/stripe-pay-callback?status=failed&error=Missing required parameters`
      );
    }

    if (status === 'canceled') {
      await prisma.payment.updateMany({
        where: { stripe_payment_id: session_id },
        data: { payment_status: 'CANCELLED' },
      });
      return res.redirect(
        'http://localhost:5173/payment/stripe-pay-callback?status=failed'
      );
    }

    // Use your payment service to handle the callback
    const paymentData = await stripeCallbackHandler(session_id);

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { stripe_payment_id: session_id },
        select: {
          payment_id: true,
          invoice_id: true,
          account_id: true,
          event_id: true,
        },
      });

      if (!payment) {
        return createValidationResult(false, [
          'Payment not found for this session',
        ]);
      }

      await tx.payment.update({
        where: { payment_id: payment.payment_id },
        data: {
          payment_status: 'COMPLETED',
          transaction_id: paymentData.paymentIntentId,
          amount: Number(paymentData.amount),
        },
      });

      if (payment.invoice_id) {
        const invoiceUpdate = await updateInvoice(
          payment.invoice_id,
          { status: 'PAID', paid_at: new Date() },
          tx
        );
        if (!invoiceUpdate.isValid) {
          return createValidationResult(false, [
            'Failed to update invoice status',
            ...invoiceUpdate.errors,
          ]);
        }
      }

      if (payment.event_id) {
        const eventUpdate = await tx.event.update({
          where: { event_id: payment.event_id },
          data: { status: 'CONFIRMED' },
        });

        const notification = await createNotification(
          {
            account_id: payment.account_id,
            title: 'Payment Successful',
            message: `Your payment of ${paymentData.amount} for event "${eventUpdate.event_name}" has been processed successfully.`,
            type: 'PAYMENT_SUCCESS',
          },
          tx
        );

        if (!notification.isValid) {
          console.warn(
            'Failed to send payment success notification:',
            notification.errors
          );
        }
      }

      return createValidationResult(true, [], { paymentData });
    });

    if (!result.isValid) {
      return res.redirect(
        `http://localhost:5173/payment/stripe-pay-callback?status=failed&error=${encodeURIComponent(
          result.errors.join(', ')
        )}`
      );
    }

    return res.redirect(
      `http://localhost:5173/payment/stripe-pay-callback?status=success&payment_id=${paymentData.orderId}&paymentIntentId=${paymentData.paymentIntentId}&amount=${paymentData.amount}`
    );
  } catch (error) {
    console.error('Error in stripeCallback:', error);
    return res.redirect(
      `http://localhost:5173/payment/stripe-pay-callback?status=failed&error=${encodeURIComponent(
        error.message
      )}`
    );
  }
};

// Check Stripe Session Status (API)
export const checkSession = async (req, res) => {
  try {
    const { session_id } = req.query;

    if (!session_id) {
      return sendResponse(res, 400, 'Missing required parameter: session_id');
    }

    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.status === 'complete') {
      const paymentData = await stripeCallbackHandler(session_id);

      // Update Payment and Invoice
      const result = await prisma.$transaction(async (tx) => {
        const payment = await tx.payment.findFirst({
          where: { stripe_payment_id: session_id },
          select: { payment_id: true, invoice_id: true },
        });

        if (!payment) {
          return createValidationResult(false, [
            'Payment not found for this session',
          ]);
        }

        await tx.payment.update({
          where: { payment_id: payment.payment_id },
          data: {
            payment_status: 'COMPLETED',
            transaction_id: paymentData.paymentIntentId,
            amount: Number(paymentData.amount),
          },
        });

        if (payment.invoice_id) {
          const invoiceUpdate = await updateInvoice(
            payment.invoice_id,
            { status: 'PAID', paid_at: new Date() },
            tx
          );
          if (!invoiceUpdate.isValid) {
            return createValidationResult(false, [
              'Failed to update invoice status',
              ...invoiceUpdate.errors,
            ]);
          }
        }

        return createValidationResult(true, [], {
          status: 'success',
          orderId: paymentData.orderId,
          paymentIntentId: paymentData.paymentIntentId,
          amount: paymentData.amount,
        });
      });

      if (!result.isValid) {
        return sendResponse(res, 400, result.errors);
      }
      return sendResponse(res, 200, 'Stripe session completed', result.data);
    } else if (session.status === 'expired') {
      await prisma.payment.updateMany({
        where: { stripe_payment_id: session_id },
        data: { payment_status: 'CANCELLED' },
      });
      return sendResponse(res, 200, 'Payment session expired', {
        status: 'canceled',
        message: 'Payment session expired',
      });
    } else {
      return sendResponse(res, 200, 'Payment session still pending', {
        status: 'pending',
        message: 'Payment session still pending',
      });
    }
  } catch (error) {
    console.error('Error in checkSession:', error);
    return sendResponse(res, 500, 'Error checking Stripe session');
  }
};
