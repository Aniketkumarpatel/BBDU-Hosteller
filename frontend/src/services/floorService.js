import api from './api.js';

export const listFloors = async (params = {}) => {
  const { data } = await api.get('/admin/floors', { params });
  return data;
};

export const getAllFloors = listFloors;

export const getFloor = async (id) => {
  const { data } = await api.get(`/admin/floors/${id}`);
  return data;
};

export const createFloor = async (floorData) => {
  const { data } = await api.post('/admin/floors', floorData);
  return data;
};

export const updateFloor = async (id, floorData) => {
  const { data } = await api.put(`/admin/floors/${id}`, floorData);
  return data;
};

export const toggleFloorStatus = async (id) => {
  const { data } = await api.patch(`/admin/floors/${id}/status`);
  return data;
};

export const deleteFloor = async (id) => {
  const { data } = await api.delete(`/admin/floors/${id}`);
  return data;
};

const floorService = {
  listFloors,
  getAllFloors,
  getFloor,
  createFloor,
  updateFloor,
  toggleFloorStatus,
  deleteFloor,
};

export default floorService;
