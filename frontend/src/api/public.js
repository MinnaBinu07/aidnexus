import api from './client';

export const getPublicCommunities = async (page = 1, pageSize = 20, q = '') => {
  const params = { page, page_size: pageSize };
  if (q && q.trim()) {
    params.q = q.trim();
  }
  const response = await api.get('/public/communities', { params });
  return response.data;
};

export const getPublicCommunity = async (id) => {
  const response = await api.get(`/public/communities/${id}`);
  return response.data;
};
