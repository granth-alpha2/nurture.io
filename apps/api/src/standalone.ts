import dotenv from 'dotenv';
import { resolve } from 'node:path';
import { buildApp } from './app.js';
import { MemoryNavigationRepository } from './infra/repository.js';

dotenv.config({ path: resolve(process.cwd(), '../../.env') });

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

const repository = new MemoryNavigationRepository();
const app = await buildApp({
  repository,
  logger: true,
  checkCacheHealth: async () => {},
});

try {
  const address = await app.listen({ port, host });
  console.log(`\n=================================================================`);
  console.log(`  LandmarkNav API is running (In-Memory Standalone Mode)`);
  console.log(`  Endpoint:  ${address}`);
  console.log(`  Health:    ${address}/healthz`);
  console.log(`  Readiness: ${address}/readyz`);
  console.log(`=================================================================\n`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

