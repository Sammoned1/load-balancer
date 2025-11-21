import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/compute": {
        target: "http://lb_backend:8080",
        changeOrigin: true,
      },
    },
  },
})
