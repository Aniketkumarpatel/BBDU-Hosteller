import api from './api.js';

export const listHostels = async (params = {}) => {
  const { data } = await api.get('/admin/hostels', { params });
  return data;
};

export const getAllHostels = listHostels;

export const getHostel = async (id) => {
  const { data } = await api.get(`/admin/hostels/${id}`);
  return data;
};

export const createHostel = async (hostelData) => {
  const { data } = await api.post('/admin/hostels', hostelData);
  return data;
};

export const updateHostel = async (id, hostelData) => {
  const { data } = await api.put(`/admin/hostels/${id}`, hostelData);
  return data;
};

export const toggleHostelStatus = async (id) => {
  const { data } = await api.patch(`/admin/hostels/${id}/status`);
  return data;
};

export const deleteHostel = async (id) => {
  const { data } = await api.delete(`/admin/hostels/${id}`);
  return data;
};

const hostelService = {
  listHostels,
  getAllHostels,
  getHostel,
  createHostel,
  updateHostel,
  toggleHostelStatus,
  deleteHostel,
};

export default hostelService;
