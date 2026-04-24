'use strict';

// Maps bare note name (no extension, no path) → { outputPath, vaultIndex }
// Used by preprocessor to resolve [[wikilinks]] to relative HTML paths.
const registry = new Map();

function register(noteName, outputAbsPath, vaultIndex) {
  const key = noteName.toLowerCase();
  if (registry.has(key) && registry.get(key).vaultIndex !== vaultIndex) {
    console.warn(`[registry] Duplicate note name "${noteName}" across vaults — using first match`);
    return;
  }
  registry.set(key, { outputAbsPath, vaultIndex });
}

function unregister(noteName) {
  registry.delete(noteName.toLowerCase());
}

function resolve(noteName) {
  return registry.get(noteName.toLowerCase()) || null;
}

function clear() {
  registry.clear();
}

module.exports = { register, unregister, resolve, clear };
