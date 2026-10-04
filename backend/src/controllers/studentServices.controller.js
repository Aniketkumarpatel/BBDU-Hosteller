import asyncHandler from '../utils/asyncHandler.js';
import * as studentServicesService from '../services/studentServices.service.js';

// ============================================================================
// NOTICE CONTROLLERS
// ============================================================================

export const handleGetNotices = asyncHandler(async (req, res) => {
  const result = await studentServicesService.getNotices(req.query, req.user);
  res.status(200).json({ success: true, data: result });
});

export const handleGetNoticeById = asyncHandler(async (req, res) => {
  const notice = await studentServicesService.getNoticeById(req.params.id, req.user);
  res.status(200).json({ success: true, data: notice });
});

export const handleCreateNotice = asyncHandler(async (req, res) => {
  const notice = await studentServicesService.createNotice(req.body, req.user);
  res.status(201).json({
    success: true,
    message: 'Notice created successfully.',
    data: notice,
  });
});

export const handleUpdateNotice = asyncHandler(async (req, res) => {
  const notice = await studentServicesService.updateNotice(req.params.id, req.body, req.user);
  res.status(200).json({
    success: true,
    message: 'Notice updated successfully.',
    data: notice,
  });
});

export const handlePublishNotice = asyncHandler(async (req, res) => {
  const notice = await studentServicesService.publishNotice(req.params.id, req.user);
  res.status(200).json({
    success: true,
    message: 'Notice published successfully.',
    data: notice,
  });
});

export const handleAcknowledgeNotice = asyncHandler(async (req, res) => {
  const result = await studentServicesService.acknowledgeNotice(req.params.id, req.user);
  res.status(200).json({
    success: true,
    message: 'Notice acknowledged.',
    data: result,
  });
});

export const handleDeleteNotice = asyncHandler(async (req, res) => {
  const result = await studentServicesService.deleteOrArchiveNotice(req.params.id, req.user);
  res.status(200).json({
    success: true,
    message: result.message,
    data: result,
  });
});

// ============================================================================
// SERVICE REQUEST CONTROLLERS
// ============================================================================

export const handleGetServiceRequests = asyncHandler(async (req, res) => {
  const result = await studentServicesService.getServiceRequests(req.query, req.user);
  res.status(200).json({ success: true, data: result });
});

export const handleGetServiceRequestById = asyncHandler(async (req, res) => {
  const request = await studentServicesService.getServiceRequestById(req.params.id, req.user);
  res.status(200).json({ success: true, data: request });
});

export const handleCreateServiceRequest = asyncHandler(async (req, res) => {
  const request = await studentServicesService.createServiceRequest(req.body, req.user);
  res.status(201).json({
    success: true,
    message: 'Service request submitted successfully.',
    data: request,
  });
});

export const handleAssignServiceRequest = asyncHandler(async (req, res) => {
  const request = await studentServicesService.assignServiceRequest(req.params.id, req.body, req.user);
  res.status(200).json({
    success: true,
    message: 'Service request assigned successfully.',
    data: request,
  });
});

export const handleUpdateServiceRequestStatus = asyncHandler(async (req, res) => {
  const request = await studentServicesService.updateServiceRequestStatus(req.params.id, req.body, req.user);
  res.status(200).json({
    success: true,
    message: 'Service request status updated.',
    data: request,
  });
});

export const handleVerifyServiceRequest = asyncHandler(async (req, res) => {
  const request = await studentServicesService.verifyServiceRequest(req.params.id, req.body, req.user);
  res.status(200).json({
    success: true,
    message: 'Service request verification recorded.',
    data: request,
  });
});

// ============================================================================
// HOSTEL CONTACT DIRECTORY CONTROLLERS
// ============================================================================

export const handleGetHostelContacts = asyncHandler(async (req, res) => {
  const contacts = await studentServicesService.getHostelContacts(req.query, req.user);
  res.status(200).json({ success: true, data: contacts });
});

export const handleCreateHostelContact = asyncHandler(async (req, res) => {
  const contact = await studentServicesService.createHostelContact(req.body, req.user);
  res.status(201).json({
    success: true,
    message: 'Hostel contact added successfully.',
    data: contact,
  });
});

export const handleUpdateHostelContact = asyncHandler(async (req, res) => {
  const contact = await studentServicesService.updateHostelContact(req.params.id, req.body, req.user);
  res.status(200).json({
    success: true,
    message: 'Hostel contact updated successfully.',
    data: contact,
  });
});

export const handleDeleteHostelContact = asyncHandler(async (req, res) => {
  const result = await studentServicesService.deleteHostelContact(req.params.id, req.user);
  res.status(200).json({
    success: true,
    message: result.message,
    data: result,
  });
});

// ============================================================================
// STUDENT FEEDBACK CONTROLLERS
// ============================================================================

export const handleGetStudentFeedback = asyncHandler(async (req, res) => {
  const result = await studentServicesService.getStudentFeedback(req.query, req.user);
  res.status(200).json({ success: true, data: result });
});

export const handleSubmitStudentFeedback = asyncHandler(async (req, res) => {
  const feedback = await studentServicesService.submitStudentFeedback(req.body, req.user);
  res.status(201).json({
    success: true,
    message: 'Feedback submitted successfully. Thank you for your feedback.',
    data: feedback,
  });
});

export const handleRespondToStudentFeedback = asyncHandler(async (req, res) => {
  const feedback = await studentServicesService.respondToStudentFeedback(req.params.id, req.body, req.user);
  res.status(200).json({
    success: true,
    message: 'Feedback response saved.',
    data: feedback,
  });
});

// ============================================================================
// DASHBOARD STATS CONTROLLER
// ============================================================================

export const handleGetStudentServicesStats = asyncHandler(async (req, res) => {
  const stats = await studentServicesService.getStudentServicesStats(req.query.hostelId, req.user);
  res.status(200).json({ success: true, data: stats });
});

// ============================================================================
// SCHEDULER LIFECYCLE TRIGGER
// ============================================================================

export const handleRunLifecycleJobs = asyncHandler(async (_req, res) => {
  const results = await studentServicesService.processStudentServicesLifecycleJobs();
  res.status(200).json({ success: true, data: results });
});
