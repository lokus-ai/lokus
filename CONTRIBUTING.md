# Contributing to Lokus

Thanks for helping improve Lokus! This project depends on community feedback, fixes, and documentation to keep moving quickly. The notes below outline how to get set up, what we expect from pull requests, and where to ask for help.

- [Code of Conduct](#code-of-conduct)
- [Ways to contribute](#ways-to-contribute)
- [Development setup](#development-setup)
- [Workflow](#workflow)
- [Testing checklist](#testing-checklist)
- [Documentation updates](#documentation-updates)
- [Need help?](#need-help)

---

## Code of Conduct

Participation in the Lokus community is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By contributing you agree to treat others with respect and to report unacceptable behaviour to the maintainers.

---

## Ways to contribute

- **Bug reports** – [Open an issue](https://github.com/lokus-ai/lokus/issues/new?template=bug_report.yml) with steps to reproduce and environment details.
- **Feature ideas** – Share proposals through [GitHub Discussions](https://github.com/lokus-ai/lokus/discussions) or the [feature request template](https://github.com/lokus-ai/lokus/issues/new?template=feature_request.yml).
- **Code & tests** – Fix bugs, add coverage, or introduce new functionality. Look for the `good first issue` and `help wanted` labels.
- **Documentation** – Improve onboarding guides, clarify features, and keep developer docs up to date.
- **Plugins & integrations** – Publish examples under `packages/` or add guides in `docs/`.

---

## Development setup

1. Fork the repository and clone your fork:
   ```bash
   git clone https://github.com/<your-user>/lokus.git
   cd lokus
   ```
2. Install dependencies (Node 20 LTS recommended):
   ```bash
   npm install
   ```
3. Make sure the Tauri toolchain is available:
   - Rust stable with `cargo`
   - Platform-specific dependencies (`brew install tauri-dev` on macOS, `apt install libwebkit2gtk-4.0-dev` on Ubuntu, Visual Studio Build Tools on Windows)
4. Run the app during development:
   ```bash
   npm run dev          # Vite web UI
   npm run tauri dev    # Desktop shell
   ```

Helpful references:

- [`docs/developer/getting-started.md`](docs/developer/getting-started.md) – architecture overview
- [`docs/BUILD_GUIDE.md`](docs/BUILD_GUIDE.md) – build matrix, packaging, signing

---

## Workflow

1. **Create a topic branch** from `main`: `git checkout -b feat/my-change`.
2. **Make small, focused commits.** Use present-tense messages (e.g. `Fix note import on Windows`).
3. **Keep PRs scoped.** If your change touches multiple areas, break it up when possible.
4. **Update documentation and tests** that relate to your change.
5. **Open a pull request** against `main` and fill in the provided template. Reference any related issues.
6. **Participate in review.** Be ready to discuss alternatives, add tests, or revise the implementation.

---

## Testing checklist

Before requesting review, try to run the checks that apply to your change:

```bash
npm test            # Unit tests (Vitest)
npm run test:e2e    # Playwright end-to-end suite
npm run build       # Ensure the web build still succeeds
```

> Some tests are still being stabilised. If a suite fails for reasons unrelated to your change, mention it in your PR with logs so maintainers can track the flake.

When new scripts or tooling are added, please update the relevant GitHub Actions workflow in [`.github/workflows/`](.github/workflows/) if required.

---

## Documentation updates

- Keep README content succinct and up to date when features change.
- Place feature walkthroughs, troubleshooting steps, or advanced guides in the appropriate section under `docs/`.
- When introducing new commands or configuration, update reference docs such as [`docs/ENVIRONMENT_VARIABLES.md`](docs/ENVIRONMENT_VARIABLES.md) or [`docs/MCP_INTEGRATION_GUIDE.md`](docs/MCP_INTEGRATION_GUIDE.md).
- Screenshots should live in `assets/screenshots/` and be referenced with relative paths.

---

## Need help?

- Ask quick questions in [Discord](https://discord.gg/lokus).
- Use [GitHub Discussions](https://github.com/lokus-ai/lokus/discussions) for design proposals or architecture topics.
- Tag maintainers in issues if something blocks you after checking existing docs and threads.

Thanks again for contributing!
