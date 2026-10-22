import { readdirSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = join(root, 'docs', 'diagrams', 'src');
const outputDir = join(root, 'docs', 'diagrams', 'rendered');
const browserCandidates = [
  process.env.ProgramFiles && join(process.env.ProgramFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
  process.env['ProgramFiles(x86)'] && join(process.env['ProgramFiles(x86)'], 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  process.env.ProgramFiles && join(process.env.ProgramFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);
const sources = readdirSync(sourceDir)
  .filter((name) => name.endsWith('.mmd'))
  .sort();

if (!process.env.PUPPETEER_EXECUTABLE_PATH) {
  const browserPath = browserCandidates.find((candidate) => existsSync(candidate));
  if (browserPath) {
    process.env.PUPPETEER_EXECUTABLE_PATH = browserPath;
  } else {
    console.error(
      'Chrome or Chromium is required. Install it or set PUPPETEER_EXECUTABLE_PATH.',
    );
    process.exit(1);
  }
}

if (sources.length === 0) {
  console.error(`No Mermaid sources found in ${sourceDir}`);
  process.exit(1);
}

mkdirSync(outputDir, { recursive: true });

for (const name of sources) {
  const input = join(sourceDir, name);
  const output = join(outputDir, `${name.slice(0, -4)}.svg`);
  const cli = join(
    root,
    'node_modules',
    '@mermaid-js',
    'mermaid-cli',
    'src',
    'cli.js',
  );
  const args = [
    cli,
    '--input',
    input,
    '--output',
    output,
    '--backgroundColor',
    'white',
  ];
  let result;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    result = spawnSync(process.execPath, args, {
      encoding: 'utf8',
      env: process.env,
    });

    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.error) {
      console.error(`Unable to render ${name}: ${result.error.message}`);
      process.exit(1);
    }
    if (result.status === 0) break;
    if (attempt < 3) {
      console.warn(`Retrying ${name} after renderer exit ${result.status} (${attempt}/2)`);
    }
  }

  if (result.status !== 0) {
    console.error(`Mermaid rendering failed for ${name} (exit ${result.status})`);
    process.exit(result.status ?? 1);
  }
}

console.log(`Rendered ${sources.length} Mermaid diagrams to ${outputDir}`);
