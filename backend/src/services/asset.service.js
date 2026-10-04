import mongoose from 'mongoose';
import Asset from '../models/Asset.js';
import MaintenanceWorkOrder from '../models/MaintenanceWorkOrder.js';
import MaintenancePlan from '../models/MaintenancePlan.js';
import MaintenanceCycle from '../models/MaintenanceCycle.js';
import Complaint from '../models/Complaint.js';
import Hostel from '../models/Hostel.js';
import Block from '../models/Block.js';
import Floor from '../models/Floor.js';
import Room from '../models/Room.js';
import Department from '../models/Department.js';
import User from '../models/User.js';
import { getNextSequence } from '../models/Counter.js';
import { ROLES } from '../constants/roles.js';
import {
  ASSET_STATUSES,
  ASSET_CONDITIONS,
  ASSET_TYPES,
  WORK_ORDER_STATUSES,
} from '../constants/workOrder.constants.js';
import {
  OPERATIONAL_FLAGS,
  WARRANTY_STATUSES,
  INVENTORY_THRESHOLDS,
} from '../constants/inventory.constants.js';
import { NOTIFICATION_TYPES } from '../constants/notification.constants.js';
import { createNotification } from './notification.service.js';
import ApiError from '../utils/ApiError.js';

/**
 * Generate sequential atomic asset ID: AST-YYYY-XXXXX
 * e.g. AST-2026-00001
 */
export const generateAssetId = async () => {
  const year = new Date().getFullYear();
  const sequenceKey = `asset_${year}`;

  let attempts = 0;
  while (attempts < 5) {
    const seq = await getNextSequence(sequenceKey);
    const assetId = `AST-${year}-${String(seq).padStart(5, '0')}`;

    const existing = await Asset.findOne({ assetId }).lean();
    if (!existing) {
      return assetId;
    }
    attempts += 1;
  }

  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `AST-${year}-${randomSuffix}`;
};

/**
 * Validate hostel, block, floor, room hierarchy
 */
export const validateLocationHierarchy = async (hostelId, blockId, floorId, roomId) => {
  if (!hostelId) {
    throw new ApiError(400, 'Hostel reference is required.');
  }

  const hostel = await Hostel.findById(hostelId);
  if (!hostel) {
    throw new ApiError(404, 'Specified hostel not found.');
  }

  if (blockId) {
    const block = await Block.findById(blockId);
    if (!block) {
      throw new ApiError(404, 'Specified block not found.');
    }
    if (String(block.hostelId) !== String(hostelId)) {
      throw new ApiError(400, 'Invalid hierarchy: Block does not belong to specified hostel.');
    }
  }

  if (floorId) {
    const floor = await Floor.findById(floorId);
    if (!floor) {
      throw new ApiError(404, 'Specified floor not found.');
    }
    if (String(floor.hostelId) !== String(hostelId)) {
      throw new ApiError(400, 'Invalid hierarchy: Floor does not belong to specified hostel.');
    }
    if (blockId && floor.blockId && String(floor.blockId) !== String(blockId)) {
      throw new ApiError(400, 'Invalid hierarchy: Floor does not belong to specified block.');
    }
  }

  if (roomId) {
    const room = await Room.findById(roomId);
    if (!room) {
      throw new ApiError(404, 'Specified room not found.');
    }
    if (String(room.hostelId) !== String(hostelId)) {
      throw new ApiError(400, 'Invalid hierarchy: Room does not belong to specified hostel.');
    }
    if (blockId && room.blockId && String(room.blockId) !== String(blockId)) {
      throw new ApiError(400, 'Invalid hierarchy: Room does not belong to specified block.');
    }
    if (floorId && room.floorId && String(room.floorId) !== String(floorId)) {
      throw new ApiError(400, 'Invalid hierarchy: Room does not belong to specified floor.');
    }
  }

  return true;
};

/**
 * Compute real-time transparent warranty status
 */
export const computeWarrantyDetails = (
  asset,
  thresholdDays = INVENTORY_THRESHOLDS.DEFAULT_WARRANTY_EXPIRING_DAYS
) => {
  const expiry = asset?.warrantyExpiryDate || asset?.warrantyExpiry;
  if (!expiry) {
    return {
      status: WARRANTY_STATUSES.NO_WARRANTY,
      label: 'No Warranty Data',
      daysRemaining: null,
      expiredDaysAgo: null,
      expiryDate: null,
    };
  }

  const now = new Date();
  const expDate = new Date(expiry);
  const diffMs = expDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (24 * 3600 * 1000));

  if (diffDays < 0) {
    return {
      status: WARRANTY_STATUSES.EXPIRED,
      label: 'Warranty Expired',
      daysRemaining: 0,
      expiredDaysAgo: Math.abs(diffDays),
      expiryDate: expDate,
    };
  }

  if (diffDays <= thresholdDays) {
    return {
      status: WARRANTY_STATUSES.EXPIRING_SOON,
      label: 'Expiring Soon',
      daysRemaining: diffDays,
      expiredDaysAgo: 0,
      expiryDate: expDate,
    };
  }

  return {
    status: WARRANTY_STATUSES.ACTIVE,
    label: 'Under Active Warranty',
    daysRemaining: diffDays,
    expiredDaysAgo: 0,
    expiryDate: expDate,
  };
};

/**
 * Deterministic Explainable Asset Health Score Calculation (0 to 100)
 */
export const calculateAssetHealth = (
  asset,
  workOrders = [],
  openComplaintsCount = 0,
  plans = []
) => {
  if (!asset) {
    return { score: 100, contributingFactors: [], recommendations: [] };
  }

  // Terminal lifecycle status check
  if (asset.status === ASSET_STATUSES.RETIRED || asset.status === ASSET_STATUSES.DISPOSED) {
    return {
      score: 0,
      condition: asset.condition,
      status: asset.status,
      operationalFlag: OPERATIONAL_FLAGS.CRITICAL,
      isReplacementCandidate: false,
      contributingFactors: [
        { factor: `Asset is permanently ${asset.status.toLowerCase()}`, impact: '-100 pts' },
      ],
      recommendations: ['Asset has concluded its service lifecycle.'],
    };
  }

  let score = 100;
  const contributingFactors = [];
  const recommendations = [];

  // 1. Condition Penalty
  if (asset.condition === ASSET_CONDITIONS.CRITICAL) {
    score -= 55;
    contributingFactors.push({ factor: 'Asset physical condition rated CRITICAL', impact: '-55 pts' });
    recommendations.push('Immediate technician inspection or safety decommission required.');
  } else if (asset.condition === ASSET_CONDITIONS.POOR) {
    score -= 35;
    contributingFactors.push({ factor: 'Asset physical condition rated POOR', impact: '-35 pts' });
    recommendations.push('Schedule restorative preventive maintenance overhaul.');
  } else if (asset.condition === ASSET_CONDITIONS.FAIR) {
    score -= 15;
    contributingFactors.push({ factor: 'Asset physical condition rated FAIR', impact: '-15 pts' });
  } else {
    contributingFactors.push({ factor: 'Physical condition optimal (GOOD)', impact: '+0 pts' });
  }

  // 2. Operational Status Penalty
  if (asset.status === ASSET_STATUSES.DAMAGED) {
    score -= 30;
    contributingFactors.push({ factor: 'Asset is currently marked DAMAGED', impact: '-30 pts' });
    recommendations.push('Initiate repair work order or vendor claim.');
  } else if (asset.status === ASSET_STATUSES.REPLACEMENT_REVIEW) {
    score -= 25;
    contributingFactors.push({ factor: 'Asset flagged for Replacement Review', impact: '-25 pts' });
  } else if (asset.status === ASSET_STATUSES.UNDER_MAINTENANCE) {
    score -= 10;
    contributingFactors.push({ factor: 'Asset currently under maintenance', impact: '-10 pts' });
  }

  // 3. Recent Failures & Work Orders in past 90 days
  const now = Date.now();
  const windowMs = INVENTORY_THRESHOLDS.MAX_RECENT_FAILURE_DAYS * 24 * 3600 * 1000;
  const recentWorkOrders = workOrders.filter((w) => {
    const createdTime = new Date(w.createdAt).getTime();
    return now - createdTime <= windowMs;
  });

  if (recentWorkOrders.length > 0) {
    const penalty = Math.min(30, recentWorkOrders.length * 8);
    score -= penalty;
    contributingFactors.push({
      factor: `${recentWorkOrders.length} maintenance work order(s) in the past 90 days`,
      impact: `-${penalty} pts`,
    });
    if (recentWorkOrders.length >= INVENTORY_THRESHOLDS.FREQUENT_FAILURE_THRESHOLD) {
      recommendations.push('Evaluate recurring breakdown pattern to eliminate root cause.');
    }
  }

  // 4. Open Complaints Penalty
  if (openComplaintsCount > 0) {
    const penalty = Math.min(20, openComplaintsCount * 10);
    score -= penalty;
    contributingFactors.push({
      factor: `${openComplaintsCount} active resident complaint(s) linked to this asset`,
      impact: `-${penalty} pts`,
    });
  }

  // 5. Overdue Preventive Plans Penalty
  const activePlans = plans.filter((p) => p.status === 'ACTIVE');
  const hasOverduePlan = activePlans.some((p) => p.nextDueAt && new Date(p.nextDueAt).getTime() < now);
  if (hasOverduePlan) {
    score -= 15;
    contributingFactors.push({ factor: 'Overdue preventive maintenance cycle detected', impact: '-15 pts' });
    recommendations.push('Execute overdue preventive service cycle to avert equipment failure.');
  }

  // 6. Warranty Expiry Penalty
  const warrantyInfo = computeWarrantyDetails(asset);
  if (warrantyInfo.status === WARRANTY_STATUSES.EXPIRED) {
    score -= 5;
    contributingFactors.push({ factor: 'Manufacturer warranty has expired', impact: '-5 pts' });
  }

  // 7. Age vs Expected Life Penalty
  if (asset.purchaseDate && asset.expectedLifeYears > 0) {
    const ageYears = (now - new Date(asset.purchaseDate).getTime()) / (365.25 * 24 * 3600 * 1000);
    if (ageYears > asset.expectedLifeYears) {
      score -= 15;
      contributingFactors.push({
        factor: `Asset exceeded expected lifespan (${ageYears.toFixed(1)} yrs > ${asset.expectedLifeYears} yrs)`,
        impact: '-15 pts',
      });
      recommendations.push('Plan budgetary allocation for anticipated asset replacement.');
    }
  }

  score = Math.min(100, Math.max(0, Math.round(score)));

  // Derive Operational Flag
  let operationalFlag = OPERATIONAL_FLAGS.NORMAL;
  if (score < 40 || asset.condition === ASSET_CONDITIONS.CRITICAL || asset.failureCount >= 4) {
    operationalFlag = OPERATIONAL_FLAGS.CRITICAL;
  } else if (
    recentWorkOrders.length >= INVENTORY_THRESHOLDS.FREQUENT_FAILURE_THRESHOLD ||
    asset.failureCount >= 3 ||
    asset.condition === ASSET_CONDITIONS.POOR
  ) {
    operationalFlag = OPERATIONAL_FLAGS.FREQUENT_FAILURE;
  } else if (recentWorkOrders.length >= 2 || asset.condition === ASSET_CONDITIONS.FAIR) {
    operationalFlag = OPERATIONAL_FLAGS.WATCH;
  }

  // Evaluate Replacement Candidate
  const purchaseCost = Number(asset.purchaseCost) || 0;
  const maintenanceCost = Number(asset.totalMaintenanceCost) || 0;
  const isHighCost =
    purchaseCost > 0 &&
    maintenanceCost >= purchaseCost * INVENTORY_THRESHOLDS.REPLACEMENT_COST_PERCENTAGE;

  const isReplacementCandidate =
    score < 45 ||
    (isHighCost && (asset.condition === ASSET_CONDITIONS.POOR || asset.condition === ASSET_CONDITIONS.CRITICAL)) ||
    (asset.failureCount >= 4 && asset.condition === ASSET_CONDITIONS.POOR);

  if (isReplacementCandidate && !recommendations.some((r) => r.toLowerCase().includes('replacement'))) {
    recommendations.push('Flagged for Replacement Review based on degraded health and repair frequency.');
  }

  return {
    score,
    condition: asset.condition,
    status: asset.status,
    operationalFlag,
    isReplacementCandidate,
    contributingFactors,
    recommendations,
    warranty: warrantyInfo,
  };
};

/**
 * Create a new Asset
 */
export const createAsset = async (data, user) => {
  if (user.role === ROLES.STUDENT) {
    throw new ApiError(403, 'Forbidden: Students cannot manage assets.');
  }

  const {
    name,
    assetCode,
    assetType,
    category,
    description,
    hostelId,
    blockId,
    floorId,
    roomId,
    commonArea,
    departmentId,
    serialNumber,
    modelNumber,
    manufacturer,
    vendor,
    purchaseDate,
    purchaseCost,
    warrantyStartDate,
    warrantyExpiryDate,
    warrantyExpiry,
    expectedLifeYears,
    status,
    condition,
    notes,
  } = data;

  if (!name || !category || !hostelId || !departmentId) {
    throw new ApiError(400, 'Name, category, hostel, and department are required to create an asset.');
  }

  // Hostel Scope Enforcement: Warden can only create assets in their assigned hostel
  if (user.role === ROLES.WARDEN) {
    const wardenHostelId = user.hostelId?._id || user.hostelId;
    if (String(wardenHostelId) !== String(hostelId)) {
      throw new ApiError(403, 'Forbidden: You can only register assets within your assigned hostel.');
    }
  }

  // Validate department exists
  const dept = await Department.findById(departmentId);
  if (!dept) {
    throw new ApiError(404, 'Specified department not found.');
  }

  // Validate Location Hierarchy
  await validateLocationHierarchy(hostelId, blockId, floorId, roomId);

  // Validate Costs
  if (purchaseCost !== undefined && (isNaN(purchaseCost) || Number(purchaseCost) < 0)) {
    throw new ApiError(400, 'Purchase cost cannot be negative.');
  }
  if (expectedLifeYears !== undefined && (isNaN(expectedLifeYears) || Number(expectedLifeYears) < 0)) {
    throw new ApiError(400, 'Expected life years cannot be negative.');
  }

  // Check duplicate serial number within same hostel if serial provided
  if (serialNumber && serialNumber.trim()) {
    const existingSerial = await Asset.findOne({
      hostelId,
      serialNumber: serialNumber.trim(),
    }).lean();
    if (existingSerial) {
      throw new ApiError(400, `An asset with serial number "${serialNumber.trim()}" already exists in this hostel.`);
    }
  }

  const assetId = await generateAssetId();
  const effectiveAssetCode = (assetCode?.trim() || assetId).toUpperCase();

  const finalWarrantyExpiry = warrantyExpiryDate || warrantyExpiry || null;

  const asset = await Asset.create({
    assetId,
    assetCode: effectiveAssetCode,
    name: name.trim(),
    assetType: assetType || ASSET_TYPES.OTHER,
    category,
    description: description?.trim() || '',
    hostelId,
    blockId: blockId || null,
    floorId: floorId || null,
    roomId: roomId || null,
    commonArea: commonArea?.trim() || null,
    departmentId,
    serialNumber: serialNumber?.trim() || '',
    modelNumber: modelNumber?.trim() || '',
    manufacturer: manufacturer?.trim() || '',
    vendor: vendor?.trim() || '',
    purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
    purchaseCost: Number(purchaseCost) || 0,
    warrantyStartDate: warrantyStartDate ? new Date(warrantyStartDate) : null,
    warrantyExpiryDate: finalWarrantyExpiry ? new Date(finalWarrantyExpiry) : null,
    warrantyExpiry: finalWarrantyExpiry ? new Date(finalWarrantyExpiry) : null,
    expectedLifeYears: Number(expectedLifeYears) || 5,
    status: status || ASSET_STATUSES.ACTIVE,
    condition: condition || ASSET_CONDITIONS.GOOD,
    notes: notes?.trim() || '',
    qrCodeData: JSON.stringify({ assetId, assetCode: effectiveAssetCode, name: name.trim() }),
    createdBy: user._id,
    lifecycleAuditLog: [
      {
        action: 'REGISTERED',
        performedBy: user._id,
        newStatus: status || ASSET_STATUSES.ACTIVE,
        reason: 'Asset initial registration in inventory system',
        timestamp: new Date(),
      },
    ],
  });

  return asset;
};

/**
 * List Assets with pagination and filtering
 */
export const getAssets = async (query = {}, user) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const filter = {};

  // Server-side RBAC scoping
  if (user.role === ROLES.WARDEN) {
    if (user.hostelId) {
      filter.hostelId = user.hostelId._id || user.hostelId;
    }
  } else if (user.role === ROLES.HOSTEL_STAFF) {
    if (user.departmentId) {
      filter.departmentId = user.departmentId._id || user.departmentId;
    }
  } else if (user.role === ROLES.STUDENT) {
    // Student can only see assets in their assigned room or common area in their hostel
    if (!user.hostelId) {
      return { assets: [], pagination: { total: 0, page, limit, totalPages: 0 } };
    }
    filter.hostelId = user.hostelId._id || user.hostelId;
    if (user.roomId) {
      filter.$or = [{ roomId: user.roomId }, { commonArea: { $ne: null } }];
    } else {
      filter.commonArea = { $ne: null };
    }
  }

  // Filter params with safe validation
  if (query.hostelId && mongoose.isValidObjectId(query.hostelId)) {
    if (user.role !== ROLES.WARDEN || String(filter.hostelId) === String(query.hostelId)) {
      filter.hostelId = query.hostelId;
    }
  }
  if (query.departmentId && mongoose.isValidObjectId(query.departmentId)) {
    filter.departmentId = query.departmentId;
  }
  if (query.blockId && mongoose.isValidObjectId(query.blockId)) {
    filter.blockId = query.blockId;
  }
  if (query.floorId && mongoose.isValidObjectId(query.floorId)) {
    filter.floorId = query.floorId;
  }
  if (query.roomId && mongoose.isValidObjectId(query.roomId)) {
    filter.roomId = query.roomId;
  }
  if (query.commonArea) {
    filter.commonArea = query.commonArea;
  }
  if (query.category) {
    filter.category = query.category.toUpperCase();
  }
  if (query.status) {
    filter.status = query.status.toUpperCase();
  }
  if (query.condition) {
    filter.condition = query.condition.toUpperCase();
  }
  if (query.assetType) {
    filter.assetType = query.assetType.toUpperCase();
  }
  if (query.operationalFlag) {
    filter.operationalFlag = query.operationalFlag.toUpperCase();
  }
  if (query.replacementRecommended === 'true') {
    filter.replacementRecommended = true;
  }

  // Warranty filter
  if (query.warrantyStatus) {
    const now = new Date();
    const thresholdDays = INVENTORY_THRESHOLDS.DEFAULT_WARRANTY_EXPIRING_DAYS;
    const thresholdDate = new Date(now.getTime() + thresholdDays * 24 * 3600 * 1000);

    if (query.warrantyStatus === WARRANTY_STATUSES.EXPIRING_SOON) {
      filter.warrantyExpiryDate = { $gte: now, $lte: thresholdDate };
    } else if (query.warrantyStatus === WARRANTY_STATUSES.EXPIRED) {
      filter.warrantyExpiryDate = { $lt: now };
    } else if (query.warrantyStatus === WARRANTY_STATUSES.ACTIVE) {
      filter.warrantyExpiryDate = { $gt: thresholdDate };
    } else if (query.warrantyStatus === WARRANTY_STATUSES.NO_WARRANTY) {
      filter.warrantyExpiryDate = null;
    }
  }

  // Search
  if (query.search && typeof query.search === 'string') {
    const s = query.search.trim();
    if (s) {
      filter.$or = [
        { assetId: { $regex: s, $options: 'i' } },
        { assetCode: { $regex: s, $options: 'i' } },
        { name: { $regex: s, $options: 'i' } },
        { serialNumber: { $regex: s, $options: 'i' } },
        { modelNumber: { $regex: s, $options: 'i' } },
      ];
    }
  }

  const [assets, total] = await Promise.all([
    Asset.find(filter)
      .populate('hostelId', 'name code type')
      .populate('blockId', 'name code')
      .populate('floorId', 'floorNumber name')
      .populate('roomId', 'roomNumber roomType')
      .populate('departmentId', 'name code')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Asset.countDocuments(filter),
  ]);

  // Attach computed warranty status
  const enrichedAssets = assets.map((a) => ({
    ...a,
    warrantyStatus: computeWarrantyDetails(a),
  }));

  return {
    assets: enrichedAssets,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Get Asset by ID or assetId with scoping and health score
 */
export const getAssetById = async (idOrAssetId, user) => {
  let query;
  if (mongoose.isValidObjectId(idOrAssetId)) {
    query = { _id: idOrAssetId };
  } else {
    query = {
      $or: [
        { assetId: idOrAssetId.toUpperCase() },
        { assetCode: idOrAssetId.toUpperCase() },
      ],
    };
  }

  const asset = await Asset.findOne(query)
    .populate('hostelId', 'name code type')
    .populate('blockId', 'name code')
    .populate('floorId', 'floorNumber name')
    .populate('roomId', 'roomNumber roomType')
    .populate('departmentId', 'name code')
    .populate('createdBy', 'name email role')
    .populate('updatedBy', 'name email role')
    .populate('movementHistory.changedBy', 'name role')
    .populate('conditionHistory.changedBy', 'name role')
    .populate('lifecycleAuditLog.performedBy', 'name role')
    .lean();

  if (!asset) {
    throw new ApiError(404, 'Asset not found.');
  }

  // Scoping check for Warden
  if (user?.role === ROLES.WARDEN) {
    const wardenHostelId = user.hostelId?._id || user.hostelId;
    const assetHostelId = asset.hostelId?._id || asset.hostelId;
    if (String(wardenHostelId) !== String(assetHostelId)) {
      throw new ApiError(403, 'Forbidden: You do not have permission to access assets from another hostel.');
    }
  }

  // Scoping check for Student
  if (user?.role === ROLES.STUDENT) {
    const studentHostelId = user.hostelId?._id || user.hostelId;
    const assetHostelId = asset.hostelId?._id || asset.hostelId;
    if (String(studentHostelId) !== String(assetHostelId)) {
      throw new ApiError(403, 'Forbidden: Asset belongs to another hostel.');
    }
    if (asset.roomId && String(asset.roomId?._id || asset.roomId) !== String(user.roomId)) {
      throw new ApiError(403, 'Forbidden: You can only view assets in your assigned room or common area.');
    }
  }

  // Fetch linked work orders and open complaints to evaluate health
  const [workOrders, openComplaintsCount, plans] = await Promise.all([
    MaintenanceWorkOrder.find({ assetId: asset._id }).sort({ createdAt: -1 }).lean(),
    Complaint.countDocuments({
      hostelId: asset.hostelId?._id || asset.hostelId,
      status: { $nin: ['RESOLVED', 'CLOSED', 'REJECTED'] },
      $or: [{ roomId: asset.roomId?._id || asset.roomId }, { title: { $regex: asset.name, $options: 'i' } }],
    }),
    MaintenancePlan.find({ assetId: asset._id }).lean(),
  ]);

  const healthData = calculateAssetHealth(asset, workOrders, openComplaintsCount, plans);
  const warrantyData = computeWarrantyDetails(asset);

  return {
    ...asset,
    health: healthData,
    warranty: warrantyData,
  };
};

/**
 * Update an existing asset
 */
export const updateAsset = async (id, data, user) => {
  if (user.role === ROLES.STUDENT) {
    throw new ApiError(403, 'Forbidden: Students cannot modify assets.');
  }

  const asset = await Asset.findById(id);
  if (!asset) {
    throw new ApiError(404, 'Asset not found.');
  }

  // Warden scoping check
  if (user.role === ROLES.WARDEN) {
    const wardenHostelId = user.hostelId?._id || user.hostelId;
    if (String(wardenHostelId) !== String(asset.hostelId)) {
      throw new ApiError(403, 'Forbidden: You cannot modify assets belonging to another hostel.');
    }
  }

  const allowedFields = [
    'name',
    'assetCode',
    'assetType',
    'category',
    'description',
    'blockId',
    'floorId',
    'roomId',
    'commonArea',
    'serialNumber',
    'modelNumber',
    'manufacturer',
    'vendor',
    'purchaseDate',
    'purchaseCost',
    'warrantyStartDate',
    'warrantyExpiryDate',
    'warrantyExpiry',
    'expectedLifeYears',
    'status',
    'condition',
    'notes',
  ];

  // Validate hierarchy if location changed
  if (data.blockId !== undefined || data.floorId !== undefined || data.roomId !== undefined) {
    await validateLocationHierarchy(
      asset.hostelId,
      data.blockId !== undefined ? data.blockId : asset.blockId,
      data.floorId !== undefined ? data.floorId : asset.floorId,
      data.roomId !== undefined ? data.roomId : asset.roomId
    );
  }

  // Cost validation
  if (data.purchaseCost !== undefined && (isNaN(data.purchaseCost) || Number(data.purchaseCost) < 0)) {
    throw new ApiError(400, 'Purchase cost cannot be negative.');
  }

  const prevStatus = asset.status;
  const prevCondition = asset.condition;

  allowedFields.forEach((field) => {
    if (data[field] !== undefined) {
      asset[field] = data[field];
    }
  });

  asset.updatedBy = user._id;

  // Audit status/condition changes
  if (data.status && data.status !== prevStatus) {
    asset.lifecycleAuditLog.push({
      action: 'STATUS_CHANGED',
      performedBy: user._id,
      previousStatus: prevStatus,
      newStatus: data.status,
      reason: data.notes || 'Status updated via asset update',
      timestamp: new Date(),
    });
  }

  if (data.condition && data.condition !== prevCondition) {
    asset.conditionHistory.push({
      previousCondition: prevCondition,
      newCondition: data.condition,
      changedBy: user._id,
      reason: data.notes || 'Condition updated via asset update',
      changedAt: new Date(),
    });
  }

  await asset.save();
  return asset;
};

/**
 * Move / Allocate an Asset
 */
export const moveAsset = async (id, data, user) => {
  if (user.role === ROLES.STUDENT) {
    throw new ApiError(403, 'Forbidden: Students cannot move or allocate assets.');
  }

  const asset = await Asset.findById(id);
  if (!asset) {
    throw new ApiError(404, 'Asset not found.');
  }

  // Warden scope enforcement: Cannot move an asset from or to another hostel
  if (user.role === ROLES.WARDEN) {
    const wardenHostelId = user.hostelId?._id || user.hostelId;
    if (String(wardenHostelId) !== String(asset.hostelId)) {
      throw new ApiError(403, 'Forbidden: You cannot move assets from another hostel.');
    }
    if (data.hostelId && String(wardenHostelId) !== String(data.hostelId)) {
      throw new ApiError(403, 'Forbidden: Wardens cannot move assets outside their assigned hostel.');
    }
  }

  const { hostelId, blockId, floorId, roomId, commonArea, reason, newStatus } = data;

  if (!reason || reason.trim().length < 3) {
    throw new ApiError(400, 'A valid movement reason is required.');
  }

  const targetHostelId = hostelId || asset.hostelId;
  await validateLocationHierarchy(targetHostelId, blockId, floorId, roomId);

  const prevLocation = {
    hostelId: asset.hostelId,
    blockId: asset.blockId,
    floorId: asset.floorId,
    roomId: asset.roomId,
    commonArea: asset.commonArea,
  };

  const newLocation = {
    hostelId: targetHostelId,
    blockId: blockId || null,
    floorId: floorId || null,
    roomId: roomId || null,
    commonArea: commonArea?.trim() || null,
  };

  const prevStatus = asset.status;
  const effectiveNewStatus = newStatus || ASSET_STATUSES.ASSIGNED;

  asset.hostelId = targetHostelId;
  asset.blockId = blockId || null;
  asset.floorId = floorId || null;
  asset.roomId = roomId || null;
  asset.commonArea = commonArea?.trim() || null;
  asset.status = effectiveNewStatus;
  asset.updatedBy = user._id;

  asset.movementHistory.push({
    previousLocation: prevLocation,
    newLocation: newLocation,
    previousStatus: prevStatus,
    newStatus: effectiveNewStatus,
    changedBy: user._id,
    reason: reason.trim(),
    changedAt: new Date(),
  });

  asset.lifecycleAuditLog.push({
    action: 'MOVED',
    performedBy: user._id,
    previousStatus: prevStatus,
    newStatus: effectiveNewStatus,
    reason: reason.trim(),
    timestamp: new Date(),
  });

  await asset.save();

  // Dispatch in-app notification to warden
  const warden = await User.findOne({
    role: ROLES.WARDEN,
    hostelId: targetHostelId,
    isActive: true,
  });
  if (warden) {
    await createNotification({
      recipient: warden._id,
      type: NOTIFICATION_TYPES.ASSET_MOVED,
      title: 'Asset Allocated / Moved',
      message: `Asset ${asset.name} (${asset.assetId}) was relocated. Reason: ${reason.trim()}`,
      relatedEntityType: 'ASSET',
      relatedEntityId: asset._id,
      metadata: { assetId: asset.assetId },
    }).catch(() => {});
  }

  return asset;
};

/**
 * Update Asset Condition
 */
export const updateAssetCondition = async (id, data, user) => {
  if (user.role === ROLES.STUDENT) {
    throw new ApiError(403, 'Forbidden: Students cannot update asset condition.');
  }

  const asset = await Asset.findById(id);
  if (!asset) {
    throw new ApiError(404, 'Asset not found.');
  }

  if (user.role === ROLES.WARDEN) {
    const wardenHostelId = user.hostelId?._id || user.hostelId;
    if (String(wardenHostelId) !== String(asset.hostelId)) {
      throw new ApiError(403, 'Forbidden: You cannot update condition for assets in another hostel.');
    }
  }

  const { condition, reason } = data;
  if (!condition || !Object.values(ASSET_CONDITIONS).includes(condition.toUpperCase())) {
    throw new ApiError(400, 'Invalid asset condition.');
  }

  const prevCondition = asset.condition;
  asset.condition = condition.toUpperCase();
  asset.updatedBy = user._id;

  asset.conditionHistory.push({
    previousCondition: prevCondition,
    newCondition: asset.condition,
    changedBy: user._id,
    reason: reason?.trim() || 'Manual condition audit',
    changedAt: new Date(),
  });

  asset.lifecycleAuditLog.push({
    action: 'CONDITION_UPDATED',
    performedBy: user._id,
    reason: `Condition updated from ${prevCondition} to ${asset.condition}. ${reason || ''}`.trim(),
    timestamp: new Date(),
  });

  // Evaluate if condition degradation requires operational flag update
  if (asset.condition === ASSET_CONDITIONS.CRITICAL) {
    asset.operationalFlag = OPERATIONAL_FLAGS.CRITICAL;
  } else if (asset.condition === ASSET_CONDITIONS.POOR && asset.failureCount >= 2) {
    asset.operationalFlag = OPERATIONAL_FLAGS.FREQUENT_FAILURE;
    asset.replacementRecommended = true;
    asset.replacementRecommendationReason = 'Asset condition is POOR with multiple recorded equipment breakdowns.';
  }

  await asset.save();
  return asset;
};

/**
 * Retire an asset
 */
export const retireAsset = async (id, { reason = '', remarks = '' } = {}, user) => {
  if (![ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN].includes(user.role)) {
    throw new ApiError(403, 'Forbidden: Insufficient permissions to retire assets.');
  }

  const asset = await Asset.findById(id);
  if (!asset) {
    throw new ApiError(404, 'Asset not found.');
  }

  if (user.role === ROLES.WARDEN) {
    const wardenHostelId = user.hostelId?._id || user.hostelId;
    if (String(wardenHostelId) !== String(asset.hostelId)) {
      throw new ApiError(403, 'Forbidden: You cannot retire assets belonging to another hostel.');
    }
  }

  const prevStatus = asset.status;
  asset.status = ASSET_STATUSES.RETIRED;
  asset.updatedBy = user._id;

  asset.lifecycleAuditLog.push({
    action: 'RETIRED',
    performedBy: user._id,
    previousStatus: prevStatus,
    newStatus: ASSET_STATUSES.RETIRED,
    reason: reason?.trim() || 'Asset retired from active service',
    remarks: remarks?.trim() || '',
    timestamp: new Date(),
  });

  await asset.save();
  return asset;
};

/**
 * Dispose an asset
 */
export const disposeAsset = async (id, { reason = '', remarks = '' } = {}, user) => {
  if (![ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN].includes(user.role)) {
    throw new ApiError(403, 'Forbidden: Insufficient permissions to dispose assets.');
  }

  const asset = await Asset.findById(id);
  if (!asset) {
    throw new ApiError(404, 'Asset not found.');
  }

  if (user.role === ROLES.WARDEN) {
    const wardenHostelId = user.hostelId?._id || user.hostelId;
    if (String(wardenHostelId) !== String(asset.hostelId)) {
      throw new ApiError(403, 'Forbidden: You cannot dispose assets belonging to another hostel.');
    }
  }

  const prevStatus = asset.status;
  asset.status = ASSET_STATUSES.DISPOSED;
  asset.updatedBy = user._id;

  asset.lifecycleAuditLog.push({
    action: 'DISPOSED',
    performedBy: user._id,
    previousStatus: prevStatus,
    newStatus: ASSET_STATUSES.DISPOSED,
    reason: reason?.trim() || 'Asset permanently disposed/scrapped',
    remarks: remarks?.trim() || '',
    timestamp: new Date(),
  });

  await asset.save();
  return asset;
};

/**
 * Get detailed explainable asset health
 */
export const getAssetHealth = async (id, user) => {
  const asset = await getAssetById(id, user);
  return asset.health;
};

/**
 * Retrieve maintenance history for a specific asset with costs
 */
export const getAssetMaintenanceHistory = async (id) => {
  const asset = await Asset.findById(id);
  if (!asset) {
    throw new ApiError(404, 'Asset not found.');
  }

  const [workOrders, maintenancePlans, cycles] = await Promise.all([
    MaintenanceWorkOrder.find({ assetId: asset._id })
      .populate('complaintId', 'complaintId title status priority')
      .populate('departmentId', 'name code')
      .populate('assignedTo', 'name email role')
      .populate('createdBy', 'name role')
      .sort({ createdAt: -1 })
      .lean(),
    MaintenancePlan.find({ assetId: asset._id }).sort({ nextDueAt: 1 }).lean(),
    MaintenanceCycle.find({ assetId: asset._id })
      .populate('workOrderId', 'workOrderId status priority dueAt completedAt')
      .sort({ dueDate: -1 })
      .lean(),
  ]);

  const completed = workOrders.filter((w) => w.status === 'COMPLETED');

  // Compute average resolution duration
  let totalDurationMs = 0;
  let durationCount = 0;
  let totalSpent = 0;

  workOrders.forEach((w) => {
    if (w.totalCost) totalSpent += Number(w.totalCost);
    if (w.completedAt && w.createdAt) {
      totalDurationMs += new Date(w.completedAt) - new Date(w.createdAt);
      durationCount += 1;
    }
  });

  const avgCompletionHours =
    durationCount > 0 ? Number((totalDurationMs / (durationCount * 3600 * 1000)).toFixed(1)) : 0;

  const healthData = calculateAssetHealth(asset, workOrders, 0, maintenancePlans);
  const activePlans = maintenancePlans.filter((p) => p.status === 'ACTIVE');
  const nextDueAt = activePlans.length > 0 ? activePlans[0].nextDueAt : null;

  return {
    asset,
    totalWorkOrders: workOrders.length,
    completedWorkOrders: completed.length,
    inProgressWorkOrders: workOrders.filter((w) => w.status === 'IN_PROGRESS' || w.status === 'ASSIGNED').length,
    avgCompletionHours,
    totalMaintenanceCost: Number(totalSpent.toFixed(2)),
    workOrders,
    maintenancePlans,
    cycles,
    assetHealth: healthData.score,
    healthEvaluation: healthData,
    isFrequentlyFailing: healthData.operationalFlag === OPERATIONAL_FLAGS.FREQUENT_FAILURE || healthData.operationalFlag === OPERATIONAL_FLAGS.CRITICAL,
    lastMaintainedAt: asset.lastMaintenanceDate,
    nextDueAt,
  };
};

/**
 * Inventory Analytics API: Aggregation Pipelines across physical assets
 */
export const getAssetCostAnalytics = async (query = {}, user) => {
  const matchFilter = {};

  if (user.role === ROLES.WARDEN && user.hostelId) {
    matchFilter.hostelId = new mongoose.Types.ObjectId(user.hostelId._id || user.hostelId);
  } else if (query.hostelId && mongoose.isValidObjectId(query.hostelId)) {
    matchFilter.hostelId = new mongoose.Types.ObjectId(query.hostelId);
  }

  const [
    costTotals,
    costByCategory,
    costByHostel,
    highestCostAssets,
    frequentFailures,
  ] = await Promise.all([
    Asset.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: null,
          totalAssetValue: { $sum: '$purchaseCost' },
          totalMaintenanceCost: { $sum: '$totalMaintenanceCost' },
          totalCount: { $sum: 1 },
        },
      },
    ]),

    Asset.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalValue: { $sum: '$purchaseCost' },
          maintenanceCost: { $sum: '$totalMaintenanceCost' },
        },
      },
      { $sort: { maintenanceCost: -1 } },
    ]),

    Asset.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: '$hostelId',
          count: { $sum: 1 },
          totalValue: { $sum: '$purchaseCost' },
          maintenanceCost: { $sum: '$totalMaintenanceCost' },
        },
      },
      {
        $lookup: {
          from: 'hostels',
          localField: '_id',
          foreignField: '_id',
          as: 'hostel',
        },
      },
      { $unwind: '$hostel' },
      {
        $project: {
          hostelName: '$hostel.name',
          hostelCode: '$hostel.code',
          count: 1,
          totalValue: 1,
          maintenanceCost: 1,
        },
      },
      { $sort: { maintenanceCost: -1 } },
    ]),

    Asset.find(matchFilter)
      .sort({ totalMaintenanceCost: -1 })
      .limit(5)
      .populate('hostelId', 'name code')
      .select('assetId assetCode name category totalMaintenanceCost purchaseCost condition status')
      .lean(),

    Asset.find({
      ...matchFilter,
      $or: [
        { operationalFlag: { $in: [OPERATIONAL_FLAGS.FREQUENT_FAILURE, OPERATIONAL_FLAGS.CRITICAL] } },
        { failureCount: { $gte: 2 } },
      ],
    })
      .sort({ failureCount: -1 })
      .limit(10)
      .populate('hostelId', 'name code')
      .populate('roomId', 'roomNumber')
      .select('assetId assetCode name failureCount totalMaintenanceCost condition operationalFlag replacementRecommended')
      .lean(),
  ]);

  return {
    overview: costTotals[0] || { totalAssetValue: 0, totalMaintenanceCost: 0, totalCount: 0 },
    costByCategory,
    costByHostel,
    highestCostAssets,
    frequentFailures,
  };
};

/**
 * Inventory Dashboard KPI Aggregator
 */
export const getInventoryDashboard = async (query = {}, user) => {
  const matchFilter = {};

  if (user.role === ROLES.WARDEN && user.hostelId) {
    matchFilter.hostelId = user.hostelId._id || user.hostelId;
  } else if (query.hostelId && mongoose.isValidObjectId(query.hostelId)) {
    matchFilter.hostelId = query.hostelId;
  }

  const now = new Date();
  const thresholdDays = INVENTORY_THRESHOLDS.DEFAULT_WARRANTY_EXPIRING_DAYS;
  const thresholdDate = new Date(now.getTime() + thresholdDays * 24 * 3600 * 1000);

  const [
    totalAssets,
    activeAssets,
    underMaintenance,
    damagedAssets,
    warrantyExpiring,
    replacementReview,
    retiredAssets,
    costAgg,
    recentMovements,
    warrantyAlertsList,
    failureAlertsList,
  ] = await Promise.all([
    Asset.countDocuments(matchFilter),
    Asset.countDocuments({ ...matchFilter, status: ASSET_STATUSES.ACTIVE }),
    Asset.countDocuments({ ...matchFilter, status: ASSET_STATUSES.UNDER_MAINTENANCE }),
    Asset.countDocuments({ ...matchFilter, status: ASSET_STATUSES.DAMAGED }),
    Asset.countDocuments({
      ...matchFilter,
      warrantyExpiryDate: { $gte: now, $lte: thresholdDate },
    }),
    Asset.countDocuments({
      ...matchFilter,
      $or: [{ replacementRecommended: true }, { status: ASSET_STATUSES.REPLACEMENT_REVIEW }],
    }),
    Asset.countDocuments({
      ...matchFilter,
      status: { $in: [ASSET_STATUSES.RETIRED, ASSET_STATUSES.DISPOSED] },
    }),
    Asset.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: null,
          totalAssetValue: { $sum: '$purchaseCost' },
          totalMaintenanceCost: { $sum: '$totalMaintenanceCost' },
        },
      },
    ]),
    Asset.find({ ...matchFilter, 'movementHistory.0': { $exists: true } })
      .sort({ updatedAt: -1 })
      .limit(5)
      .populate('hostelId', 'name')
      .populate('movementHistory.changedBy', 'name role')
      .select('assetId name movementHistory')
      .lean(),
    Asset.find({
      ...matchFilter,
      warrantyExpiryDate: { $lte: thresholdDate, $ne: null },
    })
      .sort({ warrantyExpiryDate: 1 })
      .limit(6)
      .populate('hostelId', 'name code')
      .select('assetId name warrantyExpiryDate vendor status condition')
      .lean(),
    Asset.find({
      ...matchFilter,
      $or: [
        { operationalFlag: { $in: [OPERATIONAL_FLAGS.FREQUENT_FAILURE, OPERATIONAL_FLAGS.CRITICAL] } },
        { replacementRecommended: true },
      ],
    })
      .sort({ failureCount: -1 })
      .limit(6)
      .populate('hostelId', 'name code')
      .select('assetId name condition operationalFlag failureCount replacementRecommended totalMaintenanceCost')
      .lean(),
  ]);

  return {
    kpis: {
      totalAssets,
      activeAssets,
      underMaintenance,
      damagedAssets,
      warrantyExpiring,
      replacementReview,
      retiredAssets,
      totalAssetValue: costAgg[0]?.totalAssetValue || 0,
      totalMaintenanceCost: costAgg[0]?.totalMaintenanceCost || 0,
    },
    recentMovements: recentMovements.map((a) => ({
      assetId: a.assetId,
      name: a.name,
      latestMovement: a.movementHistory[a.movementHistory.length - 1],
    })),
    warrantyAlerts: warrantyAlertsList.map((a) => ({
      ...a,
      warranty: computeWarrantyDetails(a),
    })),
    failureAlerts: failureAlertsList,
  };
};

/**
 * Central Scheduler Integration: Process Asset Lifecycle Jobs (Idempotent)
 */
export const processAssetLifecycleJobs = async (now = new Date(), options = {}) => {
  const thresholdDays = options.warrantyThresholdDays || INVENTORY_THRESHOLDS.DEFAULT_WARRANTY_EXPIRING_DAYS;
  const thresholdDate = new Date(now.getTime() + thresholdDays * 24 * 3600 * 1000);
  const cooldownDate = new Date(now.getTime() - INVENTORY_THRESHOLDS.WARRANTY_NOTIFICATION_COOLDOWN_DAYS * 24 * 3600 * 1000);

  const results = {
    warrantyExpiringCount: 0,
    warrantyExpiredCount: 0,
    frequentFailureFlaggedCount: 0,
    notificationsDispatched: 0,
  };

  // 1. Process Assets with Warranty Expiring Soon
  const expiringAssets = await Asset.find({
    status: { $in: [ASSET_STATUSES.ACTIVE, ASSET_STATUSES.ASSIGNED] },
    warrantyExpiryDate: { $gte: now, $lte: thresholdDate },
    $or: [{ lastWarrantyNotificationAt: null }, { lastWarrantyNotificationAt: { $lt: cooldownDate } }],
  })
    .populate('hostelId')
    .limit(20);

  for (const asset of expiringAssets) {
    results.warrantyExpiringCount += 1;
    asset.lastWarrantyNotificationAt = now;
    await asset.save();

    const warden = await User.findOne({
      role: ROLES.WARDEN,
      hostelId: asset.hostelId?._id || asset.hostelId,
      isActive: true,
    });

    if (warden) {
      await createNotification({
        recipient: warden._id,
        type: NOTIFICATION_TYPES.ASSET_WARRANTY_EXPIRING,
        title: 'Asset Warranty Expiring Soon',
        message: `Warranty for ${asset.name} (${asset.assetId}) will expire on ${new Date(
          asset.warrantyExpiryDate
        ).toLocaleDateString()}.`,
        relatedEntityType: 'ASSET',
        relatedEntityId: asset._id,
        metadata: { assetId: asset.assetId },
      }).catch(() => {});
      results.notificationsDispatched += 1;
    }
  }

  // 2. Process Assets with Warranty Newly Expired
  const expiredAssets = await Asset.find({
    status: { $in: [ASSET_STATUSES.ACTIVE, ASSET_STATUSES.ASSIGNED] },
    warrantyExpiryDate: { $lt: now },
    $or: [{ lastWarrantyNotificationAt: null }, { lastWarrantyNotificationAt: { $lt: cooldownDate } }],
  })
    .populate('hostelId')
    .limit(20);

  for (const asset of expiredAssets) {
    results.warrantyExpiredCount += 1;
    asset.lastWarrantyNotificationAt = now;
    await asset.save();

    const warden = await User.findOne({
      role: ROLES.WARDEN,
      hostelId: asset.hostelId?._id || asset.hostelId,
      isActive: true,
    });

    if (warden) {
      await createNotification({
        recipient: warden._id,
        type: NOTIFICATION_TYPES.ASSET_WARRANTY_EXPIRED,
        title: 'Asset Warranty Expired',
        message: `Warranty for ${asset.name} (${asset.assetId}) has expired. Ensure preventive maintenance schedules are updated.`,
        relatedEntityType: 'ASSET',
        relatedEntityId: asset._id,
        metadata: { assetId: asset.assetId },
      }).catch(() => {});
      results.notificationsDispatched += 1;
    }
  }

  return results;
};
