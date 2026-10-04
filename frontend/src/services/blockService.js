import api from './api.js';

export const listBlocks = async (params = {}) => {
  const { data } = await api.get('/admin/blocks', { params });
  return data;
};

export const getAllBlocks = listBlocks;

export const getBlock = async (id) => {
  const { data } = await api.get(`/admin/blocks/${id}`);
  return data;
};

export const createBlock = async (blockData) => {
  const { data } = await api.post('/admin/blocks', blockData);
  return data;
};

export const updateBlock = async (id, blockData) => {
  const { data } = await api.put(`/admin/blocks/${id}`, blockData);
  return data;
};

export const toggleBlockStatus = async (id) => {
  const { data } = await api.patch(`/admin/blocks/${id}/status`);
  return data;
};

export const deleteBlock = async (id) => {
  const { data } = await api.delete(`/admin/blocks/${id}`);
  return data;
};

const blockService = {
  listBlocks,
  getAllBlocks,
  getBlock,
  createBlock,
  updateBlock,
  toggleBlockStatus,
  deleteBlock,
};

export default blockService;
