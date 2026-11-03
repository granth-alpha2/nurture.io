import dotenv from 'dotenv';
import { resolve } from 'node:path';
import Fastify from 'fastify';
import pg from 'pg';
import { createClient } from 'redis';
import { buildApp } from './app.js';
import { PostgresNavigationRepository } from './infra/repository.js';

dotenv.config({ path: resolve(process.cwd(), '../../.env') });

const { Pool } = pg;
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';
const databaseUrl = process.env.DATABASE_URL;
const redisUrl = process.env.REDIS_URL;
const mapsMode = process.env.MAPS_PROVIDER;

if (!databaseUrl) throw new Error('DATABASE_URL is required');
if (!redisUrl) throw new Error('REDIS_URL is required');
if (mapsMode !== 'simulated') {
  throw new Error('MAPS_PROVIDER=simulated must be explicitly set for the local demo provider');
}
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535');
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 10,
  connectionTimeoutMillis: 3000,
  idleTimeoutMillis: 30_000,
});
const redis = createClient({ url: redisUrl });
redis.on('error', (error) => {
  console.error('Redis client error:', error.message);
});

const app = await buildApp({
  repository: new PostgresNavigationRepository(pool),
  checkCacheHealth: async () => {
    await redis.ping();
  },
});

try {
  await redis.connect();
  await app.listen({ port, host });
} catch (error) {
  app.log.error({ err: error }, 'API startup failed');
  await app.close();
  await redis.quit().catch(() => undefined);
  await pool.end();
  process.exitCode = 1;
}

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'Shutting down API');
  try {
    await app.close();
    await redis.quit();
    await pool.end();
  } catch (error) {
    app.log.error({ err: error }, 'API shutdown failed');
    process.exitCode = 1;
  }
};

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
