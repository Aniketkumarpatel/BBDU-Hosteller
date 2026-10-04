import api from './api.js';

export const getMaintenancePlans = async (params = {}) => {
  const response = await api.get('/maintenance-plans', { params });
  return response.data;
};

export const getMaintenancePlanById = async (id) => {
  const response = await api.get(`/maintenance-plans/${id}`);
  return response.data;
};

export const createMaintenancePlan = async (data) => {
  const response = await api.post('/maintenance-plans', data);
  return response.data;
};

export const updateMaintenancePlan = async (id, data) => {
  const response = await api.patch(`/maintenance-plans/${id}`, data);
  return response.data;
};

export const pauseMaintenancePlan = async (id, reason = '') => {
  const response = await api.post(`/maintenance-plans/${id}/pause`, { reason });
  return response.data;
};

export const resumeMaintenancePlan = async (id) => {
  const response = await api.post(`/maintenance-plans/${id}/resume`);
  return response.data;
};

export const deactivateMaintenancePlan = async (id, reason = '') => {
  const response = await api.post(`/maintenance-plans/${id}/deactivate`, { reason });
  return response.data;
};

export const getPlanCycles = async (id) => {
  const response = await api.get(`/maintenance-plans/${id}/cycles`);
  return response.data;
};

export const getPreventiveDashboard = async () => {
  const response = await api.get('/maintenance/dashboard');
  return response.data;
};

export const getUpcomingMaintenance = async (params = {}) => {
  const response = await api.get('/maintenance/upcoming', { params });
  return response.data;
};

export const getDueMaintenance = async (params = {}) => {
  const response = await api.get('/maintenance/due', { params });
  return response.data;
};

export const getOverdueMaintenance = async (params = {}) => {
  const response = await api.get('/maintenance/overdue', { params });
  return response.data;
};

export default {
  getMaintenancePlans,
  getMaintenancePlanById,
  createMaintenancePlan,
  updateMaintenancePlan,
  pauseMaintenancePlan,
  resumeMaintenancePlan,
  deactivateMaintenancePlan,
  getPlanCycles,
  getPreventiveDashboard,
  getUpcomingMaintenance,
  getDueMaintenance,
  getOverdueMaintenance,
};
