import asyncHandler from '../utils/asyncHandler.js';
import * as pmService from '../services/preventiveMaintenance.service.js';

/**
 * Create a new maintenance plan
 */
export const handleCreateMaintenancePlan = asyncHandler(async (req, res) => {
  const plan = await pmService.createMaintenancePlan(req.body, req.user);
  res.status(201).json({
    success: true,
    message: 'Maintenance plan created successfully',
    data: plan,
  });
});

/**
 * Get maintenance plans with filtering & pagination
 */
export const handleGetMaintenancePlans = asyncHandler(async (req, res) => {
  const result = await pmService.getMaintenancePlans(req.query, req.user);
  res.status(200).json({
    success: true,
    data: result.plans,
    pagination: result.pagination,
  });
});

/**
 * Get single maintenance plan by ID
 */
export const handleGetMaintenancePlanById = asyncHandler(async (req, res) => {
  const result = await pmService.getMaintenancePlanById(req.params.id, req.user);
  res.status(200).json({
    success: true,
    data: result.plan,
    cycles: result.cycles,
  });
});

/**
 * Update maintenance plan
 */
export const handleUpdateMaintenancePlan = asyncHandler(async (req, res) => {
  const plan = await pmService.updateMaintenancePlan(req.params.id, req.body, req.user);
  res.status(200).json({
    success: true,
    message: 'Maintenance plan updated successfully',
    data: plan,
  });
});

/**
 * Pause maintenance plan
 */
export const handlePauseMaintenancePlan = asyncHandler(async (req, res) => {
  const plan = await pmService.pauseMaintenancePlan(req.params.id, req.body, req.user);
  res.status(200).json({
    success: true,
    message: 'Maintenance plan paused',
    data: plan,
  });
});

/**
 * Resume maintenance plan
 */
export const handleResumeMaintenancePlan = asyncHandler(async (req, res) => {
  const plan = await pmService.resumeMaintenancePlan(req.params.id, req.user);
  res.status(200).json({
    success: true,
    message: 'Maintenance plan resumed',
    data: plan,
  });
});

/**
 * Deactivate / Cancel maintenance plan
 */
export const handleDeactivateMaintenancePlan = asyncHandler(async (req, res) => {
  const plan = await pmService.deactivateMaintenancePlan(req.params.id, req.body, req.user);
  res.status(200).json({
    success: true,
    message: 'Maintenance plan deactivated',
    data: plan,
  });
});

/**
 * Get maintenance plan cycles
 */
export const handleGetPlanCycles = asyncHandler(async (req, res) => {
  const result = await pmService.getMaintenancePlanById(req.params.id, req.user);
  res.status(200).json({
    success: true,
    data: result.cycles,
  });
});

/**
 * Get preventive maintenance dashboard statistics
 */
export const handleGetPreventiveDashboard = asyncHandler(async (req, res) => {
  const stats = await pmService.getPreventiveMaintenanceDashboard(req.user);
  res.status(200).json({
    success: true,
    data: stats,
  });
});

/**
 * Get upcoming maintenance queue
 */
export const handleGetUpcomingMaintenance = asyncHandler(async (req, res) => {
  const plans = await pmService.getUpcomingMaintenance(req.query, req.user);
  res.status(200).json({
    success: true,
    data: plans,
  });
});

/**
 * Get due maintenance queue
 */
export const handleGetDueMaintenance = asyncHandler(async (req, res) => {
  const plans = await pmService.getDueMaintenance(req.query, req.user);
  res.status(200).json({
    success: true,
    data: plans,
  });
});

/**
 * Get overdue maintenance queue
 */
export const handleGetOverdueMaintenance = asyncHandler(async (req, res) => {
  const plans = await pmService.getOverdueMaintenance(req.query, req.user);
  res.status(200).json({
    success: true,
    data: plans,
  });
});

/**
 * Trigger preventive maintenance cycle manually (Admin / System test)
 */
export const handleTriggerMaintenanceScheduler = asyncHandler(async (req, res) => {
  const results = await pmService.processPreventiveMaintenanceJobs(new Date());
  res.status(200).json({
    success: true,
    message: 'Preventive maintenance processing executed',
    data: results,
  });
});
