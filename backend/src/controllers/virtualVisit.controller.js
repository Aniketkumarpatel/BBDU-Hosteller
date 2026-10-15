import Hostel from '../models/Hostel.js';
import Block from '../models/Block.js';
import Floor from '../models/Floor.js';
import Room from '../models/Room.js';
import ApiError from '../utils/ApiError.js';

const DEFAULT_FACILITIES = [
  'High-Speed Campus Wi-Fi',
  'Study Desk & Ergonomic Chair',
  'Steel Storage Almirah',
  'Wooden Bed with Foam Mattress',
  'Natural Sunlight & Ventilation',
  '24x7 Inverter Power Backup',
  'Daily Room & Corridor Housekeeping',
  'Geyser Hot Water Access',
];

const MAX_PHOTOS = 6;
const MAX_VIDEOS = 2;

/**
 * Explore rooms with full virtual tour media, live availability, and hierarchy.
 * READ-ONLY: strictly for viewing hostel, block, floor, room specs and real warden-uploaded media.
 */
export const exploreRooms = async (req, res, next) => {
  try {
    const {
      hostelId,
      blockId,
      blockCategory,
      floor,
      roomType,
      cooling,
      availableBed,
      chair,
      table,
      almirah,
    } = req.query;

    const [hostels, allBlocks] = await Promise.all([
      Hostel.find({ isActive: true }).select('name code address description photos facilities').lean(),
      Block.find({ isActive: true }).select('hostelId name code description').lean(),
    ]);

    // Strictly Floors 1, 2, 3 as required
    const floors = [
      { floorNumber: 1, name: 'Floor 1' },
      { floorNumber: 2, name: 'Floor 2' },
      { floorNumber: 3, name: 'Floor 3' },
    ];

    // Build filter strictly targeting the 3 Virtual Visit rooms
    const filter = { isActive: true, isVirtualVisitRoom: true };

    if (hostelId && hostelId !== 'all') {
      filter.hostelId = hostelId;
    }

    if (blockId && blockId !== 'all') {
      filter.blockId = blockId;
    } else if (blockCategory === 'SENIORS') {
      const seniorBlocks = allBlocks.filter((b) => /block\s*[ab]|senior/i.test(b.name || b.code));
      if (seniorBlocks.length > 0) {
        filter.blockId = { $in: seniorBlocks.map((b) => b._id) };
      }
    } else if (blockCategory === 'JUNIORS') {
      const juniorBlocks = allBlocks.filter((b) => /block\s*[cd]|junior/i.test(b.name || b.code));
      if (juniorBlocks.length > 0) {
        filter.blockId = { $in: juniorBlocks.map((b) => b._id) };
      }
    }

    if (roomType && roomType !== 'all') {
      filter.roomType = roomType.toUpperCase();
    }

    if (cooling === 'AC') {
      filter.isAc = true;
    } else if (cooling === 'NON_AC') {
      filter.isAc = false;
    }

    if (availableBed === 'true') {
      filter.$expr = { $lt: ['$currentOccupancy', '$capacity'] };
    }

    const facilityQueries = [];
    if (chair === 'true') facilityQueries.push({ facilities: { $regex: /chair/i } });
    if (table === 'true') facilityQueries.push({ facilities: { $regex: /table/i } });
    if (almirah === 'true') facilityQueries.push({ facilities: { $regex: /almirah/i } });

    if (facilityQueries.length > 0) {
      filter.$and = facilityQueries;
    }

    let rawRooms = await Room.find(filter)
      .populate('hostelId', 'name code address')
      .populate('blockId', 'name code')
      .populate('floorId', 'floorNumber name')
      .sort({ roomNumber: 1 })
      .lean();

    // Floor filter (strictly Floors 1, 2, 3)
    if (floor && floor !== 'all') {
      const floorNum = Number(floor);
      rawRooms = rawRooms.filter((r) => Number(r.floorId?.floorNumber) === floorNum);
    }

    const rooms = rawRooms.map((room) => {
      const capacity = Number(room.capacity) || 1;
      const currentOccupancy = Number(room.currentOccupancy) || 0;
      const availableBeds = Math.max(0, capacity - currentOccupancy);
      const isAvailable = currentOccupancy < capacity;
      const occupancyStatus =
        currentOccupancy === 0 ? 'VACANT' : currentOccupancy >= capacity ? 'FULL' : 'AVAILABLE';

      // Strictly warden-uploaded media only (capped at 6 photos & 2 videos). NO AI images!
      const photos = Array.isArray(room.photos) ? room.photos.slice(0, MAX_PHOTOS) : [];
      const videos = Array.isArray(room.videos) ? room.videos.slice(0, MAX_VIDEOS) : [];
      const panorama360 = room.panorama360 || null;

      const facilities =
        Array.isArray(room.facilities) && room.facilities.length > 0
          ? room.facilities
          : DEFAULT_FACILITIES;

      return {
        ...room,
        capacity,
        currentOccupancy,
        availableBeds,
        isAvailable,
        occupancyStatus,
        photos,
        videos,
        panorama360,
        facilities,
        hasPhotos: photos.length > 0,
        hasVideos: videos.length > 0,
        hasPanorama: Boolean(panorama360),
      };
    });

    // Compute live campus/filter statistics
    const stats = {
      totalRooms: rooms.length,
      availableRooms: rooms.filter((r) => r.isAvailable).length,
      fullRooms: rooms.filter((r) => !r.isAvailable).length,
      totalCapacity: rooms.reduce((sum, r) => sum + r.capacity, 0),
      occupiedBeds: rooms.reduce((sum, r) => sum + r.currentOccupancy, 0),
      availableBeds: rooms.reduce((sum, r) => sum + r.availableBeds, 0),
    };

    res.json({
      success: true,
      data: {
        hostels,
        blocks: allBlocks,
        floors,
        rooms,
        stats,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get detailed virtual visit specs for a specific room.
 */
export const getRoomVirtualVisit = async (req, res, next) => {
  try {
    const { id } = req.params;
    const room = await Room.findById(id)
      .populate('hostelId', 'name code address facilities photos')
      .populate('blockId', 'name code description')
      .populate('floorId', 'floorNumber name')
      .lean();

    if (!room || !room.isActive) {
      throw ApiError.notFound('Room not found or currently inactive.');
    }

    const capacity = Number(room.capacity) || 1;
    const currentOccupancy = Number(room.currentOccupancy) || 0;
    const availableBeds = Math.max(0, capacity - currentOccupancy);
    const isAvailable = currentOccupancy < capacity;
    const occupancyStatus =
      currentOccupancy === 0 ? 'VACANT' : currentOccupancy >= capacity ? 'FULL' : 'AVAILABLE';

    // Strictly warden-uploaded media only. NO AI images!
    const photos = Array.isArray(room.photos) ? room.photos.slice(0, MAX_PHOTOS) : [];
    const videos = Array.isArray(room.videos) ? room.videos.slice(0, MAX_VIDEOS) : [];
    const panorama360 = room.panorama360 || null;

    const facilities =
      Array.isArray(room.facilities) && room.facilities.length > 0
        ? room.facilities
        : DEFAULT_FACILITIES;

    res.json({
      success: true,
      data: {
        ...room,
        capacity,
        currentOccupancy,
        availableBeds,
        isAvailable,
        occupancyStatus,
        photos,
        videos,
        panorama360,
        facilities,
        hasPhotos: photos.length > 0,
        hasVideos: videos.length > 0,
        hasPanorama: Boolean(panorama360),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Upload photos (max 6) and short videos (max 2) for a room (Warden & Super Admin only).
 */
export const uploadRoomMedia = async (req, res, next) => {
  try {
    const { id } = req.params;
    const room = await Room.findById(id);
    if (!room) {
      throw ApiError.notFound('Room not found.');
    }

    let currentPhotos = Array.isArray(room.photos) ? [...room.photos] : [];
    let currentVideos = Array.isArray(room.videos) ? [...room.videos] : [];

    // Optional removal of specific media
    if (req.body.removePhoto) {
      currentPhotos = currentPhotos.filter((p) => p !== req.body.removePhoto);
    }
    if (req.body.removeVideo) {
      currentVideos = currentVideos.filter((v) => v !== req.body.removeVideo);
    }

    // Process uploaded photos
    const newPhotos = [];
    const photoFiles = req.files?.photos || req.files?.photo || [];
    for (const f of photoFiles) {
      newPhotos.push(`/uploads/rooms/photos/${f.filename}`);
    }

    // Process uploaded videos
    const newVideos = [];
    const videoFiles = req.files?.videos || req.files?.video || [];
    for (const f of videoFiles) {
      newVideos.push(`/uploads/rooms/videos/${f.filename}`);
    }

    // Validate strict limits: Max 6 photos, Max 2 videos
    if (currentPhotos.length + newPhotos.length > MAX_PHOTOS) {
      throw ApiError.badRequest(
        `Only up to ${MAX_PHOTOS} photos allowed. Room currently has ${currentPhotos.length} photo(s). Adding ${newPhotos.length} would exceed the limit.`
      );
    }

    if (currentVideos.length + newVideos.length > MAX_VIDEOS) {
      throw ApiError.badRequest(
        `Only up to ${MAX_VIDEOS} short videos allowed. Room currently has ${currentVideos.length} video(s). Adding ${newVideos.length} would exceed the limit.`
      );
    }

    room.photos = [...currentPhotos, ...newPhotos];
    room.videos = [...currentVideos, ...newVideos];

    // Optional panorama
    if (req.files?.panorama?.[0]) {
      room.panorama360 = `/uploads/rooms/photos/${req.files.panorama[0].filename}`;
    }

    if (req.body.description !== undefined) {
      room.description = String(req.body.description).trim();
    }

    if (req.body.facilities) {
      const facList = Array.isArray(req.body.facilities)
        ? req.body.facilities
        : String(req.body.facilities)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
      room.facilities = facList;
    }

    await room.save();

    const populated = await Room.findById(id)
      .populate('hostelId', 'name code')
      .populate('blockId', 'name code')
      .populate('floorId', 'floorNumber name');

    res.json({
      success: true,
      message: 'Room media updated successfully by Warden.',
      data: populated,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Delete a specific photo or video from a room (Warden & Super Admin only).
 */
export const deleteRoomMediaItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { type, url } = req.body;

    const room = await Room.findById(id);
    if (!room) {
      throw ApiError.notFound('Room not found.');
    }

    if (type === 'photo') {
      room.photos = (room.photos || []).filter((p) => p !== url);
    } else if (type === 'video') {
      room.videos = (room.videos || []).filter((v) => v !== url);
    } else if (type === 'panorama') {
      room.panorama360 = null;
    }

    await room.save();

    const populated = await Room.findById(id)
      .populate('hostelId', 'name code')
      .populate('blockId', 'name code')
      .populate('floorId', 'floorNumber name');

    res.json({
      success: true,
      message: 'Media deleted successfully.',
      data: populated,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update media links & facilities metadata for a room (Warden & Super Admin only).
 */
export const updateRoomMediaMeta = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { photos, videos, panorama360, facilities, description } = req.body;

    if (Array.isArray(photos) && photos.length > MAX_PHOTOS) {
      throw ApiError.badRequest(`Maximum ${MAX_PHOTOS} photos allowed.`);
    }

    if (Array.isArray(videos) && videos.length > MAX_VIDEOS) {
      throw ApiError.badRequest(`Maximum ${MAX_VIDEOS} short videos allowed.`);
    }

    const update = {};
    if (Array.isArray(photos)) update.photos = photos;
    if (Array.isArray(videos)) update.videos = videos;
    if (typeof panorama360 === 'string' || panorama360 === null) update.panorama360 = panorama360;
    if (Array.isArray(facilities)) update.facilities = facilities;
    if (typeof description === 'string') update.description = description.trim();

    const updatedRoom = await Room.findByIdAndUpdate(id, update, { new: true })
      .populate('hostelId', 'name code')
      .populate('blockId', 'name code')
      .populate('floorId', 'floorNumber name');

    if (!updatedRoom) {
      throw ApiError.notFound('Room not found.');
    }

    res.json({
      success: true,
      message: 'Room details updated successfully.',
      data: updatedRoom,
    });
  } catch (err) {
    next(err);
  }
};
