import api from './api.js';

export const getComplaintMeta = async () => {
  const { data } = await api.get('/complaints/meta');
  return data;
};

export const submitComplaint = async (complaintData) => {
  const { data } = await api.post('/complaints', complaintData);
  return data;
};

export const getMyComplaints = async (params = {}) => {
  const { data } = await api.get('/complaints/my', { params });
  return data;
};

export const getComplaintDetails = async (id) => {
  const { data } = await api.get(`/complaints/${id}`);
  return data;
};

export const listComplaints = async (params = {}) => {
  const { data } = await api.get('/complaints', { params });
  return data;
};

export const triageComplaint = async (id, triageData) => {
  const { data } = await api.patch(`/complaints/${id}/triage`, triageData);
  return data;
};

export const getEligibleAssignees = async (id) => {
  const { data } = await api.get(`/complaints/${id}/eligible-assignees`);
  return data;
};

export const assignComplaint = async (id, assignData) => {
  const { data } = await api.patch(`/complaints/${id}/assign`, assignData);
  return data;
};

export const reassignComplaint = async (id, reassignData) => {
  const { data } = await api.patch(`/complaints/${id}/reassign`, reassignData);
  return data;
};

export const acknowledgeComplaint = async (id) => {
  const { data } = await api.patch(`/complaints/${id}/acknowledge`);
  return data;
};

export const startWorkOnComplaint = async (id) => {
  const { data } = await api.patch(`/complaints/${id}/start`);
  return data;
};

export const getComplaintAssignments = async (id) => {
  const { data } = await api.get(`/complaints/${id}/assignments`);
  return data;
};

export const resolveComplaint = async (id, resolutionData) => {
  const { data } = await api.patch(`/complaints/${id}/resolve`, resolutionData);
  return data;
};

export const verifyComplaint = async (id, verificationData) => {
  const { data } = await api.patch(`/complaints/${id}/verify`, verificationData);
  return data;
};

export const resumeWorkOnComplaint = async (id) => {
  const { data } = await api.patch(`/complaints/${id}/resume`);
  return data;
};

export const getComplaintResolutions = async (id) => {
  const { data } = await api.get(`/complaints/${id}/resolutions`);
  return data;
};

const complaintService = {
  getComplaintMeta,
  submitComplaint,
  getMyComplaints,
  getComplaintDetails,
  listComplaints,
  triageComplaint,
  getEligibleAssignees,
  assignComplaint,
  reassignComplaint,
  acknowledgeComplaint,
  startWorkOnComplaint,
  getComplaintAssignments,
  resolveComplaint,
  verifyComplaint,
  resumeWorkOnComplaint,
  getComplaintResolutions,
};

export default complaintService;
