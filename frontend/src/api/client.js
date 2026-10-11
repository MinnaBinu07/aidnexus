import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    // 1. Guard against HTML returned when JSON was expected
    const contentType = response.headers?.['content-type'] || '';
    if (typeof contentType === 'string' && contentType.toLowerCase().includes('text/html')) {
      const htmlError = new Error('API unreachable: received HTML instead of JSON. Check VITE_API_BASE_URL.');
      htmlError.response = response;
      htmlError.isHtmlResponse = true;
      return Promise.reject(htmlError);
    }
    return response;
  },
  (error) => {
    // Also check error responses that return HTML
    const contentType = error.response?.headers?.['content-type'] || '';
    if (typeof contentType === 'string' && contentType.toLowerCase().includes('text/html')) {
      const htmlError = new Error('API unreachable: received HTML instead of JSON. Check VITE_API_BASE_URL.');
      htmlError.response = error.response;
      htmlError.isHtmlResponse = true;
      return Promise.reject(htmlError);
    }

    if (error.response?.status === 401) {
      const url = error.config?.url || '';
      // Exclude all /auth/* credential endpoints (login and register)
      const isCredentialEndpoint = url.includes('/auth/login') || url.includes('/auth/register');
      if (!isCredentialEndpoint) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('auth:unauthorized'));
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
