import api from './client';

export const getMyCommunities = async (page = 1, pageSize = 20) => {
  const response = await api.get('/communities/mine', { params: { page, page_size: pageSize } });
  return response.data;
};

export const createCommunity = async (payload) => {
  const response = await api.post('/communities', payload);
  return response.data;
};

export const getCommunity = async (id) => {
  const response = await api.get(`/communities/${id}`);
  return response.data;
};

export const updateCommunity = async (id, payload) => {
  const response = await api.put(`/communities/${id}`, payload);
  return response.data;
};

export const uploadCommunityQr = async (id, file) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post(`/communities/${id}/qr`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const getRequiredFields = async (id) => {
  const response = await api.get(`/communities/${id}/fields`);
  return response.data;
};

export const updateRequiredFields = async (id, fields) => {
  const response = await api.put(`/communities/${id}/fields`, { fields });
  return response.data;
};

export const generateCodes = async (id, codeItems) => {
  const response = await api.post(`/communities/${id}/codes`, { codes: codeItems });
  return response.data;
};

export const getCommunityCodes = async (id, statusFilter = null, page = 1, pageSize = 30) => {
  const params = { page, page_size: pageSize };
  if (statusFilter) params.status_filter = statusFilter;
  const response = await api.get(`/communities/${id}/codes`, { params });
  return response.data;
};

export const revokeCode = async (codeId) => {
  const response = await api.post(`/codes/${codeId}/revoke`);
  return response.data;
};

export const getCommunitySubmissions = async (id, filters = {}) => {
  const response = await api.get(`/communities/${id}/submissions`, { params: filters });
  return response.data;
};

export const getSubmissionDetail = async (subId) => {
  const response = await api.get(`/submissions/${subId}`);
  return response.data;
};

export const revealValue = async (subId, valueId) => {
  const response = await api.post(`/submissions/${subId}/reveal/${valueId}`);
  return response.data;
};

export const reviewSubmission = async (subId, payload) => {
  const response = await api.post(`/submissions/${subId}/review`, payload);
  return response.data;
};

export const getCommunityNetwork = async (id, componentId = null) => {
  const params = {};
  if (componentId !== null && componentId !== undefined) {
    params.component_id = componentId;
  }
  const response = await api.get(`/communities/${id}/network`, { params });
  return response.data;
};

export const getFlaggedQueue = async (id) => {
  const response = await api.get(`/communities/${id}/queue`);
  return response.data;
};

export const getCommunityStats = async (id) => {
  const response = await api.get(`/communities/${id}/stats`);
  return response.data;
};

export const createDocumentRequest = async (id, payload) => {
  const response = await api.post(`/communities/${id}/document-requests`, payload);
  return response.data;
};

export const getCommunityAuditLogs = async (id, page = 1, pageSize = 30) => {
  const response = await api.get(`/communities/${id}/audit`, { params: { page, page_size: pageSize } });
  return response.data;
};

export const generateAccessCodes = async (id, count = 25) => {
  const codeItems = Array.from({ length: count }, (_, i) => ({
    description: `Batch generated voucher #${i + 1}`,
  }));
  return generateCodes(id, codeItems);
};

export const exportAuditLedger = async (id) => {
  return getCommunityAuditLogs(id, 1, 100);
};
