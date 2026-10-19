/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Base path: "/" for Vercel/Netlify, "/deja-vu/" for GitHub Pages (npm run build:pages).
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || '/',
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
