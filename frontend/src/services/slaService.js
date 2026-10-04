import api from './api.js';

export const listSlaRules = async (params = {}) => {
  const response = await api.get('/sla-rules', { params });
  return response.data;
};

export const getSlaRule = async (id) => {
  const response = await api.get(`/sla-rules/${id}`);
  return response.data;
};

export const createSlaRule = async (ruleData) => {
  const response = await api.post('/sla-rules', ruleData);
  return response.data;
};

export const updateSlaRule = async (id, ruleData) => {
  const response = await api.patch(`/sla-rules/${id}`, ruleData);
  return response.data;
};

export const toggleSlaRuleStatus = async (id, isActive) => {
  const response = await api.patch(`/sla-rules/${id}/status`, { isActive });
  return response.data;
};

export const triggerScheduler = async () => {
  const response = await api.post('/sla-rules/run-scheduler');
  return response.data;
};

export const verifySlaPipeline = async () => {
  const response = await api.post('/sla-rules/verify-pipeline');
  return response.data;
};

export const getSlaConfig = async () => {
  const response = await api.get('/sla-rules/config');
  return response.data;
};

export const updateSlaConfig = async (configData) => {
  const response = await api.put('/sla-rules/config', configData);
  return response.data;
};

export const listEscalationRules = async (params = {}) => {
  const response = await api.get('/escalation-rules', { params });
  return response.data;
};

export const getEscalationRule = async (id) => {
  const response = await api.get(`/escalation-rules/${id}`);
  return response.data;
};

export const createEscalationRule = async (ruleData) => {
  const response = await api.post('/escalation-rules', ruleData);
  return response.data;
};

export const updateEscalationRule = async (id, ruleData) => {
  const response = await api.patch(`/escalation-rules/${id}`, ruleData);
  return response.data;
};

export const toggleEscalationRuleStatus = async (id, isActive) => {
  const response = await api.patch(`/escalation-rules/${id}/status`, { isActive });
  return response.data;
};

export const getComplaintSla = async (complaintId) => {
  const response = await api.get(`/complaints/${complaintId}/sla`);
  return response.data;
};

export const getComplaintEscalations = async (complaintId) => {
  const response = await api.get(`/complaints/${complaintId}/escalations`);
  return response.data;
};
