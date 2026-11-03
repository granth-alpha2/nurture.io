import dotenv from 'dotenv';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';

dotenv.config({ path: resolve(process.cwd(), '../../.env') });

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL must be set before running migrations');
}

const pool = new Pool({ connectionString, max: 1 });

try {
  const migrationPath = resolve(process.cwd(), 'migrations', '001-initial.sql');
  const migration = await readFile(migrationPath, 'utf8');
  await pool.query(migration);
  console.log('Applied migration 001-initial.sql');
} catch (error) {
  console.error('Database migration failed:', error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
