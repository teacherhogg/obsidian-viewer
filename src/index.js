'use strict';

const fs = require('fs-extra');
const path = require('path');
const { loadConfig } = require('./config');
const registry = require('./registry');
const { startWatcher } = require('./watcher');
const { regenerate } = require('./indexer');

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.ico']);

async function main() {
  const { pairs, ignoreFolders, newFilesDays } = loadConfig();
  console.log(`[obsidian-viewer] Starting with ${pairs.length} vault pair(s)`);
  console.log(`[obsidian-viewer] Ignoring folders: ${ignoreFolders.join(', ')}`);

  for (const pair of pairs) {
    console.log(`[obsidian-viewer] Pair ${pair.index}: ${pair.input} → ${pair.output} (port ${pair.port})`);
    await fs.ensureDir(pair.output);
  }

  // Pre-populate registry by scanning all input dirs before any conversion.
  // This ensures wikilink resolution works correctly from the very first file processed.
  for (const pair of pairs) {
    await scanForNotes(pair.input, pair.output, pair.index, ignoreFolders);
  }

  // Start watchers; ignoreInitial:false causes them to emit 'add' for every
  // existing file, triggering the initial full sync.
  for (const pair of pairs) {
    startWatcher(pair, ignoreFolders, newFilesDays);
  }
}

async function scanForNotes(inputDir, outputDir, vaultIndex, ignoreFolders) {
  let entries;
  try {
    entries = await fs.readdir(inputDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (ignoreFolders.includes(entry.name)) continue;
    const absInput = path.join(inputDir, entry.name);
    if (entry.isDirectory()) {
      await scanForNotes(absInput, path.join(outputDir, entry.name), vaultIndex, ignoreFolders);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      const noteName = path.basename(entry.name, '.md');
      const outputAbsPath = path.join(outputDir, entry.name.replace(/\.md$/, '.html'));
      registry.register(noteName, outputAbsPath, vaultIndex);
    } else if (entry.isFile() && IMAGE_EXTS.has(path.extname(entry.name).toLowerCase())) {
      const outputAbsPath = path.join(outputDir, entry.name);
      registry.registerImage(entry.name, outputAbsPath, vaultIndex);
    }
  }
}

main().catch(err => {
  console.error('[obsidian-viewer] Fatal:', err);
  process.exit(1);
});
