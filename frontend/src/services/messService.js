import api from './api.js';

export const messService = {
  // Mess management
  getMesses: async (params) => {
    const res = await api.get('/messes', { params });
    return res.data;
  },

  getMessById: async (id) => {
    const res = await api.get(`/messes/${id}`);
    return res.data;
  },

  createMess: async (data) => {
    const res = await api.post('/messes', data);
    return res.data;
  },

  updateMess: async (id, data) => {
    const res = await api.patch(`/messes/${id}`, data);
    return res.data;
  },

  // Menus
  getMenus: async (messId, params) => {
    const res = await api.get(`/messes/${messId}/menus`, { params });
    return res.data;
  },

  getTodayMenu: async (messId, params) => {
    const res = await api.get(`/messes/${messId}/menus/today`, { params });
    return res.data;
  },

  createOrUpdateMenu: async (messId, data) => {
    const res = await api.post(`/messes/${messId}/menus`, data);
    return res.data;
  },

  publishMenu: async (menuId) => {
    const res = await api.post(`/messes/menus/${menuId}/publish`);
    return res.data;
  },

  unpublishMenu: async (menuId) => {
    const res = await api.post(`/messes/menus/${menuId}/unpublish`);
    return res.data;
  },

  // Weekly Timetable Photo / Document OCR & Bulk Publish
  uploadWeeklyMenuPhoto: async (messId, formData) => {
    const res = await api.post(`/messes/${messId}/timetable/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },

  publishWeeklySchedule: async (messId, schedule) => {
    const res = await api.post(`/messes/${messId}/timetable/publish`, { schedule });
    return res.data;
  },

  // Feedback
  submitFeedback: async (data) => {
    const res = await api.post('/mess-feedback', data);
    return res.data;
  },

  getMyFeedbacks: async (params) => {
    const res = await api.get('/mess-feedback/my', { params });
    return res.data;
  },

  getMessFeedbacks: async (params) => {
    const res = await api.get('/mess-feedback', { params });
    return res.data;
  },

  // Dashboard & Operational Analytics
  getMessDashboard: async (params) => {
    const res = await api.get('/messes/dashboard', { params });
    return res.data;
  },

  getFoodQualityAnalytics: async (params) => {
    const res = await api.get('/messes/analytics', { params });
    return res.data;
  },

  // Notices
  getNotices: async (params) => {
    const res = await api.get('/mess-notices', { params });
    return res.data;
  },

  createNotice: async (data) => {
    const res = await api.post('/mess-notices', data);
    return res.data;
  },

  toggleNoticeActive: async (id, isActive) => {
    const res = await api.patch(`/mess-notices/${id}/toggle`, { isActive });
    return res.data;
  },
};

export default messService;
