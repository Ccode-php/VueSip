import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],

  // Faqat `npm run dev` (Windows) uchun. Productionda buni Ingress qiladi.
  // Shu sabab api.js va echo.js da manzillarni almashtirib o'tirish shart emas.
  server: {
    proxy: {
      // Laravel API: php artisan serve (127.0.0.1:8000)
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      // Reverb WebSocket: php artisan reverb:start (127.0.0.1:8080)
      '/app': {
        target: 'http://127.0.0.1:8080',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
