import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",  // REQUIRED for Docker, ec2
    port: 5175,
    allowedHosts: true, // Allow requests from any host -> for development purposes, in production specify allowed hosts for security
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/portal': { target: 'http://127.0.0.1:8000', changeOrigin: true },
    },
  },
});
