/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    globals: true,
    css: false,
  },
  server: {
    host: '0.0.0.0',
    watch: { usePolling: true },
    proxy: { '/api': { target: 'http://backend:8000', changeOrigin: true } },
  },
})
