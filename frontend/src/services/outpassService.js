import api from './api.js';

export const outpassService = {
  // Operational Dashboard
  getDashboardStats: async (params) => {
    const res = await api.get('/outpass/dashboard', { params });
    return res.data;
  },

  // Outpass Management
  getOutpasses: async (params) => {
    const res = await api.get('/outpass', { params });
    return res.data;
  },

  getOutpassById: async (id) => {
    const res = await api.get(`/outpass/${id}`);
    return res.data;
  },

  createOutpassRequest: async (data) => {
    const res = await api.post('/outpass', data);
    return res.data;
  },

  approveOutpass: async (id, data) => {
    const res = await api.post(`/outpass/${id}/approve`, data);
    return res.data;
  },

  rejectOutpass: async (id, data) => {
    const res = await api.post(`/outpass/${id}/reject`, data);
    return res.data;
  },

  cancelOutpass: async (id) => {
    const res = await api.post(`/outpass/${id}/cancel`);
    return res.data;
  },

  // Gate Verifications
  verifyExit: async (id, data) => {
    const res = await api.post(`/outpass/${id}/verify-exit`, data);
    return res.data;
  },

  verifyReturn: async (id, data) => {
    const res = await api.post(`/outpass/${id}/verify-return`, data);
    return res.data;
  },

  getDigitalPass: async (id) => {
    const res = await api.get(`/outpass/${id}/digital-pass`);
    return res.data;
  },

  verifyPassToken: async (token) => {
    const res = await api.post('/outpass/verify-token', { token });
    return res.data;
  },

  // Visitor Operations
  getVisitors: async (params) => {
    const res = await api.get('/outpass/visitors', { params });
    return res.data;
  },

  getVisitorById: async (id) => {
    const res = await api.get(`/outpass/visitors/${id}`);
    return res.data;
  },

  requestVisitor: async (data) => {
    const res = await api.post('/outpass/visitors', data);
    return res.data;
  },

  approveVisitor: async (id) => {
    const res = await api.post(`/outpass/visitors/${id}/approve`);
    return res.data;
  },

  checkInVisitor: async (id, data) => {
    const res = await api.post(`/outpass/visitors/${id}/check-in`, data);
    return res.data;
  },

  checkOutVisitor: async (id, data) => {
    const res = await api.post(`/outpass/visitors/${id}/check-out`, data);
    return res.data;
  },

  rejectVisitor: async (id, data) => {
    const res = await api.post(`/outpass/visitors/${id}/reject`, data);
    return res.data;
  },

  // Manual Scheduler Trigger
  runSchedulerCheck: async () => {
    const res = await api.post('/outpass/scheduler/run');
    return res.data;
  },
};

export default outpassService;
