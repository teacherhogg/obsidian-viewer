'use strict';

const path = require('path');
const matter = require('gray-matter');
const registry = require('./registry');

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.ico']);

function preprocess(mdContent, sourceAbsPath, outputAbsPath) {
  // Strip YAML frontmatter and extract metadata
  const parsed = matter(mdContent);
  let content = parsed.content;
  const meta = parsed.data || {};

  // Resolve [[wikilinks]] and ![[embeds]]
  content = content.replace(/!?\[\[([^\]]+)\]\]/g, (match, inner) => {
    const isEmbed = match.startsWith('!');
    // Split on | for aliases: [[Note|Alias]] or [[Note#heading|Alias]]
    const [rawTarget, alias] = inner.split('|').map(s => s.trim());
    // Strip heading anchors for file resolution: [[Note#heading]] → Note
    const [notePart, heading] = rawTarget.split('#');
    const noteName = notePart.trim();
    const ext = path.extname(noteName).toLowerCase();

    if (isEmbed) {
      if (IMAGE_EXTS.has(ext) || ext === '') {
        // ![[image.png]] or ![[image]] → img tag
        const imgName = noteName;
        let imgSrc;
        if (IMAGE_EXTS.has(ext)) {
          const resolved = registry.resolveImage(path.basename(imgName));
          if (resolved) {
            const rel = path.relative(path.dirname(outputAbsPath), resolved.outputAbsPath);
            imgSrc = rel.startsWith('.') ? rel : './' + rel;
          }
        }
        if (!imgSrc) imgSrc = `./${imgName}`;
        return `![${alias || imgName}](${imgSrc})`;
      }
      // ![[OtherNote]] → phase 2; emit a styled placeholder link
      const displayName = alias || noteName;
      const resolved = registry.resolve(noteName);
      const href = resolved
        ? relativeHref(outputAbsPath, resolved.outputAbsPath, heading)
        : `#unresolved-${slugify(noteName)}`;
      return `<blockquote class="transclusion"><a href="${href}">${escapeHtml(displayName)}</a> <span class="transclusion-note">(embedded note — click to open)</span></blockquote>`;
    }

    // Regular [[wikilink]]
    const displayName = alias || noteName;
    const resolved = registry.resolve(noteName);
    if (!resolved) {
      return `<span class="wikilink-unresolved" title="Note not found: ${escapeHtml(noteName)}">${escapeHtml(displayName)}</span>`;
    }
    const href = relativeHref(outputAbsPath, resolved.outputAbsPath, heading);
    return `[${displayName}](${href})`;
  });

  // ==highlights== → <mark>
  content = content.replace(/==([^=\n]+)==/g, '<mark>$1</mark>');

  // Standalone #tags (not inside code, not part of a heading)
  // Match #word at start of line or after whitespace, not preceded by #
  content = content.replace(/(^|(?<=\s))#([a-zA-Z][a-zA-Z0-9_/-]*)/gm, (match, pre, tag) => {
    return `${pre}<span class="tag">#${tag}</span>`;
  });

  return { content, meta };
}

function relativeHref(fromOutputAbs, toOutputAbs, heading) {
  // Change extension to .html
  const toHtml = toOutputAbs.replace(/\.md$/, '.html');
  const rel = path.relative(path.dirname(fromOutputAbs), toHtml);
  const href = rel.startsWith('.') ? rel : './' + rel;
  return heading ? `${href}#${slugify(heading)}` : href;
}

function slugify(text) {
  return text.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

module.exports = { preprocess };
