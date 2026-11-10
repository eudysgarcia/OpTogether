import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import { authRoutes } from './auth.mjs';
import { config } from './config.mjs';
import { pool } from './db.mjs';
import { filesRoutes } from './files.mjs';
import { startPushWorker } from './push.mjs';

export async function buildApp(opts = {}) {
  const app = Fastify({ logger: opts.logger ?? true, trustProxy: true, bodyLimit: 1024 * 1024 });
  await app.register(cors, { origin: true });
  await app.register(rateLimit, { global: false });
  await app.register(multipart, { limits: { fileSize: config.maxUploadBytes } });

  // Errores de PostgreSQL (RAISE EXCEPTION 'CODIGO') llegan a la app con el mismo código que maneja.
  app.setErrorHandler((err, req, reply) => {
    if (err.code && /^[0-9A-Z]{5}$/.test(err.code) && !err.statusCode) {
      return reply.code(400).send({ message: err.message, hint: err.hint ?? null, code: err.code });
    }
    if (err.statusCode && err.statusCode < 500) return reply.code(err.statusCode).send({ message: err.message });
    req.log.error(err);
    return reply.code(500).send({ message: 'Error interno' });
  });

  app.get('/health', async () => {
    await pool.query('select 1');
    return { ok: true };
  });
  await app.register(authRoutes);
  await app.register(filesRoutes);
  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const app = await buildApp();
  startPushWorker(app.log);
  await app.listen({ port: config.port, host: '0.0.0.0' });
}
