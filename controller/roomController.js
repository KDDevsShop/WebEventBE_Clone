import {
  createRoom,
  updateRoom,
  getAllRooms,
  getRoomById,
  deleteRoom,
  checkRoomAvailability,
  restoreRoom,
} from "../service/room.service.js";

// Create a new room
export const createRoomController = async (req, res) => {
  try {
    const roomData = req.body;

    // Handle multiple image upload
    const imageFiles = req.files || [];

    const result = await createRoom(roomData, imageFiles);

    if (!result.isValid) {
      return res.status(400).json({
        success: false,
        errors: result.errors,
      });
    }

    return res.status(201).json({
      success: true,
      data: result.data,
      errors: [],
    });
  } catch (error) {
    console.error("Error in createRoom controller:", error);
    return res.status(500).json({
      success: false,
      errors: ["Internal server error"],
    });
  }
};

// Update an existing room
export const updateRoomController = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    // Handle single image upload (multer.single("image"))
    const imageFiles = req.files || [];
    // If you want to remove old images, pass true as third argument
    const removeOldImages = req.body.removeOldImages === "true";
    const result = await updateRoom(
      id,
      updateData,
      imageFiles,
      removeOldImages
    );

    if (!result.isValid) {
      return res.status(400).json({
        success: false,
        errors: result.errors,
      });
    }

    return res.status(200).json({
      success: true,
      data: result.data,
      errors: [],
    });
  } catch (error) {
    console.error("Error in updateRoom controller:", error);
    return res.status(500).json({
      success: false,
      errors: ["Internal server error"],
    });
  }
};

// Get all rooms with filters
export const getAllRoomsController = async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      isActive:
        req.query.isActive === "true"
          ? true
          : req.query.isActive === "false"
          ? false
          : undefined,
      includeInactive: req.query.includeInactive === "true",
      guestCapacityMin: req.query.guestCapacityMin,
      guestCapacityMax: req.query.guestCapacityMax,
      search: req.query.search,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      sortBy: req.query.sortBy || "created_at",
      sortOrder: req.query.sortOrder || "asc",
      includeEvents: req.query.includeEvents === "true",
      includeImages: req.query.includeImages === "true",
    };

    const result = await getAllRooms(filters);

    if (!result.isValid) {
      return res.status(400).json({
        success: false,
        errors: result.errors,
      });
    }

    return res.status(200).json({
      success: true,
      data: result.data.rooms,
      pagination: result.data.pagination,
      errors: [],
    });
  } catch (error) {
    console.error("Error in getAllRooms controller:", error);
    return res.status(500).json({
      success: false,
      errors: ["Internal server error"],
    });
  }
};

// Get room by ID
export const getRoomByIdController = async (req, res) => {
  try {
    const { id } = req.params;
    const options = {
      includeEvents: req.query.includeEvents === "true",
      includeImages: req.query.includeImages === "true",
    };
    const result = await getRoomById(id, options);

    if (!result.isValid) {
      return res.status(404).json({
        success: false,
        errors: result.errors,
      });
    }

    return res.status(200).json({
      success: true,
      data: result.data,
      errors: [],
    });
  } catch (error) {
    console.error("Error in getRoomById controller:", error);
    return res.status(500).json({
      success: false,
      errors: ["Internal server error"],
    });
  }
};

// Delete a room
export const deleteRoomController = async (req, res) => {
  try {
    const { id } = req.params;
    // If you want to support force delete, pass options here
    const result = await deleteRoom(id);

    if (!result.isValid) {
      return res.status(400).json({
        success: false,
        errors: result.errors,
      });
    }

    return res.status(200).json({
      success: true,
      data: result.data,
      errors: [],
    });
  } catch (error) {
    console.error("Error in deleteRoom controller:", error);
    return res.status(500).json({
      success: false,
      errors: ["Internal server error"],
    });
  }
};

// Check room availability
export const checkRoomAvailabilityController = async (req, res) => {
  try {
    const { id } = req.params;
    // Use snake_case to match your service
    const start_time = req.query.start_time;
    const end_time = req.query.end_time;
    const duration_hours = req.query.duration_hours;

    const result = await checkRoomAvailability(
      id,
      start_time,
      end_time,
      duration_hours
    );

    if (!result.isValid) {
      return res.status(400).json({
        success: false,
        errors: result.errors,
      });
    }

    return res.status(200).json({
      success: true,
      data: result.data,
      errors: [],
    });
  } catch (error) {
    console.error("Error in checkRoomAvailability controller:", error);
    return res.status(500).json({
      success: false,
      errors: ["Internal server error"],
    });
  }
};

export const restoreRoomController = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await restoreRoom(id);

    if (!result.isValid) {
      return res.status(400).json({
        success: false,
        errors: result.errors,
      });
    }

    return res.status(200).json({
      success: true,
      data: result.data,
      errors: [],
    });
  } catch (error) {
    console.error("Error in restoreRoom controller:", error);
    return res.status(500).json({
      success: false,
      errors: ["Internal server error"],
    });
  }
};
