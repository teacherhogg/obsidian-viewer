'use strict';

const fs = require('fs-extra');
const path = require('path');
const { marked } = require('marked');
const { preprocess } = require('./preprocessor');

let pageTemplate = null;

function getTemplate() {
  if (!pageTemplate) {
    pageTemplate = fs.readFileSync(path.join(__dirname, '../templates/page.html'), 'utf8');
  }
  return pageTemplate;
}

// Allow template to be reloaded (useful for dev, and after first load)
function resetTemplate() {
  pageTemplate = null;
}

marked.setOptions({
  gfm: true,
  breaks: false,
});

async function convertFile(inputAbsPath, outputAbsPath, vaultOutputRoot, vaultName) {
  const mdContent = await fs.readFile(inputAbsPath, 'utf8');
  const { content, meta } = preprocess(mdContent, inputAbsPath, outputAbsPath);

  const bodyHtml = marked.parse(content);

  // Determine title: frontmatter title > first h1 in content > filename
  let title = meta.title;
  if (!title) {
    const h1 = bodyHtml.match(/<h1[^>]*>([^<]+)<\/h1>/);
    title = h1 ? h1[1] : path.basename(inputAbsPath, '.md');
  }

  // Depth from output root → used by sidebar JS to build correct path to _nav.json
  const depth = path.relative(vaultOutputRoot, path.dirname(outputAbsPath)).split(path.sep).filter(Boolean).length;
  const rootPrefix = depth === 0 ? './' : '../'.repeat(depth);

  const resolvedVaultName = vaultName || path.basename(vaultOutputRoot);
  const html = getTemplate()
    .replace(/{{TITLE}}/g, escapeHtml(title))
    .replace(/{{BODY}}/g, bodyHtml)
    .replace(/{{ROOT_PREFIX}}/g, rootPrefix)
    .replace(/{{VAULT_NAME}}/g, resolvedVaultName)
    .replace(/{{VAULT_NAME_JSON}}/g, JSON.stringify(resolvedVaultName));

  await fs.ensureDir(path.dirname(outputAbsPath));
  await fs.writeFile(outputAbsPath, html, 'utf8');
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

module.exports = { convertFile, resetTemplate };
