import api from './api.js';

export const assetService = {
  getAssets: async (params = {}) => {
    const res = await api.get('/assets', { params });
    return res.data;
  },

  getAssetById: async (id) => {
    const res = await api.get(`/assets/${id}`);
    return res.data;
  },

  createAsset: async (data) => {
    const res = await api.post('/assets', data);
    return res.data;
  },

  updateAsset: async (id, data) => {
    const res = await api.patch(`/assets/${id}`, data);
    return res.data;
  },

  moveAsset: async (id, data) => {
    const res = await api.post(`/assets/${id}/move`, data);
    return res.data;
  },

  updateCondition: async (id, data) => {
    const res = await api.post(`/assets/${id}/condition`, data);
    return res.data;
  },

  retireAsset: async (id, data = {}) => {
    const res = await api.post(`/assets/${id}/retire`, data);
    return res.data;
  },

  disposeAsset: async (id, data = {}) => {
    const res = await api.post(`/assets/${id}/dispose`, data);
    return res.data;
  },

  getAssetHealth: async (id) => {
    const res = await api.get(`/assets/${id}/health`);
    return res.data;
  },

  getMaintenanceHistory: async (id) => {
    const res = await api.get(`/assets/${id}/maintenance-history`);
    return res.data;
  },

  getCostAnalytics: async (params = {}) => {
    const res = await api.get('/assets/analytics', { params });
    return res.data;
  },

  getInventoryDashboard: async (params = {}) => {
    const res = await api.get('/assets/dashboard', { params });
    return res.data;
  },
};

export default assetService;
