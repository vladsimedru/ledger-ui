import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The ledger API has no CORS headers, so the dev and preview servers forward /v1 to it.
const target = process.env.LEDGER_API_URL ?? 'http://localhost:8080';
const proxy = { '/v1': { target, changeOrigin: true } };

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy },
  preview: { port: 4173, proxy },
});
