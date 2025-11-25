#!/usr/bin/env node

/**
 * macOS Build Script for Lokus
 * 
 * This script handles macOS-specific build operations including:
 * - Platform validation
 * - Dependency checks (Xcode, command line tools)
 * - Building the Tauri application for macOS
 * - Generating DMG installer
 * - Code signing and notarization preparation (stub)
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } from 'fs';
import { platform } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

/**
 * Load environment variables from .env.production
 */
function loadProductionEnv() {
  const envPath = join(PROJECT_ROOT, '.env.production');

  if (!existsSync(envPath)) {
    printColor('⚠️ .env.production not found, creating from .env...', 'yellow');
    const defaultEnvPath = join(PROJECT_ROOT, '.env');
    if (existsSync(defaultEnvPath)) {
      copyFileSync(defaultEnvPath, envPath);
    } else {
      printColor('⚠️ No .env file found either, skipping environment variable loading', 'yellow');
      return;
    }
  }

  try {
    const envContent = readFileSync(envPath, 'utf8');
    const envVars = {};

    // Parse .env file
    envContent.split('\n').forEach(line => {
      line = line.trim();
      if (line && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim();
          envVars[key.trim()] = value;
          // Set in process.env so child processes inherit them
          process.env[key.trim()] = value;
        }
      }
    });

    printColor('✅ Loaded environment variables from .env.production', 'green');
    if (isVerbose) {
      Object.keys(envVars).forEach(key => {
        // Don't print sensitive values
        const displayValue = key.includes('SECRET') || key.includes('PASSWORD')
          ? '***REDACTED***'
          : envVars[key];
        printColor(`  ${key}=${displayValue}`, 'cyan');
      });
    }
  } catch (error) {
    printColor(`⚠️ Failed to load .env.production: ${error.message}`, 'yellow');
  }
}

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
const skipCodeSigning = process.argv.includes('--skip-signing');

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
 * Validate that we're running on macOS
 */
function validatePlatform() {
  printSection('Platform Validation');
  
  if (platform() !== 'darwin') {
    printColor('❌ This script is designed to run on macOS only!', 'red');
    printColor(`Current platform: ${platform()}`, 'yellow');
    printColor('Use npm run build:windows or npm run build:linux for other platforms', 'cyan');
    process.exit(1);
  }
  
  printColor('✓ Running on macOS platform', 'green');
  
  // Check macOS version
  const osResult = executeCommand('sw_vers', 'Checking macOS version', { silent: true });
  if (osResult.success && isVerbose) {
    const lines = osResult.output.split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        printColor(`  ${line}`, 'cyan');
      }
    });
  }
}

/**
 * Check macOS-specific build prerequisites
 */
function checkPrerequisites() {
  printSection('Checking Build Prerequisites');
  
  let allGood = true;
  
  // Check for Xcode Command Line Tools
  const xcodeSelectResult = executeCommand('xcode-select -p', 'Checking Xcode Command Line Tools', { silent: true });
  if (!xcodeSelectResult.success) {
    printColor('✗ Xcode Command Line Tools not installed', 'red');
    printColor('  Please run: xcode-select --install', 'yellow');
    allGood = false;
  } else {
    printColor('✓ Xcode Command Line Tools installed', 'green');
    if (isVerbose) {
      printColor(`  Path: ${xcodeSelectResult.output}`, 'cyan');
    }
  }
  
  // Check for Xcode (optional but recommended)
  if (existsSync('/Applications/Xcode.app')) {
    printColor('✓ Xcode found', 'green');
    
    // Get Xcode version
    const xcodeVersionResult = executeCommand('xcodebuild -version', 'Checking Xcode version', { silent: true });
    if (xcodeVersionResult.success && isVerbose) {
      const versionLine = xcodeVersionResult.output.split('\n')[0];
      printColor(`  ${versionLine}`, 'cyan');
    }
  } else {
    printColor('! Xcode not found (optional but recommended)', 'yellow');
    printColor('  Install from Mac App Store for full development capabilities', 'cyan');
  }
  
  // Check for codesign tool
  const codesignResult = executeCommand('which codesign', 'Checking codesign tool', { silent: true });
  if (codesignResult.success) {
    printColor('✓ codesign tool available', 'green');
  } else {
    printColor('✗ codesign tool not found', 'red');
    allGood = false;
  }
  
  // Check for create-dmg (we'll install it if missing)
  const createDmgResult = executeCommand('which create-dmg', 'Checking create-dmg tool', { silent: true });
  if (createDmgResult.success) {
    printColor('✓ create-dmg tool found', 'green');
  } else {
    printColor('! create-dmg not found, will use Tauri\'s built-in DMG creation', 'yellow');
  }
  
  if (!allGood) {
    printColor('\n❌ Prerequisites check failed!', 'red');
    printColor('Please install the required tools:', 'yellow');
    printColor('  • Xcode Command Line Tools: xcode-select --install', 'cyan');
    printColor('  • Xcode (recommended): Install from Mac App Store', 'cyan');
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
    join(PROJECT_ROOT, 'src-tauri', 'target', 'debug'),
    join(PROJECT_ROOT, 'dist-macos')
  ];
  
  for (const target of cleanTargets) {
    if (existsSync(target)) {
      executeCommand(`rm -rf "${target}"`, `Cleaning ${target}`);
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
  const configFlag = '--config src-tauri/tauri.macos.conf.json';
  const buildCommand = isDebug 
    ? `tauri build --debug ${configFlag}` 
    : `tauri build ${configFlag}`;
  
  printColor(`Building in ${buildMode} mode...`, 'cyan');
  
  const buildResult = executeCommand(buildCommand, `Building Tauri application (${buildMode})`, {
    env: {
      // Set macOS-specific environment variables
      RUST_BACKTRACE: isVerbose ? '1' : '0',
      TAURI_PLATFORM: 'macos',
      TAURI_ARCH: process.arch,
      // Enable hardened runtime for notarization
      MACOSX_DEPLOYMENT_TARGET: '10.15'
    }
  });
  
  if (!buildResult.success) {
    printColor('❌ Tauri build failed!', 'red');
    printColor('\nTroubleshooting tips:', 'yellow');
    printColor('  • Check that Xcode Command Line Tools are installed', 'cyan');
    printColor('  • Ensure Rust is properly configured for macOS', 'cyan');
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
      path: join(PROJECT_ROOT, 'src-tauri', 'target', 'release', 'lokus'),
      description: 'Main executable'
    },
    {
      path: join(PROJECT_ROOT, 'src-tauri', 'target', 'release', 'bundle', 'dmg'),
      description: 'DMG installer directory'
    },
    {
      path: join(PROJECT_ROOT, 'src-tauri', 'target', 'release', 'bundle', 'macos'),
      description: 'macOS app bundle directory'
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
  const distDir = join(PROJECT_ROOT, 'dist-macos');
  
  // Create distribution directory
  if (!existsSync(distDir)) {
    mkdirSync(distDir, { recursive: true });
  }
  
  // Copy DMG installer
  const dmgDir = join(bundleDir, 'dmg');
  if (existsSync(dmgDir)) {
    executeCommand(`cp -R "${dmgDir}/"* "${distDir}/"`, 'Copying DMG installer');
    printColor('✓ DMG installer copied to dist-macos/', 'green');
  }
  
  // Copy app bundle
  const appDir = join(bundleDir, 'macos');
  if (existsSync(appDir)) {
    executeCommand(`cp -R "${appDir}/"* "${distDir}/"`, 'Copying app bundle');
    printColor('✓ App bundle copied to dist-macos/', 'green');
  }
  
  // Copy executable for direct execution
  const exePath = join(PROJECT_ROOT, 'src-tauri', 'target', 'release', 'lokus');
  if (existsSync(exePath)) {
    copyFileSync(exePath, join(distDir, 'lokus'));
    executeCommand(`chmod +x "${join(distDir, 'lokus')}"`, 'Making executable runnable');
    printColor('✓ Executable copied to dist-macos/', 'green');
  }
  
  // Create a simple run script
  const runScript = `#!/bin/bash
# Lokus Launch Script
DIR="$( cd "$( dirname "\${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Try to run the app bundle first
if [ -d "$DIR/Lokus.app" ]; then
    echo "Starting Lokus app bundle..."
    open "$DIR/Lokus.app"
elif [ -f "$DIR/lokus" ]; then
    echo "Starting Lokus executable..."
    "$DIR/lokus"
else
    echo "Error: Lokus application not found!"
    exit 1
fi
`;
  
  if (!isDryRun) {
    writeFileSync(join(distDir, 'run-lokus.sh'), runScript);
    executeCommand(`chmod +x "${join(distDir, 'run-lokus.sh')}"`, 'Making run script executable');
    printColor('✓ Launch script created', 'green');
  }
  
  return distDir;
}

/**
 * Prepare for code signing and notarization (stub implementation)
 */
function prepareCodeSigning() {
  printSection('Code Signing and Notarization Preparation');
  
  if (skipCodeSigning) {
    printColor('⏭ Code signing skipped (--skip-signing flag)', 'yellow');
    return;
  }
  
  printColor('📝 Code Signing & Notarization (Future Enhancement)', 'blue');
  printColor('  • Apple Developer Account required for distribution', 'cyan');
  printColor('  • Code signing certificate setup needed', 'cyan');
  printColor('  • Notarization process for macOS Gatekeeper', 'cyan');
  printColor('  • App Store Connect integration for Mac App Store', 'cyan');
  
  // Check for signing identity
  const identityResult = executeCommand('security find-identity -v -p codesigning', 'Checking signing identities', { silent: true });
  if (identityResult.success) {
    const identities = identityResult.output.split('\n').filter(line => 
      line.includes('Developer ID Application') || line.includes('Mac Developer')
    );
    
    if (identities.length > 0) {
      printColor('✓ Code signing identities found:', 'green');
      identities.forEach(identity => {
        printColor(`  ${identity.trim()}`, 'cyan');
      });
    } else {
      printColor('! No Developer ID code signing identities found', 'yellow');
      printColor('  Install certificates from Apple Developer Portal', 'cyan');
    }
  }
  
  // Check for notarytool (Xcode 13+) or altool (legacy)
  const notaryToolResult = executeCommand('which notarytool', 'Checking notarytool', { silent: true });
  if (notaryToolResult.success) {
    printColor('✓ notarytool found (Xcode 13+)', 'green');
  } else {
    const altoolResult = executeCommand('which altool', 'Checking altool', { silent: true });
    if (altoolResult.success) {
      printColor('✓ altool found (legacy notarization)', 'green');
    } else {
      printColor('! No notarization tools found', 'yellow');
    }
  }
  
  // Future enhancement placeholders
  printColor('\nNext Steps for Production:', 'blue');
  printColor('  1. Configure signing identity in tauri.macos.conf.json', 'cyan');
  printColor('  2. Set up App Store Connect API key for notarization', 'cyan');
  printColor('  3. Enable hardened runtime and proper entitlements', 'cyan');
  printColor('  4. Test notarization process with Apple', 'cyan');
}

/**
 * Print build summary
 */
function printBuildSummary(distDir) {
  printHeader('Build Summary');
  
  printColor('🎉 macOS build completed successfully!', 'green');
  
  printColor('\nBuild Outputs:', 'blue');
  printColor(`  📁 Distribution folder: ${distDir}`, 'cyan');
  printColor(`  💿 DMG Installer: ${distDir}/*.dmg`, 'cyan');
  printColor(`  📱 App Bundle: ${distDir}/Lokus.app`, 'cyan');
  printColor(`  🚀 Executable: ${distDir}/lokus`, 'cyan');
  printColor(`  📝 Launch script: ${distDir}/run-lokus.sh`, 'cyan');
  
  printColor('\nNext Steps:', 'blue');
  printColor('  • Test the application thoroughly on different macOS versions', 'cyan');
  printColor('  • Set up code signing for distribution outside Mac App Store', 'cyan');
  printColor('  • Configure notarization for Gatekeeper compatibility', 'cyan');
  printColor('  • Consider Mac App Store submission workflow', 'cyan');
  printColor('  • Set up automated distribution (GitHub Releases, etc.)', 'cyan');
  
  printColor('\nInstallation:', 'blue');
  printColor('  • Drag Lokus.app to Applications folder', 'cyan');
  printColor('  • Or run DMG installer for system-wide installation', 'cyan');
  printColor('  • For development: use run-lokus.sh script', 'cyan');
  
  if (isVerbose) {
    printColor('\nDevelopment Commands:', 'blue');
    printColor('  npm run dev:macos        - Start development mode', 'cyan');
    printColor('  npm run build:macos      - Build for macOS', 'cyan');
    printColor('  npm run check-platform   - Verify dependencies', 'cyan');
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
  printColor('  • Ensure Xcode Command Line Tools: xcode-select --install', 'cyan');
  printColor('  • Clean and rebuild: npm run clean && npm run build:macos', 'cyan');
  printColor('  • Visit Tauri docs: https://tauri.app/v1/guides/', 'cyan');
  
  process.exit(1);
}

/**
 * Main build function
 */
async function main() {
  try {
    printHeader('Lokus macOS Build Script');

    // Load environment variables FIRST (before any other steps)
    loadProductionEnv();

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
    handleError(error, 'macOS build process');
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
  printHeader('Lokus macOS Build Script Help');
  printColor('Usage: npm run build:macos [options]', 'cyan');
  printColor('\nOptions:', 'blue');
  printColor('  --verbose, -v      Show detailed output', 'cyan');
  printColor('  --dry-run          Show what would be executed without running', 'cyan');
  printColor('  --debug            Build in debug mode instead of release', 'cyan');
  printColor('  --skip-signing     Skip code signing preparation checks', 'cyan');
  printColor('  --help, -h         Show this help message', 'cyan');
  printColor('\nExamples:', 'blue');
  printColor('  npm run build:macos', 'cyan');
  printColor('  npm run build:macos -- --verbose', 'cyan');
  printColor('  npm run build:macos -- --debug --verbose', 'cyan');
  printColor('  npm run build:macos -- --skip-signing', 'cyan');
  process.exit(0);
}

// Run the build
main();