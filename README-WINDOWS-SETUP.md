# Windows Development Setup for Lokus

This guide provides step-by-step instructions for setting up Lokus development environment on Windows.

## Prerequisites

1. **Visual Studio Build Tools 2022** with "Desktop development with C++" workload
2. **Node.js** (v18 or higher)
3. **Rust** (latest stable)

## Quick Start

After installing the prerequisites, simply run:

```cmd
START-DEV-NOW.bat
```

This batch file will:
- Automatically detect your Visual Studio installation
- Configure the MSVC environment
- Start the Tauri development server

## Manual Installation Steps

### 1. Install Visual Studio Build Tools

Download from: https://aka.ms/vs/17/release/vs_buildtools.exe

During installation, select:
- "Desktop development with C++" workload
- Windows 10/11 SDK

### 2. Install Node.js

Download from: https://nodejs.org/ (LTS version recommended)

### 3. Install Rust

Download from: https://rustup.rs/

### 4. Install Dependencies

```bash
npm install
```

## Common Issues

### "link.exe not found"

This occurs when Git's link.exe is found before MSVC's. Use `START-DEV-NOW.bat` which automatically sets up the correct environment.

### First Build Takes Long

The initial Rust compilation takes 5-10 minutes. Subsequent builds are much faster.

## Development Workflow

1. Start development: `START-DEV-NOW.bat`
2. Make changes - hot reload is enabled
3. Run tests: `npm test`
4. Build for production: `npm run tauri build`