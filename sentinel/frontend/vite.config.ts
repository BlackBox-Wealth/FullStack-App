import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",  // REQUIRED for Docker, ec2
    port: 5174,
    allowedHosts: true, // Allow requests from any host -> for development purposes, in production specify allowed hosts for security
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
