import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves the site under /portfolio-insel/. For a custom domain
// (CNAME) build with BASE_PATH=/ instead.
const base = process.env.BASE_PATH ?? '/portfolio-insel/';

export default defineConfig({
  base,
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  build: {
    target: 'es2022',
    // Rapier ships its physics engine as inlined WASM (~2 MB). Code splitting
    // and the load budget are handled in Phase 10.
    chunkSizeWarningLimit: 4000,
  },
});
