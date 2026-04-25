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

// Maps image filename (basename with extension) → { outputAbsPath, vaultIndex }
// Used by preprocessor to resolve ![[image.png]] to the correct relative path.
const imageRegistry = new Map();

function registerImage(fileName, outputAbsPath, vaultIndex) {
  const key = fileName.toLowerCase();
  if (!imageRegistry.has(key)) {
    imageRegistry.set(key, { outputAbsPath, vaultIndex });
  }
}

function unregisterImage(fileName) {
  imageRegistry.delete(fileName.toLowerCase());
}

function resolveImage(fileName) {
  return imageRegistry.get(fileName.toLowerCase()) || null;
}

function clearImages() {
  imageRegistry.clear();
}

module.exports = { register, unregister, resolve, clear, registerImage, unregisterImage, resolveImage, clearImages };
