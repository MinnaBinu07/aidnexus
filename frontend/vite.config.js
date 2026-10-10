import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  server: {
    port: 5173,
    proxy: {
      '/auth': 'http://127.0.0.1:8000',
      '/communities': 'http://127.0.0.1:8000',
      '/codes': 'http://127.0.0.1:8000',
      '/join': 'http://127.0.0.1:8000',
      '/submissions': 'http://127.0.0.1:8000',
      '/evidence': 'http://127.0.0.1:8000',
      '/me': 'http://127.0.0.1:8000',
      '/investigate': 'http://127.0.0.1:8000',
      '/public': 'http://127.0.0.1:8000',
      '/public-qr': 'http://127.0.0.1:8000',
      '/notifications': 'http://127.0.0.1:8000'
    }
  }
})
