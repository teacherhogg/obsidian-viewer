'use strict';

const path = require('path');
const fs = require('fs-extra');
const registry = require('./registry');
const { convertFile } = require('./converter');
const { regenerate } = require('./indexer');

async function handleAdd(inputAbsPath, pair) {
  const outputAbsPath = toOutputPath(inputAbsPath, pair);
  await fs.ensureDir(path.dirname(outputAbsPath));

  if (inputAbsPath.endsWith('.md')) {
    const noteName = path.basename(inputAbsPath, '.md');
    registry.register(noteName, outputAbsPath.replace(/\.md$/, '.html'), pair.index);
    await convertFile(inputAbsPath, outputAbsPath.replace(/\.md$/, '.html'), pair.output);
  } else {
    await fs.copy(inputAbsPath, outputAbsPath, { overwrite: true });
  }
}

async function handleChange(inputAbsPath, pair) {
  if (inputAbsPath.endsWith('.md')) {
    const outputAbsPath = toOutputPath(inputAbsPath, pair).replace(/\.md$/, '.html');
    await convertFile(inputAbsPath, outputAbsPath, pair.output);
  } else {
    await fs.copy(inputAbsPath, toOutputPath(inputAbsPath, pair), { overwrite: true });
  }
}

async function handleUnlink(inputAbsPath, pair) {
  if (inputAbsPath.endsWith('.md')) {
    const noteName = path.basename(inputAbsPath, '.md');
    registry.unregister(noteName);
    const outputAbsPath = toOutputPath(inputAbsPath, pair).replace(/\.md$/, '.html');
    await fs.remove(outputAbsPath);
  } else {
    await fs.remove(toOutputPath(inputAbsPath, pair));
  }
  await regenerate(pair.output, pair.name);
}

async function handleAddDir(inputAbsPath, pair) {
  await fs.ensureDir(toOutputPath(inputAbsPath, pair));
  await regenerate(pair.output, pair.name);
}

async function handleUnlinkDir(inputAbsPath, pair) {
  await fs.remove(toOutputPath(inputAbsPath, pair));
  await regenerate(pair.output, pair.name);
}

function toOutputPath(inputAbsPath, pair) {
  const rel = path.relative(pair.input, inputAbsPath);
  return path.join(pair.output, rel);
}

module.exports = { handleAdd, handleChange, handleUnlink, handleAddDir, handleUnlinkDir };
