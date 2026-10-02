// Builds src/lib/bible-book-names.ts: for each Indian language, which folder in the wldeh/bible-api
// dataset holds each of our 66 books, and the name to show people.
//
// The dataset names its book folders in the language's own script (Hindi: "1इतिहास"), so we cannot guess
// the folder from the English name. Instead each folder is matched to a book by its verse counts per
// chapter, compared with the table in supabase/functions/_shared/bible-books.ts. Anything that does not
// match exactly is printed so a person can check it.
//
// Usage: node scripts/build-book-names.mjs [hi ta ml ...]     (needs network)

import { readFileSync, writeFileSync } from 'node:fs';

const LANGUAGES = {
  hi: 'hi-IN-irvhin',
  ta: 'ta-irvtam',
  // Likewise Kannada: the IRV folder lacks Song of Solomon and Acts, so it uses the complete Biblica Open version.
  kn: 'kn-okcv',
  // The IRV Malayalam folder in this dataset holds only 8 books, so Malayalam uses the full Biblica Open version.
  ml: 'ml-omcv',
};

// Philemon and Jude are both one chapter of 25 verses, so verse counts cannot tell them apart. Their folder
// names are given here, by language (Philemon is the letter to Philemon, Jude is the letter of Jude).
const TIE_BREAKS = {
  hi: { फिलेमोन: 'Philemon', यहूदा: 'Jude' },
  ta: { பிலே: 'Philemon', யூதா: 'Jude' },
  kn: { ಫಿಲೆಮೋನನಿಗೆ: 'Philemon', ಯೂದನು: 'Jude' },
  ml: { ഫിലേമോൻ: 'Philemon', യൂദാ: 'Jude' },
};

const CDN = 'https://cdn.jsdelivr.net/gh/wldeh/bible-api/bibles';
const API = 'https://api.github.com/repos/wldeh/bible-api/contents/bibles';

// Our books and verse counts, read from the shared table by evaluating its array literal.
const source = readFileSync(new URL('../supabase/functions/_shared/bible-books.ts', import.meta.url), 'utf8');
const rows = [...source.matchAll(/\{ name: '([^']+)', verses: n\('([^']+)'\) \}/g)].map((m) => ({
  name: m[1],
  verses: m[2].split(',').map(Number),
}));
if (rows.length !== 66) throw new Error(`Expected 66 books, found ${rows.length}`);

// Returns null when the file is not there. A file that keeps failing is also treated as missing: the
// matching below then reports the book as having the wrong number of chapters, so it is never silent.
async function json(url) {
  for (let attempt = 0; attempt < 4; attempt++) {
    let response;
    try {
      response = await fetch(url);
    } catch {
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      continue;
    }
    if (response.ok) return response.json();
    if (response.status === 404) return null;
    await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
  }
  return null;
}

async function inBatches(items, size, work) {
  const results = [];
  for (let i = 0; i < items.length; i += size) {
    results.push(...(await Promise.all(items.slice(i, i + size).map(work))));
  }
  return results;
}

// The chapters of a book are numbered files, so ask for them in turn until one is missing. This goes through the
// CDN, which has no tight rate limit (listing every book's chapters through the GitHub API would).
async function verseCounts(id, folder) {
  const counts = [];
  for (let first = 1; ; first += 10) {
    // No book has more than 150 chapters (Psalms), so never ask past that.
    const chapters = Array.from({ length: 10 }, (_, i) => first + i).filter((c) => c <= 150);
    if (chapters.length === 0) return counts;
    const bodies = await Promise.all(
      chapters.map((chapter) => json(`${CDN}/${id}/books/${encodeURIComponent(folder)}/chapters/${chapter}.json`)),
    );
    for (const body of bodies) {
      if (!body) return counts;
      counts.push(new Set(body.data.map((v) => Number(v.verse))).size);
    }
  }
}

const distance = (a, b) =>
  a.length !== b.length ? Infinity : a.reduce((sum, n, i) => sum + Math.abs(n - b[i]), 0);

const wanted = process.argv.slice(2);
const codes = wanted.length ? wanted : Object.keys(LANGUAGES);
// Asking for some languages only updates those, so the others already in the file are kept.
let result = {};
try {
  const existing = readFileSync(new URL('../src/lib/bible-book-names.ts', import.meta.url), 'utf8');
  result = Function(`return (${existing.slice(existing.indexOf('= {') + 2, existing.lastIndexOf('}') + 1)})`)();
} catch {
  result = {};
}
const problems = [];

for (const code of codes) {
  const id = LANGUAGES[code];
  console.log(`\n${code} (${id})`);
  const folders = (await json(`${API}/${id}/books`)).map((f) => f.name);
  if (folders.length !== 66) problems.push(`${code}: found ${folders.length} book folders, expected 66`);

  const fingerprints = await inBatches(folders, 3, async (folder) => ({ folder, counts: await verseCounts(id, folder) }));

  const taken = new Map();
  for (const { folder, counts } of fingerprints) {
    const ranked = rows
      .map((row) => ({ row, d: distance(row.verses, counts) }))
      .filter((c) => c.d !== Infinity)
      .sort((a, b) => a.d - b.d);
    const best = ranked[0];
    const exact = ranked.filter((c) => c.d === 0);
    if (!best) {
      problems.push(`${code}: ${folder} has ${counts.length} chapters, no book has that many`);
      continue;
    }
    const forced = TIE_BREAKS[code]?.[folder];
    if (forced) {
      taken.set(forced, folder);
      continue;
    }
    if (exact.length > 1) {
      problems.push(`${code}: ${folder} fits several books exactly: ${exact.map((c) => c.row.name).join(', ')}`);
      continue;
    }
    if (best.d !== 0) problems.push(`${code}: ${folder} is closest to ${best.row.name} but differs by ${best.d} verses`);
    if (taken.has(best.row.name)) problems.push(`${code}: ${best.row.name} matched by both ${taken.get(best.row.name)} and ${folder}`);
    taken.set(best.row.name, folder);
  }
  for (const row of rows) if (!taken.has(row.name)) problems.push(`${code}: no folder matched ${row.name}`);

  result[code] = Object.fromEntries(rows.filter((r) => taken.has(r.name)).map((r) => [r.name, taken.get(r.name)]));
  console.log(`  matched ${taken.size} of 66`);
}

const lines = [
  '// Generated by scripts/build-book-names.mjs. Do not edit by hand: change the script and run it again.',
  '//',
  '// For each language, our English book name -> the folder that holds that book in the Bible text dataset.',
  '// The folder name is also the name of the book in that language.',
  '',
  'export const BOOK_FOLDERS: Record<string, Record<string, string>> = ' + JSON.stringify(result, null, 2) + ';',
  '',
];
writeFileSync(new URL('../src/lib/bible-book-names.ts', import.meta.url), lines.join('\n'));

console.log(problems.length ? '\nNeeds a look:\n- ' + problems.join('\n- ') : '\nEvery book matched exactly.');
