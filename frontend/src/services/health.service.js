import api from './api.js';

export const getHealth = async () => {
  const { data } = await api.get('/health');
  return data;
};
