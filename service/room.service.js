import {
  validatePagination,
  validateNumber,
  validateObject,
  validateString,
} from "../utils/validation.js";
import { prisma } from "../prisma/prisma.js";
import { uploadImage, deleteImageFromCloud } from "../utils/cloudinary.js";

// CREATE ROOM with images
export async function createRoom(data, imageFiles = []) {
  try {
    // Convert fields to correct types
    if (data.guest_capacity !== undefined)
      data.guest_capacity = Number(data.guest_capacity);
    if (data.base_price !== undefined)
      data.base_price = Number(data.base_price);
    if (data.hourly_rate !== undefined)
      data.hourly_rate = Number(data.hourly_rate);
    if (data.is_active !== undefined)
      data.is_active = data.is_active === "true" || data.is_active === true;

    validateObject(data, ["room_name"]);
    // 1. Create the room
    const room = await prisma.room.create({ data });

    // 2. Upload images and create Image records
    if (imageFiles && imageFiles.length > 0) {
      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        const uploadResult = await uploadImage(
          file.buffer,
          `rooms/${room.room_id}`,
          `${room.room_name.replace(/[^a-zA-Z0-9]/g, "_")}_${Date.now()}`,
          { width: 800, height: 600, crop: "fill", quality: "auto" }
        );
        await prisma.image.create({
          data: {
            image_url: uploadResult.secure_url,
            image_public_id: uploadResult.public_id,
            is_primary: i === 0, // first image is primary
            room_id: room.room_id,
          },
        });
      }
    }

    // 3. Return room with images
    const result = await prisma.room.findUnique({
      where: { room_id: room.room_id },
      include: { images: true },
    });

    return { isValid: true, data: result, errors: [] };
  } catch (error) {
    return { isValid: false, data: null, errors: [error.message] };
  }
}

// GET ROOM BY ID
export async function getRoomById(room_id, options = {}) {
  try {
    validateNumber(room_id);
    const include = {};
    if (options.includeImages) include.images = true;
    if (options.includeEvents) include.events = true;

    const room = await prisma.room.findUnique({
      where: { room_id: Number(room_id) },
      include,
    });

    if (!room) {
      return { isValid: false, data: null, errors: ["Room not found"] };
    }

    return { isValid: true, data: room, errors: [] };
  } catch (error) {
    return { isValid: false, data: null, errors: [error.message] };
  }
}

// GET ALL ROOMS (with images)
export async function getAllRooms(query) {
  try {
    const {
      search,
      status,
      isActive,
      includeInactive,
      guestCapacityMin,
      guestCapacityMax,
      page = 1,
      limit = 20,
      sortBy = "created_at",
      sortOrder = "asc",
      includeEvents,
      includeImages,
    } = query;

    validatePagination({ page, pageSize: limit });

    const where = {
      AND: [
        search
          ? {
              room_name: {
                contains: search,
                mode: "insensitive",
              },
            }
          : {},
        status ? { status } : {},
        isActive !== undefined
          ? { is_active: isActive === true || isActive === "true" }
          : {},
        includeInactive ? {} : { is_active: true },
        guestCapacityMin
          ? { guest_capacity: { gte: Number(guestCapacityMin) } }
          : {},
        guestCapacityMax
          ? { guest_capacity: { lte: Number(guestCapacityMax) } }
          : {},
      ],
    };

    const include = {};
    if (includeImages) include.images = true;
    if (includeEvents) include.events = true;

    const [total, rooms] = await Promise.all([
      prisma.room.count({ where }),
      prisma.room.findMany({
        where,
        skip: (page - 1) * limit,
        take: Number(limit),
        orderBy: {
          [sortBy]: sortOrder,
        },
        include,
      }),
    ]);

    return {
      isValid: true,
      data: {
        rooms,
        pagination: {
          total,
          page: Number(page),
          pageSize: Number(limit),
          totalPages: Math.ceil(total / limit),
        },
      },
      errors: [],
    };
  } catch (error) {
    return { isValid: false, data: null, errors: [error.message] };
  }
}

// UPDATE ROOM with images
export async function updateRoom(
  room_id,
  data,
  imageFiles = [],
  removeOldImages = false
) {
  try {
    // Convert fields to correct types
    if (data.guest_capacity !== undefined)
      data.guest_capacity = Number(data.guest_capacity);
    if (data.base_price !== undefined)
      data.base_price = Number(data.base_price);
    if (data.hourly_rate !== undefined)
      data.hourly_rate = Number(data.hourly_rate);
    if (data.is_active !== undefined)
      data.is_active = data.is_active === "true" || data.is_active === true;

    const roomIdNum = Number(room_id);
    validateNumber(roomIdNum);

    // Optionally remove old images
    if (removeOldImages) {
      const oldImages = await prisma.image.findMany({
        where: { room_id: roomIdNum },
      });
      for (const img of oldImages) {
        if (img.image_public_id) {
          await deleteImageFromCloud(img.image_public_id);
        }
      }
      await prisma.image.deleteMany({ where: { room_id: roomIdNum } });
    }

    // Update room data
    const room = await prisma.room.update({
      where: { room_id: roomIdNum },
      data,
    });

    // Upload new images if provided
    if (imageFiles && imageFiles.length > 0) {
      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        const uploadResult = await uploadImage(
          file.buffer,
          `rooms/${room.room_id}`,
          `${room.room_name.replace(/[^a-zA-Z0-9]/g, "_")}_${Date.now()}`,
          { width: 800, height: 600, crop: "fill", quality: "auto" }
        );
        await prisma.image.create({
          data: {
            image_url: uploadResult.secure_url,
            image_public_id: uploadResult.public_id,
            is_primary: i === 0,
            room_id: room.room_id,
          },
        });
      }
    }

    const result = await prisma.room.findUnique({
      where: { room_id: room.room_id },
      include: { images: true },
    });

    return { isValid: true, data: result, errors: [] };
  } catch (error) {
    return { isValid: false, data: null, errors: [error.message] };
  }
}

// SOFT DELETE ROOM
export async function deleteRoom(room_id) {
  try {
    const roomIdNum = Number(room_id);
    validateNumber(roomIdNum);
    const deleted = await prisma.room.update({
      where: { room_id: roomIdNum }, // Use the number, not the string
      data: { is_active: false },
    });
    return { isValid: true, data: deleted, errors: [] };
  } catch (error) {
    return { isValid: false, data: null, errors: [error.message] };
  }
}

// RESTORE ROOM
export async function restoreRoom(room_id) {
  try {
    const roomIdNum = Number(room_id);
    validateNumber(roomIdNum);
    const restored = await prisma.room.update({
      where: { room_id: roomIdNum }, // Use the number, not the string
      data: { is_active: true },
    });
    return { isValid: true, data: restored, errors: [] };
  } catch (error) {
    return { isValid: false, data: null, errors: [error.message] };
  }
}

// CHECK ROOM AVAILABILITY
export async function checkRoomAvailability(
  room_id,
  start_time,
  end_time,
  duration_hours
) {
  try {
    const roomIdNum = Number(room_id);
    validateNumber(room_id);
    if (!start_time || !end_time) {
      return {
        isValid: false,
        data: null,
        errors: ["start_time and end_time are required"],
      };
    }

    const conflicting = await prisma.event.findFirst({
      where: {
        room_id: Number(room_id),
        status: { in: ["CONFIRMED", "IN_PROGRESS"] },
        OR: [
          {
            start_time: {
              lt: new Date(end_time),
            },
            end_time: {
              gt: new Date(start_time),
            },
          },
        ],
      },
    });

    return { isValid: true, data: { isAvailable: !conflicting }, errors: [] };
  } catch (error) {
    return { isValid: false, data: null, errors: [error.message] };
  }
}

// ROOM STATISTICS
export async function getRoomStatistics() {
  try {
    const [total, available, occupied, maintenance, reserved] =
      await Promise.all([
        prisma.room.count(),
        prisma.room.count({ where: { status: "AVAILABLE" } }),
        prisma.room.count({ where: { status: "OCCUPIED" } }),
        prisma.room.count({ where: { status: "MAINTENANCE" } }),
        prisma.room.count({ where: { status: "RESERVED" } }),
      ]);

    return {
      isValid: true,
      data: {
        total,
        available,
        occupied,
        maintenance,
        reserved,
      },
      errors: [],
    };
  } catch (error) {
    return { isValid: false, data: null, errors: [error.message] };
  }
}

// BULK UPDATE ROOMS
export async function bulkUpdateRooms(roomIds, data) {
  try {
    if (!Array.isArray(roomIds) || roomIds.length === 0) {
      throw new Error("Invalid roomIds array");
    }
    const updated = await prisma.room.updateMany({
      where: {
        room_id: { in: roomIds },
      },
      data,
    });
    return { isValid: true, data: updated, errors: [] };
  } catch (error) {
    return { isValid: false, data: null, errors: [error.message] };
  }
}
