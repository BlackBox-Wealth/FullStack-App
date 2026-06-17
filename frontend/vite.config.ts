import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: ['react-markdown'],
  },
  server: {
    host: "0.0.0.0",   // REQUIRED for Docker, ec2
    port: 5173,
    allowedHosts: true, // Allow requests from any host -> for development purposes, in production specify allowed hosts for security
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/compliance-api': {
        target: 'http://127.0.0.1:8002',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/compliance-api/, ''),
      }
    }
  },
})