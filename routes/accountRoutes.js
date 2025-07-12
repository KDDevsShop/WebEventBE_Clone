import express from "express";
import multer from "multer";
import path from "path";
import rateLimit from "express-rate-limit";
import {
  loginAccountController,
  createAccountController,
  getAccountByIdController,
  updateAccountController,
  updatePasswordController,
  uploadAvatarController,
  getAllAccountsController,
  deleteAccountController,
  banAccountUserController,
  unbanAccountUserController,
  getAccountByEmailController,
  getMyProfile,
} from "../controller/accountController.js";
import { sendResponse } from "../utils/response.js";
import { validateToken, validateAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// Rate limiters
const generalLimiter = rateLimit({ windowMs: 60 * 1000, max: 100 });
const sensitiveLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5 });
const uploadLimiter = rateLimit({ windowMs: 60 * 1000, max: 10 });

// Multer config
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "image/svg+xml"
    ];
    allowedMimes.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error("Invalid file type."), false);
  },
  limits: { fileSize: 5 * 1024 * 1024, files: 1 }
});

const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError || error.message.includes("Invalid file type"))
    return sendResponse(res, 400, error.message);
  next(error);
};

// Public routes (No auth)
router.post("/login", generalLimiter, loginAccountController);
router.post("/register", generalLimiter, createAccountController);

// Authenticated user routes
router.get("/my-profile", generalLimiter, validateToken, getMyProfile);
router.get("/:accountId", generalLimiter, validateToken, getAccountByIdController);
router.put("/:accountId", generalLimiter, validateToken, updateAccountController);
router.put("/:accountId/password", sensitiveLimiter, validateToken, updatePasswordController);
router.post(
  "/:accountId/upload-avatar",
  validateToken,
  uploadLimiter,
  upload.single("avatar"),
  handleMulterError,
  uploadAvatarController
);

// Admin-only routes
router.get("/", generalLimiter, validateToken, validateAdmin, getAllAccountsController);
router.delete("/:accountId", generalLimiter, validateToken, validateAdmin, deleteAccountController);
router.put("/:accountId/ban", generalLimiter, validateToken, validateAdmin, banAccountUserController);
router.put("/:accountId/unban", generalLimiter, validateToken, validateAdmin, unbanAccountUserController);
router.get("/email/:email", generalLimiter, validateToken, validateAdmin, getAccountByEmailController);

// Fallback
router.use((req, res) => {
  sendResponse(res, 404, `Route ${req.method} ${req.originalUrl} not found`);
});

export default router;
