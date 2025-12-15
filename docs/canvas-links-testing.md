# Canvas Links Testing Plan

A comprehensive test plan for the Canvas Links feature - enabling `![canvas-name]` syntax to embed canvas file references in document notes with preview on hover and automatic navigation.

---

## 1. Manual Testing Checklist

### Autocomplete Trigger
- [ ] Type `![` in the editor
- [ ] Autocomplete menu appears immediately
- [ ] Autocomplete shows canvas files only (filters `.canvas` extension)
- [ ] No autocomplete appears after `[` alone (only after `![`)
- [ ] Autocomplete does NOT trigger inside lists or task items
- [ ] Autocomplete properly handles special characters in input

**Testing Instructions:**
1. Open a document in the editor
2. Place cursor in a blank line or paragraph
3. Type `![` and wait for suggestions to appear
4. Verify the suggestion list contains canvas files
5. Try triggering autocomplete in different contexts (lists, paragraphs, etc.)

**Expected Behavior:**
- Autocomplete menu appears within 100ms
- Only `.canvas` files displayed with filenames
- Menu positioned correctly relative to cursor
- Keyboard navigation (arrow keys) works to select items

---

### Canvas Files in Suggestions
- [ ] Canvas files appear with their display names (without `.canvas` extension)
- [ ] Files sorted by recency and relevance
- [ ] Current folder files appear first (same-folder preference)
- [ ] Maximum 30 results shown per query
- [ ] Duplicate filenames prefixed with `./` to clarify root location
- [ ] Empty autocomplete shows all canvas files sorted by recency

**Testing Instructions:**
1. Create 5+ canvas files in different folders
2. Type `![` in editor
3. For empty query, verify all files appear sorted by relevance
4. Type first letter of canvas name and verify filtering works
5. For each result, check display format (no `.canvas` extension)

**Expected Behavior:**
- Suggestions update as you type
- Results filtered by title and path matching
- Scores calculated with same-folder boost (+100), prefix match (+50), substring (+20/+10)
- Results limited to top 30 matches

---

### Selection Inserts Canvas Link
- [ ] Selecting a canvas file inserts `![CanvasName]` pattern
- [ ] Canvas link inserted with unique ID
- [ ] Canvas path resolved asynchronously
- [ ] Link exists attribute updated after path resolution
- [ ] Autocomplete menu closes after selection
- [ ] Closing bracket `]` auto-paired if not already present

**Testing Instructions:**
1. Trigger canvas autocomplete with `![`
2. Select a canvas file from suggestions
3. Check editor content for inserted link
4. Verify link has correct format and ID
5. Wait 500ms for async resolution
6. Try selecting multiple canvas links in sequence

**Expected Behavior:**
- Link inserted immediately with base attributes
- Path resolution completes within 2 seconds
- `exists` attribute set to `true` if canvas found
- Autocomplete UI closes cleanly

---

### Canvas Link Badge Rendering
- [ ] Canvas link displays as styled badge with icon
- [ ] Badge shows 🎨 emoji icon and canvas name
- [ ] Badge has blue/accent background color (light variant)
- [ ] Badge has subtle border around it
- [ ] Badge styled with monospace font
- [ ] Broken links show red background instead
- [ ] Icon opacity changes on hover (0.8 → 1.0)

**Testing Instructions:**
1. Insert a valid canvas link `![MyCanvas]`
2. Observe rendered badge styling
3. Insert invalid canvas link `![NonExistent]`
4. Compare styling between valid and broken links
5. Hover over badge and check icon opacity
6. Verify in both light and dark themes

**Expected Behavior:**
- Valid link: blue/accent background, 100% opacity, pointer cursor
- Broken link: red/danger background, strikethrough text, 75% opacity, not-allowed cursor
- Both states animate smoothly on hover
- Icon moves up 1px on hover

---

### Hover Preview Display
- [ ] Hover on canvas link triggers preview after 500ms delay
- [ ] Preview displays immediately at cursor position
- [ ] Preview popup styled with border and shadow
- [ ] Preview header shows canvas name and close button
- [ ] Preview body shows SVG thumbnail (max 400x300)
- [ ] Loading spinner animates while preview generating
- [ ] Preview auto-hides when mouse leaves link
- [ ] Multiple hover events handled correctly (debounced)

**Testing Instructions:**
1. Insert valid canvas link
2. Hover over link for 300ms - preview should NOT appear yet
3. Continue hovering for 700ms total - preview should appear
4. Move mouse away - preview should disappear
5. Hover multiple times rapidly - verify debouncing
6. Test hover over broken link (should show "Canvas not found")

**Expected Behavior:**
- Preview appears exactly 500ms after mouseenter
- Timeout cleared on mouseleave before 500ms
- Preview positioned relative to cursor with 10px offset
- Smooth fadeIn animation (0.2s)

---

### Preview SVG Thumbnail
- [ ] Preview displays canvas SVG thumbnail
- [ ] SVG scaled to fit max 400x300 dimensions
- [ ] SVG maintains aspect ratio
- [ ] Empty canvas shows "Empty Canvas" message with icon
- [ ] Large canvas with many shapes renders without lag
- [ ] Canvas save invalidates preview cache

**Testing Instructions:**
1. Create canvas with simple shapes
2. Insert link and hover to generate preview
3. Verify SVG displays correctly in preview
4. Create empty canvas and link it
5. Verify "Empty Canvas" state displays
6. Add shapes to canvas and save
7. Re-hover link - preview should show new content

**Expected Behavior:**
- SVG thumbnail generated within 2 seconds
- Thumbnail dimensions constrained to max 400x300
- Empty canvas state shows appropriate icon/message
- Preview cache expires after 5 minutes or canvas save

---

### Click Opens Canvas
- [ ] Click on canvas link opens the canvas file
- [ ] Canvas file opens in Canvas editor tab
- [ ] Navigation event dispatched with correct path
- [ ] Broken links do not open on click (cursor shows not-allowed)
- [ ] Click closes preview popup
- [ ] Opening same canvas twice highlights existing tab
- [ ] Workspace events trigger canvas tab opening

**Testing Instructions:**
1. Insert valid canvas link
2. Hover to show preview
3. Click anywhere on link (icon or text)
4. Verify Canvas editor opens
5. Check tab system shows new canvas tab
6. Try clicking broken link - should not open
7. Click link again - should focus existing tab

**Expected Behavior:**
- `lokus:open-canvas` custom event dispatched on click
- Canvas path and name included in event details
- Navigation redirects to Canvas view with correct file
- Broken links have `pointer-events: none` or similar

---

### Broken Links Show Red Styling
- [ ] Canvas link for deleted file shows red/danger color
- [ ] Broken links have strikethrough text decoration
- [ ] Broken links show reduced opacity (75%)
- [ ] Broken links change cursor to not-allowed
- [ ] Broken link preview shows "Canvas not found" message
- [ ] No click navigation occurs for broken links
- [ ] Broken link styling works in both themes

**Testing Instructions:**
1. Insert canvas link for existing file `![MyCanvas]`
2. Delete the canvas file from workspace
3. Refresh document (reload file or refresh workspace)
4. Verify link styling changed to red
5. Hover broken link - preview shows appropriate error
6. Try clicking broken link
7. Delete another canvas and verify bulk broken links display correctly

**Expected Behavior:**
- `exists` attribute set to `false` triggers `canvas-link-broken` class
- Red/danger color scheme applied (danger CSS variable)
- Text has strikethrough and reduced opacity
- Preview shows 'missing' state with appropriate icon

---

### Multiple Canvas Links in Same Document
- [ ] Multiple canvas links can exist in single document
- [ ] Each link has unique ID for tracking
- [ ] Each link resolves path independently
- [ ] Preview displays correct content for hovered link
- [ ] Switching hover between links shows appropriate previews
- [ ] All links render correctly without style conflicts
- [ ] Document save preserves all links

**Testing Instructions:**
1. Insert 3-5 canvas links in same document
2. Mix valid and broken links
3. Hover each link rapidly and verify correct preview
4. Check HTML/DOM to verify unique IDs
5. Save document and reload
6. Verify all links still present with correct data
7. Edit document with canvas links and verify persistence

**Expected Behavior:**
- Each link gets unique ID (UUID or timestamp-based)
- Node view created for each link independently
- Hover events dispatch to correct link
- Links survive document save/load cycles

---

### Preview Positioning Adjusts for Viewport Edges
- [ ] Preview adjusts position if extends right of viewport
- [ ] Preview adjusts position if extends left of viewport
- [ ] Preview positions above cursor if extends below viewport
- [ ] Preview keeps minimum padding (16px) from edges
- [ ] Preview visible in all quadrants of screen
- [ ] Preview repositions when window resized while open
- [ ] Mobile/small screens show responsive preview

**Testing Instructions:**
1. Test hover near right edge of window - preview should shift left
2. Test hover near left edge (position.x = 0) - preview should shift right
3. Test hover near bottom of viewport - preview should position above
4. Test near bottom-right corner - preview adjusts both x and y
5. Resize window while preview open - preview repositions
6. Test on mobile viewport (narrow screen)

**Expected Behavior:**
- Adjustment logic runs after preview renders (getBoundingClientRect)
- Padding applied on all edges (16px minimum)
- Preview never extends outside viewport
- Repositioning happens smoothly without flicker

---

## 2. Edge Cases to Test

### Empty Canvas File
- [ ] Empty canvas displays "Empty Canvas" state in preview
- [ ] Empty canvas link still clickable and navigable
- [ ] Preview shows appropriate icon (file image)
- [ ] No errors in console when previewing empty canvas
- [ ] Empty canvas can be added to later and preview updates

**Test Case:**
```
1. Create new empty canvas file
2. Insert link with ![EmptyCanvas]
3. Hover to show preview
4. Expect: "Empty Canvas" message with icon
5. Add shapes to canvas and save
6. Re-hover link
7. Expect: Preview shows new content
```

---

### Canvas File Deleted After Link Created
- [ ] Link persists in document after canvas deleted
- [ ] Link styling changes to broken (red) after deletion
- [ ] Deleted canvas can be restored and link becomes valid again
- [ ] No errors when hovering deleted canvas link
- [ ] File index updated correctly when canvas deleted

**Test Case:**
```
1. Create canvas "TestCanvas" with shapes
2. Insert link ![TestCanvas]
3. Delete TestCanvas file
4. Observe link changes to red/broken
5. Recreate TestCanvas with different content
6. Link becomes valid again (blue)
7. Preview shows new content
```

---

### Canvas File Renamed After Link Created
- [ ] Link breaks after canvas is renamed
- [ ] File index updated with new filename
- [ ] Old canvas name no longer resolves
- [ ] Link styling updates to show broken state
- [ ] Manual edit of link with new name fixes it

**Test Case:**
```
1. Create canvas "OldName"
2. Insert link ![OldName]
3. Rename canvas to "NewName"
4. Observe link becomes broken
5. Edit link text to ![NewName]
6. Link becomes valid again
7. Verify preview works
```

---

### Large Canvas with Many Shapes
- [ ] Preview generates for canvas with 100+ shapes
- [ ] Preview generation completes within 2 seconds
- [ ] SVG doesn't become too large to display
- [ ] No performance degradation from multiple previews
- [ ] Thumbnail properly shows all shapes without clipping
- [ ] Autocomplete remains responsive during preview gen

**Test Case:**
```
1. Create canvas with 200+ shapes
2. Insert link ![LargeCanvas]
3. Hover link and measure preview load time
4. Expect: < 2 seconds
5. Open DevTools Performance tab
6. Hover multiple large canvas links
7. Verify no frame drops or main thread blocking
```

---

### Canvas with Special Characters in Name
- [ ] Canvas named "My-Canvas_2024 (v1)" works in autocomplete
- [ ] Special characters properly escaped in preview
- [ ] Path resolution handles special chars correctly
- [ ] Link text displays special chars properly
- [ ] No XSS vulnerabilities with special character names

**Test Case:**
```
1. Create canvas: "Test-Canvas_2024 (v1.2)!!"
2. Type ![Test and verify it appears in autocomplete
3. Select it and verify link inserted correctly
4. Hover to show preview
5. Verify all special chars display properly
6. Check console for any errors
```

---

### Multiple Rapid Hover Events
- [ ] Hovering multiple links rapidly doesn't cause errors
- [ ] Timeout properly cleared between hover events
- [ ] No multiple previews displayed simultaneously
- [ ] Last hovered link shows preview correctly
- [ ] Memory doesn't leak from rapid hover events
- [ ] Debouncing works for mouse movement

**Test Case:**
```
1. Insert 3 canvas links
2. Hover first link for 100ms, move to second
3. Hover second for 100ms, move to third
4. Continue rapid hovering
5. Verify only current link shows preview
6. Open DevTools Memory tab
7. Hover links for 10 seconds
8. Check heap size - should not grow indefinitely
```

---

### Preview Cache Expiration (5 Minutes)
- [ ] Preview cached after first generation
- [ ] Hovering same link again shows cached preview instantly
- [ ] Cache invalidated after 5 minutes
- [ ] Canvas save invalidates cache for that canvas
- [ ] Cache cleared on workspace reload
- [ ] Multiple canvas previews maintain separate caches

**Test Case:**
```
1. Insert canvas link and hover (generates preview)
2. Measure time to show preview: ~500ms + generation time
3. Hover same link again
4. Measure time to show preview: ~500ms (no generation)
5. Wait 5 minutes
6. Hover again
7. Expect: New preview generated (cache expired)
```

---

### Canvas Save Invalidates Cache
- [ ] Canvas preview cache cleared when canvas saved
- [ ] Next preview hover after save shows new content
- [ ] Other canvas previews unaffected by save
- [ ] Cache invalidation happens synchronously
- [ ] No memory leaks from cache invalidation

**Test Case:**
```
1. Create canvas with one shape
2. Insert link and hover (preview shows shape)
3. Modify canvas and add more shapes
4. Save canvas
5. Don't reload page - cache should be cleared by save
6. Hover link again
7. Expect: Preview shows updated content
```

---

## 3. Integration Tests

### Editor Extension Registered Correctly
- [ ] CanvasLink extension loads without errors
- [ ] CanvasLink extension registers as 'inline' node type
- [ ] Extension adds input rule for `![...]` pattern
- [ ] Extension adds node view for link rendering
- [ ] Extension adds commands for setCanvasLink
- [ ] Extension integrates with CanvasSuggest extension
- [ ] No conflicts with other editor extensions

**Test Case:**
```javascript
// Check in DevTools console
editor.extensionManager.extensions
  .filter(ext => ext.name.includes('canvas'))
  // Should show: canvasLink, canvasSuggest
```

---

### Workspace Events Fire Properly
- [ ] File index updates when canvas added
- [ ] File index updates when canvas deleted
- [ ] File index updates when canvas renamed
- [ ] Editor receives file index updates
- [ ] Autocomplete reflects file index changes
- [ ] Canvas link resolution uses current file index
- [ ] No stale file references in autocomplete

**Test Case:**
```
1. Insert canvas link (file appears in index)
2. Create new canvas in workspace
3. Check window.__LOKUS_FILE_INDEX__
4. Trigger autocomplete again
5. New canvas should appear in suggestions
6. Delete canvas
7. Autocomplete should not show deleted canvas
```

---

### Canvas Manager Integration Works
- [ ] Canvas manager loads canvas files correctly
- [ ] Canvas manager queue prevents concurrent operations
- [ ] Save operations invalidate preview cache
- [ ] Load operations get fresh data from disk
- [ ] Canvas validation rejects corrupt data
- [ ] File paths properly validated before operations
- [ ] Canvas manager singleton instance works globally

**Test Case:**
```javascript
// In DevTools console
import { canvasManager } from './src/core/canvas/manager.js'
canvasManager.getQueueStatus()
// Should show active operations
```

---

### File Index Includes Canvas Files
- [ ] Canvas files appear in global file index
- [ ] Canvas filenames include `.canvas` extension
- [ ] Canvas file paths are absolute and valid
- [ ] Canvas titles extracted correctly from filenames
- [ ] File index sorted by modification time
- [ ] Workspace initialization scans for canvas files
- [ ] File watcher detects canvas file changes

**Test Case:**
```
1. Open DevTools console
2. Check window.__LOKUS_FILE_INDEX__
3. Filter for .canvas files
4. Verify all canvas files in workspace appear
5. Create new canvas
6. Check file index updates automatically
7. Verify new canvas appears in list
```

---

### Tab System Opens Canvas Correctly
- [ ] Canvas link click opens canvas in new tab
- [ ] Tab shows canvas filename and icon
- [ ] Clicking same canvas again focuses existing tab
- [ ] Canvas tabs can be closed
- [ ] Canvas tab switching updates canvas editor
- [ ] Canvas modifications save to correct file
- [ ] Canvas editor receives proper initialization

**Test Case:**
```
1. Insert canvas link and click it
2. Verify new tab created with canvas name
3. Click another canvas link
4. Verify new tab created for new canvas
5. Click original canvas name in tabs
6. Verify you switch to first canvas
7. Click first canvas link in editor
8. Verify tab already exists and focuses
```

---

## 4. Performance Tests

### Autocomplete Responds Instantly
- [ ] Autocomplete appears within 100ms of typing `![`
- [ ] First 30 results show immediately
- [ ] No frame drops during autocomplete
- [ ] Typing doesn't lag while results filtering
- [ ] Single character queries use cache (instant)
- [ ] Debounced queries don't block UI
- [ ] 1000+ canvas files still responsive

**Performance Targets:**
- Autocomplete appear: < 100ms
- Filtering results: < 50ms (for < 500 files)
- Debounce delay: 100ms (background only)
- Cache hit: < 5ms

**Test Instructions:**
```
1. Open DevTools Performance tab
2. Type ![M in editor
3. Record and check timeline
4. Look for main thread blocking
5. Verify 60fps maintained
```

---

### Preview Generation < 2 Seconds
- [ ] Canvas with 0 shapes: < 500ms
- [ ] Canvas with 50 shapes: < 1s
- [ ] Canvas with 200+ shapes: < 2s
- [ ] No blocking on main thread during generation
- [ ] Preview doesn't stall editor interactions
- [ ] SVG generation optimized for rendering speed
- [ ] Large previews don't impact page performance

**Test Case:**
```
1. Create canvas with 200+ shapes
2. Insert link and hover
3. Measure time from hover to preview display
4. Check for main thread blocking
5. Try typing in editor during preview generation
6. Verify editor remains responsive
```

---

### Cache Hit Avoids Regeneration
- [ ] Second hover of same link instant (cached)
- [ ] Cache hit shows preview in < 50ms
- [ ] No regeneration work done for cached items
- [ ] Memory usage reasonable for cache (< 50MB)
- [ ] Cache cleared on file save (fresh on next view)
- [ ] Per-canvas cache isolation works correctly

**Test Case:**
```
1. Hover canvas link (generates preview)
2. Measure time: ~500ms + generation
3. Hover same link again
4. Measure time: ~500ms only (no generation)
5. Check DevTools Network tab
6. No file reads for cached preview
```

---

### No Memory Leaks From Previews
- [ ] Memory stable after 100 hover events
- [ ] Heap size doesn't grow with previews shown
- [ ] Timeouts properly cleared on destroy
- [ ] SVG content garbage collected when hidden
- [ ] No detached DOM nodes from previews
- [ ] Long session (1 hour) shows stable memory

**Test Instructions:**
```
1. Open DevTools Memory tab
2. Take heap snapshot (note baseline)
3. Hover 100+ canvas links
4. Close all previews
5. Force garbage collection
6. Take another snapshot
7. Compare: should be similar size
```

---

### Multiple Previews Don't Slow App
- [ ] Showing 3 previews simultaneously: smooth
- [ ] No frame drops with multiple previews open
- [ ] No lag when showing/hiding previews rapidly
- [ ] Scrolling document with visible previews: 60fps
- [ ] Search/filter with previews: responsive
- [ ] Theme switch with previews: instant

**Test Case:**
```
1. Insert 10+ canvas links
2. Hover each link in sequence
3. Keep multiple previews visible (rapid hovers)
4. Open DevTools Performance panel
5. Record for 10 seconds
6. Check for consistent 60fps (green on timeline)
7. Verify no long tasks (> 50ms)
```

---

## 5. Accessibility Tests

### Keyboard Navigation in Autocomplete
- [ ] Arrow Up/Down moves through suggestions
- [ ] Enter/Space selects current suggestion
- [ ] Escape closes autocomplete menu
- [ ] Tab doesn't close autocomplete (remains open)
- [ ] Screen reader announces current selection
- [ ] Autocomplete list has proper ARIA roles
- [ ] Focus visible on selected item

**Test Case:**
```
1. Type ![M to trigger autocomplete
2. Press arrow down 3 times
3. Verify visual highlight moves
4. Press Enter to select
5. Verify link inserted
6. Repeat with screen reader active
7. Verify announcements clear
```

---

### Focus States Visible
- [ ] Canvas link has visible focus outline
- [ ] Close button on preview has focus outline
- [ ] Tab through document shows clear focus
- [ ] Focus outline color contrasts with background
- [ ] Focus outline at least 2px wide
- [ ] No focus trap when preview open
- [ ] Focus order logical throughout UI

**Test Case:**
```
1. Press Tab to focus canvas link
2. Verify outline visible around link
3. Verify outline color has sufficient contrast
4. Hover link to show preview
5. Tab to close button in preview
6. Verify outline visible on button
7. Press Tab to continue focus
```

---

### Screen Reader Announces Links
- [ ] Link announces as "Canvas link, canvas-name"
- [ ] Broken links announce as "Broken canvas link"
- [ ] Link purpose clear to screen reader users
- [ ] Preview state changes announced (loading, error, etc.)
- [ ] Close button announces as "Close canvas preview"
- [ ] ARIA labels added where needed
- [ ] No redundant announcements

**Test Instructions (with screen reader like NVDA/JAWS):**
```
1. Navigate to canvas link with arrow keys
2. Listen for announcement: should state "canvas link"
3. Tab to link and press Enter
4. Verify navigation occurs
5. Hover link to show preview
6. Listen for "Loading preview"
7. Wait for content load announcement
```

---

### High Contrast Mode Works
- [ ] Canvas link visible in high contrast mode
- [ ] Border styling enhanced (2px instead of 1px)
- [ ] Text has sufficient color contrast
- [ ] Preview popup visible with enhanced borders
- [ ] Icons clear and distinguishable
- [ ] No information lost in high contrast
- [ ] CSS respects `prefers-contrast: more` media query

**Test Instructions:**
```
1. Windows: Settings > Ease of Access > High Contrast
2. Choose high contrast theme (White, Black, or other)
3. Reload app
4. Verify canvas links clearly visible
5. Check borders are thicker (2px)
6. Verify text readable
7. Hover link to show preview
8. Verify preview styling adjusted
```

---

### Reduced Motion Respected
- [ ] Preview animation skipped if `prefers-reduced-motion: reduce`
- [ ] Loading spinner animation removed
- [ ] Transitions disabled
- [ ] No movement during interactions
- [ ] Preview appears instantly instead of animating
- [ ] All interactions still functional
- [ ] CSS handles `prefers-reduced-motion` media query

**Test Instructions:**
```
1. Open DevTools or OS accessibility settings
2. Enable "Reduce Motion" / "Prefers Reduced Motion"
3. Reload app
4. Hover canvas link
5. Preview appears instantly (no fadeIn animation)
6. Verify spinner doesn't spin (or removed entirely)
7. Check CSS @media (prefers-reduced-motion: reduce)
```

---

## 6. Visual/UI Tests

### Badge Styling Matches Theme
- [ ] Canvas link badge colors match theme CSS variables
- [ ] Valid link uses accent color (blue in light theme)
- [ ] Broken link uses danger color (red)
- [ ] Background opacity consistent (10% for valid, 10% for broken)
- [ ] Border color matches accent/danger palette
- [ ] Styling respects light/dark theme toggle
- [ ] No hardcoded colors in badge styling

**Test Case:**
```
1. Insert canvas link in light theme
2. Verify: blue/accent background, accent text color
3. Switch to dark theme
4. Verify: colors adjusted but same accent hue
5. Insert broken link
6. Verify: red/danger background with matching theme
7. Check CSS uses rgb(var(...)) for theme colors
```

---

### Preview Popup Themed Correctly
- [ ] Preview background uses panel color from theme
- [ ] Preview text uses text color from theme
- [ ] Preview border color matches theme borders
- [ ] Preview shadow color adjusted for theme
- [ ] Dark theme shadow darker (0.4 opacity vs 0.1)
- [ ] All elements inherit theme variables
- [ ] Theme change applies to open previews

**Test Case:**
```
1. Hover canvas link to show preview
2. Check background, text, border colors
3. Verify they match CSS variables
4. Switch theme to dark
5. Preview should update immediately
6. Verify shadow darker in dark mode
7. Switch back to light theme
8. Verify colors revert
```

---

### Icons Render Properly
- [ ] Canvas emoji icon (🎨) displays clearly
- [ ] File image icon in preview header visible
- [ ] Loader spinner icon animates smoothly
- [ ] Alert/error icon displays red in error state
- [ ] File question icon shows for missing canvas
- [ ] All icons have appropriate opacity
- [ ] Icon sizing consistent (1em, 16px, 32px as needed)

**Test Case:**
```
1. Insert canvas link - check 🎨 icon visible
2. Hover to show preview - check file image icon
3. Wait for loading - check spinner animates
4. Create broken link - check alert icon red
5. Hover missing canvas - check file question icon
6. Verify all icons scale properly
7. Test in different zoom levels (90%, 125%, 200%)
```

---

### Loading Spinner Animates
- [ ] Spinner rotates smoothly at 60fps
- [ ] Spinner animation loops continuously
- [ ] Spinner color matches accent theme
- [ ] Spinner size (32px) appropriate for popup
- [ ] Spinner stops when preview loads
- [ ] Animation removed with reduced motion
- [ ] No flicker or jank during rotation

**Test Case:**
```
1. Hover canvas link with large/slow canvas
2. Observe loading spinner
3. Measure animation smoothness (should be 60fps)
4. Wait for preview to load
5. Verify spinner disappears
6. Check CSS @keyframes for rotation
7. Test with motion reduced
```

---

### Error States Display Clearly
- [ ] Missing canvas shows "Canvas not found" message
- [ ] Generation error shows "Preview unavailable"
- [ ] Error message displays in red/danger color
- [ ] Error details shown in smaller text (12px)
- [ ] Error icon (AlertCircle) clearly visible
- [ ] Error states have appropriate background color
- [ ] Message text explains issue to user

**Test Case:**
```
1. Insert link to deleted canvas
2. Hover to show preview
3. Should show "Canvas not found" with icon
4. Create canvas with invalid JSON
5. Hover to trigger generation
6. Should show "Preview unavailable"
7. Verify error message clear to users
```

---

## 7. Known Limitations

### Current Limitations
1. **Preview Generation**: Placeholder SVG shown in development mode (actual canvas export needed)
2. **Cache Duration**: 5-minute cache may not reflect very rapid file changes
3. **Concurrent Operations**: File system operations queued (not truly concurrent)
4. **Mobile Preview**: Preview may obscure content on very small screens (consider touch-specific behavior)
5. **Autocomplete Performance**: 1000+ canvas files may need additional indexing
6. **Canvas Rename**: Links don't auto-update when canvas renamed (manual edit required)

### Future Improvements
- Real canvas SVG export for previews (currently placeholder)
- Canvas preview generation service (external rendering)
- Real-time link updates on file system changes
- Search ranking improvements with machine learning
- Preview image caching on disk
- Canvas diff/history in previews

---

## 8. Troubleshooting Tips

### Autocomplete Not Appearing
**Symptom:** Type `![` but autocomplete doesn't show

**Checks:**
1. Verify not in list item (autocomplete disabled there)
2. Check file index exists: `console.log(window.__LOKUS_FILE_INDEX__)`
3. Verify `.canvas` files in index: `window.__LOKUS_FILE_INDEX__.filter(f => f.path.endsWith('.canvas'))`
4. Check DevTools console for errors
5. Verify CanvasSuggest extension loaded: `editor.extensionManager.extensions.find(e => e.name === 'canvasSuggest')`

**Fix:**
- Reload page to reinitialize file index
- Check workspace has canvas files
- Verify CanvasLink and CanvasSuggest both registered

---

### Preview Not Appearing on Hover
**Symptom:** Hover canvas link but preview doesn't show

**Checks:**
1. Hover for at least 500ms (hover timeout)
2. Verify mouse cursor over link (not nearby)
3. Check console for errors in preview generation
4. Verify canvas file still exists: `window.__LOKUS_FILE_INDEX__.find(f => f.path === 'path/to/canvas')`
5. Check network tab for file fetch issues

**Fix:**
- Wait full 500ms delay
- Move mouse directly over link
- Check canvas file is readable
- Reload page to refresh file index

---

### Link Shows as Broken (Red)
**Symptom:** Valid canvas link shows as broken/red

**Checks:**
1. Verify canvas file exists in workspace
2. Check file index for canvas: `window.__LOKUS_FILE_INDEX__.filter(f => f.title.includes('CanvasName'))`
3. Verify file path is absolute and valid
4. Check workspace path in globals: `window.__LOKUS_WORKSPACE_PATH__`
5. Look for file system errors in console

**Fix:**
- Canvas may have been deleted - recreate it
- File index may be stale - reload page
- Try editing link with correct canvas name
- Check workspace workspace is set correctly

---

### Performance Issues (Slow Autocomplete/Preview)
**Symptom:** Autocomplete slow or preview takes > 3 seconds

**Checks:**
1. File count: `window.__LOKUS_FILE_INDEX__.length` (should be < 1000 for instant)
2. Check DevTools Performance tab for main thread blocking
3. Verify preview cache working: `window.__LOKUS_PREVIEW_CACHE__`
4. Check canvas file size (very large canvas slow to render)
5. Monitor memory usage in DevTools

**Fix:**
- Archive old canvas files to reduce index size
- Clear browser cache (DevTools > Application > Clear storage)
- Reduce number of shapes in large canvas files
- Try in incognito mode to eliminate extensions
- File system performance: check disk health

---

### Memory Leak Suspected
**Symptom:** App gets slower over time, memory grows

**Checks:**
1. DevTools Memory tab - take heap snapshots before/after
2. Check for detached DOM nodes: search for `.canvas-preview`
3. Verify timeouts cleared: check `hoverTimeout` in CanvasLink
4. Monitor event listeners: might accumulate on links
5. Check preview component unmounting properly

**Fix:**
- Hard refresh (Cmd+Shift+R / Ctrl+Shift+R)
- Clear browser cache
- Check for custom plugins that might leak memory
- Report issue with heap snapshot attached

---

## Test Execution Checklist

### Pre-Test Setup
- [ ] Fresh workspace with test canvas files created
- [ ] Browser DevTools open for debugging
- [ ] Console errors cleared before each test
- [ ] Dark and light themes both available
- [ ] Accessibility tools available (screen reader, contrast tools)
- [ ] Performance profiler ready

### Test Environment
- [ ] Desktop: Windows 10+, macOS 10.15+, Ubuntu 20.04+
- [ ] Browser: Chrome 90+, Firefox 88+, Safari 14+
- [ ] Node: 16+
- [ ] React: 18+
- [ ] TipTap: 2.0+

### Documentation
- [ ] Screenshot of each test state (success, error, broken)
- [ ] Console logs captured for any errors
- [ ] Performance measurements recorded
- [ ] Accessibility audit results saved
- [ ] Test summary document updated

---

## Regression Test Checklist

Run after any of these changes:

- [ ] CanvasLink extension modified
- [ ] CanvasSuggest extension modified
- [ ] Canvas manager updated
- [ ] File index modified
- [ ] Preview component changed
- [ ] CSS/styling updated
- [ ] Editor configuration changed
- [ ] File system operations changed

**Minimum Regression Tests:**
1. Autocomplete triggers on `![`
2. Canvas link badge renders correctly
3. Hover shows preview within 500-1000ms
4. Click opens canvas in tab
5. Broken links show red styling
6. No console errors
7. Performance within targets (autocomplete < 100ms, preview < 2s)

---

## Automation Test Cases

Suggested automated test cases using Playwright:

```javascript
// Canvas link autocomplete
test('should show canvas files in autocomplete', async ({ page }) => {
  await page.type('.editor', '![');
  await expect(page.locator('.suggestion-list')).toContainText(/MyCanvas/);
});

// Canvas link insertion
test('should insert canvas link on selection', async ({ page }) => {
  await page.type('.editor', '![');
  await page.click('.suggestion-list >> text=MyCanvas');
  await expect(page.locator('.canvas-link')).toHaveText('MyCanvas');
});

// Preview on hover
test('should show preview on hover after 500ms', async ({ page }) => {
  const link = page.locator('.canvas-link');
  await link.hover();
  await page.waitForTimeout(600);
  await expect(page.locator('.canvas-preview')).toBeVisible();
});

// Click navigation
test('should navigate to canvas on click', async ({ page }) => {
  await page.click('.canvas-link');
  await expect(page.locator('[data-testid="canvas-editor"]')).toBeVisible();
});
```

---

*Last Updated: 2025-12-15*
*Status: Comprehensive - Ready for Testing Phase*
