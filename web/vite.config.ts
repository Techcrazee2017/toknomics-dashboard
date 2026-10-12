import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    rollupOptions: {
      // Vendor code changes far less often than the app; separate chunks keep repeat visits cached
      output: { manualChunks: { react: ['react', 'react-dom', 'react-router'], data: ['@supabase/supabase-js', '@tanstack/react-query', 'zod'] } },
    },
  },
  test: { environment: 'jsdom' },
} as Parameters<typeof defineConfig>[0]);
