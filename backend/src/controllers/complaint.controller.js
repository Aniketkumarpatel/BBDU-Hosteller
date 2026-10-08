import asyncHandler from '../utils/asyncHandler.js';
import * as complaintService from '../services/complaint.service.js';
import { Department } from '../models/index.js';
import { validateComplaintInput } from '../validators/complaint.validator.js';
import {
  COMPLAINT_CATEGORIES,
  CATEGORY_ISSUE_TYPES,
  COMPLAINT_PRIORITIES,
  COMPLAINT_STATUSES,
} from '../constants/complaint.constants.js';

/**
 * GET /api/complaints/meta
 * Returns controlled constants for dropdowns in frontend complaint forms
 */
export const getComplaintMeta = asyncHandler(async (req, res) => {
  const departments = await Department.find({ isActive: true }).select('name code description');
  return res.status(200).json({
    success: true,
    data: {
      categories: Object.values(COMPLAINT_CATEGORIES),
      categoryIssueTypes: CATEGORY_ISSUE_TYPES,
      priorities: Object.values(COMPLAINT_PRIORITIES),
      statuses: Object.values(COMPLAINT_STATUSES),
      departments,
    },
  });
});

/**
 * GET /api/complaints
 * Role-based filtered complaints listing (Warden, Staff, Authority, Super Admin)
 */
export const listComplaints = asyncHandler(async (req, res) => {
  const complaints = await complaintService.getComplaints(req.user, req.query);

  return res.status(200).json({
    success: true,
    count: complaints.length,
    data: complaints,
  });
});

/**
 * POST /api/complaints
 * Submit a new student complaint
 * Role: STUDENT
 */
export const submitComplaint = asyncHandler(async (req, res) => {
  const { isValid, errors } = validateComplaintInput(req.body);
  if (!isValid) {
    return res.status(400).json({
      success: false,
      message: errors[0] || 'Validation error',
      errors,
    });
  }

  const payload = {
    ...req.body,
    file: req.file,
  };

  const complaint = await complaintService.createStudentComplaint(req.user._id, payload);

  return res.status(201).json({
    success: true,
    message: `Complaint ${complaint.complaintId} created successfully`,
    data: complaint,
  });
});

/**
 * GET /api/complaints/my
 * Retrieve all complaints submitted by the authenticated student
 * Role: STUDENT
 */
export const getMyComplaints = asyncHandler(async (req, res) => {
  const complaints = await complaintService.getStudentComplaints(req.user._id, req.query);

  return res.status(200).json({
    success: true,
    count: complaints.length,
    data: complaints,
  });
});

/**
 * GET /api/complaints/:id
 * Retrieve complaint details by MongoDB ObjectId or complaintId
 */
export const getComplaintDetails = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const complaint = await complaintService.getComplaintById(id, req.user);

  return res.status(200).json({
    success: true,
    data: complaint,
  });
});

/**
 * PATCH /api/complaints/:id/triage
 * Move complaint SUBMITTED -> TRIAGED
 * Roles: WARDEN, AUTHORITY, SUPER_ADMIN
 */
export const triageComplaint = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updatedComplaint = await complaintService.triageComplaint(id, req.body, req.user);

  return res.status(200).json({
    success: true,
    message: `Complaint ${updatedComplaint.complaintId} successfully triaged`,
    data: updatedComplaint,
  });
});

/**
 * GET /api/complaints/:id/eligible-assignees
 * Retrieve list of active staff members eligible for assignment
 * Roles: WARDEN, AUTHORITY, SUPER_ADMIN
 */
export const getEligibleAssignees = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const assignees = await complaintService.getEligibleAssignees(id, req.user);

  return res.status(200).json({
    success: true,
    count: assignees.length,
    data: assignees,
  });
});

/**
 * PATCH /api/complaints/:id/assign
 * Move complaint TRIAGED -> ASSIGNED
 * Roles: WARDEN, AUTHORITY, SUPER_ADMIN
 */
export const assignComplaint = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updatedComplaint = await complaintService.assignComplaint(id, req.body, req.user);

  return res.status(200).json({
    success: true,
    message: `Complaint ${updatedComplaint.complaintId} assigned successfully`,
    data: updatedComplaint,
  });
});

/**
 * PATCH /api/complaints/:id/reassign
 * Reassign complaint to a different staff member
 * Roles: WARDEN, AUTHORITY, SUPER_ADMIN
 */
export const reassignComplaint = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updatedComplaint = await complaintService.reassignComplaint(id, req.body, req.user);

  return res.status(200).json({
    success: true,
    message: `Complaint ${updatedComplaint.complaintId} reassigned successfully`,
    data: updatedComplaint,
  });
});

/**
 * PATCH /api/complaints/:id/acknowledge
 * Move complaint ASSIGNED -> ACKNOWLEDGED
 * Roles: Current Assignee OR Warden / Super Admin
 */
export const acknowledgeComplaint = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updatedComplaint = await complaintService.acknowledgeComplaint(id, req.user);

  return res.status(200).json({
    success: true,
    message: `Complaint ${updatedComplaint.complaintId} acknowledged`,
    data: updatedComplaint,
  });
});

/**
 * PATCH /api/complaints/:id/start
 * Move complaint ACKNOWLEDGED -> IN_PROGRESS
 * Roles: Current Assignee
 */
export const startWorkOnComplaint = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updatedComplaint = await complaintService.startWorkOnComplaint(id, req.user);

  return res.status(200).json({
    success: true,
    message: `Work started on complaint ${updatedComplaint.complaintId}`,
    data: updatedComplaint,
  });
});

/**
 * GET /api/complaints/:id/assignments
 * Retrieve audit history of assignments and reassignments
 */
export const getComplaintAssignments = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const history = await complaintService.getComplaintAssignments(id, req.user);

  return res.status(200).json({
    success: true,
    count: history.length,
    data: history,
  });
});

/**
 * PATCH /api/complaints/:id/resolve
 * Move complaint IN_PROGRESS -> STUDENT_VERIFICATION
 * Roles: Assigned Staff, Warden, Authority, Super Admin
 */
export const resolveComplaint = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updatedComplaint = await complaintService.resolveComplaint(id, req.body, req.user);

  return res.status(200).json({
    success: true,
    message: `Complaint ${updatedComplaint.complaintId} marked as resolved and submitted for student verification`,
    data: updatedComplaint,
  });
});

/**
 * PATCH /api/complaints/:id/verify
 * Student Verification of Resolution
 * Action: STUDENT_VERIFICATION -> CLOSED (if ACCEPT) or REOPENED (if REJECT)
 * Roles: Student (complainant)
 */
export const verifyComplaint = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updatedComplaint = await complaintService.verifyComplaint(id, req.body, req.user);

  const actionMsg =
    updatedComplaint.status === 'CLOSED'
      ? `Complaint ${updatedComplaint.complaintId} verified and closed successfully`
      : `Complaint ${updatedComplaint.complaintId} rejected and reopened`;

  return res.status(200).json({
    success: true,
    message: actionMsg,
    data: updatedComplaint,
  });
});

/**
 * PATCH /api/complaints/:id/resume
 * Move complaint REOPENED -> IN_PROGRESS
 * Roles: Assigned Staff, Warden, Authority, Super Admin
 */
export const resumeWorkOnComplaint = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updatedComplaint = await complaintService.resumeWorkOnComplaint(id, req.user);

  return res.status(200).json({
    success: true,
    message: `Work resumed on complaint ${updatedComplaint.complaintId}`,
    data: updatedComplaint,
  });
});

/**
 * GET /api/complaints/:id/resolutions
 * Retrieve chronological resolution and verification attempts
 */
export const getComplaintResolutions = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const resolutions = await complaintService.getComplaintResolutions(id, req.user);

  return res.status(200).json({
    success: true,
    count: resolutions.length,
    data: resolutions,
  });
});

/**
 * GET /api/complaints/:id/sla
 * Retrieve SLA status, current countdown, and all SLA cycles
 */
export const getComplaintSla = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const complaint = await complaintService.getComplaintById(id, req.user);
  return res.status(200).json({
    success: true,
    data: complaint.sla || null,
  });
});

/**
 * GET /api/complaints/:id/escalations
 * Retrieve chronological escalation history for a complaint
 */
export const getComplaintEscalations = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const complaint = await complaintService.getComplaintById(id, req.user);
  return res.status(200).json({
    success: true,
    count: complaint.escalations?.length || 0,
    data: complaint.escalations || [],
  });
});
