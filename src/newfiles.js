'use strict';

const fs = require('fs-extra');
const path = require('path');

const META_FILE = '.new-files-meta.json';
const LIST_FILE = '_new_files.json';

async function shouldScan(outputDir) {
  try {
    const { lastScan } = await fs.readJson(path.join(outputDir, META_FILE));
    return Date.now() - lastScan > 24 * 60 * 60 * 1000;
  } catch {
    return true; // first run or missing/corrupt meta
  }
}

async function walk(dir, cb) {
  let entries;
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) await walk(full, cb);
    else if (e.isFile() && e.name.endsWith('.md')) await cb(full);
  }
}

async function runScanIfDue(inputDir, outputDir, daysThreshold) {
  if (!(await shouldScan(outputDir))) return;

  const cutoff = Date.now() - daysThreshold * 24 * 60 * 60 * 1000;
  const newPaths = [];

  await walk(inputDir, async mdPath => {
    const stat = await fs.stat(mdPath);
    // Use birthtime when available (non-zero), otherwise fall back to mtime
    const fileTime = stat.birthtimeMs > 0 ? stat.birthtimeMs : stat.mtimeMs;
    if (fileTime >= cutoff) {
      const rel = path.relative(inputDir, mdPath).replace(/\\/g, '/');
      newPaths.push(rel.replace(/\.md$/i, '.html'));
    }
  });

  await fs.writeJson(path.join(outputDir, LIST_FILE), newPaths, { spaces: 2 });
  await fs.writeJson(path.join(outputDir, META_FILE), { lastScan: Date.now() });
  console.log(`[newfiles] Scanned ${inputDir}: ${newPaths.length} file(s) within ${daysThreshold} days`);
}

module.exports = { runScanIfDue };
