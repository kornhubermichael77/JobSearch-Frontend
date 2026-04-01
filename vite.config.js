import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  // Alias: @ zeigt auf src/ Verzeichnis
  // Damit: @/services/api.js = src/services/api.js
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  
  /**
   * CORS-Proxy für Development
   * localhost:5173 → /api/* → localhost:8080/api/*
   * 
   * In Production: Backend muss CORS Headers setzen oder
   * Frontend/Backend auf gleichem Server/Port laufen
   */
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        // Url wird rewritten: /api/auth/login → /api/auth/login (bleibt gleich)
        rewrite: (path) => path,
      },
    },
  },
})
