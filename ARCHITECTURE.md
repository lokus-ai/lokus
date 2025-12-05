# Lokus Architecture

## Overview

Lokus is a local-first, privacy-focused note-taking application built with Tauri and React. It emphasizes speed, extensibility, and user ownership of data.

## Directory Structure

### `src/core`
Contains the core logic and business rules of the application, independent of the UI.
- `config`: Configuration management.
- `editor`: Editor state and logic.
- `theme`: Theme management.
- `markdown`: Markdown processing and syntax configuration.
- `shortcuts`: Keyboard shortcut registry.
- `auth`: Authentication logic.
- `search`: Search functionality.

### `src/components`
Contains reusable UI components, organized by feature or function.
- `ui`: Generic UI components (buttons, inputs, etc.).
- `layout`: Layout components (sidebar, status bar).
- `editor`: Editor-specific components.
- `features`: Feature-specific components (search, file tree, etc.).
- `preferences`: Components for the Preferences view.
- `graph`: Graph view components.

### `src/views`
Top-level views that compose components to form complete screens.
- `Workspace.jsx`: The main application view.
- `Preferences.jsx`: The settings view.
- `Gmail.jsx`: Gmail integration view.

### `src-tauri`
Rust backend code for Tauri.

## Key Components

### Workspace (`src/views/Workspace.jsx`)
The central hub of the application. It manages the layout of panels (file tree, editor, graph, etc.) and coordinates interactions between them.
- Refactored into sub-components in `src/components/layout/workspace/` for better maintainability.

### Preferences (`src/views/Preferences.jsx`)
Manages user settings.
- Refactored into sub-components in `src/components/preferences/`.
- Each section (Appearance, Editor, etc.) is a separate component.

## Data Flow

- **State Management**: Uses React Context and local state for UI. Core logic often uses singleton stores or managers in `src/core`.
- **Persistence**: Settings are saved to disk via Tauri's file system APIs.
- **Events**: Uses Tauri's event system for communication between the backend and frontend, and for some cross-component communication.

## Design Principles

- **Modularity**: Components should be small, focused, and reusable.
- **Separation of Concerns**: UI logic should be separated from business logic where possible.
- **Performance**: Minimize re-renders and heavy computations on the main thread.
