import api from './client';

export const getPublicCommunities = async (page = 1, pageSize = 20) => {
  const response = await api.get('/public/communities', {
    params: { page, page_size: pageSize },
  });
  return response.data;
};

export const getPublicCommunity = async (id) => {
  const response = await api.get(`/public/communities/${id}`);
  return response.data;
};

export const getActiveDemoCode = async () => {
  const response = await api.get('/public/demo-code');
  return response.data;
};
