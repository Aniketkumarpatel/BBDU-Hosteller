import api from './api.js';

export const workOrderService = {
  getWorkOrders: async (params = {}) => {
    const res = await api.get('/work-orders', { params });
    return res.data;
  },

  getWorkOrderStats: async (params = {}) => {
    const res = await api.get('/work-orders/stats', { params });
    return res.data;
  },

  getWorkOrderById: async (id) => {
    const res = await api.get(`/work-orders/${id}`);
    return res.data;
  },

  createWorkOrder: async (data) => {
    const res = await api.post('/work-orders', data);
    return res.data;
  },

  updateWorkOrder: async (id, data) => {
    const res = await api.patch(`/work-orders/${id}`, data);
    return res.data;
  },

  assignWorkOrder: async (id, { assignedTo }) => {
    const res = await api.post(`/work-orders/${id}/assign`, { assignedTo });
    return res.data;
  },

  reassignWorkOrder: async (id, { assignedTo, reason }) => {
    const res = await api.post(`/work-orders/${id}/reassign`, { assignedTo, reason });
    return res.data;
  },

  acceptWorkOrder: async (id) => {
    const res = await api.post(`/work-orders/${id}/accept`);
    return res.data;
  },

  startWorkOrder: async (id) => {
    const res = await api.post(`/work-orders/${id}/start`);
    return res.data;
  },

  holdWorkOrder: async (id, { holdReason }) => {
    const res = await api.post(`/work-orders/${id}/hold`, { holdReason });
    return res.data;
  },

  resumeWorkOrder: async (id) => {
    const res = await api.post(`/work-orders/${id}/resume`);
    return res.data;
  },

  completeWorkOrder: async (id, { completionNote }) => {
    const res = await api.post(`/work-orders/${id}/complete`, { completionNote });
    return res.data;
  },

  cancelWorkOrder: async (id, { cancellationReason }) => {
    const res = await api.post(`/work-orders/${id}/cancel`, { cancellationReason });
    return res.data;
  },
};

export default workOrderService;
