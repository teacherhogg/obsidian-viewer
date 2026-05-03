'use strict';

const path = require('path');
const fs = require('fs-extra');

const ATTACHMENTS_DIR = process.env.ATTACHMENTS_DIR || '_generated';
const TRANSPARENT_SEGMENTS = new Set(['Summaries']);
const SKIP_FOLDER_SEGMENTS = new Set(['Sources']);

// Maps a vault-relative markdownPath to the web-view HTML path (strips Summaries, changes ext).
function toWebPath(markdownPath) {
  const parts = markdownPath.replace(/\\/g, '/').split('/');
  const filtered = parts.filter(p => !TRANSPARENT_SEGMENTS.has(p));
  return filtered.join('/').replace(/\.md$/, '.html');
}

function escHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function generateShowcase(pair, vaultName) {
  const manifestPath = path.join(pair.input, ATTACHMENTS_DIR, '.manifest.json');
  let manifest;
  try {
    manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
  } catch {
    return; // No manifest yet — showcase will be generated once watcher produces one
  }

  // Group entries, filtering out Sources and missing images
  const groups = new Map(); // category → Map(subcategory → entries[])
  for (const [imageFile, entry] of Object.entries(manifest)) {
    const parts = (entry.markdownPath || '').replace(/\\/g, '/').split('/');
    if (parts.some(p => SKIP_FOLDER_SEGMENTS.has(p))) continue;

    const imgOutPath = path.join(pair.output, ATTACHMENTS_DIR, imageFile);
    try { await fs.access(imgOutPath); } catch { continue; }

    const cat = entry.category || '(Uncategorized)';
    const sub = entry.subcategory || '';
    if (!groups.has(cat)) groups.set(cat, new Map());
    const subs = groups.get(cat);
    if (!subs.has(sub)) subs.set(sub, []);
    subs.get(sub).push({ imageFile, ...entry });
  }

  if (groups.size === 0) return;

  const sortedCats = [...groups.keys()].sort((a, b) => a.localeCompare(b));
  const totalCount = [...groups.values()].flatMap(s => [...s.values()]).flat().length;

  const sectionsHtml = sortedCats.map(cat => {
    const subs = groups.get(cat);
    const sortedSubs = [...subs.keys()].sort((a, b) => a.localeCompare(b));

    const subHtml = sortedSubs.map(sub => {
      const entries = subs.get(sub).sort((a, b) => a.title.localeCompare(b.title));
      const cardsHtml = entries.map(({ imageFile, markdownPath, title, category, subcategory }) => {
        const webPath = toWebPath(markdownPath);
        const href = './' + webPath;
        const imgSrc = './' + ATTACHMENTS_DIR + '/' + imageFile;
        const metaText = [category, subcategory].filter(Boolean).join(' › ');
        const displayTitle = title.replace(/\b\w/g, c => c.toUpperCase());
        return `<a class="sc-card" href="${href}" data-doc-path="${escHtml(webPath)}">` +
          `<img src="${escHtml(imgSrc)}" loading="lazy" alt="${escHtml(displayTitle)}">` +
          `<div class="sc-caption">` +
          `<div class="sc-title">${escHtml(displayTitle)}</div>` +
          `<div class="sc-meta">${escHtml(metaText)}</div>` +
          `<div class="read-caption"></div>` +
          `</div></a>`;
      }).join('');

      const subHeading = sub ? `<h3 class="sc-subcat">${escHtml(sub)}</h3>` : '';
      return `<div class="sc-subcategory">${subHeading}<div class="sc-grid">${cardsHtml}</div></div>`;
    }).join('');

    return `<section class="sc-category"><h2 class="sc-cat">${escHtml(cat)}</h2>${subHtml}</section>`;
  }).join('');

  const bodyHtml = `<span data-is-showcase="1" style="display:none"></span>
<style>
  #content-wrap { max-width: none !important; padding: 24px 32px !important; }
  .sc-header { display:flex; align-items:baseline; gap:1rem; margin-bottom:2rem; padding-bottom:1rem; border-bottom:1px solid var(--border); }
  .sc-header h1 { font-size:1.5rem; font-weight:600; color:var(--text-heading); }
  .sc-header .sc-count { font-size:0.85rem; color:var(--text-muted); }
  .sc-category { margin-bottom:3rem; }
  .sc-cat { font-size:1.2rem; font-weight:700; color:var(--text-heading); margin-bottom:1rem; padding-left:0.75rem; border-left:3px solid var(--accent); }
  .sc-subcategory { margin-bottom:1.5rem; }
  .sc-subcat { font-size:0.85rem; font-weight:600; text-transform:uppercase; letter-spacing:0.07em; color:var(--text-muted); margin-bottom:0.75rem; }
  .sc-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(210px,1fr)); gap:1rem; }
  .sc-card { display:flex; flex-direction:column; background:var(--bg-sidebar); border:1px solid var(--border); border-radius:8px; overflow:hidden; text-decoration:none; color:inherit; transition:transform 0.15s,box-shadow 0.15s,background 0.15s; }
  .sc-card:hover { transform:translateY(-2px); box-shadow:0 6px 24px rgba(0,0,0,0.4); background:var(--bg-hover); }
  .sc-card img { width:100%; aspect-ratio:4/3; object-fit:cover; display:block; background:var(--border); }
  .sc-caption { padding:0.6rem 0.7rem 0.7rem; display:flex; flex-direction:column; gap:0.2rem; }
  .sc-title { font-size:0.82rem; font-weight:500; text-transform:capitalize; line-height:1.35; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
  .sc-meta { font-size:0.7rem; color:var(--text-muted); margin-top:auto; }
  .read-caption { font-size:0.68rem; color:var(--text-muted); min-height:1em; }
  .read-caption.never-read { color:#f38ba8; }
</style>
<div class="sc-header"><h1>Showcase</h1><span class="sc-count">${totalCount} article${totalCount !== 1 ? 's' : ''}</span></div>
<main>${sectionsHtml}</main>`;

  const templatePath = path.join(__dirname, '../templates/page.html');
  const template = await fs.readFile(templatePath, 'utf-8');

  const html = template
    .replace(/{{TITLE}}/g, 'Showcase')
    .replace(/{{BODY}}/g, bodyHtml)
    .replace(/{{ROOT_PREFIX}}/g, './')
    .replace(/{{VAULT_NAME}}/g, escHtml(vaultName))
    .replace(/{{VAULT_NAME_JSON}}/g, JSON.stringify(vaultName));

  const outPath = path.join(pair.output, 'Showcase.html');
  const tmp = outPath + '.tmp';
  await fs.writeFile(tmp, html, 'utf-8');
  await fs.rename(tmp, outPath);
}

module.exports = { generateShowcase };
