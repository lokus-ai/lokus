# Plugin Developer Experience - Issues Found

Testing the full plugin developer experience by attempting to build "File Stats Pro" plugin.

**Test Date:** December 17, 2025
**Working Directory:** `/Users/pratham/Desktop/Lokus/Plugin`

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 3 |
| Major | 4 |
| Minor | 3 |
| **Total** | **10** |

---

## Critical Issues

### Issue #1: CLI Tests Run in Watch Mode (BLOCKS)

**Command:** `npx lokus-plugin create file-stats-pro --skip-prompts`

**Problem:** During plugin creation, the CLI runs `vitest` without `--run` flag, causing it to stay in watch mode indefinitely and block the create process.

**Expected:** Tests should run once and exit.

**Fix:** Change `"test": "vitest"` to `"test": "vitest --run"` in generated `package.json`, OR run tests with `--run` flag during creation.

---

### Issue #6: Import Path Mismatch (TypeScript Fails)

**Problem:** The CLI generates code that imports from `@lokus/plugin-sdk`:

```typescript
import { PluginContext, Logger } from '@lokus/plugin-sdk';
```

But `package.json` has:

```json
"dependencies": {
  "lokus-plugin-sdk": "^1.0.0"
}
```

**Result:**
- `npx tsc --noEmit` fails with `TS2307: Cannot find module '@lokus/plugin-sdk'`
- esbuild succeeds because it strips type-only imports

**Additional Problem:** The PluginLoader's `transformPluginCode` only handles `lokus-plugin-sdk`:

```javascript
// Line 318 - Only handles lokus-plugin-sdk, NOT @lokus/plugin-sdk
code.replace(/import.*from\s+['"]lokus-plugin-sdk['"]/g, ...)
```

But CJS require handles both (line 266).

**Fix:** Either:
1. CLI should generate imports from `lokus-plugin-sdk` (not @lokus scope)
2. Or publish SDK as `@lokus/plugin-sdk` on npm
3. Or add path mapping to tsconfig.json

---

### Issue #8: No Rust Backend Extension API

**Problem:** Plugins cannot add Rust/Tauri backend commands. The plugin architecture is JavaScript-only.

**Impact:** Plugins cannot:
- Add new invoke commands
- Perform system-level operations
- Access native APIs not already exposed

**Example:** I tried to add a `get_file_stats` Rust command for the plugin, but realized a plugin developer cannot modify `src-tauri/src/lib.rs`.

**Required for Real Solution:**
- Plugin system needs a native extension API
- Or pre-defined generic commands plugins can use (like a sandbox file system API)
- Or WASM-based plugin architecture for near-native performance

---

## Major Issues

### Issue #5: Vitest Config References Missing Setup File

**File:** `vitest.config.ts`

```typescript
setupFiles: ['./src/test/setup.ts']
```

**Problem:** The file doesn't exist. Actual location is `./test/setup.ts`.

**Result:** All tests fail with:
```
Error: Failed to load url .../src/test/setup.ts. Does the file exist?
```

---

### Issue #7: Validate Command Silent on Success

**Command:** `npx lokus-plugin validate`

**Problem:** Exits with code 0 but produces NO OUTPUT.

**Expected:** Should show success message like:
```
✓ Plugin manifest is valid
```

---

### Issue #2: Display Name Not Used

**Command:** `--display-name "File Stats Pro"`

**Problem:** The flag is ignored. `plugin.json` has:

```json
{
  "name": "file-stats-pro"
}
```

**Expected:** Should have separate `displayName` field:

```json
{
  "name": "file-stats-pro",
  "displayName": "File Stats Pro"
}
```

---

### Issue #3: Module Type Mismatch

**Problem:** package.json has `"type": "commonjs"` but CLI context shows `"moduleType": "esm"`.

```json
// package.json generated
"type": "commonjs"

// CLI debug output
"moduleType": "esm"
```

This inconsistency can cause issues with import/export syntax.

---

## Minor Issues

### Issue #4: Test Script Should Be One-Shot

**Problem:** `"test": "vitest"` should be `"test": "vitest --run"` for CI/CD compatibility.

The current setup runs in watch mode by default, which is not suitable for:
- CI pipelines
- CLI create process
- Pre-commit hooks

---

### Issue #9: Repository URL Has Space

**Generated:**
```json
"repository": {
  "url": "https://github.com/Lokus Team/file-stats-pro.git"
}
```

**Problem:** "Lokus Team" has a space, making the URL invalid.

---

### Issue #10: icon.png is Empty

**File:** `file-stats-pro/icon.png` is 0 bytes.

**Problem:** Plugin icon file is created but empty.

---

## Commands Tested

| Command | Status | Notes |
|---------|--------|-------|
| `npx lokus-plugin create --skip-prompts` | ⚠️ Blocked | Tests run in watch mode |
| `npm run build` | ✅ Works | Output in dist/ |
| `npx tsc --noEmit` | ❌ Fails | Import path mismatch |
| `npx lokus-plugin validate` | ⚠️ Works | No output on success |
| `npx lokus-plugin link` | ✅ Works | Symlink created |
| `npx lokus-plugin package` | ✅ Works | ZIP created |
| `npm run dev` | ❓ Not tested | Blocked by other issues |

---

## Recommendations

### P0 (Critical - Fix Immediately)

1. **Fix import path**: Use `lokus-plugin-sdk` in templates OR publish as `@lokus/plugin-sdk`
2. **Fix vitest config path**: Change to `./test/setup.ts`
3. **Add --run flag**: Tests during create should not be interactive

### P1 (Major - Fix Soon)

4. **Add success output to validate command**
5. **Fix displayName handling**
6. **Sanitize repository URL** (replace spaces with dashes)

### P2 (Minor - Fix Eventually)

7. **Create placeholder icon.png**
8. **Document Rust extension limitations** clearly in docs

---

## Files Created During Test

```
file-stats-pro/
├── src/
│   ├── index.ts          # Plugin entry (has wrong import)
│   ├── index.test.ts     # Empty test
│   ├── lib/
│   ├── types/
│   └── utils/
├── test/
│   ├── index.test.ts
│   └── setup.ts          # Correct location
├── dist/
│   ├── index.js          # Built output
│   └── index.js.map
├── plugin.json           # Missing displayName
├── package.json          # type: commonjs
├── tsconfig.json         # No path mapping
├── vitest.config.ts      # Wrong setup path
├── esbuild.config.js
└── icon.png              # Empty file
```
