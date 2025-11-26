/**
 * Markdown Syntax Documentation Resource for MCP
 * Provides comprehensive documentation of all supported markdown features in Lokus
 */

export const markdownSyntaxResources = [
  {
    uri: "lokus://markdown-syntax/overview",
    name: "Lokus Markdown Syntax Overview",
    description: "Complete guide to all supported markdown syntax in Lokus",
    mimeType: "text/markdown"
  },
  {
    uri: "lokus://markdown-syntax/callouts",
    name: "Callout Syntax",
    description: "How to create callouts/admonitions in Lokus",
    mimeType: "text/markdown"
  },
  {
    uri: "lokus://markdown-syntax/images",
    name: "Image Embedding Syntax",
    description: "How to embed images in Lokus notes",
    mimeType: "text/markdown"
  },
  {
    uri: "lokus://markdown-syntax/wiki-links",
    name: "Wiki Link Syntax",
    description: "How to create wiki-style links and embeds",
    mimeType: "text/markdown"
  }
];

export async function getMarkdownSyntaxResource(uri) {
  switch (uri) {
    case "lokus://markdown-syntax/overview":
      return getOverview();

    case "lokus://markdown-syntax/callouts":
      return getCalloutSyntax();

    case "lokus://markdown-syntax/images":
      return getImageSyntax();

    case "lokus://markdown-syntax/wiki-links":
      return getWikiLinkSyntax();

    default:
      throw new Error(`Unknown markdown syntax resource: ${uri}`);
  }
}

function getOverview() {
  return {
    contents: [{
      uri: "lokus://markdown-syntax/overview",
      mimeType: "text/markdown",
      text: `# Lokus Markdown Syntax Guide

Lokus supports extended markdown with special features for note-taking and knowledge management.

## Basic Markdown

All standard markdown is supported:
- **Bold** with \`**text**\` or \`__text__\`
- *Italic* with \`*text*\` or \`_text_\`
- \`inline code\` with backticks
- Links: \`[text](url)\`
- Images: \`![alt](url)\`
- Headings: \`# H1\`, \`## H2\`, etc.
- Lists (ordered and unordered)
- Tables
- Blockquotes: \`> quote\`
- Code blocks with \`\`\`language\`\`\`

## Extended Features

### 1. Callouts/Admonitions
Create colored, collapsible callouts:
\`\`\`
>[!note] Optional Title
Content goes here

>[!warning] Be Careful
Important warning message

>[!tip]- Collapsed by default
This callout starts collapsed (note the dash)
\`\`\`

**Available types:** note, tip, warning, danger, info, success, question, example

### 2. Wiki Links
Link to other notes:
\`\`\`
[[Note Name]]
[[Note Name|Display Text]]
[[Note Name#Heading]]
[[Note Name^blockid]]
\`\`\`

### 3. Image Embeds
Embed images using wiki-style syntax:
\`\`\`
![[image.png]]
![[folder/image.jpg]]
![[image.png|Custom Alt Text]]
\`\`\`

Also supports standard markdown:
\`\`\`
![alt text](path/to/image.png)
![alt text](https://example.com/image.jpg)
\`\`\`

### 4. Block Embeds
Embed content from other notes:
\`\`\`
![[Note Name^blockid]]
\`\`\`

### 5. Math Equations
Inline: \`$E = mc^2$\`
Block:
\`\`\`
$$
\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}
$$
\`\`\`

### 6. Task Lists
\`\`\`
- [ ] Incomplete task
- [x] Completed task
\`\`\`

### 7. Highlights
\`==highlighted text==\`

### 8. Strikethrough
\`~~strikethrough text~~\`

### 9. Superscript & Subscript
- Superscript: \`H^2^O\` renders as H²O
- Subscript: \`H~2~O\` renders as H₂O

### 10. Mermaid Diagrams
\`\`\`mermaid
graph TD
    A[Start] --> B[Process]
    B --> C[End]
\`\`\`

## Best Practices

1. **Always use proper syntax** - Don't mix formats
2. **For images**, prefer wiki-style \`![[image.png]]\` for local files
3. **For callouts**, always include the type: \`>[!type]\`
4. **For wiki links**, use \`[[Note Name]]\` not \`[Note Name]\`
5. **For math**, use \`$inline$\` or \`$$block$$\` delimiters

## Common Mistakes

❌ **Wrong:**
- \`> [!note]\` (space after >)
- \`[[!image.png]]\` (using [[ for images without !)
- \`[!note]\` (missing >)
- Standard link syntax for local files: \`[text](file.md)\`

✅ **Correct:**
- \`>[!note]\` (no space)
- \`![[image.png]]\` (! before [[)
- \`>[!note]\` (> before [)
- Wiki link syntax: \`[[Note Name]]\`
`
    }]
  };
}

function getCalloutSyntax() {
  return {
    contents: [{
      uri: "lokus://markdown-syntax/callouts",
      mimeType: "text/markdown",
      text: `# Callout/Admonition Syntax

## Basic Syntax

\`\`\`
>[!type] Optional Title
Content goes here on the next lines.
Can be multiple paragraphs.
\`\`\`

**IMPORTANT:** No space between \`>\` and \`[!\`

## Available Types

- \`>[!note]\` - Blue, informational (default)
- \`>[!tip]\` - Green, helpful tips
- \`>[!warning]\` - Orange, caution/warnings
- \`>[!danger]\` - Red, critical warnings
- \`>[!info]\` - Cyan, general information
- \`>[!success]\` - Green, success messages
- \`>[!question]\` - Purple, questions/help
- \`>[!example]\` - Gray, examples

## Collapsible Callouts

Add a dash \`-\` after the type to make it collapsible and start collapsed:

\`\`\`
>[!tip]- Click to expand
This content starts hidden
\`\`\`

Without dash, callouts are expanded by default:

\`\`\`
>[!tip] Always visible
This is always shown
\`\`\`

## Custom Titles

\`\`\`
>[!warning] Custom Warning Title
Your content here
\`\`\`

If no title is provided, the type name is used:

\`\`\`
>[!warning]
This will show "Warning" as the title
\`\`\`

## Nested Content

Callouts can contain any markdown:

\`\`\`
>[!note] Advanced Example
This callout contains:

- Bullet points
- **Bold text**
- \`code\`

\`\`\`code
Code blocks
\`\`\`

And even [[Wiki Links]]
\`\`\`

## Common Mistakes

❌ **Wrong:**
- \`> [!note]\` - Space after >
- \`[!note]\` - Missing >
- \`> [! note]\` - Spaces in tag
- \`>[note]\` - Missing !

✅ **Correct:**
- \`>[!note]\` - Proper syntax
`
    }]
  };
}

function getImageSyntax() {
  return {
    contents: [{
      uri: "lokus://markdown-syntax/images",
      mimeType: "text/markdown",
      text: `# Image Embedding Syntax

## Wiki-Style Images (Recommended for Local Files)

\`\`\`
![[image.png]]
![[folder/subfolder/image.jpg]]
![[image.png|Custom Alt Text]]
\`\`\`

**Supported formats:** PNG, JPG, JPEG, GIF, SVG, WebP

## Standard Markdown Images

\`\`\`
![alt text](image.png)
![alt text](folder/image.jpg)
![alt text](https://example.com/image.jpg)
\`\`\`

## Syntax Comparison

| Style | Syntax | Use Case |
|-------|--------|----------|
| Wiki | \`![[image.png]]\` | Local workspace images |
| Wiki with alt | \`![[image.png\\|Alt Text]]\` | Local with custom alt |
| Markdown | \`![alt](image.png)\` | Standard markdown |
| Markdown URL | \`![alt](https://...)\` | External images |

## Path Resolution

Images are resolved relative to:
1. Current note's directory
2. Workspace root
3. Attachments folder (if configured)

## Best Practices

✅ **Do:**
- Use \`![[image.png]]\` for local workspace images
- Place images in descriptive folders: \`assets/`, \`images/`, etc.
- Use descriptive filenames: \`diagram-architecture.png\`
- Provide alt text for accessibility

❌ **Don't:**
- Use \`[[!image.png]]\` - Wrong! The \`!\` goes BEFORE \`[[\`
- Use absolute system paths: \`/Users/name/image.png\`
- Use spaces in filenames (use hyphens: \`my-image.png\`)

## Examples

**Basic image:**
\`\`\`
![[screenshot.png]]
\`\`\`

**Image in folder:**
\`\`\`
![[diagrams/architecture.png]]
\`\`\`

**With alt text:**
\`\`\`
![[diagram.png|System Architecture Diagram]]
\`\`\`

**External image:**
\`\`\`
![Logo](https://example.com/logo.png)
\`\`\`

## Common Mistakes

❌ **Wrong:**
- \`[[!image.png]]\` - ! is in wrong position
- \`[!image.png]\` - Missing one bracket
- \`![[image]]\` - Missing file extension
- \`![[image .png]]\` - Space in filename

✅ **Correct:**
- \`![[image.png]]\` - Proper wiki-style
- \`![alt](image.png)\` - Standard markdown
`
    }]
  };
}

function getWikiLinkSyntax() {
  return {
    contents: [{
      uri: "lokus://markdown-syntax/wiki-links",
      mimeType: "text/markdown",
      text: `# Wiki Link Syntax

## Basic Links

\`\`\`
[[Note Name]]
[[Note Name|Display Text]]
\`\`\`

## Heading Links

\`\`\`
[[Note Name#Heading]]
[[Note Name#Heading|Custom Text]]
\`\`\`

## Block References

\`\`\`
[[Note Name^blockid]]
\`\`\`

## Block Embeds

Embed content from other notes:

\`\`\`
![[Note Name^blockid]]
\`\`\`

## Image Embeds

\`\`\`
![[image.png]]
![[folder/image.jpg]]
\`\`\`

## Path Resolution

- Relative to current note
- Relative to workspace root
- Case-insensitive matching

## Best Practices

✅ **Do:**
- Use \`[[Note Name]]\` for internal links
- Use \`|alt text\` for custom display
- Use \`#heading\` for section links

❌ **Don't:**
- Use \`[Note Name]\` - Need two brackets!
- Use \`[[Note Name.md]]\` - No extension needed
- Mix wiki and markdown link syntax
`
    }]
  };
}
