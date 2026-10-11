import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const apiProxy = {
  target: 'http://127.0.0.1:8000',
  changeOrigin: true,
  bypass: (req) => {
    // Browser page navigations (Accept: text/html) should serve index.html instead of hitting the backend proxy
    if (req.headers.accept && req.headers.accept.includes('text/html')) {
      return '/index.html';
    }
  },
};

const proxyEndpoints = [
  '/auth',
  '/communities',
  '/codes',
  '/join',
  '/submissions',
  '/evidence',
  '/me',
  '/investigate',
  '/public',
  '/public-qr',
  '/notifications',
];

const proxy = Object.fromEntries(
  proxyEndpoints.map((endpoint) => [endpoint, apiProxy])
);

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  server: {
    port: 5173,
    proxy
  }
})
