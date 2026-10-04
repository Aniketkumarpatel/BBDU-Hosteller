import api from './api.js';

export const listRooms = async (params = {}) => {
  const { data } = await api.get('/admin/rooms', { params });
  return data;
};

export const getAllRooms = listRooms;

export const getRoom = async (id) => {
  const { data } = await api.get(`/admin/rooms/${id}`);
  return data;
};

export const createRoom = async (roomData) => {
  const { data } = await api.post('/admin/rooms', roomData);
  return data;
};

export const updateRoom = async (id, roomData) => {
  const { data } = await api.put(`/admin/rooms/${id}`, roomData);
  return data;
};

export const toggleRoomStatus = async (id) => {
  const { data } = await api.patch(`/admin/rooms/${id}/status`);
  return data;
};

export const deleteRoom = async (id) => {
  const { data } = await api.delete(`/admin/rooms/${id}`);
  return data;
};

const roomService = {
  listRooms,
  getAllRooms,
  getRoom,
  createRoom,
  updateRoom,
  toggleRoomStatus,
  deleteRoom,
};

export default roomService;
