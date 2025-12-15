# Contributing to lokus-word-count

Thank you for your interest in contributing! This document provides guidelines for contributing to this plugin.

## Development Setup

1. Fork and clone the repository
2. Install dependencies: `npm install`
3. Start development server: `npm run dev`

## Development Workflow

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make your changes
3. Add tests for new functionality
4. Run tests: `npm test`
5. Run linting: `npm run lint`
6. Commit your changes: `git commit -am 'Add some feature'`
7. Push to the branch: `git push origin feature/your-feature`
8. Create a Pull Request

## Code Style

This project uses eslint for linting. Run `npm run lint` to check your code.

Code formatting is handled by prettier. Run `npm run format` to format your code.

## Testing

This project uses jest for testing. Please add tests for any new functionality.

## Release Process

1. Update version in `package.json` and `plugin.json`
2. Update `CHANGELOG.md`
3. Create a git tag: `git tag v0.1.0`
4. Push tag: `git push origin v0.1.0`
5. Publish to registry: `npm run publish`

## Questions?

Feel free to open an issue for any questions or concerns.