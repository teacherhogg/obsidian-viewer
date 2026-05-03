'use strict';

const path = require('path');
const fs = require('fs-extra');
const registry = require('./registry');
const { convertFile } = require('./converter');
const { regenerate } = require('./indexer');

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.ico']);

// Files whose basename should never be synced to output.
const SKIP_FILES = new Set(['Showcase Summary.md', 'Showcase.html']);
// Any file/dir whose path contains one of these folder names is excluded entirely.
const SKIP_FOLDER_SEGMENTS = new Set(['Sources']);
// These folder name segments are stripped from the output path (files are promoted up one level).
const TRANSPARENT_FOLDER_SEGMENTS = new Set(['Summaries']);

// Returns the output path for a file, applying skip and transparency rules.
// Returns null if the file should not be synced.
function toOutputPath(inputAbsPath, pair) {
  const rel = path.relative(pair.input, inputAbsPath);
  const parts = rel.split(path.sep);
  if (SKIP_FILES.has(parts[parts.length - 1])) return null;
  if (parts.some(p => SKIP_FOLDER_SEGMENTS.has(p))) return null;
  const filtered = parts.filter(p => !TRANSPARENT_FOLDER_SEGMENTS.has(p));
  return path.join(pair.output, ...filtered);
}

// Returns true if this directory should be skipped entirely (transparent or excluded).
function shouldSkipDir(inputAbsPath, pair) {
  const rel = path.relative(pair.input, inputAbsPath);
  const parts = rel.split(path.sep);
  const name = parts[parts.length - 1];
  return TRANSPARENT_FOLDER_SEGMENTS.has(name) || parts.some(p => SKIP_FOLDER_SEGMENTS.has(p));
}

async function handleAdd(inputAbsPath, pair) {
  const outputAbsPath = toOutputPath(inputAbsPath, pair);
  if (!outputAbsPath) return;
  await fs.ensureDir(path.dirname(outputAbsPath));

  if (inputAbsPath.endsWith('.md')) {
    const noteName = path.basename(inputAbsPath, '.md');
    registry.register(noteName, outputAbsPath.replace(/\.md$/, '.html'), pair.index);
    await convertFile(inputAbsPath, outputAbsPath.replace(/\.md$/, '.html'), pair.output, pair.name);
  } else {
    const ext = path.extname(inputAbsPath).toLowerCase();
    if (IMAGE_EXTS.has(ext)) {
      registry.registerImage(path.basename(inputAbsPath), outputAbsPath, pair.index);
    }
    await fs.copy(inputAbsPath, outputAbsPath, { overwrite: true });
  }
}

async function handleChange(inputAbsPath, pair) {
  const outputAbsPath = toOutputPath(inputAbsPath, pair);
  if (!outputAbsPath) return;
  if (inputAbsPath.endsWith('.md')) {
    await convertFile(inputAbsPath, outputAbsPath.replace(/\.md$/, '.html'), pair.output, pair.name);
  } else {
    await fs.copy(inputAbsPath, outputAbsPath, { overwrite: true });
  }
}

async function handleUnlink(inputAbsPath, pair) {
  const outputAbsPath = toOutputPath(inputAbsPath, pair);
  if (!outputAbsPath) return;
  if (inputAbsPath.endsWith('.md')) {
    const noteName = path.basename(inputAbsPath, '.md');
    registry.unregister(noteName);
    await fs.remove(outputAbsPath.replace(/\.md$/, '.html'));
  } else {
    await fs.remove(outputAbsPath);
  }
  await regenerate(pair.output, pair.name);
}

async function handleAddDir(inputAbsPath, pair) {
  if (shouldSkipDir(inputAbsPath, pair)) {
    // Remove any stale output directory at the non-stripped path so files don't appear twice.
    const rel = path.relative(pair.input, inputAbsPath);
    await fs.remove(path.join(pair.output, rel)).catch(() => {});
    return;
  }
  const outputAbsPath = toOutputPath(inputAbsPath, pair);
  if (!outputAbsPath) return;
  await fs.ensureDir(outputAbsPath);
  await regenerate(pair.output, pair.name);
}

async function handleUnlinkDir(inputAbsPath, pair) {
  if (shouldSkipDir(inputAbsPath, pair)) return;
  const outputAbsPath = toOutputPath(inputAbsPath, pair);
  if (!outputAbsPath) return;
  await fs.remove(outputAbsPath);
  await regenerate(pair.output, pair.name);
}

module.exports = { handleAdd, handleChange, handleUnlink, handleAddDir, handleUnlinkDir, toOutputPath };
