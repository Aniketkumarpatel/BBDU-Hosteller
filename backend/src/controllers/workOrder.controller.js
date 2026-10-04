import asyncHandler from '../utils/asyncHandler.js';
import {
  createWorkOrder,
  getWorkOrders,
  getWorkOrderStats,
  getWorkOrderById,
  updateWorkOrder,
  assignWorkOrder,
  reassignWorkOrder,
  acceptWorkOrder,
  startWorkOrder,
  holdWorkOrder,
  resumeWorkOrder,
  completeWorkOrder,
  cancelWorkOrder,
} from '../services/workOrder.service.js';

export const handleCreateWorkOrder = asyncHandler(async (req, res) => {
  const workOrder = await createWorkOrder(req.body, req.user);
  res.status(201).json({
    success: true,
    message: 'Maintenance work order created successfully',
    data: workOrder,
  });
});

export const handleGetWorkOrders = asyncHandler(async (req, res) => {
  const result = await getWorkOrders(req.query, req.user);
  res.status(200).json({
    success: true,
    data: result.workOrders,
    pagination: result.pagination,
  });
});

export const handleGetWorkOrderStats = asyncHandler(async (req, res) => {
  const stats = await getWorkOrderStats(req.query, req.user);
  res.status(200).json({
    success: true,
    data: stats,
  });
});

export const handleGetWorkOrderById = asyncHandler(async (req, res) => {
  const workOrder = await getWorkOrderById(req.params.id, req.user);
  res.status(200).json({
    success: true,
    data: workOrder,
  });
});

export const handleUpdateWorkOrder = asyncHandler(async (req, res) => {
  const workOrder = await updateWorkOrder(req.params.id, req.body, req.user);
  res.status(200).json({
    success: true,
    message: 'Work order updated successfully',
    data: workOrder,
  });
});

export const handleAssignWorkOrder = asyncHandler(async (req, res) => {
  const workOrder = await assignWorkOrder(req.params.id, req.body, req.user);
  res.status(200).json({
    success: true,
    message: 'Work order assigned successfully',
    data: workOrder,
  });
});

export const handleReassignWorkOrder = asyncHandler(async (req, res) => {
  const workOrder = await reassignWorkOrder(req.params.id, req.body, req.user);
  res.status(200).json({
    success: true,
    message: 'Work order reassigned successfully',
    data: workOrder,
  });
});

export const handleAcceptWorkOrder = asyncHandler(async (req, res) => {
  const workOrder = await acceptWorkOrder(req.params.id, req.user);
  res.status(200).json({
    success: true,
    message: 'Work order accepted successfully',
    data: workOrder,
  });
});

export const handleStartWorkOrder = asyncHandler(async (req, res) => {
  const workOrder = await startWorkOrder(req.params.id, req.user);
  res.status(200).json({
    success: true,
    message: 'Maintenance work marked in-progress',
    data: workOrder,
  });
});

export const handleHoldWorkOrder = asyncHandler(async (req, res) => {
  const workOrder = await holdWorkOrder(req.params.id, req.body, req.user);
  res.status(200).json({
    success: true,
    message: 'Work order put on hold',
    data: workOrder,
  });
});

export const handleResumeWorkOrder = asyncHandler(async (req, res) => {
  const workOrder = await resumeWorkOrder(req.params.id, req.user);
  res.status(200).json({
    success: true,
    message: 'Work order resumed successfully',
    data: workOrder,
  });
});

export const handleCompleteWorkOrder = asyncHandler(async (req, res) => {
  const workOrder = await completeWorkOrder(req.params.id, req.body, req.user);
  res.status(200).json({
    success: true,
    message: 'Work order marked completed successfully',
    data: workOrder,
  });
});

export const handleCancelWorkOrder = asyncHandler(async (req, res) => {
  const workOrder = await cancelWorkOrder(req.params.id, req.body, req.user);
  res.status(200).json({
    success: true,
    message: 'Work order cancelled',
    data: workOrder,
  });
});
