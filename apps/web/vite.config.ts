import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // maplibre-gl (~300 kB gzip) is lazy-loaded in its own chunk.
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // Keep the heavy map library in its own chunk; it's lazy-loaded.
        manualChunks: (id) => (id.includes('maplibre-gl') ? 'maplibre' : undefined),
      },
    },
  },
});
