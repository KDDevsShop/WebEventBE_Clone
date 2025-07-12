import express from "express";
import {
  createReview,
  getAllReviews,
  getReviewById,
  updateReview,
  deleteReview
} from "../controller/reviewController.js";
import { validateToken, validateAdmin } from "../middleware/authMiddleware.js";
const router = express.Router();

// Create a new review (authenticated)
router.post("/", validateToken,createReview);

// Get all reviews (public)
router.get("/", getAllReviews);

// Get review by ID (public)
router.get("/:id",validateToken,
  validateAdmin, getReviewById);

// Update review (authenticated)
router.patch("/:id", validateToken,updateReview);

// Delete review (authenticated)
router.delete("/:id", validateToken,deleteReview);

export default router;