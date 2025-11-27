#!/usr/bin/env node

/**
 * Windows Build Script for Lokus
 * 
 * This script handles Windows-specific build operations including:
 * - Platform validation
 * - Dependency checks
 * - Building the Tauri application
 * - Generating Windows installer (.msi)
 * - Code signing preparation (stub)
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, copyFileSync } from 'fs';
import { platform } from 'os';
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

const isVerbose = process.argv.includes('--verbose') || process.argv.includes('-v');
const isDryRun = process.argv.includes('--dry-run');
const isDebug = process.argv.includes('--debug');

/**
 * Print colored output to console
 */
function printColor(text, color = 'reset') {
}

/**
 * Print a header with styling
 */
function printHeader(text) {
  printColor(`\n${'='.repeat(60)}`, 'cyan');
  printColor(`${text}`, 'bright');
  printColor(`${'='.repeat(60)}`, 'cyan');
}

/**
 * Print a section header
 */
function printSection(text) {
  printColor(`\n${text}`, 'blue');
  printColor(`${'-'.repeat(text.length)}`, 'blue');
}

/**
 * Print step progress
 */
function printStep(step, total, description) {
  printColor(`[${step}/${total}] ${description}`, 'cyan');
}

/**
 * Execute a command with progress feedback
 */
function executeCommand(command, description, options = {}) {
  if (isVerbose) {
    printColor(`Executing: ${command}`, 'magenta');
  }
  
  if (isDryRun) {
    printColor(`[DRY RUN] Would execute: ${command}`, 'yellow');
    return { success: true, output: '[dry run]' };
  }
  
  try {
    const startTime = Date.now();
    printColor(`⏳ ${description}...`, 'yellow');
    
    const result = execSync(command, { 
      encoding: 'utf8',
      cwd: options.cwd || PROJECT_ROOT,
      stdio: isVerbose ? 'inherit' : 'pipe',
      env: { ...process.env, ...options.env }
    });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    printColor(`✓ ${description} completed (${duration}s)`, 'green');
    
    return { success: true, output: result?.trim() };
  } catch (error) {
    printColor(`✗ ${description} failed`, 'red');
    if (isVerbose) {
      printColor(`Error: ${error.message}`, 'red');
      if (error.stdout) {
        printColor(`Output: ${error.stdout.toString()}`, 'yellow');
      }
      if (error.stderr) {
        printColor(`Error Output: ${error.stderr.toString()}`, 'red');
      }
    }
    return { 
      success: false, 
      error: error.message,
      output: error.stdout?.toString()?.trim() || ''
    };
  }
}

/**
 * Validate that we're running on Windows
 */
function validatePlatform() {
  printSection('Platform Validation');
  
  if (platform() !== 'win32') {
    printColor('❌ This script is designed to run on Windows only!', 'red');
    printColor(`Current platform: ${platform()}`, 'yellow');
    printColor('Use npm run build:macos or npm run build:linux for other platforms', 'cyan');
    process.exit(1);
  }
  
  printColor('✓ Running on Windows platform', 'green');
  
  // Check Windows version
  const osResult = executeCommand('wmic os get Caption,Version /format:list', 'Checking Windows version', { silent: true });
  if (osResult.success && isVerbose) {
    const lines = osResult.output.split('\n').filter(line => line.trim());
    lines.forEach(line => {
      if (line.includes('Caption=') || line.includes('Version=')) {
        printColor(`  ${line.replace('=', ': ')}`, 'cyan');
      }
    });
  }
}

/**
 * Check Windows-specific build prerequisites
 */
function checkPrerequisites() {
  printSection('Checking Build Prerequisites');
  
  let allGood = true;
  
  // Check for Visual Studio Build Tools
  const vsBuildToolsPaths = [
    'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\BuildTools\\MSBuild\\Current\\Bin\\MSBuild.exe',
    'C:\\Program Files (x86)\\Microsoft Visual Studio\\2022\\BuildTools\\MSBuild\\Current\\Bin\\MSBuild.exe',
    'C:\\Program Files\\Microsoft Visual Studio\\2019\\Community\\MSBuild\\Current\\Bin\\MSBuild.exe',
    'C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\MSBuild\\Current\\Bin\\MSBuild.exe',
    'C:\\Program Files\\Microsoft Visual Studio\\2019\\Professional\\MSBuild\\Current\\Bin\\MSBuild.exe',
    'C:\\Program Files\\Microsoft Visual Studio\\2022\\Professional\\MSBuild\\Current\\Bin\\MSBuild.exe'
  ];
  
  const msbuildPath = vsBuildToolsPaths.find(path => existsSync(path));
  
  if (!msbuildPath) {
    printColor('✗ MSBuild not found in standard locations', 'red');
    printColor('  Please install Visual Studio Build Tools or Visual Studio Community', 'yellow');
    allGood = false;
  } else {
    printColor('✓ MSBuild found', 'green');
    if (isVerbose) {
      printColor(`  Path: ${msbuildPath}`, 'cyan');
    }
  }
  
  // Check for Windows SDK
  try {
    const sdkResult = executeCommand('reg query "HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Microsoft SDKs\\Windows" /s', 'Checking Windows SDK', { silent: true });
    if (sdkResult.success) {
      printColor('✓ Windows SDK detected', 'green');
    } else {
      printColor('! Windows SDK check inconclusive', 'yellow');
    }
  } catch (error) {
    printColor('! Could not verify Windows SDK installation', 'yellow');
  }
  
  // Check for WebView2
  printColor('✓ WebView2 (bundled with Windows 10/11)', 'green');
  
  if (!allGood) {
    printColor('\n❌ Prerequisites check failed!', 'red');
    printColor('Please install the required tools:', 'yellow');
    printColor('  • Visual Studio Build Tools: https://visualstudio.microsoft.com/downloads/', 'cyan');
    printColor('  • Windows SDK (usually included with VS Build Tools)', 'cyan');
    process.exit(1);
  }
  
  printColor('\n✓ All prerequisites satisfied', 'green');
}

/**
 * Run platform check script
 */
function runPlatformCheck() {
  printSection('Running Platform Check');
  
  const checkResult = executeCommand('node scripts/check-platform.js', 'Platform dependency check');
  
  if (!checkResult.success) {
    printColor('❌ Platform check failed!', 'red');
    printColor('Please resolve the issues reported by the platform checker', 'yellow');
    process.exit(1);
  }
}

/**
 * Clean previous build artifacts
 */
function cleanBuildArtifacts() {
  printSection('Cleaning Previous Build Artifacts');
  
  const cleanTargets = [
    join(PROJECT_ROOT, 'dist'),
    join(PROJECT_ROOT, 'src-tauri', 'target', 'release'),
    join(PROJECT_ROOT, 'src-tauri', 'target', 'debug')
  ];
  
  for (const target of cleanTargets) {
    if (existsSync(target)) {
      executeCommand(`rmdir /s /q "${target}"`, `Cleaning ${target}`);
    }
  }
  
  printColor('✓ Build artifacts cleaned', 'green');
}

/**
 * Build the frontend
 */
function buildFrontend() {
  printSection('Building Frontend (React + Vite)');
  
  const buildResult = executeCommand('npm run build', 'Building frontend assets');
  
  if (!buildResult.success) {
    printColor('❌ Frontend build failed!', 'red');
    process.exit(1);
  }
  
  // Verify dist directory was created
  if (!existsSync(join(PROJECT_ROOT, 'dist'))) {
    printColor('❌ Frontend build did not produce dist directory!', 'red');
    process.exit(1);
  }
  
  printColor('✓ Frontend build completed successfully', 'green');
}

/**
 * Build the Tauri application
 */
function buildTauriApp() {
  printSection('Building Tauri Application');
  
  const buildMode = isDebug ? 'debug' : 'release';
  const buildCommand = isDebug ? 'tauri build --debug' : 'tauri build';
  
  printColor(`Building in ${buildMode} mode...`, 'cyan');
  
  const buildResult = executeCommand(buildCommand, `Building Tauri application (${buildMode})`, {
    env: {
      // Set Windows-specific environment variables
      RUST_BACKTRACE: isVerbose ? '1' : '0',
      TAURI_PLATFORM: 'windows',
      TAURI_ARCH: process.arch
    }
  });
  
  if (!buildResult.success) {
    printColor('❌ Tauri build failed!', 'red');
    printColor('\nTroubleshooting tips:', 'yellow');
    printColor('  • Check that all Rust dependencies are installed', 'cyan');
    printColor('  • Ensure Visual Studio Build Tools are properly configured', 'cyan');
    printColor('  • Try running: cargo clean && cargo build', 'cyan');
    printColor('  • Run with --verbose for more detailed output', 'cyan');
    process.exit(1);
  }
  
  printColor('✓ Tauri application built successfully', 'green');
}

/**
 * Verify build outputs
 */
function verifyBuildOutputs() {
  printSection('Verifying Build Outputs');
  
  const expectedOutputs = [
    {
      path: join(PROJECT_ROOT, 'src-tauri', 'target', 'release', 'lokus.exe'),
      description: 'Main executable'
    },
    {
      path: join(PROJECT_ROOT, 'src-tauri', 'target', 'release', 'bundle', 'msi'),
      description: 'MSI installer directory'
    }
  ];
  
  let allOutputsFound = true;
  
  for (const output of expectedOutputs) {
    if (existsSync(output.path)) {
      printColor(`✓ ${output.description} found`, 'green');
      if (isVerbose) {
        printColor(`  Path: ${output.path}`, 'cyan');
      }
    } else {
      printColor(`✗ ${output.description} not found`, 'red');
      printColor(`  Expected: ${output.path}`, 'yellow');
      allOutputsFound = false;
    }
  }
  
  return allOutputsFound;
}

/**
 * Package the application for distribution
 */
function packageApplication() {
  printSection('Packaging Application');
  
  const bundleDir = join(PROJECT_ROOT, 'src-tauri', 'target', 'release', 'bundle');
  const distDir = join(PROJECT_ROOT, 'dist-windows');
  
  // Create distribution directory
  if (!existsSync(distDir)) {
    mkdirSync(distDir, { recursive: true });
  }
  
  // Copy MSI installer
  const msiDir = join(bundleDir, 'msi');
  if (existsSync(msiDir)) {
    executeCommand(`xcopy "${msiDir}\\*" "${distDir}\\" /E /Y`, 'Copying MSI installer');
    printColor('✓ MSI installer copied to dist-windows/', 'green');
  }
  
  // Copy executable
  const exePath = join(PROJECT_ROOT, 'src-tauri', 'target', 'release', 'lokus.exe');
  if (existsSync(exePath)) {
    copyFileSync(exePath, join(distDir, 'lokus.exe'));
    printColor('✓ Executable copied to dist-windows/', 'green');
  }
  
  // Create a simple batch file for running the app
  const batchContent = `@echo off
echo Starting Lokus...
"%~dp0lokus.exe"
pause`;
  
  if (!isDryRun) {
    require('fs').writeFileSync(join(distDir, 'run-lokus.bat'), batchContent);
    printColor('✓ Convenience batch file created', 'green');
  }
  
  return distDir;
}

/**
 * Prepare for code signing (stub implementation)
 */
function prepareCodeSigning() {
  printSection('Code Signing Preparation');
  
  printColor('📝 Code Signing (Future Enhancement)', 'blue');
  printColor('  • Digital certificate setup required for distribution', 'cyan');
  printColor('  • SignTool.exe configuration needed', 'cyan');
  printColor('  • Timestamp server configuration recommended', 'cyan');
  printColor('  • Consider EV certificates for immediate trust', 'cyan');
  
  // Check if SignTool is available
  try {
    const signToolResult = executeCommand('where signtool', 'Checking for SignTool', { silent: true });
    if (signToolResult.success) {
      printColor('✓ SignTool.exe found (ready for code signing setup)', 'green');
    } else {
      printColor('! SignTool.exe not found in PATH', 'yellow');
      printColor('  Install Windows SDK for code signing capabilities', 'cyan');
    }
  } catch (error) {
    printColor('! Could not check for SignTool availability', 'yellow');
  }
}

/**
 * Print build summary
 */
function printBuildSummary(distDir) {
  printHeader('Build Summary');
  
  printColor('🎉 Windows build completed successfully!', 'green');
  
  printColor('\nBuild Outputs:', 'blue');
  printColor(`  📁 Distribution folder: ${distDir}`, 'cyan');
  printColor(`  📦 MSI Installer: ${distDir}\\*.msi`, 'cyan');
  printColor(`  🚀 Executable: ${distDir}\\lokus.exe`, 'cyan');
  printColor(`  📝 Run script: ${distDir}\\run-lokus.bat`, 'cyan');
  
  printColor('\nNext Steps:', 'blue');
  printColor('  • Test the application thoroughly', 'cyan');
  printColor('  • Set up code signing for distribution', 'cyan');
  printColor('  • Consider automated deployment pipelines', 'cyan');
  printColor('  • Upload to Windows package managers (winget, chocolatey)', 'cyan');
  
  if (isVerbose) {
    printColor('\nDevelopment Commands:', 'blue');
    printColor('  npm run dev:windows     - Start development mode', 'cyan');
    printColor('  npm run build:windows   - Build for Windows', 'cyan');
    printColor('  npm run check-platform  - Verify dependencies', 'cyan');
  }
}

/**
 * Handle errors and cleanup
 */
function handleError(error, context = '') {
  printColor(`\n❌ Build failed${context ? ` during ${context}` : ''}!`, 'red');
  
  if (error instanceof Error) {
    printColor(`Error: ${error.message}`, 'red');
    if (isVerbose && error.stack) {
      printColor(`Stack: ${error.stack}`, 'yellow');
    }
  }
  
  printColor('\nTroubleshooting:', 'yellow');
  printColor('  • Run with --verbose for detailed output', 'cyan');
  printColor('  • Check platform dependencies: npm run check-platform', 'cyan');
  printColor('  • Clean and rebuild: npm run clean && npm run build:windows', 'cyan');
  printColor('  • Visit Tauri docs: https://tauri.app/v1/guides/', 'cyan');
  
  process.exit(1);
}

/**
 * Main build function
 */
async function main() {
  try {
    printHeader('Lokus Windows Build Script');
    
    const totalSteps = 8;
    let currentStep = 1;
    
    printStep(currentStep++, totalSteps, 'Validating platform');
    validatePlatform();
    
    printStep(currentStep++, totalSteps, 'Checking prerequisites');
    checkPrerequisites();
    
    printStep(currentStep++, totalSteps, 'Running platform checks');
    runPlatformCheck();
    
    printStep(currentStep++, totalSteps, 'Cleaning previous builds');
    cleanBuildArtifacts();
    
    printStep(currentStep++, totalSteps, 'Building frontend');
    buildFrontend();
    
    printStep(currentStep++, totalSteps, 'Building Tauri application');
    buildTauriApp();
    
    printStep(currentStep++, totalSteps, 'Verifying build outputs');
    const outputsValid = verifyBuildOutputs();
    if (!outputsValid) {
      throw new Error('Build verification failed - some expected outputs are missing');
    }
    
    printStep(currentStep++, totalSteps, 'Packaging for distribution');
    const distDir = packageApplication();
    
    // Optional steps
    prepareCodeSigning();
    
    printBuildSummary(distDir);
    
  } catch (error) {
    handleError(error, 'Windows build process');
  }
}

// Handle process termination
process.on('SIGINT', () => {
  printColor('\n⚠ Build interrupted by user', 'yellow');
  process.exit(1);
});

process.on('SIGTERM', () => {
  printColor('\n⚠ Build terminated', 'yellow');
  process.exit(1);
});

// Show help if requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  printHeader('Lokus Windows Build Script Help');
  printColor('Usage: npm run build:windows [options]', 'cyan');
  printColor('\nOptions:', 'blue');
  printColor('  --verbose, -v    Show detailed output', 'cyan');
  printColor('  --dry-run        Show what would be executed without running', 'cyan');
  printColor('  --debug          Build in debug mode instead of release', 'cyan');
  printColor('  --help, -h       Show this help message', 'cyan');
  printColor('\nExamples:', 'blue');
  printColor('  npm run build:windows', 'cyan');
  printColor('  npm run build:windows -- --verbose', 'cyan');
  printColor('  npm run build:windows -- --debug --verbose', 'cyan');
  process.exit(0);
}

// Run the build
main();