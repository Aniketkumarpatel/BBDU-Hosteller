import api from './api.js';

export const cleaningService = {
  // Dashboard & KPIs
  getDashboardStats: async (params) => {
    const res = await api.get('/cleaning/dashboard', { params });
    return res.data;
  },

  // Cleaning Areas
  getAreas: async (params) => {
    const res = await api.get('/cleaning/areas', { params });
    return res.data;
  },

  getAreaById: async (id) => {
    const res = await api.get(`/cleaning/areas/${id}`);
    return res.data;
  },

  createArea: async (data) => {
    const res = await api.post('/cleaning/areas', data);
    return res.data;
  },

  updateArea: async (id, data) => {
    const res = await api.patch(`/cleaning/areas/${id}`, data);
    return res.data;
  },

  // Cleaning Plans
  getPlans: async (params) => {
    const res = await api.get('/cleaning/plans', { params });
    return res.data;
  },

  getPlanById: async (id) => {
    const res = await api.get(`/cleaning/plans/${id}`);
    return res.data;
  },

  createPlan: async (data) => {
    const res = await api.post('/cleaning/plans', data);
    return res.data;
  },

  updatePlan: async (id, data) => {
    const res = await api.patch(`/cleaning/plans/${id}`, data);
    return res.data;
  },

  togglePlanStatus: async (id, isActive) => {
    const res = await api.patch(`/cleaning/plans/${id}/status`, { isActive });
    return res.data;
  },

  // Tasks & Operations
  getTasks: async (params) => {
    const res = await api.get('/cleaning/tasks', { params });
    return res.data;
  },

  getTaskById: async (id) => {
    const res = await api.get(`/cleaning/tasks/${id}`);
    return res.data;
  },

  createTask: async (data) => {
    const res = await api.post('/cleaning/tasks', data);
    return res.data;
  },

  assignTask: async (id, data) => {
    const res = await api.post(`/cleaning/tasks/${id}/assign`, data);
    return res.data;
  },

  acceptTask: async (id) => {
    const res = await api.post(`/cleaning/tasks/${id}/accept`);
    return res.data;
  },

  startTask: async (id) => {
    const res = await api.post(`/cleaning/tasks/${id}/start`);
    return res.data;
  },

  holdTask: async (id, data) => {
    const res = await api.post(`/cleaning/tasks/${id}/hold`, data);
    return res.data;
  },

  resumeTask: async (id) => {
    const res = await api.post(`/cleaning/tasks/${id}/resume`);
    return res.data;
  },

  completeTask: async (id, data) => {
    const res = await api.post(`/cleaning/tasks/${id}/complete`, data);
    return res.data;
  },

  verifyTask: async (id, data) => {
    const res = await api.post(`/cleaning/tasks/${id}/verify`, data);
    return res.data;
  },

  rejectTask: async (id, data) => {
    const res = await api.post(`/cleaning/tasks/${id}/reject`, data);
    return res.data;
  },

  cancelTask: async (id, data) => {
    const res = await api.post(`/cleaning/tasks/${id}/cancel`, data);
    return res.data;
  },

  // Manual Scheduler Run
  runScheduler: async () => {
    const res = await api.post('/cleaning/scheduler/run');
    return res.data;
  },
};

export default cleaningService;
