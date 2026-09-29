#!/usr/bin/env node
/**
 * Scans the built output for dead internal links.
 *
 * The bugs this catches are invisible in source: section anchors that only exist on
 * the home page, and language-switcher links that assume both locales share a slug.
 * Both were live in this repo before. Run after `npm run build`.
 *
 * Usage: npm run check:links
 */

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

if (!fs.existsSync(DIST)) {
  console.error('dist/ not found — run `npm run build` first.');
  process.exit(1);
}

/** Every route the build emitted, as site-absolute directories (`/id/blog/`). */
function collectRoutes(dir = DIST) {
  const routes = new Set();
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      for (const nested of collectRoutes(full)) routes.add(nested);
    } else if (entry.name.endsWith('.html')) {
      const rel = path.relative(DIST, path.dirname(full)).split(path.sep).join('/');
      routes.add(`/${rel ? `${rel}/` : ''}`);
    }
  }
  return routes;
}

const routes = collectRoutes();

/** Section ids present on each page, so `#hash` links can be checked per page. */
function sectionIds(html) {
  return new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]));
}

const problems = [];

for (const route of routes) {
  const file = path.join(DIST, route, 'index.html');
  if (!fs.existsSync(file)) continue;

  const html = fs.readFileSync(file, 'utf8');
  const ids = sectionIds(html);

  for (const [, href] of html.matchAll(/href="([^"]+)"/g)) {
    if (/^(https?:|mailto:|tel:|\/\/)/.test(href)) continue;

    const [target, hash] = href.split('#');

    if (target.startsWith('/')) {
      // Normalise `/id` and `/id/` to the same route key.
      const key = target.endsWith('/') ? target : `${target}/`;
      if (!routes.has(key) && !fs.existsSync(path.join(DIST, target))) {
        problems.push(`${route}  ->  ${href}  (missing route)`);
        continue;
      }
      // A cross-page anchor must land on a page that actually has that id.
      if (hash) {
        const landing = fs.readFileSync(path.join(DIST, key, 'index.html'), 'utf8');
        if (!sectionIds(landing).has(hash)) {
          problems.push(`${route}  ->  ${href}  (target page has no #${hash})`);
        }
      }
    } else if (hash && !ids.has(hash)) {
      problems.push(`${route}  ->  ${href}  (no #${hash} on this page)`);
    }
  }
}

if (problems.length > 0) {
  console.error(`dead links in dist/ (${problems.length}):`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

console.log(`no dead links — ${routes.size} routes scanned`);
