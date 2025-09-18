#!/usr/bin/env node

/**
 * Linux Build Script for Lokus
 * 
 * This script handles Linux-specific build operations including:
 * - Platform validation
 * - Dependency checks (build-essential, GTK, WebKit)
 * - Building the Tauri application for Linux
 * - Generating AppImage, DEB, and RPM packages
 * - Distribution preparation
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } from 'fs';
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
const skipAppImage = process.argv.includes('--skip-appimage');

/**
 * Print colored output to console
 */
function printColor(text, color = 'reset') {
  console.log(`${colors[color]}${text}${colors.reset}`);
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
 * Detect Linux distribution
 */
function detectLinuxDistribution() {
  try {
    if (existsSync('/etc/os-release')) {
      const osRelease = readFileSync('/etc/os-release', 'utf8');
      const lines = osRelease.split('\n');
      const info = {};
      
      lines.forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
          info[key] = value.replace(/"/g, '');
        }
      });
      
      return {
        id: info.ID || 'unknown',
        name: info.NAME || 'Unknown Linux',
        version: info.VERSION_ID || '',
        pretty: info.PRETTY_NAME || info.NAME || 'Unknown Linux'
      };
    }
  } catch (error) {
    // Fallback detection methods
  }
  
  // Fallback to basic detection
  if (existsSync('/etc/debian_version')) {
    return { id: 'debian', name: 'Debian/Ubuntu', version: '', pretty: 'Debian-based Linux' };
  } else if (existsSync('/etc/redhat-release')) {
    return { id: 'rhel', name: 'RHEL/CentOS/Fedora', version: '', pretty: 'Red Hat-based Linux' };
  } else if (existsSync('/etc/arch-release')) {
    return { id: 'arch', name: 'Arch Linux', version: '', pretty: 'Arch Linux' };
  }
  
  return { id: 'unknown', name: 'Unknown', version: '', pretty: 'Unknown Linux Distribution' };
}

/**
 * Validate that we're running on Linux
 */
function validatePlatform() {
  printSection('Platform Validation');
  
  if (platform() !== 'linux') {
    printColor('❌ This script is designed to run on Linux only!', 'red');
    printColor(`Current platform: ${platform()}`, 'yellow');
    printColor('Use npm run build:windows or npm run build:macos for other platforms', 'cyan');
    process.exit(1);
  }
  
  printColor('✓ Running on Linux platform', 'green');
  
  // Detect and display Linux distribution
  const distro = detectLinuxDistribution();
  printColor(`Distribution: ${distro.pretty}`, 'cyan');
  if (isVerbose && distro.version) {
    printColor(`Version: ${distro.version}`, 'cyan');
  }
  
  return distro;
}

/**
 * Check command availability with package suggestions
 */
function checkCommand(command, packageSuggestions) {
  const result = executeCommand(`which ${command}`, `Checking for ${command}`, { silent: true });
  if (result.success) {
    printColor(`✓ ${command} found`, 'green');
    return true;
  } else {
    printColor(`✗ ${command} not found`, 'red');
    if (packageSuggestions) {
      printColor('  Install suggestions:', 'yellow');
      Object.entries(packageSuggestions).forEach(([distro, pkg]) => {
        printColor(`    ${distro}: ${pkg}`, 'cyan');
      });
    }
    return false;
  }
}

/**
 * Check Linux-specific build prerequisites
 */
function checkPrerequisites(distro) {
  printSection('Checking Build Prerequisites');
  
  let allGood = true;
  
  // Essential build tools
  const buildTools = [
    {
      command: 'gcc',
      packages: {
        'Ubuntu/Debian': 'sudo apt-get install build-essential',
        'Fedora/RHEL': 'sudo dnf install gcc gcc-c++ make',
        'Arch Linux': 'sudo pacman -S base-devel'
      }
    },
    {
      command: 'g++',
      packages: {
        'Ubuntu/Debian': 'sudo apt-get install build-essential',
        'Fedora/RHEL': 'sudo dnf install gcc gcc-c++ make',
        'Arch Linux': 'sudo pacman -S base-devel'
      }
    },
    {
      command: 'make',
      packages: {
        'Ubuntu/Debian': 'sudo apt-get install build-essential',
        'Fedora/RHEL': 'sudo dnf install make',
        'Arch Linux': 'sudo pacman -S base-devel'
      }
    },
    {
      command: 'pkg-config',
      packages: {
        'Ubuntu/Debian': 'sudo apt-get install pkg-config',
        'Fedora/RHEL': 'sudo dnf install pkgconf-devel',
        'Arch Linux': 'sudo pacman -S pkgconf'
      }
    }
  ];
  
  printColor('Essential build tools:', 'blue');
  buildTools.forEach(tool => {
    if (!checkCommand(tool.command, tool.packages)) {
      allGood = false;
    }
  });
  
  // Check for GTK3 development libraries
  printColor('\nGTK3 development libraries:', 'blue');
  const gtkResult = executeCommand('pkg-config --exists gtk+-3.0', 'Checking GTK3', { silent: true });
  if (gtkResult.success) {
    printColor('✓ GTK3 development libraries found', 'green');
  } else {
    printColor('✗ GTK3 development libraries not found', 'red');
    printColor('  Install suggestions:', 'yellow');
    printColor('    Ubuntu/Debian: sudo apt-get install libgtk-3-dev', 'cyan');
    printColor('    Fedora/RHEL: sudo dnf install gtk3-devel', 'cyan');
    printColor('    Arch Linux: sudo pacman -S gtk3', 'cyan');
    allGood = false;
  }
  
  // Check for WebKit2GTK
  printColor('\nWebKit2GTK libraries:', 'blue');
  const webkitResult = executeCommand('pkg-config --exists webkit2gtk-4.0', 'Checking WebKit2GTK', { silent: true });
  if (webkitResult.success) {
    printColor('✓ WebKit2GTK libraries found', 'green');
  } else {
    printColor('✗ WebKit2GTK libraries not found', 'red');
    printColor('  Install suggestions:', 'yellow');
    printColor('    Ubuntu/Debian: sudo apt-get install libwebkit2gtk-4.0-dev', 'cyan');
    printColor('    Fedora/RHEL: sudo dnf install webkit2gtk3-devel', 'cyan');
    printColor('    Arch Linux: sudo pacman -S webkit2gtk', 'cyan');
    allGood = false;
  }
  
  // Check for AppImage tools (optional)
  if (!skipAppImage) {
    printColor('\nAppImage tools (optional):', 'blue');
    const appImageTools = [
      {
        command: 'appimagetool',
        packages: {
          'All': 'Download from https://github.com/AppImage/AppImageKit/releases'
        }
      }
    ];
    
    appImageTools.forEach(tool => {
      checkCommand(tool.command, tool.packages);
    });
  }
  
  if (!allGood) {
    printColor('\n❌ Prerequisites check failed!', 'red');
    printColor('Please install the required development libraries:', 'yellow');
    printColor('\nQuick setup for common distributions:', 'blue');
    printColor('  Ubuntu/Debian:', 'cyan');
    printColor('    sudo apt-get update', 'cyan');
    printColor('    sudo apt-get install build-essential pkg-config libgtk-3-dev libwebkit2gtk-4.0-dev', 'cyan');
    printColor('  Fedora/RHEL:', 'cyan');
    printColor('    sudo dnf install gcc gcc-c++ make pkgconf-devel gtk3-devel webkit2gtk3-devel', 'cyan');
    printColor('  Arch Linux:', 'cyan');
    printColor('    sudo pacman -S base-devel gtk3 webkit2gtk', 'cyan');
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
    join(PROJECT_ROOT, 'dist-linux')
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
  const buildCommand = isDebug ? 'tauri build --debug' : 'tauri build';
  
  printColor(`Building in ${buildMode} mode...`, 'cyan');
  
  const buildResult = executeCommand(buildCommand, `Building Tauri application (${buildMode})`, {
    env: {
      // Set Linux-specific environment variables
      RUST_BACKTRACE: isVerbose ? '1' : '0',
      TAURI_PLATFORM: 'linux',
      TAURI_ARCH: process.arch,
      // Ensure GTK theme integration
      GTK_THEME: process.env.GTK_THEME || 'Adwaita'
    }
  });
  
  if (!buildResult.success) {
    printColor('❌ Tauri build failed!', 'red');
    printColor('\nTroubleshooting tips:', 'yellow');
    printColor('  • Check that all development libraries are installed', 'cyan');
    printColor('  • Ensure GTK3 and WebKit2GTK are properly configured', 'cyan');
    printColor('  • Try running: cargo clean && cargo build', 'cyan');
    printColor('  • Run with --verbose for more detailed output', 'cyan');
    printColor('  • Check library paths: ldconfig -p | grep gtk', 'cyan');
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
      path: join(PROJECT_ROOT, 'src-tauri', 'target', 'release', 'bundle'),
      description: 'Bundle directory'
    }
  ];
  
  // Check for common package formats
  const bundleDir = join(PROJECT_ROOT, 'src-tauri', 'target', 'release', 'bundle');
  const packageFormats = ['deb', 'rpm', 'appimage'];
  
  packageFormats.forEach(format => {
    const formatDir = join(bundleDir, format);
    if (existsSync(formatDir)) {
      expectedOutputs.push({
        path: formatDir,
        description: `${format.toUpperCase()} package directory`
      });
    }
  });
  
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
  const distDir = join(PROJECT_ROOT, 'dist-linux');
  
  // Create distribution directory
  if (!existsSync(distDir)) {
    mkdirSync(distDir, { recursive: true });
  }
  
  // Copy packages
  const packageFormats = ['deb', 'rpm', 'appimage'];
  
  packageFormats.forEach(format => {
    const formatDir = join(bundleDir, format);
    if (existsSync(formatDir)) {
      executeCommand(`cp -R "${formatDir}/"* "${distDir}/"`, `Copying ${format.toUpperCase()} packages`);
      printColor(`✓ ${format.toUpperCase()} packages copied to dist-linux/`, 'green');
    }
  });
  
  // Copy executable
  const exePath = join(PROJECT_ROOT, 'src-tauri', 'target', 'release', 'lokus');
  if (existsSync(exePath)) {
    copyFileSync(exePath, join(distDir, 'lokus'));
    executeCommand(`chmod +x "${join(distDir, 'lokus')}"`, 'Making executable runnable');
    printColor('✓ Executable copied to dist-linux/', 'green');
  }
  
  // Create a desktop entry file
  const desktopEntry = `[Desktop Entry]
Version=1.0
Type=Application
Name=Lokus
Comment=Modern note-taking and knowledge management application
Exec=${join(distDir, 'lokus')}
Icon=lokus
Terminal=false
Categories=Office;TextEditor;
StartupWMClass=lokus
MimeType=text/markdown;
`;
  
  if (!isDryRun) {
    writeFileSync(join(distDir, 'lokus.desktop'), desktopEntry);
    printColor('✓ Desktop entry file created', 'green');
  }
  
  // Create installation script
  const installScript = `#!/bin/bash
# Lokus Installation Script for Linux

set -e

INSTALL_DIR="/opt/lokus"
BIN_DIR="/usr/local/bin"
DESKTOP_DIR="/usr/share/applications"
ICON_DIR="/usr/share/icons/hicolor/256x256/apps"

echo "Installing Lokus..."

# Check for root privileges
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root (use sudo)"
    exit 1
fi

# Create installation directory
mkdir -p "$INSTALL_DIR"

# Copy executable
cp lokus "$INSTALL_DIR/"
chmod +x "$INSTALL_DIR/lokus"

# Create symlink in bin directory
ln -sf "$INSTALL_DIR/lokus" "$BIN_DIR/lokus"

# Install desktop entry
if [ -f "lokus.desktop" ]; then
    mkdir -p "$DESKTOP_DIR"
    cp lokus.desktop "$DESKTOP_DIR/"
    chmod 644 "$DESKTOP_DIR/lokus.desktop"
fi

# Update desktop database
if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database "$DESKTOP_DIR"
fi

echo "✓ Lokus installed successfully!"
echo "You can now run 'lokus' from anywhere or find it in your applications menu."
`;
  
  if (!isDryRun) {
    writeFileSync(join(distDir, 'install.sh'), installScript);
    executeCommand(`chmod +x "${join(distDir, 'install.sh')}"`, 'Making install script executable');
    printColor('✓ Installation script created', 'green');
  }
  
  // Create uninstall script
  const uninstallScript = `#!/bin/bash
# Lokus Uninstallation Script for Linux

set -e

INSTALL_DIR="/opt/lokus"
BIN_DIR="/usr/local/bin"
DESKTOP_DIR="/usr/share/applications"

echo "Uninstalling Lokus..."

# Check for root privileges
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root (use sudo)"
    exit 1
fi

# Remove files
rm -f "$BIN_DIR/lokus"
rm -f "$DESKTOP_DIR/lokus.desktop"
rm -rf "$INSTALL_DIR"

# Update desktop database
if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database "$DESKTOP_DIR"
fi

echo "✓ Lokus uninstalled successfully!"
`;
  
  if (!isDryRun) {
    writeFileSync(join(distDir, 'uninstall.sh'), uninstallScript);
    executeCommand(`chmod +x "${join(distDir, 'uninstall.sh')}"`, 'Making uninstall script executable');
    printColor('✓ Uninstallation script created', 'green');
  }
  
  return distDir;
}

/**
 * Create AppImage (if tools available)
 */
function createAppImage(distDir) {
  if (skipAppImage) {
    printColor('⏭ AppImage creation skipped (--skip-appimage flag)', 'yellow');
    return;
  }
  
  printSection('Creating AppImage');
  
  const appImageToolResult = executeCommand('which appimagetool', 'Checking for appimagetool', { silent: true });
  if (!appImageToolResult.success) {
    printColor('! appimagetool not found, skipping AppImage creation', 'yellow');
    printColor('  Download from: https://github.com/AppImage/AppImageKit/releases', 'cyan');
    return;
  }
  
  printColor('📝 AppImage Creation (Advanced)', 'blue');
  printColor('  • Requires proper directory structure setup', 'cyan');
  printColor('  • Icon and desktop file configuration needed', 'cyan');
  printColor('  • Consider using electron-builder or similar tools', 'cyan');
  printColor('  • AppImageUpdate integration for auto-updates', 'cyan');
}

/**
 * Print build summary
 */
function printBuildSummary(distDir, distro) {
  printHeader('Build Summary');
  
  printColor('🎉 Linux build completed successfully!', 'green');
  
  printColor('\nBuild Outputs:', 'blue');
  printColor(`  📁 Distribution folder: ${distDir}`, 'cyan');
  printColor(`  🚀 Executable: ${distDir}/lokus`, 'cyan');
  printColor(`  📦 DEB package: ${distDir}/*.deb (if available)`, 'cyan');
  printColor(`  📦 RPM package: ${distDir}/*.rpm (if available)`, 'cyan');
  printColor(`  🖥️ Desktop entry: ${distDir}/lokus.desktop`, 'cyan');
  printColor(`  📜 Install script: ${distDir}/install.sh`, 'cyan');
  printColor(`  📜 Uninstall script: ${distDir}/uninstall.sh`, 'cyan');
  
  printColor('\nInstallation Options:', 'blue');
  
  if (existsSync(join(distDir, 'lokus.deb'))) {
    printColor('  DEB Package (Ubuntu/Debian):', 'cyan');
    printColor(`    sudo dpkg -i ${distDir}/*.deb`, 'cyan');
    printColor(`    sudo apt-get install -f  # Fix dependencies if needed`, 'cyan');
  }
  
  if (existsSync(join(distDir, 'lokus.rpm'))) {
    printColor('  RPM Package (Fedora/RHEL):', 'cyan');
    printColor(`    sudo rpm -i ${distDir}/*.rpm`, 'cyan');
    printColor(`    # Or use dnf/yum for dependency resolution`, 'cyan');
  }
  
  printColor('  Manual Installation:', 'cyan');
  printColor(`    cd ${distDir}`, 'cyan');
  printColor(`    sudo ./install.sh`, 'cyan');
  
  printColor('  Direct Execution:', 'cyan');
  printColor(`    ${distDir}/lokus`, 'cyan');
  
  printColor('\nNext Steps:', 'blue');
  printColor('  • Test on different Linux distributions', 'cyan');
  printColor('  • Set up package repositories (PPA, AUR, etc.)', 'cyan');
  printColor('  • Consider Flatpak/Snap packaging', 'cyan');
  printColor('  • Create AppImage for universal distribution', 'cyan');
  printColor('  • Set up automated builds with GitHub Actions', 'cyan');
  
  if (isVerbose) {
    printColor('\nDevelopment Commands:', 'blue');
    printColor('  npm run dev:linux        - Start development mode', 'cyan');
    printColor('  npm run build:linux      - Build for Linux', 'cyan');
    printColor('  npm run check-platform   - Verify dependencies', 'cyan');
  }
  
  // Distribution-specific notes
  printColor(`\nNotes for ${distro.pretty}:`, 'blue');
  if (distro.id.includes('ubuntu') || distro.id.includes('debian')) {
    printColor('  • Use DEB packages for easy installation', 'cyan');
    printColor('  • Consider creating a PPA for easier distribution', 'cyan');
  } else if (distro.id.includes('fedora') || distro.id.includes('rhel') || distro.id.includes('centos')) {
    printColor('  • Use RPM packages for easy installation', 'cyan');
    printColor('  • Consider COPR repositories for distribution', 'cyan');
  } else if (distro.id.includes('arch')) {
    printColor('  • Consider creating an AUR package', 'cyan');
    printColor('  • Use the manual installation method', 'cyan');
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
  printColor('  • Ensure development libraries: see prerequisites above', 'cyan');
  printColor('  • Clean and rebuild: npm run clean && npm run build:linux', 'cyan');
  printColor('  • Check Tauri docs: https://tauri.app/v1/guides/', 'cyan');
  
  process.exit(1);
}

/**
 * Main build function
 */
async function main() {
  try {
    printHeader('Lokus Linux Build Script');
    
    const totalSteps = 9;
    let currentStep = 1;
    
    printStep(currentStep++, totalSteps, 'Validating platform');
    const distro = validatePlatform();
    
    printStep(currentStep++, totalSteps, 'Checking prerequisites');
    checkPrerequisites(distro);
    
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
    
    printStep(currentStep++, totalSteps, 'Creating AppImage (optional)');
    createAppImage(distDir);
    
    printBuildSummary(distDir, distro);
    
  } catch (error) {
    handleError(error, 'Linux build process');
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
  printHeader('Lokus Linux Build Script Help');
  printColor('Usage: npm run build:linux [options]', 'cyan');
  printColor('\nOptions:', 'blue');
  printColor('  --verbose, -v      Show detailed output', 'cyan');
  printColor('  --dry-run          Show what would be executed without running', 'cyan');
  printColor('  --debug            Build in debug mode instead of release', 'cyan');
  printColor('  --skip-appimage    Skip AppImage creation', 'cyan');
  printColor('  --help, -h         Show this help message', 'cyan');
  printColor('\nExamples:', 'blue');
  printColor('  npm run build:linux', 'cyan');
  printColor('  npm run build:linux -- --verbose', 'cyan');
  printColor('  npm run build:linux -- --debug --verbose', 'cyan');
  printColor('  npm run build:linux -- --skip-appimage', 'cyan');
  process.exit(0);
}

// Run the build
main();