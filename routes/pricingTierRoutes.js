import express from "express";
import {
  createPricingTierController,
  getPricingTierByIdController,
  getAllPricingTiersController,
  updatePricingTierController,
  deletePricingTierController,
  togglePricingTierStatusController,
  getActivePricingTiersController,
  getPricingTiersByPriceRangeController
} from "../controller/pricingTierController.js";
import { validateToken, validateAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public routes
router.get("/", getAllPricingTiersController);
router.get("/active", getActivePricingTiersController);
router.get("/range", getPricingTiersByPriceRangeController);
router.get("/:id", getPricingTierByIdController);

// Admin/protected routes
router.post("/", validateToken, validateAdmin, createPricingTierController);
router.put("/:id", validateToken, validateAdmin, updatePricingTierController);
router.delete("/:id", validateToken, validateAdmin, deletePricingTierController);
router.patch("/:id/toggle", validateToken, validateAdmin, togglePricingTierStatusController);

export default router;