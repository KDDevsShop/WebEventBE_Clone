import express from "express";
import multer from "multer";
import {
  createVariation,
  getAllVariations,
  getVariationById,
  updateVariation,
  deleteVariation
} from "../controller/variationController.js"
import { validateToken, validateAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();
const upload = multer(); 

// Public routes
router.get("/", getAllVariations);
router.get("/:id", getVariationById);

// Protected routes (admin only)
router.post("/", validateToken, validateAdmin, upload.single("image"), createVariation);
router.put("/:id", validateToken, validateAdmin, upload.single("image"), updateVariation);
router.delete("/:id", validateToken, validateAdmin, deleteVariation);

export default router;