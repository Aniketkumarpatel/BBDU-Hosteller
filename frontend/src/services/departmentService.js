import api from './api.js';

export const listDepartments = async (params = {}) => {
  const { data } = await api.get('/admin/departments', { params });
  return data;
};

export const getAllDepartments = listDepartments;

export const getDepartment = async (id) => {
  const { data } = await api.get(`/admin/departments/${id}`);
  return data;
};

export const createDepartment = async (departmentData) => {
  const { data } = await api.post('/admin/departments', departmentData);
  return data;
};

export const updateDepartment = async (id, departmentData) => {
  const { data } = await api.put(`/admin/departments/${id}`, departmentData);
  return data;
};

export const toggleDepartmentStatus = async (id) => {
  const { data } = await api.patch(`/admin/departments/${id}/status`);
  return data;
};

export const deleteDepartment = async (id) => {
  const { data } = await api.delete(`/admin/departments/${id}`);
  return data;
};

const departmentService = {
  listDepartments,
  getAllDepartments,
  getDepartment,
  createDepartment,
  updateDepartment,
  toggleDepartmentStatus,
  deleteDepartment,
};

export default departmentService;
