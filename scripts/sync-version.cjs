#!/usr/bin/env node
/**
 * Sync version from package.json to Cargo.toml
 *
 * Usage:
 *   npm run version:sync         - Sync current version to Cargo.toml
 *   npm run version:bump patch   - Bump patch version and sync
 *   npm run version:bump minor   - Bump minor version and sync
 *   npm run version:bump major   - Bump major version and sync
 */

const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const cargoTomlPath = path.join(__dirname, '..', 'src-tauri', 'Cargo.toml');

// Read package.json version
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;

console.log(`Syncing version: ${version}`);

// Update Cargo.toml
let cargoToml = fs.readFileSync(cargoTomlPath, 'utf8');
cargoToml = cargoToml.replace(
  /^version = ".*"$/m,
  `version = "${version}"`
);
fs.writeFileSync(cargoTomlPath, cargoToml);

console.log(`✓ Updated src-tauri/Cargo.toml to version ${version}`);
console.log('\nVersion synced! Tauri configs already read from package.json.');
