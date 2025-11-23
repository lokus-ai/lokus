# Migration Guide

Welcome to Lokus! This guide will help you migrate your notes from other platforms.

## 📝 Table of Contents

- [Obsidian](#obsidian-migration)
- [Logseq](#logseq-migration)
- [Roam Research](#roam-research-migration)
- [Troubleshooting](#troubleshooting)

---

## Obsidian Migration

### ✨ Great News: Obsidian Vaults Are Already Compatible!

Lokus uses the same markdown-based format as Obsidian, which means **you don't need to migrate at all**!

### Quick Start

1. **Open your Obsidian vault in Lokus**
   - Launch Lokus
   - Select "Open Workspace"
   - Navigate to your Obsidian vault folder
   - Click "Open"

2. **That's it!** Your notes will work immediately.

### What Works Out of the Box

✅ **Wiki Links**: `[[Note Name]]` and `[[Note Name|Display Text]]`
✅ **Block References**: `[[Note#heading]]` and `[[Note^blockid]]`
✅ **Embeds**: `![[Note]]` for embedding content
✅ **YAML Frontmatter**: All properties preserved
✅ **Markdown Features**: Standard markdown, tables, task lists
✅ **Math**: KaTeX inline `$x^2$` and block `$$E=mc^2$$`
✅ **Code Blocks**: With syntax highlighting
✅ **Images**: Local and web URLs
✅ **Tags**: `#tag` format

### Differences to Be Aware Of

⚠️ **Plugin-Specific Syntax**
- Obsidian community plugins may add custom syntax that won't render in Lokus
- Dataview queries won't execute (they'll display as code blocks)
- Canvas files (.canvas) are not supported

⚠️ **Theme Differences**
- Lokus has its own theme system
- Custom CSS snippets from Obsidian won't apply
- You can create equivalent themes in Lokus

### Running Both Side-by-Side

You can use Lokus and Obsidian with the same vault simultaneously:
- Changes made in Lokus will be visible in Obsidian
- Changes made in Obsidian will be visible in Lokus
- Both apps use plain markdown files

### Recommended Workflow

1. **Test First**: Open your vault in Lokus and browse your notes
2. **Check Compatibility**: Look for any plugin-specific syntax
3. **Gradual Transition**: Use both apps during the transition period
4. **Full Switch**: When comfortable, switch completely to Lokus

---

## Logseq Migration

### Overview

Logseq uses an outline-based structure with special syntax that needs conversion. Lokus provides an **automatic importer** to handle this.

### Preparation

Before importing, ensure:
1. Your Logseq graph is synced and up-to-date
2. You have a backup (just in case!)
3. You know the location of your Logseq folder

### Import Process

1. **Launch Import Wizard**
   - Open Lokus
   - Click "Import Notes" (File menu or preferences)

2. **Select Platform**
   - Choose "Logseq"

3. **Select Source**
   - Click "Select Source"
   - Navigate to your Logseq graph folder
   - The folder should contain a `logseq/config.edn` file

4. **Preview Conversion**
   - Review sample conversions
   - Check how your notes will be transformed

5. **Select Destination**
   - Choose where to save converted notes
   - Recommended: Create a new folder

6. **Import**
   - Click "Start Import"
   - Wait for completion (may take a few minutes for large graphs)

### What Gets Converted

| Logseq Feature | Lokus Equivalent |
|----------------|------------------|
| Outline structure | Standard markdown paragraphs |
| `property:: value` | YAML frontmatter |
| `((uuid))` references | `^blockid` references |
| `[[Page]]` links | `[[Page]]` (same) |
| TODO/DOING/DONE | Task list checkboxes |
| Block embeds | Standard embeds |

### Known Limitations

- Logseq queries won't execute (converted to code blocks)
- Some heavily nested outlines may need manual adjustment
- Page aliases might need verification

### Post-Import Checklist

- [ ] Verify file count matches
- [ ] Check a few sample notes
- [ ] Test wiki links work
- [ ] Review any warnings/errors
- [ ] Keep original Logseq folder as backup

---

## Roam Research Migration

### Overview

Roam uses a JSON export format that requires conversion. Lokus provides an **automatic importer** to handle this complex transformation.

### Preparation

1. **Export from Roam**
   - In Roam, go to Settings → Export All
   - Choose "JSON" format
   - Download the `.json` file

2. **Backup**
   - Keep the JSON file as a backup
   - Save attachments separately if needed

### Import Process

1. **Launch Import Wizard**
   - Open Lokus
   - Click "Import Notes"

2. **Select Platform**
   - Choose "Roam Research"

3. **Select Source**
   - Click "Select Source"
   - Choose your Roam export `.json` file

4. **Preview Conversion**
   - Review how blocks will be converted
   - Check structure transformation

5. **Select Destination**
   - Choose where to save converted notes
   - Recommended: Create a new folder

6. **Import**
   - Click "Start Import"
   - This may take several minutes for large exports

### What Gets Converted

| Roam Feature | Lokus Equivalent |
|--------------|------------------|
| Pages | Individual markdown files |
| Blocks | Paragraphs and lists |
| `((uid))` references | `^blockid` references |
| `[[Page]]` links | `[[Page]]` (same) |
| Block embeds | Standard embeds |
| Tags | Frontmatter tags |
| Timestamps | Frontmatter created/modified |

### Known Limitations

- Firebase-hosted images may need manual re-upload
- Complex nested blocks may need adjustment
- Roam-specific features (graph view, etc.) won't transfer
- Aliases and page references need verification

### Post-Import Checklist

- [ ] Verify all pages imported
- [ ] Check block references resolved
- [ ] Test wiki links
- [ ] Review images and attachments
- [ ] Keep JSON export as backup

---

## Troubleshooting

### Import Errors

**"Source path does not exist"**
- Double-check you selected the correct folder/file
- For Logseq: Should contain `logseq/config.edn`
- For Roam: Should be a `.json` file

**"No markdown files found"**
- Ensure you selected the graph folder, not a subfolder
- Check that your notes aren't in a hidden folder

**"Unresolved block references"**
- Some block references couldn't be matched
- These will remain as original `((uuid))` format
- You can manually update them or leave as-is

### Performance Issues

**Import is slow**
- Large vaults (1000+ notes) may take several minutes
- This is normal - conversion is CPU-intensive
- Don't close Lokus during import

**Lokus crashes during import**
- Try importing smaller batches
- Check available disk space
- Report the issue on GitHub

### Content Issues

**Formatting looks wrong**
- Some platform-specific syntax may not convert perfectly
- You can manually adjust after import
- Report patterns you notice for future improvements

**Missing notes**
- Check the import results for errors
- Some files may have been skipped due to errors
- Check the warnings list

**Links broken**
- Wiki links should work automatically
- Check file names match exactly (case-sensitive)
- Some links may need manual fixes

### Getting Help

If you encounter issues:

1. **Check the import results**: Look for specific errors and warnings
2. **Search existing issues**: Visit [GitHub Issues](https://github.com/lokus-ai/lokus/issues)
3. **Create a new issue**: Include:
   - Platform you're migrating from
   - Error messages
   - Number of notes
   - Sample note structure (anonymized)

---

## FAQ

### Can I import multiple times?

Yes, but be careful of duplicates. The importer doesn't check for existing files. Consider using a new destination folder each time.

### Will my original notes be modified?

No! The importer reads your source files but never modifies them. Your original notes remain untouched.

### Can I use Lokus with my existing vault?

If you're coming from Obsidian: **Yes!** Just open the vault directly.

If you're coming from Logseq/Roam: Import first, then use the new folder with Lokus.

### What about attachments?

- **Obsidian**: Attachments work directly (same folder structure)
- **Logseq**: Local attachments are copied during import
- **Roam**: Some attachments may need manual download from Firebase

### Can I undo an import?

The import creates new files but doesn't delete anything. To "undo":
1. Delete the imported files
2. Or simply don't open that folder in Lokus

### How do I keep my notes in sync after import?

Lokus doesn't have built-in sync (yet), but you can use:
- iCloud Drive
- Dropbox
- Git (for version control)
- Any file sync service

---

## Tips for Success

### Before Migrating

1. **Backup everything**: Always have a backup before migration
2. **Clean up first**: Remove old/unused notes in your source app
3. **Test with a sample**: Import a small subset first
4. **Read the guide**: Understand what will and won't convert

### After Migrating

1. **Verify thoroughly**: Check random samples throughout your vault
2. **Fix critical issues first**: Start with frequently-used notes
3. **Update links gradually**: You don't need to fix everything at once
4. **Customize Lokus**: Set up themes, preferences to match your workflow
5. **Keep backups**: Maintain your original export for at least a month

### Making the Most of Lokus

- Explore Lokus-specific features (kanban, templates, etc.)
- Join the community for tips and support
- Report bugs and request features
- Customize your workspace and theme

---

## Platform Comparison

| Feature | Obsidian | Logseq | Roam | Lokus |
|---------|----------|--------|------|-------|
| File Format | Markdown | Markdown | JSON | Markdown |
| Wiki Links | ✅ | ✅ | ✅ | ✅ |
| Block Refs | ✅ | ✅ | ✅ | ✅ |
| Outlines | ✅ | ✅ | ✅ | ✅ |
| Graph View | ✅ | ✅ | ✅ | 🚧 |
| Plugins | ✅ | ⚠️ | ❌ | 🚧 |
| Cloud Sync | Extra | Native | Native | Manual |
| Open Source | ❌ | ✅ | ❌ | ✅ |
| Offline | ✅ | ✅ | ❌ | ✅ |

✅ = Full support | ⚠️ = Limited | 🚧 = In development | ❌ = Not supported

---

## Next Steps

After successfully migrating:

1. **Set up your workspace**: Customize folders, preferences, themes
2. **Learn Lokus features**: Explore kanban boards, templates, shortcuts
3. **Join the community**: Get help, share tips, request features
4. **Provide feedback**: Help improve the migration experience

Welcome to Lokus! 🚀
