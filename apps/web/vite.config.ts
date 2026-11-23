import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

/**
 * Dev-only: serve api/*.ts (Vercel Functions) from the Vite dev server so
 * `pnpm dev` works without the Vercel CLI. Production uses Vercel's runtime.
 */
function vercelApiDev(): Plugin {
  return {
    name: 'nittany-rooms:vercel-api-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const m = /^\/api\/([a-z0-9-]+)$/.exec(url.pathname);
        if (!m) return next();
        try {
          const mod = (await server.ssrLoadModule(`/api/${m[1]}.ts`)) as {
            GET?: (r: Request) => Promise<Response>;
          };
          if (!mod.GET || req.method !== 'GET') {
            res.statusCode = 405;
            return res.end();
          }
          const response = await mod.GET(new Request(url));
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (e) {
          server.config.logger.error(String(e));
          res.statusCode = 500;
          res.end('dev api error');
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), vercelApiDev()],
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
