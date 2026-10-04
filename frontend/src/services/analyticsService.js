import api from './api.js';

export const analyticsService = {
  getOverview: async (params = {}) => {
    const res = await api.get('/analytics/overview', { params });
    return res.data;
  },

  getTrends: async (params = {}) => {
    const res = await api.get('/analytics/trends', { params });
    return res.data;
  },

  getStatusDistribution: async (params = {}) => {
    const res = await api.get('/analytics/status-distribution', { params });
    return res.data;
  },

  getCategories: async (params = {}) => {
    const res = await api.get('/analytics/categories', { params });
    return res.data;
  },

  getPriorities: async (params = {}) => {
    const res = await api.get('/analytics/priorities', { params });
    return res.data;
  },

  getDepartments: async (params = {}) => {
    const res = await api.get('/analytics/departments', { params });
    return res.data;
  },

  getHostels: async (params = {}) => {
    const res = await api.get('/analytics/hostels', { params });
    return res.data;
  },

  getSla: async (params = {}) => {
    const res = await api.get('/analytics/sla', { params });
    return res.data;
  },

  getEscalations: async (params = {}) => {
    const res = await api.get('/analytics/escalations', { params });
    return res.data;
  },

  getWorkload: async (params = {}) => {
    const res = await api.get('/analytics/workload', { params });
    return res.data;
  },

  exportCsv: async (type = 'complaints', params = {}) => {
    const res = await api.get('/analytics/export', {
      params: { ...params, type },
      responseType: 'blob',
    });

    const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `bbdu_analytics_${type}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
};

export default analyticsService;
