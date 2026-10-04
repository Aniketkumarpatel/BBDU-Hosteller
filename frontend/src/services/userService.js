import api from './api.js';

export const listUsers = async (params = {}) => {
  const { data } = await api.get('/admin/users', { params });
  return data;
};

export const getAllUsers = listUsers;

export const getUser = async (id) => {
  const { data } = await api.get(`/admin/users/${id}`);
  return data;
};

export const createUser = async (userData) => {
  const { data } = await api.post('/admin/users', userData);
  return data;
};

export const updateUser = async (id, userData) => {
  const { data } = await api.put(`/admin/users/${id}`, userData);
  return data;
};

export const toggleUserStatus = async (id) => {
  const { data } = await api.patch(`/admin/users/${id}/status`);
  return data;
};

export const deleteUser = async (id) => {
  const { data } = await api.delete(`/admin/users/${id}`);
  return data;
};

const userService = {
  listUsers,
  getAllUsers,
  getUser,
  createUser,
  updateUser,
  toggleUserStatus,
  deleteUser,
};

export default userService;
