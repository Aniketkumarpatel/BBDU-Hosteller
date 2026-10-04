import asyncHandler from '../utils/asyncHandler.js';
import * as outpassService from '../services/outpass.service.js';

// ==========================================
// Student Outpass Handlers
// ==========================================

export const handleCreateOutpassRequest = asyncHandler(async (req, res) => {
  const outpass = await outpassService.createOutpassRequest(req.user._id, req.body);
  res.status(201).json({
    success: true,
    message: outpass.isEmergency
      ? 'Emergency outpass submitted. Priority warden review alert dispatched.'
      : 'Outpass request submitted successfully for review.',
    data: outpass,
  });
});

export const handleGetOutpasses = asyncHandler(async (req, res) => {
  const outpasses = await outpassService.getOutpasses(req.query, req.user);
  res.status(200).json({
    success: true,
    data: outpasses,
  });
});

export const handleGetOutpassById = asyncHandler(async (req, res) => {
  const outpass = await outpassService.getOutpassById(req.params.id, req.user);
  res.status(200).json({
    success: true,
    data: outpass,
  });
});

export const handleApproveOutpass = asyncHandler(async (req, res) => {
  const outpass = await outpassService.approveOutpass(req.params.id, req.body, req.user);
  res.status(200).json({
    success: true,
    message: 'Outpass approved. Digital pass generated.',
    data: outpass,
  });
});

export const handleRejectOutpass = asyncHandler(async (req, res) => {
  const outpass = await outpassService.rejectOutpass(req.params.id, req.body, req.user);
  res.status(200).json({
    success: true,
    message: 'Outpass request rejected.',
    data: outpass,
  });
});

export const handleCancelOutpass = asyncHandler(async (req, res) => {
  const outpass = await outpassService.cancelOutpass(req.params.id, req.user);
  res.status(200).json({
    success: true,
    message: 'Outpass cancelled successfully.',
    data: outpass,
  });
});

// ==========================================
// Gate Exit & Return Verifications
// ==========================================

export const handleVerifyExit = asyncHandler(async (req, res) => {
  const outpass = await outpassService.verifyExit(req.params.id, req.body, req.user);
  res.status(200).json({
    success: true,
    message: 'Hostel exit verified and recorded.',
    data: outpass,
  });
});

export const handleVerifyReturn = asyncHandler(async (req, res) => {
  const outpass = await outpassService.verifyReturn(req.params.id, req.body, req.user);
  res.status(200).json({
    success: true,
    message: 'Hostel return verified. Outpass completed.',
    data: outpass,
  });
});

export const handleGetDigitalPass = asyncHandler(async (req, res) => {
  const digitalPass = await outpassService.getDigitalPass(req.params.id, req.user);
  res.status(200).json({
    success: true,
    data: digitalPass,
  });
});

export const handleVerifyPassToken = asyncHandler(async (req, res) => {
  const verifiedData = await outpassService.verifyDigitalPassToken(req.body.token);
  res.status(200).json({
    success: true,
    data: verifiedData,
  });
});

// ==========================================
// Visitor Handlers
// ==========================================

export const handleRequestVisitor = asyncHandler(async (req, res) => {
  const visitor = await outpassService.requestVisitor(req.body, req.user);
  res.status(201).json({
    success: true,
    message: 'Visitor registered successfully.',
    data: visitor,
  });
});

export const handleGetVisitors = asyncHandler(async (req, res) => {
  const visitors = await outpassService.getVisitors(req.query, req.user);
  res.status(200).json({
    success: true,
    data: visitors,
  });
});

export const handleGetVisitorById = asyncHandler(async (req, res) => {
  const visitor = await outpassService.getVisitorById(req.params.id, req.user);
  res.status(200).json({
    success: true,
    data: visitor,
  });
});

export const handleApproveVisitor = asyncHandler(async (req, res) => {
  const visitor = await outpassService.approveVisitor(req.params.id, req.user);
  res.status(200).json({
    success: true,
    message: 'Visitor approved.',
    data: visitor,
  });
});

export const handleCheckInVisitor = asyncHandler(async (req, res) => {
  const visitor = await outpassService.checkInVisitor(req.params.id, req.body, req.user);
  res.status(200).json({
    success: true,
    message: 'Visitor checked in at gate.',
    data: visitor,
  });
});

export const handleCheckOutVisitor = asyncHandler(async (req, res) => {
  const visitor = await outpassService.checkOutVisitor(req.params.id, req.body, req.user);
  res.status(200).json({
    success: true,
    message: 'Visitor checked out.',
    data: visitor,
  });
});

export const handleRejectVisitor = asyncHandler(async (req, res) => {
  const visitor = await outpassService.rejectVisitor(req.params.id, req.body, req.user);
  res.status(200).json({
    success: true,
    message: 'Visitor request rejected.',
    data: visitor,
  });
});

// ==========================================
// Operational Dashboard & Scheduler Handlers
// ==========================================

export const handleGetOutpassStats = asyncHandler(async (req, res) => {
  const stats = await outpassService.getOutpassDashboardStats(req.query, req.user);
  res.status(200).json({
    success: true,
    data: stats,
  });
});

export const handleRunOverdueOutpassCheck = asyncHandler(async (req, res) => {
  const results = await outpassService.processOverdueOutpasses(req.body.referenceTime || new Date());
  res.status(200).json({
    success: true,
    message: 'Overdue outpasses processed.',
    data: results,
  });
});
