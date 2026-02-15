import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  css: {
    postcss: './postcss.config.cjs',
  },
  server: {
    port: 5173,  // Standard Vite port
    // Backend API URL is configured via VITE_BACKEND_URL in .env
  },
})
