import asyncHandler from '../utils/asyncHandler.js';
import {
  createAsset,
  getAssets,
  getAssetById,
  updateAsset,
  moveAsset,
  updateAssetCondition,
  retireAsset,
  disposeAsset,
  getAssetHealth,
  getAssetMaintenanceHistory,
  getAssetCostAnalytics,
  getInventoryDashboard,
} from '../services/asset.service.js';

export const handleCreateAsset = asyncHandler(async (req, res) => {
  const asset = await createAsset(req.body, req.user);
  res.status(201).json({
    success: true,
    message: 'Asset registered successfully',
    data: asset,
  });
});

export const handleGetAssets = asyncHandler(async (req, res) => {
  const result = await getAssets(req.query, req.user);
  res.status(200).json({
    success: true,
    data: result.assets,
    pagination: result.pagination,
  });
});

export const handleGetAssetById = asyncHandler(async (req, res) => {
  const asset = await getAssetById(req.params.id, req.user);
  res.status(200).json({
    success: true,
    data: asset,
  });
});

export const handleUpdateAsset = asyncHandler(async (req, res) => {
  const asset = await updateAsset(req.params.id, req.body, req.user);
  res.status(200).json({
    success: true,
    message: 'Asset updated successfully',
    data: asset,
  });
});

export const handleMoveAsset = asyncHandler(async (req, res) => {
  const asset = await moveAsset(req.params.id, req.body, req.user);
  res.status(200).json({
    success: true,
    message: 'Asset relocated successfully',
    data: asset,
  });
});

export const handleUpdateAssetCondition = asyncHandler(async (req, res) => {
  const asset = await updateAssetCondition(req.params.id, req.body, req.user);
  res.status(200).json({
    success: true,
    message: 'Asset condition updated successfully',
    data: asset,
  });
});

export const handleRetireAsset = asyncHandler(async (req, res) => {
  const asset = await retireAsset(req.params.id, req.body, req.user);
  res.status(200).json({
    success: true,
    message: 'Asset retired successfully',
    data: asset,
  });
});

export const handleDisposeAsset = asyncHandler(async (req, res) => {
  const asset = await disposeAsset(req.params.id, req.body, req.user);
  res.status(200).json({
    success: true,
    message: 'Asset disposed successfully',
    data: asset,
  });
});

export const handleGetAssetHealth = asyncHandler(async (req, res) => {
  const health = await getAssetHealth(req.params.id, req.user);
  res.status(200).json({
    success: true,
    data: health,
  });
});

export const handleGetAssetMaintenanceHistory = asyncHandler(async (req, res) => {
  const history = await getAssetMaintenanceHistory(req.params.id);
  res.status(200).json({
    success: true,
    data: history,
  });
});

export const handleGetAssetCostAnalytics = asyncHandler(async (req, res) => {
  const analytics = await getAssetCostAnalytics(req.query, req.user);
  res.status(200).json({
    success: true,
    data: analytics,
  });
});

export const handleGetInventoryDashboard = asyncHandler(async (req, res) => {
  const dashboard = await getInventoryDashboard(req.query, req.user);
  res.status(200).json({
    success: true,
    data: dashboard,
  });
});
