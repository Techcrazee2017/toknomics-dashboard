import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SpeedInsights } from '@vercel/speed-insights/react';
import '@phosphor-icons/web/regular';
import '@phosphor-icons/web/fill';
import './styles/nocturne.css';
import './styles/app.css';
import { App } from './App';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, refetchOnWindowFocus: true, retry: (n, e) => n < 2 && !(e instanceof Error && /role|not allow|Not connected/i.test(e.message)) } },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <SpeedInsights />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
