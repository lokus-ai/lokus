# Testing Suite

Lokus maintains a comprehensive testing suite with 17+ test files covering both unit and end-to-end (E2E) testing scenarios. The testing strategy ensures code quality, feature reliability, and maintains confidence during development and refactoring.

## Overview

The testing architecture follows modern JavaScript testing best practices with:
- **Unit Tests**: 9 test files covering individual components and utilities
- **End-to-End Tests**: 8 test files covering complete user workflows
- **Comprehensive Mocking**: Full Tauri API and browser API mocking
- **Continuous Integration**: Automated testing on every commit

## Testing Stack

### Core Testing Framework
- **[Vitest](https://vitest.dev/)** - Fast unit test runner with ESM support
- **[Playwright](https://playwright.dev/)** - Cross-browser E2E testing
- **[@testing-library/react](https://testing-library.com/docs/react-testing-library/intro/)** - Component testing utilities
- **[@testing-library/jest-dom](https://github.com/testing-library/jest-dom)** - Custom Jest matchers

### Testing Environment
- **jsdom** - Browser environment simulation for unit tests
- **Comprehensive mocking** - Tauri APIs, clipboard, and browser APIs
- **Hot reload testing** - Watch mode for development
- **Coverage reporting** - HTML, JSON, and text coverage reports

## Test Structure

### Unit Tests Location
```
src/
├── core/
│   ├── config/store.test.js
│   ├── theme/manager.test.js
│   ├── shortcuts/registry.test.js
│   ├── editor/live-settings.test.js
│   └── clipboard/shortcuts.test.js
├── components/
│   └── CommandPalette.test.jsx
└── utils/
    └── markdown.test.js
```

### E2E Tests Location
```
tests/
├── e2e/
│   ├── app-navigation.spec.js
│   ├── math-rendering.spec.js
│   ├── editor-functionality.spec.js
│   ├── preferences.spec.js
│   ├── markdown-paste.spec.js
│   └── file-operations.spec.js
├── unit/
│   ├── editor-utils.test.js
│   └── math.test.js
└── setup.js
```

## Test Configuration

### Vitest Configuration
```javascript
// vitest.config.js
{
  environment: 'jsdom',
  setupFiles: ['./tests/setup.js'],
  globals: true,
  css: true,
  testTimeout: 10000,
  coverage: {
    reporter: ['text', 'json', 'html'],
    exclude: ['node_modules/', 'tests/', 'src-tauri/']
  }
}
```

### Playwright Configuration
```javascript
// playwright.config.js
{
  testDir: './tests/e2e',
  timeout: 30000,
  use: {
    browserName: 'chromium',
    headless: true,
    screenshot: 'only-on-failure'
  }
}
```

## Mock Setup

### Tauri API Mocking
The test setup includes comprehensive mocking for Tauri APIs:

```javascript
// Global Tauri mocks
global.window.__TAURI_INTERNALS__ = {
  invoke: vi.fn()
}

global.window.__TAURI_METADATA__ = {
  currentWindow: { label: 'main' }
}
```

### Browser API Mocking
Essential browser APIs are mocked for consistent testing:

- **Clipboard API** - `navigator.clipboard.writeText/readText`
- **ResizeObserver** - For component resize monitoring
- **IntersectionObserver** - For scroll-based features
- **matchMedia** - For responsive design testing
- **CSS.supports** - For progressive enhancement features

## Unit Test Coverage

### Core Functionality Tests

#### Configuration Management (`store.test.js`)
- **Settings persistence** - Verify preferences save and load correctly
- **Default values** - Ensure proper fallbacks for missing settings
- **Schema validation** - Test configuration schema enforcement
- **Migration handling** - Test upgrade scenarios for settings format changes

#### Theme Management (`manager.test.js`)
- **Theme switching** - Verify light/dark theme transitions
- **Custom themes** - Test user-defined theme application
- **CSS variable updates** - Ensure proper CSS custom property updates
- **Theme persistence** - Verify theme selection survives app restarts

#### Shortcut Registry (`registry.test.js`)
- **Shortcut registration** - Test dynamic shortcut registration
- **Platform formatting** - Verify proper accelerator formatting (⌘ vs Ctrl)
- **Conflict detection** - Test duplicate shortcut prevention
- **Context sensitivity** - Ensure shortcuts work in appropriate contexts

#### Live Editor Settings (`live-settings.test.js`)
- **Real-time updates** - Test immediate editor appearance changes
- **Font rendering** - Verify font family and size changes
- **Color scheme updates** - Test foreground/background color changes
- **Performance validation** - Ensure settings changes don't cause performance issues

#### Clipboard Operations (`shortcuts.test.js`)
- **Copy/paste functionality** - Test standard clipboard operations
- **Format preservation** - Verify rich text and markdown preservation
- **Cross-platform behavior** - Test platform-specific clipboard handling
- **Error handling** - Test clipboard permission failures

### Component Tests

#### Command Palette (`CommandPalette.test.jsx`)
- **Keyboard navigation** - Test arrow key navigation through options
- **Search filtering** - Verify file and command search functionality
- **Command execution** - Test command invocation and callback handling
- **Recent files** - Test recent file tracking and display
- **File tree integration** - Verify proper file tree search and display

### Utility Tests

#### Markdown Processing (`markdown.test.js`)
- **Parsing accuracy** - Test markdown-to-HTML conversion
- **Extension support** - Verify tables, strikethrough, math extensions
- **Link processing** - Test wiki-link and standard link handling
- **Safety validation** - Ensure XSS protection in markdown rendering

## E2E Test Coverage

### Application Navigation (`app-navigation.spec.js`)
- **Route handling** - Test navigation between different application views
- **Sidebar toggling** - Verify file explorer show/hide functionality
- **Tab management** - Test opening, closing, and switching between tabs
- **Keyboard shortcuts** - Validate keyboard navigation throughout the app

### Math Rendering (`math-rendering.spec.js`)
- **Inline math** - Test `$equation$` rendering with KaTeX
- **Block math** - Test `$$equation$$` display math rendering
- **Complex equations** - Validate advanced mathematical notation
- **Error handling** - Test invalid LaTeX equation handling
- **Performance** - Ensure math rendering doesn't block UI

### Editor Functionality (`editor-functionality.spec.js`)
- **Text editing** - Test basic typing, deletion, and formatting
- **Markdown shortcuts** - Verify **bold**, *italic*, `code` shortcuts
- **Wiki links** - Test `[[link]]` creation and navigation
- **Auto-save** - Verify automatic content persistence
- **Undo/redo** - Test history management and restoration

### Preferences (`preferences.spec.js`)
- **Settings dialog** - Test preferences dialog opening and navigation
- **Live preview** - Verify real-time setting changes in editor
- **Persistence** - Test settings save and reload across sessions
- **Default restoration** - Test reset-to-defaults functionality
- **Validation** - Test input validation for settings fields

### Markdown Paste (`markdown-paste.spec.js`)
- **Rich text preservation** - Test pasting formatted content
- **URL conversion** - Test automatic link detection and formatting
- **Image handling** - Test image paste and embedding
- **Format detection** - Test automatic format recognition
- **Cleanup** - Test paste content sanitization

### File Operations (`file-operations.spec.js`)
- **File creation** - Test new file creation workflow
- **File opening** - Test file selection and opening
- **File saving** - Test manual and automatic file saving
- **File deletion** - Test file removal with confirmation
- **Folder operations** - Test folder creation and management

## Test Scripts

### Development Testing
```bash
# Run all unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with minimal output (for development)
npm run test:watch:silent

# Run tests with detailed output
npm run test:summary

# Show only test failures
npm run test:failures
```

### E2E Testing
```bash
# Run E2E tests headlessly
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui

# Run E2E tests in headed mode (visible browser)
npm run test:e2e:headed
```

### Development Workflow
```bash
# Run development server with concurrent testing
npm run dev:test
```

## Coverage Reporting

### Coverage Configuration
- **HTML reports** - Visual coverage reports with line-by-line highlighting
- **JSON output** - Machine-readable coverage data for CI/CD
- **Text summary** - Quick coverage overview in terminal
- **Exclusions** - Excludes test files, node_modules, and build artifacts

### Coverage Targets
- **Statements**: Aim for >90% statement coverage
- **Branches**: Aim for >85% branch coverage  
- **Functions**: Aim for >90% function coverage
- **Lines**: Aim for >90% line coverage

## Test Quality Standards

### Unit Test Guidelines
1. **Single responsibility** - Each test should verify one specific behavior
2. **Descriptive names** - Test names should clearly describe the expected behavior
3. **Arrange-Act-Assert** - Follow the AAA pattern for test structure
4. **Mock external dependencies** - Isolate units under test from external systems
5. **Test edge cases** - Include boundary conditions and error scenarios

### E2E Test Guidelines
1. **User-centric scenarios** - Tests should mirror real user workflows
2. **Stable selectors** - Use data-testid attributes for reliable element selection
3. **Minimal setup** - Keep test setup focused and efficient
4. **Error recovery** - Tests should handle and report failures gracefully
5. **Platform coverage** - Ensure tests work across supported platforms

## Continuous Integration

### GitHub Actions Integration
- **Automated testing** - All tests run on every pull request
- **Multi-platform testing** - Tests run on macOS, Windows, and Linux
- **Browser testing** - E2E tests run across multiple browser versions
- **Coverage reporting** - Coverage reports uploaded to external services

### Quality Gates
- **All tests must pass** - No PRs merged with failing tests
- **Coverage maintenance** - Coverage must not decrease significantly
- **Performance validation** - Tests include performance regression checks

## Debugging Tests

### Local Debugging
```bash
# Run specific test file
npx vitest run src/core/config/store.test.js

# Run tests with debugging output
npx vitest run --reporter=verbose

# Run E2E tests with browser visible
npx playwright test --headed

# Run E2E tests with debugging
npx playwright test --debug
```

### Common Issues and Solutions

**Test timeouts:**
- Increase `testTimeout` in vitest.config.js
- Check for unresolved promises in async tests
- Verify mock functions are properly configured

**Mock conflicts:**
- Clear mocks between tests with `vi.clearAllMocks()`
- Ensure global mocks don't interfere with specific test needs
- Check that Tauri API mocks are properly set up

**E2E test flakiness:**
- Use explicit waits instead of fixed delays
- Ensure proper test isolation and cleanup
- Verify test data doesn't conflict between tests

## Performance Testing

### Test Performance Monitoring
- **Test execution time** - Monitor individual test duration
- **Memory usage** - Track memory consumption during test runs
- **Parallel execution** - Optimize test parallelization for speed
- **CI/CD efficiency** - Minimize total testing time in pipelines

### Performance Test Categories
- **Component rendering** - Measure React component render times
- **Large file handling** - Test performance with large markdown files
- **Search functionality** - Validate search performance with many files
- **Memory leaks** - Detect and prevent memory leaks in long-running tests

## Related Documentation

- **[Development Setup](./development-setup.md)** - Setting up local development environment
- **[Contributing Guidelines](./contributing.md)** - How to contribute code and tests
- **[Code Quality](./code-quality.md)** - Code standards and quality tools
- **[Continuous Integration](./ci-cd.md)** - Build and deployment processes