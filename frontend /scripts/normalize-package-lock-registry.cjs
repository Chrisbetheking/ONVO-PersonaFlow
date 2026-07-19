const fs = require('node:fs');
const path = require('node:path');

const lockPath = path.resolve(process.cwd(), 'package-lock.json');
const publicRegistry = 'https://registry.npmjs.org/';

if (!fs.existsSync(lockPath)) {
  console.log('[registry-fix] package-lock.json not found; nothing to normalize.');
  process.exit(0);
}

const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
let replacements = 0;

function normalizeResolved(value) {
  if (typeof value !== 'string' || !value.startsWith('http')) return value;

  let url;
  try {
    url = new URL(value);
  } catch {
    return value;
  }

  const isInternal =
    url.hostname.includes('applied-caas-gateway') ||
    url.hostname.endsWith('internal.api.openai.org');

  if (!isInternal) return value;

  const markers = [
    '/artifactory/api/npm/npm-public/',
    '/api/npm/npm-public/',
    '/npm-public/',
  ];

  let suffix = url.pathname.replace(/^\/+/, '');
  for (const marker of markers) {
    const index = url.pathname.indexOf(marker);
    if (index >= 0) {
      suffix = url.pathname.slice(index + marker.length).replace(/^\/+/, '');
      break;
    }
  }

  replacements += 1;
  return `${publicRegistry}${suffix}${url.search}`;
}

function walk(node) {
  if (Array.isArray(node)) {
    node.forEach(walk);
    return;
  }
  if (!node || typeof node !== 'object') return;

  for (const [key, value] of Object.entries(node)) {
    if (key === 'resolved') {
      node[key] = normalizeResolved(value);
    } else {
      walk(value);
    }
  }
}

walk(lock);

if (replacements > 0) {
  fs.writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
  console.log(`[registry-fix] Replaced ${replacements} internal registry URL(s).`);
} else {
  console.log('[registry-fix] No internal registry URLs found.');
}
