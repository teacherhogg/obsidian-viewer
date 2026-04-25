'use strict';

const chokidar = require('chokidar');
const { regenerate } = require('./indexer');
const { handleAdd, handleChange, handleUnlink, handleAddDir, handleUnlinkDir } = require('./sync');
const { runScanIfDue } = require('./newfiles');

function buildIgnored(ignoreFolders) {
  // Match any path segment that exactly equals a folder in the ignore list.
  // This handles both dot-prefixed folders (.obsidian) and plain names (templates).
  return (filePath) => {
    const parts = filePath.split(/[/\\]/);
    return parts.some(part => part && ignoreFolders.includes(part));
  };
}

function startWatcher(pair, ignoreFolders, newFilesDays) {
  const watcher = chokidar.watch(pair.input, {
    persistent: true,
    ignoreInitial: false,
    ignored: buildIgnored(ignoreFolders),
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
  });

  const queue = [];
  let processing = false;
  // During the initial scan we skip per-file nav regeneration; one bulk
  // regeneration happens after the 'ready' event instead.
  let initialScanDone = false;

  async function processQueue() {
    if (processing || queue.length === 0) return;
    processing = true;
    const { event, filePath } = queue.shift();
    try {
      switch (event) {
        case 'add':    await handleAdd(filePath, pair); break;
        case 'change': await handleChange(filePath, pair); break;
        case 'unlink': await handleUnlink(filePath, pair); break;
        case 'addDir': await handleAddDir(filePath, pair); break;
        case 'unlinkDir': await handleUnlinkDir(filePath, pair); break;
      }
      // Regenerate nav on every structural change after startup.
      // During initial scan, a single bulk regeneration runs after 'ready'.
      if (initialScanDone && (event === 'add' || event === 'change' || event === 'unlink' || event === 'unlinkDir')) {
        await runScanIfDue(pair.input, pair.output, newFilesDays);
        await regenerate(pair.output, pair.name);
      }
    } catch (err) {
      console.error(`[watcher:${pair.name}] Error on ${event} ${filePath}:`, err.message);
    }
    processing = false;
    processQueue();
  }

  function enqueue(event, filePath) {
    queue.push({ event, filePath });
    processQueue();
  }

  watcher
    .on('add',       fp => enqueue('add', fp))
    .on('change',    fp => enqueue('change', fp))
    .on('unlink',    fp => enqueue('unlink', fp))
    .on('addDir',    fp => enqueue('addDir', fp))
    .on('unlinkDir', fp => enqueue('unlinkDir', fp))
    .on('error',     err => console.error(`[watcher:${pair.name}] Error:`, err))
    .on('ready', async () => {
      // Wait for the queue to finish draining before declaring ready
      const waitForQueue = () => new Promise(resolve => {
        const check = () => (queue.length === 0 && !processing) ? resolve() : setTimeout(check, 100);
        check();
      });
      await waitForQueue();
      initialScanDone = true;
      await runScanIfDue(pair.input, pair.output, newFilesDays);
      await regenerate(pair.output, pair.name);
      console.log(`[watcher:${pair.name}] Initial sync complete, watching for changes`);
    });

  return watcher;
}

module.exports = { startWatcher };
