'use strict';

const fs = require('fs-extra');
const path = require('path');

let indexTemplate = null;

function getTemplate() {
  if (!indexTemplate) {
    indexTemplate = fs.readFileSync(path.join(__dirname, '../templates/index.html'), 'utf8');
  }
  return indexTemplate;
}

const SKIP = new Set(['_nav.json', 'index.html', '_new_files.json']);
const MD_HIDDEN = /^\./; // skip dot files/dirs

async function buildTree(dir, rootDir, newFilesSet) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const children = [];

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (MD_HIDDEN.test(entry.name) || SKIP.has(entry.name)) continue;

    const absPath = path.join(dir, entry.name);
    const relPath = path.relative(rootDir, absPath);
    const relPathNorm = relPath.replace(/\\/g, '/');

    if (entry.isDirectory()) {
      const subChildren = await buildTree(absPath, rootDir, newFilesSet);
      const node = { name: entry.name, path: relPath, type: 'dir', children: subChildren };
      if (newFilesSet && subChildren.some(c => c.isNew)) node.isNew = true;
      children.push(node);
    } else if (entry.isFile()) {
      const node = { name: entry.name, path: relPath, type: 'file' };
      if (newFilesSet && newFilesSet.has(relPathNorm)) node.isNew = true;
      children.push(node);
    }
  }

  return children;
}

async function regenerate(vaultOutputRoot, vaultName) {
  let newFilesSet = null;
  try {
    const list = await fs.readJson(path.join(vaultOutputRoot, '_new_files.json'));
    newFilesSet = new Set(list.map(p => p.replace(/\\/g, '/')));
  } catch {
    // No new files data yet; proceed without marking
  }

  const tree = await buildTree(vaultOutputRoot, vaultOutputRoot, newFilesSet);
  const nav = { name: vaultName, path: '', type: 'dir', children: tree };

  await fs.writeFile(path.join(vaultOutputRoot, '_nav.json'), JSON.stringify(nav, null, 2), 'utf8');

  const html = getTemplate()
    .replace(/{{VAULT_NAME}}/g, escapeHtml(vaultName))
    .replace(/{{ROOT_PREFIX}}/g, './')
    .replace(/{{TITLE}}/g, escapeHtml(vaultName));

  await fs.writeFile(path.join(vaultOutputRoot, 'index.html'), html, 'utf8');
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

module.exports = { regenerate };
