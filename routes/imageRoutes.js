import express from "express";
import {
  createImage,
  getAllImages,
  getImageById,
  updateImage,
  deleteImage
} from "../controller/imageUploadController.js";
import { validateToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// Create a new image (authenticated)
router.post("/", validateToken, createImage);

// Get all images (public)
router.get("/", getAllImages);

// Get image by ID (public)
router.get("/:id",validateToken, getImageById);

// Update image (authenticated)
router.patch("/:id",validateToken, updateImage);

// Delete image (authenticated)
router.delete("/:id", validateToken, deleteImage);

export default router;