import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Inlined into the bundle at build time: a production build without them ships an app that can't sign in or reach the API.
const REQUIRED_ENV = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_API_URL'] as const;

export default defineConfig(({ command, mode }) => {
  if (command === 'build' && mode === 'production') {
    // Same precedence as Vite: variables already in the environment win over web/.env* files.
    const env: Record<string, string | undefined> = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env };
    const missing = REQUIRED_ENV.filter(k => !env[k]?.trim());
    if (missing.length) throw new Error(`Production build is missing ${missing.join(', ')}. Set them in the Vercel project (or web/.env.production.local); see web/.env.example.`);
  }
  return {
    plugins: [react()],
    server: { port: 5173 },
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
  };
});
