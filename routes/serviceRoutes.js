import express from "express";
import {
  createService,
  getAllServices,
  getServiceById,
  updateService,
  deleteService,
  advancedSearchServices,
  getServicesDashboard,
  bulkUpdateServices,
  exportServices,
} from "../controller/servicesController.js";
import { validateToken, validateAdmin } from "../middleware/authMiddleware.js";
import multer from "multer";

const upload = multer();

const router = express.Router();

// Public routes
router.get("/", getAllServices);
router.get("/dashboard", getServicesDashboard);
router.get("/export", exportServices);
router.get("/search", advancedSearchServices);
router.get("/:id", getServiceById);

// Protected routes (require authentication)
router.post(
  "/",
  validateToken,
  validateAdmin,
  upload.array("image"),
  createService
);
router.put(
  "/:id",
  validateToken,
  validateAdmin,
  upload.array("images"),
  updateService
);
router.delete("/:id", validateToken, validateAdmin, deleteService);
router.put(
  "/bulk-update",
  (req, res, next) => {
    console.log("Route received body:", req.body);
    next();
  },
  bulkUpdateServices
);
export default router;
