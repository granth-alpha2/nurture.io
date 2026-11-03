import { copyFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = join(root, '.env');
const templatePath = join(root, '.env.example');

if (!existsSync(envPath)) {
  copyFileSync(templatePath, envPath);
  console.log('Created .env from .env.example using local-only development defaults.');
} else {
  console.log('.env already exists; it was not changed.');
}
