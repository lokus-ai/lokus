#!/usr/bin/env node

/**
 * Platform Detection and Dependency Checker for Lokus
 * 
 * This script detects the current platform and verifies that all required
 * dependencies are installed for building and developing Lokus.
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { platform, arch } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Platform detection
const PLATFORMS = {
  WINDOWS: 'win32',
  MACOS: 'darwin',
  LINUX: 'linux'
};

const currentPlatform = platform();
const currentArch = arch();
const isVerbose = process.argv.includes('--verbose') || process.argv.includes('-v');

/**
 * Print colored output to console
 */
function printColor(text, color = 'reset') {
}

/**
 * Print a header with styling
 */
function printHeader(text) {
  printColor(`\n${'='.repeat(50)}`, 'cyan');
  printColor(`${text}`, 'bright');
  printColor(`${'='.repeat(50)}`, 'cyan');
}

/**
 * Print a section header
 */
function printSection(text) {
  printColor(`\n${text}`, 'blue');
  printColor(`${'-'.repeat(text.length)}`, 'blue');
}

/**
 * Execute a command and return result
 */
function executeCommand(command, options = {}) {
  try {
    const result = execSync(command, { 
      encoding: 'utf8', 
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options 
    });
    return { success: true, output: result?.trim() };
  } catch (error) {
    return { 
      success: false, 
      error: error.message,
      output: error.stdout?.toString()?.trim() || ''
    };
  }
}

/**
 * Check if a command exists
 */
function commandExists(command) {
  const testCommand = currentPlatform === PLATFORMS.WINDOWS 
    ? `where ${command} 2>nul`
    : `which ${command} 2>/dev/null`;
  
  return executeCommand(testCommand, { silent: true }).success;
}

/**
 * Get version of a command
 */
function getVersion(command, versionFlag = '--version') {
  const result = executeCommand(`${command} ${versionFlag}`, { silent: true });
  if (result.success) {
    // Extract version number from output
    const versionMatch = result.output.match(/(\d+\.\d+\.\d+)/);
    return versionMatch ? versionMatch[1] : result.output.split('\n')[0];
  }
  return null;
}

/**
 * Check Node.js installation and version
 */
function checkNode() {
  printSection('Node.js Environment');
  
  if (!commandExists('node')) {
    printColor('✗ Node.js is not installed', 'red');
    printColor('  Please install Node.js from https://nodejs.org/', 'yellow');
    return false;
  }
  
  const nodeVersion = getVersion('node');
  printColor(`✓ Node.js: ${nodeVersion}`, 'green');
  
  if (!commandExists('npm')) {
    printColor('✗ npm is not installed', 'red');
    return false;
  }
  
  const npmVersion = getVersion('npm');
  printColor(`✓ npm: ${npmVersion}`, 'green');
  
  // Check if we're in the right directory
  if (!existsSync(join(PROJECT_ROOT, 'package.json'))) {
    printColor('✗ package.json not found in project root', 'red');
    return false;
  }
  
  printColor('✓ Project structure verified', 'green');
  return true;
}

/**
 * Check Rust installation
 */
function checkRust() {
  printSection('Rust Environment');
  
  if (!commandExists('rustc')) {
    printColor('✗ Rust is not installed', 'red');
    printColor('  Please install Rust from https://rustup.rs/', 'yellow');
    return false;
  }
  
  const rustVersion = getVersion('rustc');
  printColor(`✓ Rust: ${rustVersion}`, 'green');
  
  if (!commandExists('cargo')) {
    printColor('✗ Cargo is not installed', 'red');
    return false;
  }
  
  const cargoVersion = getVersion('cargo');
  printColor(`✓ Cargo: ${cargoVersion}`, 'green');
  
  return true;
}

/**
 * Check Tauri CLI
 */
function checkTauri() {
  printSection('Tauri Environment');
  
  if (!commandExists('tauri')) {
    printColor('✗ Tauri CLI is not installed', 'red');
    printColor('  Installing Tauri CLI...', 'yellow');
    
    const installResult = executeCommand('cargo install tauri-cli');
    if (!installResult.success) {
      printColor('✗ Failed to install Tauri CLI', 'red');
      printColor('  Please run: cargo install tauri-cli', 'yellow');
      return false;
    }
  }
  
  const tauriVersion = getVersion('tauri', '--version');
  printColor(`✓ Tauri CLI: ${tauriVersion}`, 'green');
  
  // Check if src-tauri directory exists
  if (!existsSync(join(PROJECT_ROOT, 'src-tauri'))) {
    printColor('✗ src-tauri directory not found', 'red');
    return false;
  }
  
  printColor('✓ Tauri project structure verified', 'green');
  return true;
}

/**
 * Check Windows-specific dependencies
 */
function checkWindowsDeps() {
  printSection('Windows Development Environment');
  
  let allGood = true;
  
  // Check for Visual Studio Build Tools
  const vsBuildToolsPaths = [
    'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\BuildTools',
    'C:\\Program Files (x86)\\Microsoft Visual Studio\\2022\\BuildTools',
    'C:\\Program Files\\Microsoft Visual Studio\\2019\\Community',
    'C:\\Program Files\\Microsoft Visual Studio\\2022\\Community',
    'C:\\Program Files\\Microsoft Visual Studio\\2019\\Professional',
    'C:\\Program Files\\Microsoft Visual Studio\\2022\\Professional'
  ];
  
  const hasVSBuildTools = vsBuildToolsPaths.some(path => existsSync(path));
  
  if (!hasVSBuildTools) {
    printColor('✗ Visual Studio Build Tools not found', 'red');
    printColor('  Please install Visual Studio Build Tools or Visual Studio Community', 'yellow');
    printColor('  Download from: https://visualstudio.microsoft.com/downloads/', 'yellow');
    allGood = false;
  } else {
    printColor('✓ Visual Studio Build Tools found', 'green');
  }
  
  // Check for Windows SDK
  if (commandExists('msbuild')) {
    printColor('✓ MSBuild available', 'green');
  } else {
    printColor('✗ MSBuild not found in PATH', 'red');
    allGood = false;
  }
  
  // Check for WebView2 (usually pre-installed on Windows 10/11)
  printColor('✓ WebView2 (assumed available on Windows 10/11)', 'green');
  
  return allGood;
}

/**
 * Check macOS-specific dependencies
 */
function checkMacOSDeps() {
  printSection('macOS Development Environment');
  
  let allGood = true;
  
  // Check for Xcode Command Line Tools
  if (!commandExists('xcode-select')) {
    printColor('✗ Xcode Command Line Tools not installed', 'red');
    printColor('  Please run: xcode-select --install', 'yellow');
    allGood = false;
  } else {
    const xcodeResult = executeCommand('xcode-select -p', { silent: true });
    if (xcodeResult.success) {
      printColor('✓ Xcode Command Line Tools installed', 'green');
      if (isVerbose) {
        printColor(`  Path: ${xcodeResult.output}`, 'cyan');
      }
    } else {
      printColor('✗ Xcode Command Line Tools not properly configured', 'red');
      printColor('  Please run: xcode-select --install', 'yellow');
      allGood = false;
    }
  }
  
  // Check for Xcode (optional but recommended)
  if (existsSync('/Applications/Xcode.app')) {
    printColor('✓ Xcode found', 'green');
  } else {
    printColor('! Xcode not found (optional for development)', 'yellow');
    printColor('  Install from Mac App Store for full iOS development', 'cyan');
  }
  
  // Check macOS version compatibility
  const osVersion = executeCommand('sw_vers -productVersion', { silent: true });
  if (osVersion.success) {
    printColor(`✓ macOS Version: ${osVersion.output}`, 'green');
    
    // Check if version is compatible (macOS 10.15+)
    const version = osVersion.output.split('.').map(Number);
    if (version[0] < 10 || (version[0] === 10 && version[1] < 15)) {
      printColor('✗ macOS version too old (requires 10.15+)', 'red');
      allGood = false;
    }
  }
  
  return allGood;
}

/**
 * Check Linux-specific dependencies
 */
function checkLinuxDeps() {
  printSection('Linux Development Environment');
  
  let allGood = true;
  
  // Check for essential build tools
  const requiredTools = ['gcc', 'g++', 'make'];
  
  for (const tool of requiredTools) {
    if (commandExists(tool)) {
      const version = getVersion(tool, '--version');
      printColor(`✓ ${tool}: ${version}`, 'green');
    } else {
      printColor(`✗ ${tool} not found`, 'red');
      allGood = false;
    }
  }
  
  // Check for pkg-config
  if (commandExists('pkg-config')) {
    printColor('✓ pkg-config available', 'green');
  } else {
    printColor('✗ pkg-config not found', 'red');
    printColor('  Please install: sudo apt-get install pkg-config (Ubuntu/Debian)', 'yellow');
    allGood = false;
  }
  
  // Check for development libraries commonly needed
  const libChecks = [
    'gtk+-3.0',
    'webkit2gtk-4.0'
  ];
  
  for (const lib of libChecks) {
    const result = executeCommand(`pkg-config --exists ${lib}`, { silent: true });
    if (result.success) {
      printColor(`✓ ${lib} found`, 'green');
    } else {
      printColor(`✗ ${lib} not found`, 'red');
      if (lib === 'gtk+-3.0') {
        printColor('  Please install: sudo apt-get install libgtk-3-dev (Ubuntu/Debian)', 'yellow');
      } else if (lib === 'webkit2gtk-4.0') {
        printColor('  Please install: sudo apt-get install libwebkit2gtk-4.0-dev (Ubuntu/Debian)', 'yellow');
      }
      allGood = false;
    }
  }
  
  return allGood;
}

/**
 * Check project dependencies
 */
function checkProjectDeps() {
  printSection('Project Dependencies');
  
  // Check if node_modules exists
  if (!existsSync(join(PROJECT_ROOT, 'node_modules'))) {
    printColor('✗ node_modules not found', 'red');
    printColor('  Please run: npm install', 'yellow');
    return false;
  }
  
  printColor('✓ node_modules found', 'green');
  
  // Check if Tauri is built
  const tauriTarget = join(PROJECT_ROOT, 'src-tauri', 'target');
  if (existsSync(tauriTarget)) {
    printColor('✓ Tauri build artifacts found', 'green');
  } else {
    printColor('! No previous Tauri builds found (normal for first run)', 'yellow');
  }
  
  return true;
}

/**
 * Print platform summary
 */
function printPlatformSummary() {
  printHeader('Platform Information');
  
  printColor(`Operating System: ${currentPlatform}`, 'cyan');
  printColor(`Architecture: ${currentArch}`, 'cyan');
  
  const platformName = {
    [PLATFORMS.WINDOWS]: 'Windows',
    [PLATFORMS.MACOS]: 'macOS',
    [PLATFORMS.LINUX]: 'Linux'
  }[currentPlatform] || 'Unknown';
  
  printColor(`Platform: ${platformName}`, 'cyan');
  
  if (isVerbose) {
    printColor(`Node.js Platform: ${process.platform}`, 'cyan');
    printColor(`Node.js Version: ${process.version}`, 'cyan');
    printColor(`Working Directory: ${process.cwd()}`, 'cyan');
    printColor(`Project Root: ${PROJECT_ROOT}`, 'cyan');
  }
}

/**
 * Print recommendations based on platform
 */
function printRecommendations() {
  printSection('Development Recommendations');
  
  switch (currentPlatform) {
    case PLATFORMS.WINDOWS:
      printColor('📝 Windows Development Tips:', 'blue');
      printColor('  • Use Windows Terminal or PowerShell for better experience', 'cyan');
      printColor('  • Consider using WSL2 for Linux compatibility', 'cyan');
      printColor('  • Visual Studio Code with Rust extensions recommended', 'cyan');
      break;
      
    case PLATFORMS.MACOS:
      printColor('📝 macOS Development Tips:', 'blue');
      printColor('  • Use Terminal.app or iTerm2', 'cyan');
      printColor('  • Install Homebrew for package management', 'cyan');
      printColor('  • Xcode for iOS development capabilities', 'cyan');
      break;
      
    case PLATFORMS.LINUX:
      printColor('📝 Linux Development Tips:', 'blue');
      printColor('  • Ensure all system dependencies are installed', 'cyan');
      printColor('  • Use your distribution\'s package manager', 'cyan');
      printColor('  • Consider AppImage for easier distribution', 'cyan');
      break;
  }
}

/**
 * Main execution function
 */
function main() {
  printHeader('Lokus Platform & Dependency Checker');
  
  printPlatformSummary();
  
  let allChecksPass = true;
  
  // Core checks
  allChecksPass &= checkNode();
  allChecksPass &= checkRust();
  allChecksPass &= checkTauri();
  allChecksPass &= checkProjectDeps();
  
  // Platform-specific checks
  switch (currentPlatform) {
    case PLATFORMS.WINDOWS:
      allChecksPass &= checkWindowsDeps();
      break;
    case PLATFORMS.MACOS:
      allChecksPass &= checkMacOSDeps();
      break;
    case PLATFORMS.LINUX:
      allChecksPass &= checkLinuxDeps();
      break;
    default:
      printColor(`⚠ Warning: Unsupported platform: ${currentPlatform}`, 'yellow');
      allChecksPass = false;
  }
  
  // Final summary
  printHeader('Summary');
  
  if (allChecksPass) {
    printColor('🎉 All checks passed! You\'re ready to develop Lokus.', 'green');
    printColor('\nQuick start commands:', 'blue');
    printColor('  npm run dev          - Start development server', 'cyan');
    printColor('  npm run tauri dev    - Start Tauri development', 'cyan');
    printColor('  npm run tauri build  - Build for production', 'cyan');
  } else {
    printColor('❌ Some checks failed. Please resolve the issues above.', 'red');
    printColor('\nFor help, visit:', 'blue');
    printColor('  • Tauri Docs: https://tauri.app/v1/guides/', 'cyan');
    printColor('  • Rust Installation: https://rustup.rs/', 'cyan');
    printColor('  • Node.js: https://nodejs.org/', 'cyan');
  }
  
  if (isVerbose) {
    printRecommendations();
  }
  
  process.exit(allChecksPass ? 0 : 1);
}

// Run the script
main();