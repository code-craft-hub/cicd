import Fastify, { FastifyInstance } from 'fastify';

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: true });

  app.get('/', async () => {
    return { message: 'Hello, world!' };
  });

  app.get('/health', async () => {
    return { status: 'ok' };
  });

  return app;
}
