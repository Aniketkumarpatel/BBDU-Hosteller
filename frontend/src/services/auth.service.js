import api from './api.js';

export const getPublicHostels = async () => {
  const { data } = await api.get('/auth/hostels');
  return data;
};

export const getPublicBlocks = async (hostelId) => {
  const { data } = await api.get(`/auth/blocks?hostelId=${hostelId}`);
  return data;
};

export const getPublicFloors = async (blockId) => {
  const { data } = await api.get(`/auth/floors?blockId=${blockId}`);
  return data;
};

export const getPublicRooms = async (floorId) => {
  const { data } = await api.get(`/auth/rooms?floorId=${floorId}`);
  return data;
};

export const register = async (userData) => {
  const { data } = await api.post('/auth/register', userData);
  return data;
};

export const login = async ({ email, password }) => {
  const { data } = await api.post('/auth/login', { email, password });
  return data;
};

export const getMe = async () => {
  const { data } = await api.get('/auth/me');
  return data;
};

export const changePassword = async ({ currentPassword, newPassword }) => {
  const { data } = await api.post('/auth/change-password', { currentPassword, newPassword });
  return data;
};

// SUPER_ADMIN (any user) or WARDEN (student and staff of own hostel).
// The response carries the one-time temporary password.
export const resetUserPassword = async (userId) => {
  const { data } = await api.post(`/auth/users/${userId}/reset-password`);
  return data;
};

// WARDEN only: students and staff of the warden's own hostel
export const listHostelUsers = async (params = {}) => {
  const { data } = await api.get('/auth/hostel-users', { params });
  return data;
};

export const logout = async () => {
  try {
    const { data } = await api.post('/auth/logout');
    return data;
  } catch {
    // Stateless logout: local credentials should be cleared regardless
    return { success: true };
  }
};
