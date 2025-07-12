import express from "express";
import {
  createPaymentController,
  updatePaymentController,
  getPaymentByIdController,
  getAllPaymentsController,
  deletePaymentController
} from "../controller/paymentController.js";
import {
  createCheckoutSession,
  stripeCallback,
  checkSession
} from "../controller/stripeController.js";

const router = express.Router();

// Stripe payment endpoints (use controller, not inline handler)
router.post("/stripe/checkout-session", ...createCheckoutSession);
router.get("/stripe/check-session", checkSession);
router.get("/stripe/callback", stripeCallback);

// Payment CRUD endpoints
router.post("/", ...createPaymentController);
router.put("/:id", ...updatePaymentController);
router.get("/", ...getAllPaymentsController);
router.get("/:id", ...getPaymentByIdController);
router.delete("/:id", ...deletePaymentController);

export default router;