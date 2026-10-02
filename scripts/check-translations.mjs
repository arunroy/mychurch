// Checks every language file against English (src/i18n/locales/en.json): no missing keys, no leftover keys,
// and the same {{placeholders}} in each text, so a translation can never lose a name or a number.
//
// Usage: node scripts/check-translations.mjs        (exits with an error if anything is off)

import { readdirSync, readFileSync } from 'node:fs';

const dir = new URL('../src/i18n/locales/', import.meta.url);

/** Flattens nested objects to "a.b.c" -> text. Arrays are treated as one value and compared by length. */
function flatten(object, prefix = '') {
  const out = {};
  for (const [key, value] of Object.entries(object)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) Object.assign(out, flatten(value, path));
    else out[path] = value;
  }
  return out;
}

const placeholders = (text) => (typeof text === 'string' ? [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort().join(',') : '');

/** "wantToJoin_one" and "wantToJoin_other" are one text with plural forms; other languages may need other forms. */
const base = (key) => key.replace(/_(zero|one|two|few|many|other)$/, '');

const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
const english = flatten(JSON.parse(readFileSync(new URL('en.json', dir), 'utf8')));
const englishBases = new Set(Object.keys(english).map(base));
let problems = 0;
const report = (message) => {
  problems++;
  console.log('  ' + message);
};

for (const file of files.filter((f) => f !== 'en.json')) {
  console.log(file);
  const other = flatten(JSON.parse(readFileSync(new URL(file, dir), 'utf8')));

  for (const key of Object.keys(english)) {
    if (!(key in other) && !Object.keys(other).some((k) => base(k) === base(key))) report(`missing: ${key}`);
  }
  for (const key of Object.keys(other)) {
    if (!englishBases.has(base(key))) report(`not in English: ${key}`);
  }
  for (const [key, text] of Object.entries(other)) {
    const source = english[key] ?? english[Object.keys(english).find((k) => base(k) === base(key))];
    if (source === undefined) continue;
    if (Array.isArray(source) && (!Array.isArray(text) || text.length !== source.length)) report(`wrong number of items: ${key}`);
    if (placeholders(source) !== placeholders(text)) report(`placeholders differ: ${key} (English has {{${placeholders(source)}}})`);
    if (typeof text === 'string' && !text.trim()) report(`empty: ${key}`);
  }
}

console.log(problems ? `\n${problems} problem(s)` : '\nAll languages match English.');
process.exit(problems ? 1 : 0);
