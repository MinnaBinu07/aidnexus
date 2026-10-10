import api from './client';

export const searchPhoto = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/investigate/photo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const searchQuery = async (q, queryType = 'all') => {
  const response = await api.get('/investigate/search', {
    params: { q, query_type: queryType },
  });
  return response.data;
};

export const getInvestigateNetwork = async (submissionId) => {
  const response = await api.get(`/investigate/network/${submissionId}`);
  return response.data;
};

export const getInvestigationLogs = async (limit = 30) => {
  const response = await api.get('/investigate/logs', { params: { limit } });
  return response.data;
};

export const revealInvestigatorValue = async (valueId) => {
  const response = await api.post(`/investigate/reveal/${valueId}`);
  return response.data;
};
