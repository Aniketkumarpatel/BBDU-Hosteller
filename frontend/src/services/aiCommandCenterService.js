import api from './api.js';

export const aiCommandCenterService = {
  getOverview: async (params = {}) => {
    const res = await api.get('/ai-command-center/overview', { params });
    return res.data;
  },

  getHealthScore: async (params = {}) => {
    const res = await api.get('/ai-command-center/health-score', { params });
    return res.data;
  },

  getInsights: async (params = {}) => {
    const res = await api.get('/ai-command-center/insights', { params });
    return res.data;
  },

  getRecommendations: async (params = {}) => {
    const res = await api.get('/ai-command-center/recommendations', { params });
    return res.data;
  },

  askAssistant: async (query, params = {}) => {
    const res = await api.post('/ai-command-center/ask', { query }, { params });
    return res.data;
  },
};

export default aiCommandCenterService;
