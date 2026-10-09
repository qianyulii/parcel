/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Serves /api/* from server/handlers.ts during `pnpm dev`, so no `vercel dev`
 * is needed locally. Same handlers Vercel runs in production.
 */
function devApi(): Plugin {
  return {
    name: 'parcel-globe-dev-api',
    configureServer(server: ViteDevServer) {
      Object.assign(process.env, loadEnv(server.config.mode, process.cwd(), ''));
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        const path = req.url?.split('?')[0];
        if (path !== '/api/track' && path !== '/api/login') return next();
        try {
          const mod = (await server.ssrLoadModule('/server/handlers.ts')) as typeof import('./server/handlers');
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          const headers = new Headers();
          for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
          const request = new Request(`http://${req.headers.host}${req.url}`, {
            method: req.method, headers, body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks),
          });
          const r = await (path === '/api/track' ? mod.handleTrack : mod.handleLogin)(request);
          res.statusCode = r.status;
          r.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(Buffer.from(await r.arrayBuffer()));
        } catch (e) {
          server.config.logger.error(String(e));
          res.statusCode = 500;
          res.end('{"error":"dev api"}');
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), devApi()],
  test: { include: process.env.PG_LIVE === '1' ? ['tests/live/**/*.test.ts'] : ['tests/unit/**/*.test.ts'], environment: 'node' },
});
