# Mobile Port - GitHub Issues

> **Note to contributors:** Always wrap mobile-specific changes in `isMobile()` checks to avoid breaking the desktop app. Import from `src/platform/index.js`.

---

## Epic 1: Mobile Layout Foundation

### 🟢 Good First Issues

#### Issue: Add `safe-area-inset-top` class to Workspace view
**Labels:** `good first issue`, `mobile`, `css`

The Workspace view doesn't account for the iOS notch/Dynamic Island. Content gets hidden behind it.

**File:** `src/views/Workspace.jsx`

**Task:**
- Add `safe-area-inset-top` class to the root container (only when `isMobile()` is true)
- Test on iOS simulator with notch

**Acceptance Criteria:**
- [ ] Content doesn't overlap with Dynamic Island/notch
- [ ] Desktop layout unchanged

---

#### Issue: Add `safe-area-inset-bottom` class to StatusBar on mobile
**Labels:** `good first issue`, `mobile`, `css`

The bottom status bar overlaps with the iOS home indicator gesture area.

**File:** `src/components/StatusBar.jsx`

**Task:**
- Import `isMobile` from `src/platform/index.js`
- Add `safe-area-inset-bottom` class when on mobile

**Acceptance Criteria:**
- [ ] Status bar is above the home indicator
- [ ] Desktop layout unchanged

---

#### Issue: Hide tab close button `X` visibility on mobile (currently hover-only)
**Labels:** `good first issue`, `mobile`, `css`, `ux`

Tab close buttons use `opacity-0 group-hover:opacity-100` which doesn't work on touch devices.

**File:** `src/components/TabBar.jsx` (around line 78)

**Task:**
- Make close button always visible on mobile OR
- Add swipe-to-close gesture (more advanced)

**Simple fix:**
```jsx
className={`${isMobile() ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} ...`}
```

**Acceptance Criteria:**
- [ ] Close button visible on mobile
- [ ] Desktop still has hover behavior

---

#### Issue: Increase touch target size for StatusBar items
**Labels:** `good first issue`, `mobile`, `css`, `accessibility`

Status bar buttons are too small for touch (need minimum 44x44px).

**File:** `src/components/StatusBar.jsx`

**Task:**
- Add mobile-specific padding/sizing
- Use `min-h-[44px] min-w-[44px]` on mobile

**Acceptance Criteria:**
- [ ] Touch targets are at least 44px
- [ ] Desktop appearance unchanged

---

#### Issue: Make plugin panel width responsive on mobile
**Labels:** `good first issue`, `mobile`, `css`

Plugin panel has fixed 280px width which is too wide for mobile screens.

**File:** `src/components/PluginPanel.jsx` (line 25)

**Task:**
- Use `w-full` on mobile instead of fixed width
- Or hide plugin panel entirely on mobile (simpler)

**Acceptance Criteria:**
- [ ] Panel doesn't overflow on mobile
- [ ] Desktop keeps current behavior

---

#### Issue: Add responsive font size for mobile UI elements
**Labels:** `good first issue`, `mobile`, `css`

UI uses `text-xs` (11px) and `text-sm` (13px) which are too small on mobile.

**File:** `src/styles/globals.css`

**Task:**
- Add CSS media query for mobile to increase base font sizes
- Target `@media (pointer: coarse)` for touch devices

```css
@media (pointer: coarse) {
  :root {
    --text-xs: 13px;
    --text-sm: 15px;
  }
}
```

**Acceptance Criteria:**
- [ ] Text is readable on mobile
- [ ] Desktop fonts unchanged

---

#### Issue: Replace hover states with active states for mobile
**Labels:** `good first issue`, `mobile`, `css`

Many buttons use `:hover` which doesn't work on touch. Need `:active` for mobile.

**Files:** Multiple components

**Task:**
- Add `active:` Tailwind variants alongside `hover:` variants
- Example: `hover:bg-gray-100 active:bg-gray-100`

**Acceptance Criteria:**
- [ ] Buttons show feedback when tapped
- [ ] Desktop hover still works

---

#### Issue: Hide horizontal scrollbar on mobile tab bar
**Labels:** `good first issue`, `mobile`, `css`

Tab bar can show ugly scrollbar on mobile when many tabs open.

**File:** `src/components/TabBar.jsx`

**Task:**
- Add `no-scrollbar` class on mobile
- Or use CSS `scrollbar-width: none`

---

#### Issue: Add mobile detection to platform capabilities check
**Labels:** `good first issue`, `mobile`, `refactor`

Platform capabilities are defined but not consistently enforced.

**File:** `src/platform/index.js`

**Task:**
- Export a `hasCapability(name)` function
- Use it before calling desktop-only features

```js
export const hasCapability = (name) => {
  const caps = getPlatformCapabilities();
  return caps[name] === true;
};
```

---

#### Issue: Reduce tab max-width on mobile
**Labels:** `good first issue`, `mobile`, `css`

Tabs have `max-w-[150px]` which wastes space on mobile.

**File:** `src/components/TabBar.jsx` (line 63)

**Task:**
- Use responsive Tailwind: `max-w-[100px] md:max-w-[150px]`

---

---

## Epic 2: Mobile Navigation & Layout

### 🟡 Medium Issues

#### Issue: Create mobile navigation drawer for sidebar
**Labels:** `mobile`, `feature`, `ui`

On mobile, the file tree sidebar should be a slide-out drawer instead of always visible.

**Files:**
- `src/views/Workspace.jsx`
- Create new: `src/components/mobile/MobileDrawer.jsx`

**Task:**
- Create a drawer component that slides in from left
- Add hamburger menu button in header on mobile
- File tree goes inside the drawer
- Overlay when drawer is open

**Acceptance Criteria:**
- [ ] Drawer slides in/out smoothly
- [ ] Tapping overlay closes drawer
- [ ] Desktop layout completely unchanged

---

#### Issue: Create mobile bottom tab bar for view switching
**Labels:** `mobile`, `feature`, `ui`

Mobile needs a bottom tab bar to switch between: Files, Editor, Search, Settings.

**Files:**
- Create new: `src/components/mobile/MobileTabBar.jsx`
- `src/views/Workspace.jsx`

**Task:**
- Create bottom tab bar component
- 4 tabs: Files (tree), Editor, Search, Settings
- Only show on mobile
- Account for safe area bottom inset

---

#### Issue: Make sidebar overlay instead of push layout on mobile
**Labels:** `mobile`, `ui`, `layout`

Currently sidebar pushes content. On mobile it should overlay.

**File:** `src/views/Workspace.jsx`

**Task:**
- On mobile: sidebar is `position: fixed` with backdrop
- On desktop: keep current push behavior

---

#### Issue: Hide right plugin panel on mobile by default
**Labels:** `mobile`, `ui`

Plugin panel takes too much space on mobile. Hide it by default.

**File:** `src/views/Workspace.jsx`

**Task:**
- Don't render plugin panel on mobile OR
- Make it accessible via a button/modal

---

---

## Epic 3: Touch Interactions

### 🟢 Good First Issues

#### Issue: Add touch event handlers to SplitEditor resizer
**Labels:** `good first issue`, `mobile`, `touch`

Split pane resizer only handles mouse events, not touch.

**File:** `src/components/SplitEditor/PaneResizer.jsx`

**Task:**
- Add `onTouchStart`, `onTouchMove`, `onTouchEnd` handlers
- Map touch coordinates similar to mouse coordinates

```jsx
const handleTouchStart = (e) => {
  const touch = e.touches[0];
  // Similar logic to handleMouseDown
};
```

**Acceptance Criteria:**
- [ ] Can resize panes with touch
- [ ] Mouse still works on desktop

---

#### Issue: Add long-press detection utility for mobile context menus
**Labels:** `good first issue`, `mobile`, `utility`

Need a utility hook for detecting long-press (replaces right-click on mobile).

**File:** Create new: `src/hooks/useLongPress.js`

**Task:**
```js
export function useLongPress(callback, delay = 500) {
  // Return handlers: onTouchStart, onTouchEnd, onTouchMove
  // Call callback after delay if not moved/released
}
```

**Acceptance Criteria:**
- [ ] Hook detects long press
- [ ] Cancels if user moves finger
- [ ] Cancels if user releases early

---

#### Issue: Add haptic feedback utility for mobile
**Labels:** `good first issue`, `mobile`, `utility`

iOS supports haptic feedback. Add utility to trigger it.

**File:** `src/platform/index.js` or create `src/utils/haptics.js`

**Task:**
```js
export const triggerHaptic = (type = 'light') => {
  if ('vibrate' in navigator) {
    navigator.vibrate(type === 'light' ? 10 : 50);
  }
};
```

---

### 🟡 Medium Issues

#### Issue: Replace FileContextMenu right-click with long-press on mobile
**Labels:** `mobile`, `touch`, `ux`

Context menu uses right-click which doesn't exist on mobile.

**File:** `src/components/FileContextMenu.jsx`

**Task:**
- Use the `useLongPress` hook (after it's created)
- Show context menu on long-press for mobile
- Keep right-click for desktop

---

#### Issue: Add pinch-zoom support to ImageViewer
**Labels:** `mobile`, `touch`, `feature`

Image viewer uses mouse wheel for zoom. Need pinch gesture for mobile.

**File:** `src/components/ImageViewer/ImageViewerCore.jsx`

**Task:**
- Detect pinch gesture with two touch points
- Calculate scale from distance between touches
- Apply zoom transform

---

#### Issue: Add swipe gesture to close tabs on mobile
**Labels:** `mobile`, `touch`, `ux`

Allow swiping tabs left/right to close them (common mobile pattern).

**File:** `src/components/TabBar.jsx`

**Task:**
- Track horizontal swipe on tab
- If swipe distance > threshold, close tab
- Add visual feedback during swipe

---

---

## Epic 4: Disable/Hide Desktop-Only Features

### 🟢 Good First Issues

#### Issue: Wrap global shortcut registration in desktop check
**Labels:** `good first issue`, `mobile`, `bugfix`

Global shortcuts crash on mobile because the plugin doesn't exist.

**File:** `src/core/shortcuts/registry.js`

**Task:**
- Import `isDesktop` from platform
- Wrap all shortcut registration in `if (isDesktop()) { ... }`

```js
import { isDesktop } from '../../platform/index.js';

export async function registerShortcuts() {
  if (!isDesktop()) return; // Skip on mobile
  // ... existing code
}
```

**Acceptance Criteria:**
- [ ] No crash on mobile
- [ ] Shortcuts still work on desktop

---

#### Issue: Hide terminal panel option on mobile
**Labels:** `good first issue`, `mobile`, `ui`

Terminal doesn't work on mobile. Hide the option to open it.

**Files:**
- `src/components/StatusBar.jsx` (if terminal button exists)
- `src/views/Workspace.jsx`

**Task:**
- Wrap terminal-related UI in `isDesktop()` check

---

#### Issue: Hide Git operations in file context menu on mobile
**Labels:** `good first issue`, `mobile`, `ui`

Git commands can't run on mobile.

**File:** `src/components/FileContextMenu.jsx`

**Task:**
- Wrap Git menu items in `isDesktop()` check
- Don't render them on mobile

---

#### Issue: Hide MCP/Plugin install UI on mobile
**Labels:** `good first issue`, `mobile`, `ui`

MCP servers and plugin installation don't work on mobile.

**Files:** Plugin-related UI components

**Task:**
- Hide "Install Plugin" buttons on mobile
- Show message "Plugins available on desktop only"

---

#### Issue: Hide keyboard shortcut hints on mobile
**Labels:** `good first issue`, `mobile`, `ux`

Showing "⌘S" keyboard hints doesn't make sense on mobile.

**Files:** Various tooltip/hint components

**Task:**
- Don't show keyboard shortcuts on mobile
- Or show touch alternatives ("tap and hold")

---

#### Issue: Disable file dialog calls on mobile gracefully
**Labels:** `good first issue`, `mobile`, `bugfix`

File dialogs (`open()`) may crash or do nothing on mobile.

**File:** Any file using `@tauri-apps/plugin-dialog`

**Task:**
- Check `hasCapability('fileDialog')` before calling
- Show toast "Not available on mobile" instead

---

---

## Epic 5: Mobile Editor Experience

### 🟡 Medium Issues

#### Issue: Handle virtual keyboard appearance in editor
**Labels:** `mobile`, `editor`, `ux`

When virtual keyboard opens, editor content may be hidden.

**File:** `src/editor/` (multiple files)

**Task:**
- Listen for `visualViewport` resize events
- Scroll editor to keep cursor visible
- Adjust editor height when keyboard is open

---

#### Issue: Add mobile-friendly editor toolbar
**Labels:** `mobile`, `editor`, `feature`

Desktop uses keyboard shortcuts for formatting. Mobile needs toolbar buttons.

**Files:** Create `src/components/mobile/EditorToolbar.jsx`

**Task:**
- Floating toolbar with: Bold, Italic, Link, Heading, List
- Only show on mobile
- Position above virtual keyboard

---

#### Issue: Increase editor tap target for cursor placement
**Labels:** `mobile`, `editor`, `ux`

Hard to place cursor precisely on mobile.

**Task:**
- Increase line height on mobile
- Add larger touch targets for text selection handles

---

---

## Epic 6: Mobile-Specific Features

### 🟡 Medium Issues

#### Issue: Add pull-to-refresh for file tree
**Labels:** `mobile`, `feature`, `ux`

Common mobile pattern to refresh content.

**File:** File tree component

**Task:**
- Detect overscroll at top
- Show refresh indicator
- Reload file tree on release

---

#### Issue: Add share sheet integration for iOS
**Labels:** `mobile`, `feature`, `ios`

Allow sharing notes to other apps via iOS share sheet.

**Task:**
- Use Tauri's share plugin or native API
- Add "Share" button in note options
- Share as text/markdown/PDF

---

#### Issue: Add "Open in Files" option for workspace on iOS
**Labels:** `mobile`, `feature`, `ios`

Let users access their workspace in iOS Files app.

---

---

## Summary

### Issue Count by Difficulty

| Difficulty | Count | Percentage |
|------------|-------|------------|
| 🟢 Good First Issue | 22 | 58% |
| 🟡 Medium | 16 | 42% |
| 🔴 Hard | 0* | 0% |

*Hard issues broken down into smaller pieces

### Labels to Create

- `mobile` - All mobile-related issues
- `ios` - iOS-specific
- `android` - Android-specific
- `good first issue` - Beginner friendly
- `touch` - Touch interaction related
- `css` - CSS/styling only
- `ui` - UI component changes
- `ux` - User experience improvements
- `bugfix` - Fixes broken functionality
- `feature` - New functionality
- `accessibility` - A11y improvements

### Contributing Guidelines Addition

```markdown
## Mobile Development

When working on mobile issues:

1. **Always check platform first:**
   ```js
   import { isMobile, isDesktop } from '../platform/index.js';

   if (isMobile()) {
     // Mobile-specific code
   }
   ```

2. **Use responsive Tailwind classes:**
   ```jsx
   // Base = mobile, md: = desktop
   <div className="p-2 md:p-4 text-base md:text-sm">
   ```

3. **Test on both platforms:**
   - Run `npm run dev` for desktop
   - Run `npm run tauri ios dev` for iOS simulator

4. **Don't break desktop:**
   - All mobile changes should be wrapped in platform checks
   - Desktop should work exactly as before
```
