import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { host: '0.0.0.0', port: 3000, strictPort: true, allowedHosts: true },
  build: {
    rolldownOptions: {
      // Vendor code changes far less often than the app; separate chunks keep repeat visits cached
      output: {
        codeSplitting: {
          groups: [
            { name: 'react', test: /[\\/]node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/ },
            { name: 'data', test: /[\\/]node_modules[\\/](@supabase|@tanstack|zod)[\\/]/ },
          ],
        },
      },
    },
  },
  test: { environment: 'jsdom' },
});
