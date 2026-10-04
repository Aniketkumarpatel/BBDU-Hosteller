import api from './api.js';

export const studentServicesService = {
  // Stats
  getStats: async (hostelId) => {
    const res = await api.get('/student-services/stats', {
      params: hostelId ? { hostelId } : {},
    });
    return res.data;
  },

  // Notices
  getNotices: async (params = {}) => {
    const res = await api.get('/student-services/notices', { params });
    return res.data;
  },

  getNoticeById: async (id) => {
    const res = await api.get(`/student-services/notices/${id}`);
    return res.data;
  },

  createNotice: async (data) => {
    const res = await api.post('/student-services/notices', data);
    return res.data;
  },

  updateNotice: async (id, data) => {
    const res = await api.put(`/student-services/notices/${id}`, data);
    return res.data;
  },

  publishNotice: async (id) => {
    const res = await api.post(`/student-services/notices/${id}/publish`);
    return res.data;
  },

  acknowledgeNotice: async (id) => {
    const res = await api.post(`/student-services/notices/${id}/acknowledge`);
    return res.data;
  },

  deleteNotice: async (id) => {
    const res = await api.delete(`/student-services/notices/${id}`);
    return res.data;
  },

  // Service Requests
  getServiceRequests: async (params = {}) => {
    const res = await api.get('/student-services/requests', { params });
    return res.data;
  },

  getServiceRequestById: async (id) => {
    const res = await api.get(`/student-services/requests/${id}`);
    return res.data;
  },

  createServiceRequest: async (data) => {
    const res = await api.post('/student-services/requests', data);
    return res.data;
  },

  assignServiceRequest: async (id, data) => {
    const res = await api.post(`/student-services/requests/${id}/assign`, data);
    return res.data;
  },

  updateServiceRequestStatus: async (id, data) => {
    const res = await api.patch(`/student-services/requests/${id}/status`, data);
    return res.data;
  },

  verifyServiceRequest: async (id, data) => {
    const res = await api.post(`/student-services/requests/${id}/verify`, data);
    return res.data;
  },

  // Hostel Contacts
  getContacts: async (params = {}) => {
    const res = await api.get('/student-services/contacts', { params });
    return res.data;
  },

  createContact: async (data) => {
    const res = await api.post('/student-services/contacts', data);
    return res.data;
  },

  updateContact: async (id, data) => {
    const res = await api.put(`/student-services/contacts/${id}`, data);
    return res.data;
  },

  deleteContact: async (id) => {
    const res = await api.delete(`/student-services/contacts/${id}`);
    return res.data;
  },

  // Student Feedback
  getFeedback: async (params = {}) => {
    const res = await api.get('/student-services/feedback', { params });
    return res.data;
  },

  submitFeedback: async (data) => {
    const res = await api.post('/student-services/feedback', data);
    return res.data;
  },

  respondToFeedback: async (id, data) => {
    const res = await api.post(`/student-services/feedback/${id}/respond`, data);
    return res.data;
  },

  // Lifecycle scheduler trigger
  runLifecycleJobs: async () => {
    const res = await api.post('/student-services/lifecycle/run');
    return res.data;
  },
};

export default studentServicesService;
