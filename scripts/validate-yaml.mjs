import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'yaml';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const searchRoots = [join(root, '.github')];
const yamlFiles = [];

function collect(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      collect(path);
    } else if (/\.(yaml|yml)$/i.test(entry.name)) {
      yamlFiles.push(path);
    }
  }
}

for (const directory of searchRoots) {
  collect(directory);
}

if (yamlFiles.length === 0) {
  console.error('No YAML configuration files found.');
  process.exit(1);
}

let failed = false;
for (const path of yamlFiles.sort()) {
  const document = parseDocument(readFileSync(path, 'utf8'), {
    uniqueKeys: true,
    version: '1.2',
  });
  if (document.errors.length > 0) {
    failed = true;
    for (const error of document.errors) {
      console.error(`${path}: ${error.message}`);
    }
  } else {
    console.log(`Valid YAML: ${path.slice(root.length + 1)}`);
  }
}

if (failed) {
  process.exit(1);
}
