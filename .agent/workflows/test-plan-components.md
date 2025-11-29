---
description: Plan for adding 50+ comprehensive tests for editor extensions and UI components
---

# Test Plan: Editor Extensions & Components

This plan outlines 50+ new tests to ensure robust coverage for complex editor extensions and UI components.

## 1. SlashCommand Extension & UI (15 Tests)

### `src/editor/components/SlashCommandList.test.jsx` (New File)
1. **Rendering**: Verify list renders correctly with provided `items`.
2. **Empty State**: Verify "No results found" is displayed when `items` is empty.
3. **Keyboard Navigation (Down)**: Verify `ArrowDown` moves selection to the next item.
4. **Keyboard Navigation (Up)**: Verify `ArrowUp` moves selection to the previous item.
5. **Keyboard Navigation (Loop)**: Verify navigation loops from last to first and vice versa.
6. **Selection (Enter)**: Verify pressing `Enter` triggers the `command` callback with the selected item.
7. **Selection (Click)**: Verify clicking an item triggers the `command` callback.
8. **Dynamic Updates**: Verify the list updates and resets selection when `items` prop changes.
9. **Scroll Behavior**: Verify `scrollIntoView` is called for the selected item (using mocks).
10. **Accessibility**: Verify `aria-selected` attribute updates correctly on selection.

### `src/editor/lib/SlashCommand.test.js` (Enhance)
11. **Plugin Configuration**: Verify ProseMirror plugin key and basic configuration.
12. **Suggestion Logic**: Test the `items` filtering logic (mocking the query).
13. **Render Hook**: Verify the `render` function returns the correct React renderer instance.
14. **Props Passing**: Verify props are correctly passed to the `SlashCommandList` component.
15. **Cleanup**: Verify `destroy` method cleans up the renderer.

## 2. Mermaid Diagram Extension (15 Tests)

### `src/editor/extensions/MermaidDiagram.test.js` (New File)
16. **Schema Definition**: Verify node name, group, content, and atom properties.
17. **Attribute Defaults**: Verify default values for `code`, `theme`, and `updatedAt`.
18. **Parse HTML (Base64)**: Verify `parseHTML` correctly decodes `data-code` attribute.
19. **Parse HTML (Legacy)**: Verify `parseHTML` falls back to `<code>` content or `code` attribute.
20. **Parse HTML (Markdown)**: Verify `parseHTML` handles `<pre><code class="language-mermaid">`.
21. **Render HTML**: Verify `renderHTML` encodes code to base64 `data-code`.
22. **Input Rule**: Verify ` ``mm ` input rule triggers node creation.
23. **Input Rule (Negative)**: Verify similar patterns (e.g., ` ``m `) do not trigger it.

### `src/editor/lib/Mermaid.test.jsx` (New File)
24. **Rendering**: Verify component renders the container.
25. **Initial Render**: Verify mermaid.render is called with initial code.
26. **Code Update**: Verify diagram updates when `node.attrs.code` changes.
27. **Error Handling**: Verify error message is displayed for invalid Mermaid syntax.
28. **View Mode Toggle**: Verify toggling between "Edit" and "Preview" modes.
29. **Theme Application**: Verify `theme` prop is passed to mermaid configuration.
30. **Cleanup**: Verify mermaid instance/listeners are cleaned up on unmount.

## 3. WikiLink Embed Extension (10 Tests)

### `src/editor/extensions/WikiLinkEmbed.test.js` (New File)
31. **Schema Definition**: Verify node properties (inline vs block, isolating).
32. **Attributes**: Verify `src`, `title`, and `fileId` attributes.
33. **Parse HTML**: Verify parsing from custom tag or iframe representation.
34. **Render HTML**: Verify output structure matches expected HTML.
35. **Input Rule**: Verify `![[Link]]` pattern triggers embed creation.
36. **Paste Rule**: Verify pasting a link with embed syntax works.
37. **File Resolution**: Test logic for resolving `src` to a file path (if logic exists in extension).
38. **Missing File**: Verify behavior when linked file is missing (e.g., error state attribute).
39. **Recursion Prevention**: Verify logic to prevent self-embedding (if applicable).
40. **Update Logic**: Verify node updates when attributes change.

## 4. Complex UI Components (10 Tests)

### `src/components/FileContextMenu.test.jsx` (Enhance)
41. **Recursive Delete**: Mock a folder with children and verify delete action affects all.
42. **Rename Validation**: Verify renaming to an empty string or invalid characters is prevented.
43. **Keyboard Shortcuts**: Verify context menu actions show correct keyboard shortcuts.
44. **File vs Folder**: Verify "New File" option is only available on folders.
45. **Clipboard Actions**: Verify "Copy Path" and "Copy Relative Path" copy correct values.

### `src/components/SearchPanel.test.jsx` (Enhance)
46. **Regex Search**: Verify search works with Regex mode enabled.
47. **Case Sensitivity**: Verify search respects Case Sensitive toggle.
48. **Large Result Set**: Verify performance/rendering with 100+ search results (virtualization check).
49. **Navigation**: Verify `ArrowDown`/`ArrowUp` navigates through search results.
50. **Preview**: Verify selecting a result triggers preview (if applicable).

## Implementation Strategy
- **Mocking**: extensively mock `mermaid`, `tiptap` internals, and `tauri` invoke calls.
- **Environment**: Use `jsdom` for component tests.
- **Async**: Use `waitFor` and `userEvent` for realistic interaction testing.
