import api from './api.js';

export const financeService = {
  // Financial Years
  getFinancialYears: async () => {
    const res = await api.get('/finance/financial-years');
    return res.data;
  },

  createFinancialYear: async (data) => {
    const res = await api.post('/finance/financial-years', data);
    return res.data;
  },

  closeFinancialYear: async (id) => {
    const res = await api.patch(`/finance/financial-years/${id}/close`);
    return res.data;
  },

  reopenFinancialYear: async (id) => {
    const res = await api.patch(`/finance/financial-years/${id}/reopen`);
    return res.data;
  },

  // Budgets
  getBudgets: async (params = {}) => {
    const res = await api.get('/finance/budgets', { params });
    return res.data;
  },

  createBudget: async (data) => {
    const res = await api.post('/finance/budgets', data);
    return res.data;
  },

  updateBudget: async (id, data) => {
    const res = await api.patch(`/finance/budgets/${id}`, data);
    return res.data;
  },

  getBudgetUtilization: async (params = {}) => {
    const res = await api.get('/finance/budgets/utilization', { params });
    return res.data;
  },

  // Vendors
  getVendors: async (params = {}) => {
    const res = await api.get('/finance/vendors', { params });
    return res.data;
  },

  getVendorById: async (id) => {
    const res = await api.get(`/finance/vendors/${id}`);
    return res.data;
  },

  createVendor: async (data) => {
    const res = await api.post('/finance/vendors', data);
    return res.data;
  },

  updateVendor: async (id, data) => {
    const res = await api.patch(`/finance/vendors/${id}`, data);
    return res.data;
  },

  deleteVendor: async (id) => {
    const res = await api.delete(`/finance/vendors/${id}`);
    return res.data;
  },

  // Expenses
  getExpenses: async (params = {}) => {
    const res = await api.get('/finance/expenses', { params });
    return res.data;
  },

  getExpenseById: async (id) => {
    const res = await api.get(`/finance/expenses/${id}`);
    return res.data;
  },

  createExpense: async (data) => {
    const res = await api.post('/finance/expenses', data);
    return res.data;
  },

  updateExpense: async (id, data) => {
    const res = await api.patch(`/finance/expenses/${id}`, data);
    return res.data;
  },

  submitExpense: async (id) => {
    const res = await api.post(`/finance/expenses/${id}/submit`);
    return res.data;
  },

  reviewExpense: async (id) => {
    const res = await api.post(`/finance/expenses/${id}/review`);
    return res.data;
  },

  approveExpense: async (id) => {
    const res = await api.post(`/finance/expenses/${id}/approve`);
    return res.data;
  },

  rejectExpense: async (id, data = {}) => {
    const res = await api.post(`/finance/expenses/${id}/reject`, data);
    return res.data;
  },

  cancelExpense: async (id, data = {}) => {
    const res = await api.post(`/finance/expenses/${id}/cancel`, data);
    return res.data;
  },

  // Dashboard & Traceability
  getFinanceDashboard: async (params = {}) => {
    const res = await api.get('/finance/dashboard', { params });
    return res.data;
  },

  getOperationalTraceability: async (id) => {
    const res = await api.get(`/finance/traceability/${id}`);
    return res.data;
  },
};

export default financeService;
