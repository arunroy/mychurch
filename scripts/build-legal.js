#!/usr/bin/env node
// Builds the public privacy policy and terms pages from src/lib/legal.json, the same text the app shows.
// Run with `npm run build:legal`, then publish the docs/ folder (for example with GitHub Pages) and give the
// store listings the address of docs/privacy.html.

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const legal = JSON.parse(fs.readFileSync(path.join(root, 'src', 'lib', 'legal.json'), 'utf8'));
const outDir = path.join(root, 'docs');
fs.mkdirSync(outDir, { recursive: true });

const escapeHtml = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const page = (title, body) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · ${escapeHtml(legal.appName)}</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 17px/1.55 system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 0 auto; max-width: 42rem; padding: 1.5rem 1rem 4rem; }
  h1 { font-size: 1.9rem; margin-bottom: .25rem; }
  h2 { font-size: 1.2rem; margin-top: 2rem; }
  .meta { opacity: .7; margin-top: 0; }
  nav a { margin-right: 1rem; }
  footer { margin-top: 3rem; opacity: .7; font-size: .9rem; }
</style>
</head>
<body>
<nav><a href="index.html">${escapeHtml(legal.appName)}</a><a href="privacy.html">Privacy policy</a><a href="terms.html">Terms of use</a></nav>
${body}
<footer>${escapeHtml(legal.appName)}${legal.supportEmail ? ` · <a href="mailto:${escapeHtml(legal.supportEmail)}">${escapeHtml(legal.supportEmail)}</a>` : ''}</footer>
</body>
</html>
`;

const document = (doc) =>
  `<h1>${escapeHtml(doc.title)}</h1>
<p class="meta">Last updated ${escapeHtml(legal.updated)}</p>
<p>${escapeHtml(doc.intro)}</p>
${doc.sections
  .map((section) => `<h2>${escapeHtml(section.heading)}</h2>\n${section.body.map((p) => `<p>${escapeHtml(p)}</p>`).join('\n')}`)
  .join('\n')}
${legal.supportEmail ? `<h2>Contact us</h2>\n<p>Questions, reports or requests about your information: <a href="mailto:${escapeHtml(legal.supportEmail)}">${escapeHtml(legal.supportEmail)}</a></p>` : ''}`;

fs.writeFileSync(path.join(outDir, 'privacy.html'), page(legal.privacy.title, document(legal.privacy)));
fs.writeFileSync(path.join(outDir, 'terms.html'), page(legal.terms.title, document(legal.terms)));
fs.writeFileSync(
  path.join(outDir, 'index.html'),
  page(
    legal.appName,
    `<h1>${escapeHtml(legal.appName)}</h1>\n<p>A church app that helps a church stay connected.</p>\n<ul>\n<li><a href="privacy.html">Privacy policy</a></li>\n<li><a href="terms.html">Terms of use</a></li>\n</ul>`,
  ),
);

console.log('Wrote docs/index.html, docs/privacy.html and docs/terms.html');
if (!legal.supportEmail) {
  console.warn('Warning: "supportEmail" in src/lib/legal.json is empty. Set it before publishing so people can contact you.');
}
