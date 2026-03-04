#!/usr/bin/env node
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const entry = resolve(__dirname, '../src/index.ts');
const tsx = resolve(__dirname, '../node_modules/.bin/tsx');

const result = spawnSync(tsx, [entry, ...process.argv.slice(2)], {
  stdio: 'inherit',
  // On Windows, spawn through the shell so .cmd extensions are resolved.
  // On Unix, exec directly — no shell overhead.
  shell: process.platform === 'win32',
});

process.exit(result.status ?? 0);
