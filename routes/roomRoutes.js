import {
  createRoomController,
  updateRoomController,
  getAllRoomsController,
  getRoomByIdController,
  deleteRoomController,
  checkRoomAvailabilityController,
  restoreRoomController,
} from "../controller/roomController.js";
import express from "express";
import { validateToken, validateAdmin } from "../middleware/authMiddleware.js";
import multer from "multer";

const upload = multer();

const router = express.Router();

//Public routes
router.get("/", getAllRoomsController);
router.get("/:id", getRoomByIdController);
router.get("/:id/availability", checkRoomAvailabilityController);

//Admin routes
router.post(
  "/",
  validateToken,
  validateAdmin,
  upload.array("image"),
  createRoomController
);
router.put(
  "/:id",
  validateToken,
  validateAdmin,
  upload.array("image"),
  updateRoomController
);
router.delete("/:id", validateToken, validateAdmin, deleteRoomController);
router.patch(
  "/:id/restore",
  validateToken,
  validateAdmin,
  restoreRoomController
);

export default router;
