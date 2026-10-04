import api from './api.js';

export const getDashboardStats = async () => {
  const { data } = await api.get('/dashboard/stats');
  return data;
};

const dashboardService = {
  getDashboardStats,
};

export default dashboardService;
