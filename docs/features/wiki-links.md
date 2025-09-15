# Wiki Links

Lokus features a powerful wiki-style linking system that enables you to create interconnected networks of notes. Wiki links provide bidirectional connections between notes, automatic suggestion, and seamless navigation through your knowledge base.

## Overview

The wiki link system provides:
- **Bidirectional linking** - Links automatically create backlinks
- **Autocomplete suggestions** - Smart suggestions as you type
- **Note creation** - Create new notes directly from links
- **Link visualization** - See connection networks in graph view
- **Fuzzy matching** - Find notes even with partial names
- **Case insensitive** - Links work regardless of case differences

## Creating Wiki Links

### Basic Wiki Link Syntax
Create links using double square brackets:
```
[[Note Name]]           - Links to "Note Name"
[[Note Name|Display]]   - Links to "Note Name" but shows "Display"
[[Folder/Note Name]]    - Links to note in specific folder
```

### Link Creation Methods
1. **Type Directly** - Type `[[` and the autocomplete dropdown appears
2. **Select Text** - Select text and press `[[` to convert to link
3. **Command Palette** - Use "Create Wiki Link" command
4. **Paste Links** - Paste note names with automatic link detection

### Autocomplete System
When typing `[[`, the system provides:
- **Fuzzy Search** - Finds notes with partial matches
- **Recent Notes** - Shows recently edited notes first
- **Relevance Ranking** - Orders suggestions by relevance
- **Folder Context** - Shows note locations for disambiguation
- **Create New** - Option to create new note if no matches found

## Link Types and Behavior

### Standard Links
Regular wiki links to existing notes:
- **Existing Notes** - Links to notes that exist in workspace
- **Visual Style** - Styled as clickable links with distinct appearance
- **Hover Preview** - Hover for note preview (future feature)
- **Navigation** - Click to open linked note

### Broken Links
Links to notes that don't exist:
- **Visual Indication** - Styled differently to show broken state
- **Creation Option** - Click to create the missing note
- **Resolution Tracking** - System tracks and helps resolve broken links
- **Batch Resolution** - Tools to fix multiple broken links

### External Links
Links to external resources:
- **URL Detection** - Automatic detection of web URLs
- **File Links** - Links to files outside workspace
- **Protocol Support** - Support for various URL protocols
- **External Indication** - Visual indicator for external links

## Link Navigation

### Following Links
- **Click Navigation** - Click any link to open target note
- **Keyboard Navigation** - `⌘⏎` (macOS) / `Ctrl+Enter` (Windows/Linux) to follow
- **New Tab** - `⌘⇧⏎` to open link in new tab
- **Background Tab** - Middle-click to open in background tab

### Navigation History
- **Browser-style Navigation** - Back and forward through visited notes
- **Breadcrumb Trail** - Visual path showing navigation history
- **Jump Back** - Quick return to previous note
- **History Persistence** - Navigation history persists across sessions

### Link Context
- **Source Highlighting** - Highlight text that contains link
- **Context Preview** - Show surrounding text when following links
- **Backlink Context** - See how other notes reference current note
- **Link Relationships** - Understand connection patterns

## Backlink System

### Automatic Backlinks
The system automatically tracks bidirectional connections:
- **Reverse References** - See which notes link to current note
- **Real-time Updates** - Backlinks update immediately when links added/removed
- **Context Snippets** - Show text context around backlinks
- **Link Count** - Number of notes linking to current note

### Backlink Display
Backlinks appear in dedicated sections:
- **Backlinks Panel** - Dedicated panel showing all incoming links
- **Inline Display** - Show backlinks within note content
- **Sidebar Integration** - Backlinks in file explorer sidebar
- **Graph Integration** - Visual representation in graph view

### Unlinked References
Find potential connections that aren't explicit links:
- **Mention Detection** - Find notes that mention current note by name
- **Suggested Links** - Suggest converting mentions to links
- **Context Analysis** - Analyze context to suggest relevant connections
- **Bulk Conversion** - Convert multiple mentions to links at once

## Advanced Link Features

### Link Aliases and Display Text
Customize how links appear in text:
```
[[Actual Note Name|Display Text]]
[[Very Long Note Name|Short]]
[[Technical Term|Simple Explanation]]
```

### Folder-based Linking
Organize notes in folders while maintaining links:
```
[[Projects/Project Alpha]]
[[Meeting Notes/2024/January/Weekly Sync]]
[[References/Books/Thinking Fast and Slow]]
```

### Link Anchors and Sections
Link to specific sections within notes:
```
[[Note Name#Section Header]]
[[Planning Doc#Goals and Objectives]]
[[Reference#Chapter 3]]
```

### Link Templates
Use templates for consistent link patterns:
- **Date-based Links** - `[[Daily Notes/{{date}}]]`
- **Project Links** - `[[Projects/{{project}}/{{type}}]]`
- **Meeting Links** - `[[Meetings/{{attendees}}/{{date}}]]`
- **Reference Links** - `[[References/{{category}}/{{title}}]]`

## Link Management

### Link Maintenance
Keep links healthy and up-to-date:
- **Broken Link Detection** - Automatic detection of broken links
- **Link Validation** - Verify links point to correct notes
- **Rename Propagation** - Update links when notes are renamed
- **Batch Updates** - Update multiple links simultaneously

### Link Analytics
Understand your link patterns:
- **Link Statistics** - Count of links per note
- **Connection Metrics** - Most connected and isolated notes
- **Link Growth** - Track link creation over time
- **Popular Targets** - Most frequently linked notes

### Link Organization
Organize and categorize links:
- **Link Categories** - Categorize different types of links
- **Link Tags** - Tag links for organization
- **Link Collections** - Groups of related links
- **Link Hierarchies** - Parent-child link relationships

## Integration with Other Features

### Graph View Integration
Wiki links power the graph visualization:
- **Node Connections** - Links appear as edges between note nodes
- **Bidirectional Display** - Both directions of links shown
- **Link Strength** - Visual representation of connection strength
- **Cluster Detection** - Identify groups of highly connected notes

### Search Integration
Links enhance search capabilities:
- **Link-based Search** - Find notes connected to current note
- **Traversal Search** - Search through link networks
- **Backlink Search** - Search within notes that link here
- **Connection Discovery** - Find paths between any two notes

### Template Integration
Links work seamlessly with templates:
- **Template Links** - Include links in note templates
- **Dynamic Links** - Links that adapt based on template variables
- **Link Variables** - Template variables for common link patterns
- **Template Networks** - Create connected note structures from templates

## Performance and Optimization

### Link Processing
Efficient handling of large link networks:
- **Incremental Updates** - Only reprocess changed links
- **Background Processing** - Link analysis in background threads
- **Cache Management** - Cache frequently accessed link data
- **Memory Efficiency** - Optimize memory usage for large networks

### Large Network Handling
Scale to thousands of interconnected notes:
- **Lazy Loading** - Load link data only when needed
- **Partial Networks** - Show subsets of large networks
- **Performance Monitoring** - Track link processing performance
- **Optimization Hints** - Suggest optimizations for large networks

## Link Syntax Reference

### Basic Syntax
```
[[Note Name]]                    - Simple link
[[Note Name|Display Text]]       - Link with custom display text
[[Folder/Note Name]]             - Link to note in folder
[[Note Name#Section]]            - Link to specific section
```

### Advanced Syntax
```
[[Note Name|]]                   - Use note name as display text
[[Very Long Note Name|Short]]    - Abbreviated display
[[#Section]]                     - Link to section in current note
[[../Other Folder/Note]]         - Relative path link
```

### Special Characters
```
[[Note with (parentheses)]]      - Parentheses in note names
[[Note with "quotes"]]           - Quotes in note names
[[Note with spaces]]             - Spaces are preserved
[[Note-with-dashes]]             - Dashes are preserved
```

## Accessibility

### Keyboard Navigation
- **Tab Navigation** - Navigate between links using Tab key
- **Link Activation** - Enter to follow link, Shift+Enter for new tab
- **Link Creation** - Keyboard shortcuts for creating links
- **Autocomplete Navigation** - Arrow keys to navigate suggestions

### Screen Reader Support
- **Link Announcements** - Screen readers announce link destinations
- **Link Context** - Provide context about link relationships
- **Navigation Feedback** - Announce navigation between linked notes
- **Link Status** - Announce whether links are internal or external

### Visual Accessibility
- **High Contrast** - Links visible in high contrast modes
- **Color Independence** - Links identifiable without color
- **Focus Indicators** - Clear focus indicators for links
- **Text Alternatives** - Text alternatives for link icons

## Best Practices

### Link Creation Strategy
1. **Be Specific** - Use descriptive, specific note names
2. **Consistent Naming** - Develop naming conventions for notes
3. **Natural Language** - Use natural, readable note names
4. **Avoid Abbreviations** - Spell out names for clarity
5. **Consider Context** - Think about how notes connect conceptually

### Link Maintenance
1. **Regular Cleanup** - Periodically review and fix broken links
2. **Rename Carefully** - Consider impact on existing links when renaming
3. **Use Aliases** - Create multiple names for the same concept
4. **Monitor Orphans** - Identify and connect isolated notes
5. **Review Connections** - Periodically review note connections

### Network Organization
1. **Hub Notes** - Create central hub notes for topics
2. **Index Notes** - Use index notes to organize related content
3. **Consistent Structure** - Maintain consistent linking patterns
4. **Bidirectional Thinking** - Consider both directions of relationships
5. **Natural Growth** - Let link networks grow organically

## Troubleshooting

### Common Issues

**Links not working:**
- Check link syntax uses double square brackets
- Verify note names match exactly (case insensitive)
- Ensure target notes exist in workspace
- Check for special characters in note names

**Autocomplete not showing suggestions:**
- Verify you've typed `[[` to trigger autocomplete
- Check if there are matching notes in workspace
- Try typing more characters for better matching
- Ensure search indexing is up to date

**Broken links after renaming:**
- Use application's rename function to update links automatically
- Check for links that weren't automatically updated
- Search for old note name to find missed references
- Consider creating redirect notes for major renames

**Performance issues with many links:**
- Check total number of notes and links in workspace
- Consider breaking large networks into smaller workspaces
- Monitor memory usage during link-heavy operations
- Disable real-time graph updates if performance suffers

### Performance Tips
1. **Moderate network size** - Very large link networks may impact performance
2. **Use specific names** - Specific note names improve autocomplete performance
3. **Regular maintenance** - Clean up broken links and orphaned notes
4. **Monitor graph complexity** - Complex graphs may slow visualization
5. **Balance connections** - Avoid creating overly dense link networks

## Related Features

- **[Graph View](./graph-view.md)** - Visualize wiki link networks
- **[Search](./search.md)** - Search through linked notes
- **[Template System](./template-system.md)** - Include links in templates
- **[File Management](./file-management.md)** - Note organization and structure
- **[Editor](./editor.md)** - Creating and editing wiki links

---

*For technical wiki link implementation details, see the [Wiki Link API Documentation](../api/wiki-links.md).*