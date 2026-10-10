import api from './client';

export const validateJoinCode = async (code) => {
  const response = await api.post('/join', { code });
  return response.data;
};

export const submitClaim = async (formData) => {
  const response = await api.post('/join/submit', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const getMySubmission = async () => {
  const response = await api.get('/me/submission');
  return response.data;
};

export const markNotificationRead = async (id) => {
  const response = await api.post(`/me/notifications/${id}/read`);
  return response.data;
};

export const fulfillDocumentRequest = async (id, file) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post(`/me/document-requests/${id}/fulfill`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};
