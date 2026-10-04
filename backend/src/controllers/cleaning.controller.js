import asyncHandler from '../utils/asyncHandler.js';
import * as cleaningService from '../services/cleaning.service.js';

// ==========================================
// Cleaning Areas
// ==========================================

export const handleCreateCleaningArea = asyncHandler(async (req, res) => {
  const area = await cleaningService.createCleaningArea(req.body, req.user);
  res.status(201).json({
    success: true,
    message: 'Cleaning area created successfully',
    data: area,
  });
});

export const handleGetCleaningAreas = asyncHandler(async (req, res) => {
  const areas = await cleaningService.getCleaningAreas(req.query);
  res.status(200).json({
    success: true,
    data: areas,
  });
});

export const handleGetCleaningAreaById = asyncHandler(async (req, res) => {
  const area = await cleaningService.getCleaningAreaById(req.params.id);
  res.status(200).json({
    success: true,
    data: area,
  });
});

export const handleUpdateCleaningArea = asyncHandler(async (req, res) => {
  const area = await cleaningService.updateCleaningArea(req.params.id, req.body);
  res.status(200).json({
    success: true,
    message: 'Cleaning area updated successfully',
    data: area,
  });
});

// ==========================================
// Cleaning Plans
// ==========================================

export const handleCreateCleaningPlan = asyncHandler(async (req, res) => {
  const plan = await cleaningService.createCleaningPlan(req.body, req.user);
  res.status(201).json({
    success: true,
    message: 'Cleaning plan created successfully',
    data: plan,
  });
});

export const handleGetCleaningPlans = asyncHandler(async (req, res) => {
  const plans = await cleaningService.getCleaningPlans(req.query);
  res.status(200).json({
    success: true,
    data: plans,
  });
});

export const handleGetCleaningPlanById = asyncHandler(async (req, res) => {
  const plan = await cleaningService.getCleaningPlanById(req.params.id);
  res.status(200).json({
    success: true,
    data: plan,
  });
});

export const handleUpdateCleaningPlan = asyncHandler(async (req, res) => {
  const plan = await cleaningService.updateCleaningPlan(req.params.id, req.body);
  res.status(200).json({
    success: true,
    message: 'Cleaning plan updated successfully',
    data: plan,
  });
});

export const handleToggleCleaningPlanStatus = asyncHandler(async (req, res) => {
  const plan = await cleaningService.toggleCleaningPlanStatus(req.params.id, req.body.isActive);
  res.status(200).json({
    success: true,
    message: `Cleaning plan ${plan.isActive ? 'activated' : 'deactivated'} successfully`,
    data: plan,
  });
});

// ==========================================
// Cleaning Tasks & Lifecycle
// ==========================================

export const handleCreateTask = asyncHandler(async (req, res) => {
  const task = await cleaningService.createManualTask(req.body, req.user);
  res.status(201).json({
    success: true,
    message: 'Cleaning task created successfully',
    data: task,
  });
});

export const handleGetTasks = asyncHandler(async (req, res) => {
  const tasks = await cleaningService.getCleaningTasks(req.query, req.user);
  res.status(200).json({
    success: true,
    data: tasks,
  });
});

export const handleGetTaskById = asyncHandler(async (req, res) => {
  const task = await cleaningService.getCleaningTaskById(req.params.id);
  res.status(200).json({
    success: true,
    data: task,
  });
});

export const handleAssignTask = asyncHandler(async (req, res) => {
  const task = await cleaningService.assignTask(req.params.id, req.body, req.user);
  res.status(200).json({
    success: true,
    message: 'Task assigned successfully',
    data: task,
  });
});

export const handleAcceptTask = asyncHandler(async (req, res) => {
  const task = await cleaningService.acceptTask(req.params.id, req.user);
  res.status(200).json({
    success: true,
    message: 'Task accepted successfully',
    data: task,
  });
});

export const handleStartTask = asyncHandler(async (req, res) => {
  const task = await cleaningService.startTask(req.params.id, req.user);
  res.status(200).json({
    success: true,
    message: 'Task started successfully',
    data: task,
  });
});

export const handleHoldTask = asyncHandler(async (req, res) => {
  const task = await cleaningService.holdTask(req.params.id, req.body, req.user);
  res.status(200).json({
    success: true,
    message: 'Task placed on hold',
    data: task,
  });
});

export const handleResumeTask = asyncHandler(async (req, res) => {
  const task = await cleaningService.resumeTask(req.params.id, req.user);
  res.status(200).json({
    success: true,
    message: 'Task resumed successfully',
    data: task,
  });
});

export const handleCompleteTask = asyncHandler(async (req, res) => {
  const task = await cleaningService.completeTask(req.params.id, req.body, req.user);
  res.status(200).json({
    success: true,
    message: 'Task marked as completed',
    data: task,
  });
});

export const handleVerifyTask = asyncHandler(async (req, res) => {
  const task = await cleaningService.verifyTask(req.params.id, req.body, req.user);
  res.status(200).json({
    success: true,
    message: 'Task verified successfully with quality score',
    data: task,
  });
});

export const handleRejectTask = asyncHandler(async (req, res) => {
  const task = await cleaningService.rejectTask(req.params.id, req.body, req.user);
  res.status(200).json({
    success: true,
    message: 'Task rejected and returned for rework',
    data: task,
  });
});

export const handleCancelTask = asyncHandler(async (req, res) => {
  const task = await cleaningService.cancelTask(req.params.id, req.body, req.user);
  res.status(200).json({
    success: true,
    message: 'Task cancelled successfully',
    data: task,
  });
});

// ==========================================
// Scheduler & Dashboard Handlers
// ==========================================

export const handleRunCleaningScheduler = asyncHandler(async (req, res) => {
  const results = await cleaningService.processCleaningTasks(req.body.referenceTime || new Date());
  res.status(200).json({
    success: true,
    message: 'Cleaning scheduler run successfully',
    data: results,
  });
});

export const handleGetCleaningDashboardStats = asyncHandler(async (req, res) => {
  const stats = await cleaningService.getCleaningDashboardStats(req.query);
  res.status(200).json({
    success: true,
    data: stats,
  });
});
