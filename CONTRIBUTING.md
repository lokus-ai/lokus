# Contributing to Lokus 🤝

Thank you for your interest in contributing to Lokus! We welcome contributions from everyone, whether you're fixing bugs, adding features, improving documentation, or helping with community support.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Contributing Workflow](#contributing-workflow)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Release Process](#release-process)

## 📜 Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## 🚀 Getting Started

### Ways to Contribute

| 🐛 **Bug Reports** | ✨ **Feature Requests** | 💻 **Code Contributions** |
|:---:|:---:|:---:|
| Help us identify and fix issues | Suggest new features or improvements | Implement features, fix bugs, improve performance |
| [Report a bug](https://github.com/lokus-ai/lokus/issues/new?template=bug_report.yml) | [Request a feature](https://github.com/lokus-ai/lokus/issues/new?template=feature_request.yml) | Check [`good first issue`](https://github.com/lokus-ai/lokus/labels/good%20first%20issue) |

| 📖 **Documentation** | 🧪 **Testing** | 🎨 **Design** |
|:---:|:---:|:---:|
| Improve README, add tutorials, fix typos | Add test cases, improve test coverage | UI/UX improvements, themes, icons |
| Help others understand Lokus | Make the app more reliable | Make the app more beautiful |

### 🌟 Special Contribution Opportunities

- **🏷️ First-time contributors**: Look for [`good first issue`](https://github.com/lokus-ai/lokus/labels/good%20first%20issue) labels
- **🆘 Help wanted**: Check [`help wanted`](https://github.com/lokus-ai/lokus/labels/help%20wanted) for high-impact areas
- **🎃 Hacktoberfest**: During October, look for [`hacktoberfest`](https://github.com/lokus-ai/lokus/labels/hacktoberfest) eligible issues
- **📸 Content creation**: Help create screenshots, videos, and demo content
- **🌍 Localization**: Help translate Lokus to other languages (coming soon)

### Before You Start

1. Check [existing issues](https://github.com/YOUR_USERNAME/lokus/issues) to see if your bug/feature has already been reported
2. Look at [open pull requests](https://github.com/YOUR_USERNAME/lokus/pulls) to avoid duplicate work
3. For large features, consider opening an [RFC discussion](https://github.com/YOUR_USERNAME/lokus/discussions) first

## 💻 Development Setup

### Prerequisites Installation

#### 1. Install Rust and Cargo 🦀

**Option A: Using rustup (Recommended)**
```bash
# Install rustup (Rust installer)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Follow the on-screen instructions, then restart your terminal
# Verify installation
cargo --version
rustc --version
```

**Option B: Platform-specific installers**
- **Windows**: Download from [rustup.rs](https://rustup.rs/) or use:
  ```powershell
  winget install Rustlang.Rustup
  ```
- **macOS**: 
  ```bash
  brew install rustup-init
  rustup-init
  ```
- **Linux**: Use your package manager or rustup script above

#### 2. Install Node.js 📦

**Recommended: Use Node Version Manager**

**For macOS/Linux (nvm):**
```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Restart terminal, then install Node.js
nvm install 18
nvm use 18
nvm alias default 18
```

**For Windows (nvm-windows):**
1. Download from [nvm-windows releases](https://github.com/coreybutler/nvm-windows/releases)
2. Install and restart terminal
3. Run:
   ```cmd
   nvm install 18.17.0
   nvm use 18.17.0
   ```

**Alternative: Direct installation**
- Download from [nodejs.org](https://nodejs.org/) (LTS version 18+)

#### 3. Install Git 🌿
- **Windows**: [Git for Windows](https://gitforwindows.org/)
- **macOS**: `brew install git` or Xcode Command Line Tools
- **Linux**: `sudo apt install git` / `sudo yum install git`

### Platform-Specific Dependencies

#### 🐧 Linux (Ubuntu/Debian)
```bash
# Update package lists
sudo apt-get update

# Install Tauri dependencies
sudo apt-get install -y \
    libgtk-3-dev \
    libwebkit2gtk-4.0-dev \
    libappindicator3-dev \
    librsvg2-dev \
    patchelf \
    build-essential \
    curl \
    wget \
    file \
    libssl-dev \
    pkg-config

# For older Ubuntu versions, you might need:
# sudo apt-get install libwebkit2gtk-4.1-dev
```

#### 🐧 Linux (Fedora/RHEL/CentOS)
```bash
sudo dnf install -y \
    gtk3-devel \
    webkit2gtk4.0-devel \
    libappindicator-gtk3-devel \
    librsvg2-devel \
    openssl-devel \
    curl \
    wget \
    file
```

#### 🐧 Linux (Arch)
```bash
sudo pacman -S \
    webkit2gtk \
    gtk3 \
    libappindicator-gtk3 \
    librsvg \
    openssl \
    curl \
    wget \
    file
```

#### 🍎 macOS
```bash
# Install Xcode Command Line Tools
xcode-select --install

# If using Homebrew (recommended)
brew install pkg-config
```

#### 🪟 Windows
1. **Install Visual Studio Build Tools**:
   - Download [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022)
   - Install with "C++ build tools" workload
   - OR install full Visual Studio with C++ development tools

2. **Alternative: Install via winget**:
   ```powershell
   winget install Microsoft.VisualStudio.2022.BuildTools
   ```

### 🚀 Setup Steps

#### 1. Fork and Clone
```bash
# Fork the repository on GitHub first, then:
git clone https://github.com/YOUR_USERNAME/lokus.git
cd lokus

# Verify you're in the right directory
ls -la  # Should see package.json, src-tauri/, etc.
```

#### 2. Install Dependencies
```bash
# Install Node.js dependencies
npm install

# Verify Rust toolchain
cargo --version

# Install Tauri CLI (if not already installed)
npm install -g @tauri-apps/cli
# or locally: npm install @tauri-apps/cli
```

#### 3. Initial Build (Important!)
```bash
# Build Rust dependencies first (this can take 5-10 minutes on first run)
cargo build --manifest-path=src-tauri/Cargo.toml

# Or build via npm script
npm run tauri build --debug
```

#### 4. Run Development Server
```bash
# Start the development server
npm run tauri dev

# This will:
# 1. Start Vite dev server (React frontend)
# 2. Build and start Tauri app (Rust backend)
# 3. Open the desktop application
```

#### 5. Verify Installation
```bash
# In a new terminal, run tests to verify everything works
npm test              # Unit tests
npm run test:e2e      # E2E tests (may take a few minutes)
```

### 🚨 Common Installation Issues & Solutions

#### Rust/Cargo Issues

**"cargo: command not found"**
```bash
# Linux/macOS: Add Cargo to PATH (restart terminal after)
echo 'export PATH="$HOME/.cargo/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# Windows: Add to PATH in Environment Variables
# Path: %USERPROFILE%\.cargo\bin
```

**"linker `cc` not found" (Linux)**
```bash
# Ubuntu/Debian
sudo apt-get install build-essential

# Fedora/RHEL/CentOS
sudo dnf groupinstall "Development Tools"

# Arch Linux
sudo pacman -S base-devel
```

**Rust toolchain issues**
```bash
# Update Rust to latest stable
rustup update stable
rustup default stable

# Verify target is installed
rustup target list --installed

# Add targets for cross-compilation
rustup target add x86_64-pc-windows-msvc  # Windows
rustup target add x86_64-apple-darwin     # Intel Mac
rustup target add aarch64-apple-darwin    # Apple Silicon Mac
rustup target add x86_64-unknown-linux-gnu # Linux
```

#### Node.js Issues

**Version conflicts**
```bash
# Check Node version (should be 18+)
node --version
npm --version

# Clear npm cache if issues persist
npm cache clean --force

# Reset npm configuration
npm config delete prefix  # if using nvm
```

**Permission errors (Linux/macOS)**
```bash
# Fix npm permissions
sudo chown -R $(whoami) ~/.npm

# Alternative: Use nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
```

**Windows npm issues**
```powershell
# Run as Administrator if needed
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Clear npm cache
npm cache clean --force

# Check for long path support
git config --system core.longpaths true
```

#### Tauri-Specific Issues

**"webkit2gtk not found" (Linux)**
```bash
# Ubuntu/Debian 20.04
sudo apt-get install libwebkit2gtk-4.0-dev

# Ubuntu/Debian 22.04+
sudo apt-get install libwebkit2gtk-4.1-dev

# Fedora
sudo dnf install webkit2gtk4.0-devel

# Arch Linux
sudo pacman -S webkit2gtk
```

**"failed to run custom build command" (Windows)**
```powershell
# Ensure Visual Studio Build Tools are installed
winget install Microsoft.VisualStudio.2022.BuildTools

# Or install via Chocolatey
choco install visualstudio2022buildtools

# Verify MSVC is available
where cl.exe
```

**Apple Silicon (M1/M2) specific issues**
```bash
# Install Rosetta 2 for compatibility
softwareupdate --install-rosetta

# Use native ARM64 Node.js
arch -arm64 brew install node

# Check architecture
uname -m  # Should show arm64
```

**Build takes too long / runs out of memory**
```bash
# Limit parallel jobs globally
export CARGO_BUILD_JOBS=2

# Or set in ~/.cargo/config.toml:
mkdir -p ~/.cargo
cat > ~/.cargo/config.toml << EOF
[build]
jobs = 2

[net]
retry = 2
git-fetch-with-cli = true
EOF
```

#### Development Server Issues

**Port conflicts**
```bash
# Linux/macOS: Kill processes using default ports
sudo lsof -ti:1420 | xargs kill -9  # Tauri dev server
sudo lsof -ti:5173 | xargs kill -9  # Vite dev server

# Windows: Kill processes using default ports
netstat -ano | findstr :1420
taskkill /PID <PID> /F
netstat -ano | findstr :5173
taskkill /PID <PID> /F
```

**"Permission denied" errors**
```bash
# Linux: Install additional security libraries
sudo apt-get install libnss3-dev libatk-bridge2.0-dev libdrm2 libxss1 libgconf-2-4

# macOS: Grant Terminal/IDE full disk access
# System Preferences > Security & Privacy > Privacy > Full Disk Access

# Windows: Run as Administrator or adjust UAC settings
```

**WebView2 issues (Windows)**
```powershell
# Install WebView2 Runtime
winget install Microsoft.EdgeWebView2

# For development, install WebView2 SDK
winget install Microsoft.EdgeWebView2.SDK

# Check WebView2 version
Get-AppxPackage -Name "Microsoft.WebView2"
```

#### Platform-Specific Setup Verification

**Windows Setup Verification**
```powershell
# Check all required tools
node --version     # Should be 18+
npm --version      # Should be 8+
cargo --version    # Should be recent
rustc --version    # Should be recent
cl.exe            # Should show MSVC compiler
where tauri       # Should find Tauri CLI

# Test build environment
cargo check --manifest-path=src-tauri/Cargo.toml
```

**macOS Setup Verification**
```bash
# Check all required tools
node --version     # Should be 18+
npm --version      # Should be 8+
cargo --version    # Should be recent
rustc --version    # Should be recent
xcode-select -p    # Should show Xcode path
which tauri        # Should find Tauri CLI

# Check for Xcode Command Line Tools
xcrun --show-sdk-path

# Test build environment
cargo check --manifest-path=src-tauri/Cargo.toml
```

**Linux Setup Verification**
```bash
# Check all required tools
node --version          # Should be 18+
npm --version           # Should be 8+
cargo --version         # Should be recent
rustc --version         # Should be recent
pkg-config --version    # Should be available
which tauri             # Should find Tauri CLI

# Check GTK/WebKit libraries
pkg-config --exists gtk+-3.0 && echo "GTK3 OK"
pkg-config --exists webkit2gtk-4.0 && echo "WebKit2GTK OK"

# Test build environment
cargo check --manifest-path=src-tauri/Cargo.toml
```

### 🔧 Development Tools (Optional but Recommended)

```bash
# Install useful development tools
npm install -g:
  @tauri-apps/cli        # Tauri CLI tools
  typescript             # TypeScript support
  prettier               # Code formatting
  eslint                 # Linting

# Rust development tools
cargo install:
  cargo-watch           # Auto-rebuild on changes
  cargo-audit           # Security auditing
  cargo-outdated        # Check for outdated dependencies
```

### 🎯 Quick Verification Checklist

After setup, verify everything works:

- [ ] `node --version` shows v18+
- [ ] `npm --version` shows recent version
- [ ] `cargo --version` shows recent Rust version
- [ ] `npm install` completes without errors
- [ ] `npm run tauri dev` opens the application
- [ ] `npm test` passes all unit tests
- [ ] Application launches and basic functionality works

### 🧪 Cross-Platform Testing

#### Virtual Machine Setup

**Testing on Multiple Platforms**
```bash
# Use GitHub Actions for automated cross-platform testing
.github/workflows/test.yml

# Or set up local VMs:
# - Windows: Use VirtualBox with Windows 10/11 VM
# - macOS: Use UTM or Parallels (on Apple Silicon)
# - Linux: Use Docker containers or VirtualBox
```

**Docker Testing (Linux)**
```dockerfile
# Create Dockerfile for Linux testing
FROM ubuntu:22.04

RUN apt-get update && apt-get install -y \
    curl build-essential \
    libgtk-3-dev libwebkit2gtk-4.1-dev \
    libappindicator3-dev librsvg2-dev patchelf

# Install Node.js and Rust
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

WORKDIR /workspace
COPY . .
RUN npm install && npm run tauri build
```

**GitHub Actions Testing**
```yaml
# .github/workflows/cross-platform-test.yml
name: Cross-Platform Tests

on: [push, pull_request]

jobs:
  test:
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
        node-version: [18, 20]
    
    runs-on: ${{ matrix.os }}
    
    steps:
    - uses: actions/checkout@v3
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
    
    - name: Install Rust
      uses: actions-rs/toolchain@v1
      with:
        toolchain: stable
        
    - name: Install platform dependencies
      run: |
        if [ "$RUNNER_OS" == "Linux" ]; then
          sudo apt-get update
          sudo apt-get install -y libgtk-3-dev libwebkit2gtk-4.1-dev
        elif [ "$RUNNER_OS" == "macOS" ]; then
          # macOS dependencies
          echo "macOS setup complete"
        elif [ "$RUNNER_OS" == "Windows" ]; then
          # Windows dependencies
          echo "Windows setup complete"
        fi
      shell: bash
        
    - name: Install dependencies
      run: npm install
      
    - name: Run tests
      run: npm run test
      
    - name: Build application
      run: npm run tauri build
```

### 💡 Pro Tips

1. **First build is slow**: Initial Rust compilation takes 5-10 minutes. Subsequent builds are much faster.

2. **Use cargo-watch for Rust development**:
   ```bash
   cargo install cargo-watch
   cargo watch -x "build --manifest-path=src-tauri/Cargo.toml"
   ```

3. **IDE Setup**: We recommend VS Code with these extensions:
   - Rust Analyzer
   - Tauri
   - ES7+ React/Redux/React-Native snippets
   - Prettier
   - ESLint

4. **Development workflow**:
   ```bash
   # Terminal 1: Run dev server
   npm run tauri dev
   
   # Terminal 2: Run tests in watch mode
   npm run test:watch
   
   # Terminal 3: Available for git commands, etc.
   ```

5. **Platform-specific development tips**:
   ```bash
   # Windows: Use Windows Terminal for better experience
   # macOS: Use iTerm2 or Terminal.app
   # Linux: Use terminal of choice (gnome-terminal, konsole, etc.)
   
   # Enable Rust backtrace for debugging
   export RUST_BACKTRACE=1  # or "full" for detailed traces
   ```

6. **Cross-compilation setup**:
   ```bash
   # Add targets for building on different platforms
   rustup target add x86_64-pc-windows-msvc    # Windows
   rustup target add x86_64-apple-darwin       # Intel Mac
   rustup target add aarch64-apple-darwin      # Apple Silicon Mac
   rustup target add x86_64-unknown-linux-gnu  # Linux
   
   # Build for specific target
   cargo build --target x86_64-pc-windows-msvc
   ```

### 📁 Project Structure

```
lokus/
├── src/                      # Frontend source code
│   ├── components/           # Reusable React components
│   ├── views/                # Main application views
│   │   ├── Canvas.jsx        # Canvas/whiteboard view
│   │   ├── Workspace.jsx     # Main workspace
│   │   └── Preferences.jsx   # Settings/preferences
│   ├── editor/               # TipTap rich text editor
│   │   ├── components/       # Editor UI components
│   │   ├── extensions/       # Custom TipTap extensions
│   │   └── lib/              # Editor utilities & helpers
│   ├── core/                 # Core application logic
│   │   ├── canvas/           # Canvas management
│   │   ├── graph/            # Graph visualization
│   │   ├── theme/            # Theme management
│   │   └── wiki/             # Wiki-link functionality
│   ├── hooks/                # Custom React hooks
│   ├── styles/               # CSS and styling
│   └── App.jsx               # Main React component
├── src-tauri/                # Tauri backend (Rust)
│   ├── src/
│   │   ├── main.rs           # Main Rust entry point
│   │   ├── commands.rs       # Tauri commands (API)
│   │   └── lib.rs            # Rust library code
│   ├── Cargo.toml            # Rust dependencies
│   └── tauri.conf.json       # Tauri configuration
├── tests/                    # Test suites
│   ├── unit/                 # Unit tests (Vitest)
│   └── e2e/                  # E2E tests (Playwright)
├── public/                   # Static assets
├── .github/                  # CI/CD workflows
├── package.json              # Node.js dependencies & scripts
├── vite.config.js            # Vite bundler configuration
├── tailwind.config.js        # Tailwind CSS configuration
├── README.md                 # Project documentation
├── CONTRIBUTING.md           # This file
└── CLAUDE.md                 # Claude Code development guide
```

## 🔄 Contributing Workflow

1. **Create an issue** (if one doesn't exist)
   - For bugs: Use the [bug report template](https://github.com/YOUR_USERNAME/lokus/issues/new?template=bug_report.yml)
   - For features: Use the [feature request template](https://github.com/YOUR_USERNAME/lokus/issues/new?template=feature_request.yml)

2. **Fork the repository**
   ```bash
   gh repo fork YOUR_USERNAME/lokus --clone
   ```

3. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/issue-number-description
   ```

4. **Make your changes**
   - Write code following our [coding standards](#coding-standards)
   - Add tests for new functionality
   - Update documentation if needed

5. **Test your changes**
   ```bash
   npm test              # Unit tests
   npm run test:e2e      # E2E tests
   npm run tauri build   # Test build
   ```

6. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add amazing new feature"
   ```

7. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   gh pr create --title "feat: add amazing new feature" --body "Description of changes"
   ```

## 🎨 Coding Standards

### JavaScript/React

- **ES6+**: Use modern JavaScript features
- **React Hooks**: Prefer hooks over class components
- **JSX**: Use semantic HTML and proper accessibility attributes
- **Props**: Use TypeScript-style prop validation where possible

### Code Formatting

```bash
# We use Prettier and ESLint (run automatically on commit)
npm run lint          # Check linting
npm run lint:fix      # Fix auto-fixable issues
npm run format        # Format with Prettier
```

### Naming Conventions

- **Files**: `kebab-case.jsx` for components, `camelCase.js` for utilities
- **Components**: `PascalCase`
- **Variables/Functions**: `camelCase`
- **Constants**: `SCREAMING_SNAKE_CASE`
- **CSS Classes**: `kebab-case`

### Component Structure

```jsx
// Good component structure
import React, { useState, useEffect } from 'react';

const MyComponent = ({ prop1, prop2 }) => {
  // State
  const [state, setState] = useState(null);
  
  // Effects
  useEffect(() => {
    // Effect logic
  }, []);
  
  // Event handlers
  const handleClick = () => {
    // Handler logic
  };
  
  // Render
  return (
    <div className="my-component">
      {/* JSX content */}
    </div>
  );
};

export default MyComponent;
```

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add wiki link autocompletion
fix: resolve math rendering issue in tables
docs: update installation instructions
test: add e2e tests for preferences
refactor: improve editor extension architecture
perf: optimize file search performance
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`

## 🧪 Testing

### Unit Tests (Vitest)

- Test utilities and pure functions
- Test React components with React Testing Library
- Aim for >80% code coverage for new features

```bash
npm test                    # Run once
npm run test:watch          # Watch mode
npm run test:coverage       # With coverage report
```

### E2E Tests (Playwright)

- Test complete user workflows
- Test cross-platform compatibility
- Test critical user paths

```bash
npm run test:e2e           # Headless
npm run test:e2e:headed    # With browser window
npm run test:e2e:ui        # With Playwright UI
```

### Writing Tests

```javascript
// Unit test example
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MyComponent from './MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});

// E2E test example
import { test, expect } from '@playwright/test';

test('should create new note', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-testid="new-note"]');
  await expect(page.locator('.editor')).toBeVisible();
});
```

## 🔀 Pull Request Process

### Before Submitting

- [ ] Tests pass locally (`npm test && npm run test:e2e`)
- [ ] Code follows our style guidelines
- [ ] Self-review your code
- [ ] Add tests for new functionality
- [ ] Update documentation if needed
- [ ] Rebase on latest main branch

### PR Template

Our PR template will guide you through:
- **Description**: What changes were made and why
- **Type**: Feature, bug fix, documentation, etc.
- **Testing**: How the changes were tested
- **Screenshots**: For UI changes
- **Checklist**: Ensure all requirements are met

### Review Process

1. **Automated Checks**: CI/CD pipeline runs tests and builds
2. **Code Review**: Maintainers review code quality and design
3. **Testing**: Additional testing on different platforms
4. **Approval**: At least one maintainer approval required
5. **Merge**: Squash and merge to main branch

### After Merge

- PR branch will be automatically deleted
- Changes will be included in next release
- Consider contributing to release notes

## 📦 Release Process

### Versioning

We follow [Semantic Versioning](https://semver.org/):
- **MAJOR**: Breaking changes
- **MINOR**: New features (backwards compatible)
- **PATCH**: Bug fixes (backwards compatible)

### Release Workflow

1. **Version Bump**: Update version in `package.json`
2. **Changelog**: Update `CHANGELOG.md` with new features and fixes
3. **Tag**: Create git tag for version
4. **Build**: Automated builds for all platforms
5. **Release**: GitHub release with binaries
6. **Announcement**: Update community on new release

## 🎉 Recognition

Contributors are recognized in:
- **README**: Contributors section
- **Release Notes**: Feature contributions
- **All Contributors**: Comprehensive contribution recognition

## 📞 Getting Help

- **Questions**: [GitHub Discussions](https://github.com/YOUR_USERNAME/lokus/discussions)
- **Chat**: Join our Discord community
- **Issues**: [GitHub Issues](https://github.com/YOUR_USERNAME/lokus/issues)

## 📄 License

By contributing to Lokus, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Lokus! 🙏

*This document is living and will be updated as the project evolves.*