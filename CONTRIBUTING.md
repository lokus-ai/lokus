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
| [Report a bug](https://github.com/CodeWithInferno/Lokus/issues/new?template=bug_report.yml) | [Request a feature](https://github.com/CodeWithInferno/Lokus/issues/new?template=feature_request.yml) | Check [`good first issue`](https://github.com/CodeWithInferno/Lokus/labels/good%20first%20issue) |

| 📖 **Documentation** | 🧪 **Testing** | 🎨 **Design** |
|:---:|:---:|:---:|
| Improve README, add tutorials, fix typos | Add test cases, improve test coverage | UI/UX improvements, themes, icons |
| Help others understand Lokus | Make the app more reliable | Make the app more beautiful |

### 🌟 Special Contribution Opportunities

- **🏷️ First-time contributors**: Look for [`good first issue`](https://github.com/CodeWithInferno/Lokus/labels/good%20first%20issue) labels
- **🆘 Help wanted**: Check [`help wanted`](https://github.com/CodeWithInferno/Lokus/labels/help%20wanted) for high-impact areas
- **🎃 Hacktoberfest**: During October, look for [`hacktoberfest`](https://github.com/CodeWithInferno/Lokus/labels/hacktoberfest) eligible issues
- **📸 Content creation**: Help create screenshots, videos, and demo content
- **🌍 Localization**: Help translate Lokus to other languages (coming soon)

### Before You Start

1. Check [existing issues](https://github.com/YOUR_USERNAME/lokus/issues) to see if your bug/feature has already been reported
2. Look at [open pull requests](https://github.com/YOUR_USERNAME/lokus/pulls) to avoid duplicate work
3. For large features, consider opening an [RFC discussion](https://github.com/YOUR_USERNAME/lokus/discussions) first

## 💻 Development Setup

### Prerequisites

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **Rust** (latest stable) - [Install via rustup](https://rustup.rs/)
- **Git** - [Download](https://git-scm.com/)

### Platform-specific Dependencies

#### Linux (Ubuntu/Debian)
```bash
sudo apt-get update
sudo apt-get install -y libgtk-3-dev libwebkit2gtk-4.0-dev libappindicator3-dev librsvg2-dev patchelf
```

#### macOS
```bash
xcode-select --install
```

#### Windows
Install [Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)

### Setup Steps

1. **Fork and clone**
   ```bash
   git clone https://github.com/YOUR_USERNAME/lokus.git
   cd lokus/lokus  # Note: navigate to the nested lokus directory
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run development server**
   ```bash
   npm run tauri dev
   ```

4. **Run tests** (in a new terminal)
   ```bash
   npm test              # Unit tests
   npm run test:e2e      # E2E tests
   ```

### Project Structure

```
lokus/
├── lokus/                    # Main application directory
│   ├── src/
│   │   ├── editor/           # TipTap editor components
│   │   │   ├── components/   # Editor UI components
│   │   │   ├── extensions/   # Custom TipTap extensions
│   │   │   └── lib/          # Editor utilities
│   │   ├── views/            # Main application views
│   │   ├── core/             # Core functionality
│   │   └── styles/           # Global styles
│   ├── src-tauri/            # Tauri backend (Rust)
│   ├── tests/
│   │   ├── unit/             # Unit tests (Vitest)
│   │   └── e2e/              # E2E tests (Playwright)
│   └── .github/              # CI/CD workflows
├── README.md                 # Project documentation
├── CONTRIBUTING.md           # This file
└── future.md                 # Development roadmap
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