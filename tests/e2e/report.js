// Line coverage of every source file (src/, without vendor/): by the unit tests, by the browser tests and
// by either. Reads coverage/unit.lcov and coverage/e2e/*.json, which `npm run coverage:all` writes first.
// Exits with an error when the combined coverage is under MIN_COMBINED_PERCENT.

import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { relative, join } from 'node:path';
import { codeLines, mergeEntries } from './lines.js';

const MIN_COMBINED_PERCENT = 100;
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const COVERAGE = join(ROOT, 'coverage');

/** src/**\/*.js without src/vendor/, as paths relative to the repository. */
async function sourceFiles(dir = join(ROOT, 'src')) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'vendor' ? [] : sourceFiles(path);
    return entry.name.endsWith('.js') ? [relative(ROOT, path)] : [];
  }));
  return nested.flat().sort();
}

/** path → Set of lines the unit tests ran, from an lcov file. */
function unitCovered(lcov) {
  const files = new Map();
  let current = null;
  lcov.split('\n').forEach((line) => {
    if (line.startsWith('SF:')) {
      current = new Set();
      files.set(relative(ROOT, line.slice(3)), current);
    }
    const [, number, count] = /^DA:(\d+),(\d+)/.exec(line) ?? [];
    if (current && Number(count) > 0) current.add(Number(number));
  });
  return files;
}

async function browserCovered() {
  const dir = join(COVERAGE, 'e2e');
  const names = (await readdir(dir)).filter((name) => name.endsWith('.json'));
  const entries = (await Promise.all(names.map(async (name) => JSON.parse(await readFile(join(dir, name), 'utf8'))))).flat();
  return mergeEntries(entries);
}

const percent = (part, whole) => (whole === 0 ? 100 : (100 * part) / whole);
const cell = (value) => value.toFixed(1).padStart(6);

async function main() {
  const unit = unitCovered(await readFile(join(COVERAGE, 'unit.lcov'), 'utf8'));
  const browser = await browserCovered();
  const rows = await Promise.all((await sourceFiles()).map(async (path) => {
    const lines = codeLines(await readFile(join(ROOT, path), 'utf8'));
    const byUnit = lines.filter((line) => unit.get(path)?.has(line));
    const byBrowser = lines.filter((line) => browser.get(path)?.covered.has(line));
    const either = lines.filter((line) => byUnit.includes(line) || byBrowser.includes(line));
    const missing = lines.filter((line) => !either.includes(line));
    return { path, total: lines.length, unit: byUnit.length, browser: byBrowser.length, either: either.length, missing };
  }));
  console.log(`${'file'.padEnd(34)}  unit %  browser %  combined %  uncovered lines`);
  rows.forEach((row) => console.log(
    `${row.path.padEnd(34)} ${cell(percent(row.unit, row.total))} ${cell(percent(row.browser, row.total))}    ${cell(percent(row.either, row.total))}    ${row.missing.join(' ')}`,
  ));
  const sum = (key) => rows.reduce((total, row) => total + row[key], 0);
  const combined = percent(sum('either'), sum('total'));
  console.log(`${'all files'.padEnd(34)} ${cell(percent(sum('unit'), sum('total')))} ${cell(percent(sum('browser'), sum('total')))}    ${cell(combined)}`);
  if (combined < MIN_COMBINED_PERCENT) {
    console.error(`Combined line coverage ${combined.toFixed(1)}% is under ${MIN_COMBINED_PERCENT}%.`);
    process.exitCode = 1;
  }
}

main();
