# Phase 1 Complete User Guide
## All Features & How to Use Them

This guide covers **ALL 7 features** added in Phase 1, bringing Lokus to 80% editor parity with Obsidian.

**Branch:** `feature/phase-1-complete` (unified branch with all features)

---

## Quick Start

1. **Switch to the unified branch:**
   ```bash
   git checkout feature/phase-1-complete
   git pull origin feature/phase-1-complete
   ```

2. **Install dependencies (if needed):**
   ```bash
   npm install
   ```

3. **Run Lokus:**
   ```bash
   npm run tauri dev
   ```

---

## Feature 1: Tag System 🏷️

### What It Does
Create, search, and manage tags across all your notes with autocomplete and hierarchical organization.

### How to Use

#### **Create Tags:**
1. Open any note in the editor
2. Type `#` anywhere
3. **You'll see**: Autocomplete dropdown with existing tags
4. Type your tag name (e.g., `#work` or `#project/lokus`)
5. Press `Enter` or `Tab` to insert

#### **Nested Tags:**
```markdown
#project/lokus/phase1
#work/meetings/weekly
#personal/health/fitness
```
These create hierarchies automatically!

#### **Tag Browser:**
1. Look in the **left sidebar** for "Tags" panel
2. **You'll see**: All tags with note counts
3. Click any tag to **filter notes** by that tag
4. Use search box to find specific tags

#### **Tag Actions:**
1. Hover over any tag in the browser
2. **Pencil icon**: Rename tag (updates ALL notes)
3. **Trash icon**: Delete tag (removes from ALL notes)

#### **Search Tags:**
- Type in tag browser search box
- Uses fuzzy matching (finds partial matches)
- Shows tags sorted by relevance

### Troubleshooting
**Q: Tag autocomplete not showing?**
- Press `#` again
- Check console for errors (Cmd/Ctrl+Shift+I)
- Make sure you have tags in other notes first

**Q: Tags not filtering notes?**
- Click the tag again to refresh
- Check if notes actually have that tag

---

## Feature 2: Full-Text Search 🔍

### What It Does
Search ALL content in ALL notes with powerful filters and operators.

### How to Use

#### **Open Search:**
- Press `Cmd+Shift+F` (Mac) or `Ctrl+Shift+F` (Windows/Linux)
- **OR** Click search icon in toolbar

#### **Basic Search:**
1. Type any word or phrase
2. Results appear instantly with context snippets
3. Matches are highlighted in yellow
4. Click any result to open that note

#### **Search Operators:**

**AND Operator:**
```
work AND project
```
Finds notes with BOTH words

**OR Operator:**
```
work OR project
```
Finds notes with EITHER word

**NOT Operator:**
```
work NOT meeting
```
Finds notes with "work" but NOT "meeting"

**Exact Phrase:**
```
"project lokus"
```
Finds exact phrase only

#### **Filters:**

**Filter by Tag:**
```
tag:#work
tag:#project/lokus
```

**Filter by Folder:**
```
folder:Projects
folder:Personal/Health
```

**Filter by Date:**
```
modified:2025-10
modified:2025-10-17
```

#### **Combine Everything:**
```
work AND project tag:#important folder:Active modified:2025-10
```

### Troubleshooting
**Q: Search not finding content?**
- Wait a moment for indexing (first time only)
- Check if notes are saved
- Try simpler search first

**Q: Keyboard shortcut not working?**
- Check if another app is using Cmd+Shift+F
- Manually click search icon instead

---

## Feature 3: Export System 📤

### What It Does
Export notes to Markdown, PDF, or ZIP formats with all formatting preserved.

### How to Use

#### **Export Single Note:**
1. Open a note
2. Press `Cmd+E` (Mac) or `Ctrl+E` (Windows/Linux)
3. **Export modal opens**

#### **Choose Format:**

**Markdown (.md):**
- Select "Markdown" format
- Toggle options:
  - ✅ **Preserve wiki links** (keep `[[links]]` as-is)
  - ✅ **Include frontmatter** (keep YAML metadata)
  - ✅ **Embed images** (include images inline)
- Click "Export"
- `.md` file downloads

**PDF (.pdf):**
- Select "PDF" format
- Choose:
  - **Page size**: A4 / Letter / Legal
  - **Orientation**: Portrait / Landscape
- Click "Export"
- `.pdf` file downloads with proper formatting

#### **Export from File Browser:**
1. Right-click any file
2. Select "Export..."
3. Choose format and export

#### **Batch Export:**
1. Select multiple files (Cmd/Ctrl+Click)
2. Right-click → Export
3. Select format
4. Downloads as `.zip` file with folder structure

### What Gets Exported

✅ All text formatting (bold, italic, etc.)
✅ Headings, lists, tables
✅ Code blocks
✅ Math equations
✅ Images (embedded or as links)
✅ Wiki links (converted or preserved)
✅ Frontmatter (YAML metadata)

### Troubleshooting
**Q: PDF looks weird?**
- Try portrait orientation instead of landscape
- Check if images are too large

**Q: Wiki links broken in export?**
- Toggle "Preserve wiki links" OFF
- They'll be converted to regular markdown links

---

## Feature 4: Backlinks Panel 🔗

### What It Does
Shows all notes that link TO the current note, with context snippets.

### How to Use

#### **View Backlinks:**
1. Open any note
2. Look at **right sidebar**
3. Find "Backlinks" panel (at bottom)

#### **Two Sections:**

**Linked Mentions:**
- Notes with actual `[[wiki links]]` to current note
- Shows context around the link
- Click to navigate to source note

**Unlinked Mentions:**
- Notes that mention the note title without a link
- Helps you find connections you forgot to link
- Click to navigate

#### **Example:**

You're in **"Project Overview"**

Backlinks shows:
- **Meeting Notes** → "discussed [[Project Overview]] today"
- **Tasks** → "Review the Project Overview document" _(unlinked)_

#### **Navigate:**
- Click any backlink
- Opens source note
- Scrolls to the exact mention

### Troubleshooting
**Q: Backlinks panel empty?**
- Other notes need to link to this one first
- Use `[[note title]]` syntax in other notes

**Q: Backlinks not updating?**
- Save the notes first
- Click refresh if needed

---

## Feature 5: Outgoing Links Panel 🔗

### What It Does
Shows all links FROM the current note, grouped by type.

### How to Use

#### **View Outgoing Links:**
1. Open any note with links
2. Look at **right sidebar**
3. Find "Outgoing Links" panel (middle, above backlinks)

#### **Three Sections:**

**Wiki Links:**
```markdown
[[Another Note]]
[[Project/Docs]]
```
- Shows all internal wiki links
- **Red = broken** (note doesn't exist)
- **Blue = working** (note exists)

**External URLs:**
```markdown
[Google](https://google.com)
[Documentation](https://docs.lokus.md)
```
- Shows all external links
- Click to open in browser

**File Links:**
```markdown
[Document](./files/doc.pdf)
[Image](./images/photo.jpg)
```
- Shows all file links
- Click to open file

#### **Fix Broken Links:**
1. Broken links show in **RED** with warning icon
2. Hover: "Note doesn't exist. Click to create."
3. Click the broken link
4. Lokus creates the note automatically
5. Link turns blue (fixed!)

### Troubleshooting
**Q: Links not showing?**
- Make sure note has actual links
- Save the note first

**Q: External links not opening?**
- Check your browser settings
- Try right-click → Copy Link

---

## Feature 6: Reading Mode & Callouts 📖

### What It Does
Switch between editing and reading modes, plus add styled callout boxes.

### How to Use

#### **Switch Modes:**

Look at the **toolbar at top** of editor. You'll see 3 buttons:

1. **Edit** - Normal editing (contentEditable)
2. **Live Preview** - WYSIWYG while editing
3. **Reading** - Clean, non-editable view

**Keyboard Shortcut:**
- Press `Cmd+E` (Mac) or `Ctrl+E` (Windows/Linux)
- Cycles through: Edit → Live → Reading → Edit

**Mode Persists:**
- Each note remembers its mode
- Close and reopen: stays in same mode

#### **Create Callouts:**

**Basic Syntax:**
```markdown
>[!note] This is a note
>More content here

>[!tip] Helpful Tip
>This is a tip

>[!warning] Be Careful
>Important warning

>[!danger] Critical
>Dangerous action
```

**All 8 Types:**
- `>[!note]` - Blue, info icon
- `>[!tip]` - Green, lightbulb icon
- `>[!warning]` - Orange, warning icon
- `>[!danger]` - Red, alert icon
- `>[!info]` - Cyan, info icon
- `>[!success]` - Green, checkmark icon
- `>[!question]` - Purple, question icon
- `>[!example]` - Gray, code icon

**Collapsible Callouts:**
```markdown
>[!note]- Collapsed by default
>Content is hidden initially
>Click header to expand
```
The `-` after `[!note]` makes it collapsed

**Using Slash Command:**
1. Type `/callout`
2. Select from list
3. Callout template inserted

#### **Nested Content:**
```markdown
>[!tip] Complex Callout
>- List item 1
>- List item 2
>
>```javascript
>const code = "works too";
>```
>
>Even [[wiki links]] work!
```

### Troubleshooting
**Q: Mode buttons not visible?**
- Check if you're in the editor
- Toolbar is at very top

**Q: Callouts not rendering?**
- Check syntax: `>[!type] Title`
- Make sure there's `>` at start
- Try slash command instead

---

## Feature 7: Navigation Features 🧭

### What It Does
Fold sections, navigate with outline, and quick switch files with fuzzy search.

### How to Use

#### **A. Section Folding**

**Fold/Unfold Sections:**
1. Look for **▶** arrows next to headings
2. Click ▶ to **fold** (collapse content)
3. Click ▼ to **unfold** (expand content)

**Keyboard Shortcuts:**
- `Cmd+Option+[` (Mac) or `Ctrl+Alt+[` (Win) - Fold current section
- `Cmd+Option+]` (Mac) or `Ctrl+Alt+]` (Win) - Unfold current section
- `Cmd+Option+0` (Mac) or `Ctrl+Alt+0` (Win) - Unfold ALL sections

**Fold State Persists:**
- Close note → reopen
- Folded sections stay folded

#### **B. Document Outline**

**View Outline:**
1. Look at **right sidebar** (top section)
2. "Outline" panel shows all headings
3. Nested structure (H2 under H1, etc.)

**Navigate:**
- Click any heading → editor scrolls to it
- Current heading highlighted
- Collapsible branches (click chevron ▶)

**Example Structure:**
```
▼ Introduction
  ▶ Background
  ▶ Goals
▼ Implementation
  ▼ Phase 1
    • Tag System
    • Search
  ▶ Phase 2
```

#### **C. Quick Switcher**

**Open Quick Switcher:**
- Press `Cmd+O` (Mac) or `Ctrl+O` (Windows/Linux)
- **Modal opens** with search box

**Fuzzy Search:**
```
Type: "prj lok"
Matches: "Project Lokus.md"
```
Don't need exact names!

**What You Can Search:**

**Files:**
```
Type: meeting
Shows: Meeting Notes.md, Weekly Meetings.md, etc.
```

**Headings within files:**
```
Type: @introduction
Shows: Files with "Introduction" heading
```

**Tags:**
```
Type: #work
Shows: Files tagged with #work
```

**Features:**
- ↑↓ arrows to navigate
- `Enter` to open file
- `Tab` to toggle preview pane
- `Cmd+Enter` to open in split view
- Recent files show at top

### Troubleshooting
**Q: Fold indicators not showing?**
- Make sure note has headings
- Try refreshing (Cmd/Ctrl+R)

**Q: Quick switcher not opening?**
- Check keyboard shortcut conflicts
- Try clicking search icon instead

**Q: Outline not updating?**
- Save the note
- Add some headings first

---

## Complete Feature List

Here's everything you can do now:

### Editor Basics
✅ Rich text editing
✅ Markdown support
✅ Math equations (KaTeX)
✅ Code blocks
✅ Tables
✅ Task lists

### Organization
✅ **Tags** with autocomplete
✅ **Tag browser** with filtering
✅ Tag rename/delete across notes
✅ **Backlinks** panel
✅ **Outgoing links** panel
✅ **Full-text search** with filters

### Export & Share
✅ Export to **Markdown**
✅ Export to **PDF**
✅ Batch export to **ZIP**
✅ Preserve images and links

### Reading & Writing
✅ **Three modes**: Edit / Live Preview / Reading
✅ **8 callout types** with icons
✅ Collapsible callouts

### Navigation
✅ **Section folding** with shortcuts
✅ **Document outline** panel
✅ **Quick switcher** with fuzzy search
✅ Search files, headings, tags
✅ Preview pane in quick switcher

---

## Common Issues & Solutions

### "I don't see tag autocomplete"
**Solution:** Type `#` character. Make sure you have tags in other notes first to see suggestions.

### "Search is not finding my content"
**Solution:** Wait a moment for initial indexing. Try a simple one-word search first.

### "Keyboard shortcuts not working"
**Possible conflicts:**
- Cmd/Ctrl+E (Export/Reading mode)
- Cmd/Ctrl+Shift+F (Search)
- Cmd/Ctrl+O (Quick Switcher)

**Solution:** Check your OS keyboard shortcuts. Manually use menus/buttons instead.

### "Backlinks panel is empty"
**Solution:** Other notes need to link to this one using `[[wiki link]]` syntax first.

### "PDF export looks weird"
**Solution:**
- Try different page size (A4 vs Letter)
- Try different orientation
- Optimize images first

### "Reading mode button not visible"
**Solution:** Make sure you're in the editor (not file browser). Toolbar is at very top.

### "Outline not showing"
**Solution:** Note needs headings (# Heading 1, ## Heading 2, etc.). Add some headings first.

---

## Testing Checklist

Use this to verify everything works:

### Tags
- [ ] Type `#` → autocomplete appears
- [ ] Create tag → appears in tag browser
- [ ] Click tag → filters notes
- [ ] Rename tag → updates all notes
- [ ] Delete tag → removes from all notes

### Search
- [ ] Press Cmd/Ctrl+Shift+F → opens
- [ ] Search finds content
- [ ] AND/OR/NOT operators work
- [ ] tag: filter works
- [ ] folder: filter works
- [ ] Click result → opens note

### Export
- [ ] Press Cmd/Ctrl+E → modal opens
- [ ] Export to Markdown works
- [ ] Export to PDF works
- [ ] Right-click export works
- [ ] Images preserved

### Links
- [ ] Backlinks panel shows
- [ ] Linked mentions appear
- [ ] Unlinked mentions detected
- [ ] Click backlink → navigates
- [ ] Outgoing links panel shows
- [ ] Broken links in red
- [ ] Click broken → creates note

### Reading Mode
- [ ] Three mode buttons visible
- [ ] Edit mode works
- [ ] Live Preview mode works
- [ ] Reading mode works
- [ ] Cmd/Ctrl+E cycles modes
- [ ] Mode persists per note

### Callouts
- [ ] Type `>[!note]` → renders
- [ ] All 8 types work
- [ ] Collapsible `>[!type]-` works
- [ ] /callout slash command works
- [ ] Icons and colors show

### Navigation
- [ ] ▶ indicators appear
- [ ] Click fold/unfold works
- [ ] Keyboard shortcuts work
- [ ] Fold state persists
- [ ] Outline panel shows
- [ ] Click outline → navigates
- [ ] Cmd/Ctrl+O → quick switcher
- [ ] Fuzzy search works
- [ ] Tab → preview pane

---

## What's Next?

### Phase 2: Publishing MVP
Coming next with these features:
- One-click publish to web
- Beautiful themes
- SEO optimization
- Custom domains
- Analytics

### Getting Help
- GitHub Issues: Report bugs or request features
- Community: Share feedback
- Documentation: Check docs folder for more guides

---

## Quick Reference Card

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl+Shift+F` | Open search |
| `Cmd/Ctrl+E` | Cycle editor modes |
| `Cmd/Ctrl+O` | Quick switcher |
| `Cmd/Ctrl+Option+[` | Fold section |
| `Cmd/Ctrl+Option+]` | Unfold section |
| `Cmd/Ctrl+Option+0` | Unfold all |
| `#` | Tag autocomplete |
| `/callout` | Insert callout |

### Syntax Quick Reference

**Tags:**
```markdown
#tag
#parent/child
#project/lokus/phase1
```

**Callouts:**
```markdown
>[!note] Title
>Content here

>[!warning]- Collapsed
>Hidden content
```

**Search:**
```
word AND other
word OR other
word NOT exclude
"exact phrase"
tag:#work
folder:Projects
modified:2025-10
```

---

**Built with ❤️ for Lokus**
**Version:** Phase 1 Complete
**Last Updated:** October 17, 2025
