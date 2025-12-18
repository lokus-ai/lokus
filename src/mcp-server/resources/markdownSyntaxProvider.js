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
  },
  {
    uri: "lokus://markdown-syntax/math",
    name: "Math Equations (LaTeX/KaTeX)",
    description: "How to write inline and block math equations using LaTeX syntax",
    mimeType: "text/markdown"
  },
  {
    uri: "lokus://markdown-syntax/tables",
    name: "Tables",
    description: "How to create and format markdown tables",
    mimeType: "text/markdown"
  },
  {
    uri: "lokus://markdown-syntax/code",
    name: "Code Blocks",
    description: "How to add inline code and code blocks with syntax highlighting",
    mimeType: "text/markdown"
  },
  {
    uri: "lokus://markdown-syntax/lists",
    name: "Lists and Tasks",
    description: "How to create ordered lists, unordered lists, and task lists",
    mimeType: "text/markdown"
  },
  {
    uri: "lokus://markdown-syntax/formatting",
    name: "Text Formatting",
    description: "Bold, italic, strikethrough, highlights, superscript, subscript",
    mimeType: "text/markdown"
  },
  {
    uri: "lokus://markdown-syntax/diagrams",
    name: "Mermaid Diagrams",
    description: "How to create flowcharts, sequence diagrams, and more with Mermaid",
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

    case "lokus://markdown-syntax/math":
      return getMathSyntax();

    case "lokus://markdown-syntax/tables":
      return getTableSyntax();

    case "lokus://markdown-syntax/code":
      return getCodeSyntax();

    case "lokus://markdown-syntax/lists":
      return getListSyntax();

    case "lokus://markdown-syntax/formatting":
      return getFormattingSyntax();

    case "lokus://markdown-syntax/diagrams":
      return getDiagramSyntax();

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
- Place images in descriptive folders: \`assets/\`, \`images/\`, etc.
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

Wiki-style links connect notes and enable bidirectional linking in your knowledge base.

## Basic Links

Link to another note:

\`\`\`
[[Note Name]]
[[Note Name|Custom Display Text]]
\`\`\`

Examples:
\`\`\`
[[Project Ideas]]
[[Meeting Notes 2024-01-15]]
[[JavaScript Guide|JS Guide]]
\`\`\`

## Heading Links

Link to specific sections within notes using \`#\`:

\`\`\`
[[Note Name#Heading]]
[[Note Name#Heading|Custom Text]]
\`\`\`

Examples:
\`\`\`
[[Documentation#Installation]]
[[API Reference#Authentication|Auth docs]]
[[Project Plan#Phase 2]]
\`\`\`

**How it works:**
- \`#\` links to a heading (# Heading, ## Heading, etc.)
- Case-insensitive heading matching
- Spaces in heading names work automatically

## Block References (Block IDs)

Link to specific blocks/paragraphs within notes using \`^\`:

\`\`\`
[[Note Name^blockid]]
[[Note Name^blockid|Custom Text]]
\`\`\`

### What are Block IDs?

Block IDs let you reference specific paragraphs, list items, or blocks of content. Each block can have a unique identifier.

### Creating Block IDs

Add \`^blockid\` at the END of any block:

\`\`\`
This is a paragraph with a block ID. ^intro-para

- This is a list item ^list-item-1
- Another list item ^list-item-2

> This is a quote block ^important-quote
\`\`\`

**Block ID Rules:**
- Use lowercase letters, numbers, hyphens, underscores
- No spaces allowed
- Must be unique within the note
- Format: \`^block-id-name\`

### Linking to Blocks

Reference the block from another note:

\`\`\`
See the introduction: [[Project Notes^intro-para]]
Check out [[Meeting Notes^action-items]]
Reference [[Research^key-finding-1|this finding]]
\`\`\`

### Examples

**In source note (Research.md):**
\`\`\`
# Research Findings

Our study found significant results. ^key-finding

## Methodology
We used a double-blind approach. ^methodology

- Sample size: 1000 participants ^sample-size
- Duration: 6 months ^duration
\`\`\`

**In another note:**
\`\`\`
According to [[Research^key-finding]], the results were significant.
The [[Research^methodology|study methodology]] was rigorous.
With [[Research^sample-size|1000 participants]], the data is reliable.
\`\`\`

## Block Embeds

Embed actual content from blocks using \`!\`:

\`\`\`
![[Note Name^blockid]]
\`\`\`

**Difference:**
- \`[[Note^block]]\` - Creates a LINK to the block
- \`![[Note^block]]\` - EMBEDS the block content inline

### Embed Examples

**Source note (Quotes.md):**
\`\`\`
> "The only way to do great work is to love what you do." - Steve Jobs ^jobs-quote

The key to success is persistence. ^success-key
\`\`\`

**In another note:**
\`\`\`
# Daily Inspiration

![[Quotes^jobs-quote]]

Remember: ![[Quotes^success-key]]
\`\`\`

Result: The actual content will be displayed inline, not just a link.

## Image Embeds

Embed images from your workspace:

\`\`\`
![[image.png]]
![[folder/subfolder/diagram.jpg]]
![[screenshot.png|Custom Alt Text]]
\`\`\`

**Supported formats:** PNG, JPG, JPEG, GIF, SVG, WebP

Examples:
\`\`\`
![[architecture-diagram.png]]
![[Screenshots/bug-report.png]]
![[logo.svg|Company Logo]]
\`\`\`

## Syntax Summary

| Syntax | Purpose | Example |
|--------|---------|---------|
| \`[[Note]]\` | Link to note | \`[[Meeting Notes]]\` |
| \`[[Note\\|Text]]\` | Link with custom text | \`[[API Docs\\|Documentation]]\` |
| \`[[Note#Heading]]\` | Link to section | \`[[Guide#Installation]]\` |
| \`[[Note^block]]\` | Link to block | \`[[Research^finding-1]]\` |
| \`![[Note^block]]\` | Embed block content | \`![[Quotes^quote-1]]\` |
| \`![[image.png]]\` | Embed image | \`![[diagram.png]]\` |

## Path Resolution

Lokus resolves links intelligently:

1. **By filename** - \`[[Note]]\` finds \`Note.md\`
2. **By path** - \`[[folder/Note]]\` finds specific location
3. **Same folder** - Prefers notes in current folder
4. **Workspace root** - Falls back to workspace search
5. **Case-insensitive** - \`[[note]]\` matches \`Note.md\`

## Best Practices

✅ **Do:**
- Use \`[[Note Name]]\` for internal note links
- Use \`|alt text\` for descriptive link text
- Use \`#heading\` to link to specific sections
- Use \`^blockid\` for paragraph-level references
- Use \`![[Note^block]]\` to embed reusable content
- Keep block IDs descriptive: \`^key-finding\` not \`^1\`

❌ **Don't:**
- Use \`[Note Name]\` - Need TWO brackets
- Use \`[[Note.md]]\` - Omit file extension
- Use spaces in block IDs: \`^my block\` (wrong)
- Use special characters in block IDs: \`^block!@#\` (wrong)
- Mix wiki and markdown link syntax

## Common Use Cases

**Research notes:**
\`\`\`
Key findings: [[Study 2024^results]]
See methodology: [[Study 2024#Methods]]
Full report: [[Study 2024]]
\`\`\`

**Meeting notes:**
\`\`\`
Action items from last meeting: ![[Meeting 2024-01-15^action-items]]
Decision made: [[Meeting 2024-01-15^decision-architecture]]
\`\`\`

**Documentation:**
\`\`\`
Setup guide: [[Installation#Prerequisites]]
API endpoint: [[API Reference#Authentication]]
Example: ![[Examples^basic-usage]]
\`\`\`

**Knowledge base:**
\`\`\`
Related concept: [[Machine Learning]]
See definition: [[Glossary^neural-network]]
Visual diagram: ![[diagrams/architecture.png]]
\`\`\`

## Heading vs Block Reference

**When to use \`#heading\`:**
- Link to entire sections
- Section has a heading
- Content under heading may change
- Example: \`[[Guide#Installation]]\`

**When to use \`^blockid\`:**
- Link to specific paragraph/quote
- Need stable reference to exact content
- Want to embed specific block
- Example: \`[[Research^key-finding]]\`
`
    }]
  };
}

function getMathSyntax() {
  return {
    contents: [{
      uri: "lokus://markdown-syntax/math",
      mimeType: "text/markdown",
      text: `# Math Equations (LaTeX/KaTeX)

Lokus supports LaTeX math equations using KaTeX renderer.

## Inline Math

Use single dollar signs \`$\` for inline equations:

\`\`\`
The equation $E = mc^2$ represents energy-mass equivalence.
The quadratic formula is $x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$.
\`\`\`

**IMPORTANT:** No spaces after opening \`$\` or before closing \`$\`

## Block Math

Use double dollar signs \`$$\` for block equations:

\`\`\`
$$
E = mc^2
$$

$$
\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}
$$

$$
\\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}
$$
\`\`\`

## Common Syntax

### Fractions
\`\`\`
$\\frac{a}{b}$ - Simple fraction
$\\frac{\\partial f}{\\partial x}$ - Partial derivative
\`\`\`

### Superscripts & Subscripts
\`\`\`
$x^2$ - Superscript
$x_i$ - Subscript
$x^{2y}$ - Multiple characters (use braces)
$x_{i,j}$ - Multiple subscript characters
\`\`\`

### Square Roots
\`\`\`
$\\sqrt{x}$ - Square root
$\\sqrt[3]{x}$ - Cube root
$\\sqrt{x^2 + y^2}$ - Complex expression
\`\`\`

### Sums & Products
\`\`\`
$\\sum_{i=1}^{n} x_i$ - Summation
$\\prod_{i=1}^{n} x_i$ - Product
$\\int_{a}^{b} f(x) dx$ - Integral
\`\`\`

### Greek Letters
\`\`\`
$\\alpha, \\beta, \\gamma, \\delta$ - Lowercase
$\\Alpha, \\Beta, \\Gamma, \\Delta$ - Uppercase
$\\pi, \\theta, \\lambda, \\omega$ - Common symbols
\`\`\`

### Matrices
\`\`\`
$$
\\begin{bmatrix}
a & b \\\\
c & d
\\end{bmatrix}
$$

$$
\\begin{pmatrix}
1 & 2 & 3 \\\\
4 & 5 & 6
\\end{pmatrix}
$$
\`\`\`

### Special Symbols
\`\`\`
$\\infty$ - Infinity
$\\pm$ - Plus-minus
$\\times$ - Multiplication
$\\div$ - Division
$\\neq$ - Not equal
$\\leq, \\geq$ - Less/greater than or equal
$\\approx$ - Approximately
$\\in$ - Element of
$\\subset$ - Subset
$\\cup, \\cap$ - Union, intersection
\`\`\`

### Calculus
\`\`\`
$\\frac{d}{dx}$ - Derivative
$\\frac{\\partial}{\\partial x}$ - Partial derivative
$\\int$ - Integral
$\\oint$ - Contour integral
$\\lim_{x \\to \\infty}$ - Limit
\`\`\`

### Logic & Sets
\`\`\`
$\\forall$ - For all
$\\exists$ - There exists
$\\in$ - Element of
$\\emptyset$ - Empty set
$\\mathbb{R}$ - Real numbers
$\\mathbb{N}$ - Natural numbers
$\\mathbb{Z}$ - Integers
\`\`\`

## Common Equations Examples

**Physics:**
\`\`\`
$E = mc^2$
$F = ma$
$v = v_0 + at$
$s = ut + \\frac{1}{2}at^2$
\`\`\`

**Chemistry:**
\`\`\`
$H_2O$
$CO_2$
$C_6H_{12}O_6$
\`\`\`

**Statistics:**
\`\`\`
$\\mu = \\frac{1}{n}\\sum_{i=1}^{n} x_i$ - Mean
$\\sigma = \\sqrt{\\frac{1}{n}\\sum_{i=1}^{n}(x_i - \\mu)^2}$ - Standard deviation
\`\`\`

**Calculus:**
\`\`\`
$$
\\frac{d}{dx}(x^n) = nx^{n-1}
$$

$$
\\int x^n dx = \\frac{x^{n+1}}{n+1} + C
$$
\`\`\`

## Common Mistakes

❌ **Wrong:**
- \`$ E=mc^2$\` - Space before closing $
- \`$E=mc^2 $\` - Space before closing $
- \`$E = mc^2\` - Missing closing $
- \`E = mc^2$\` - Missing opening $
- \`$$E = mc^2\` - Missing closing $$

✅ **Correct:**
- \`$E = mc^2$\` - Proper inline
- \`$$E = mc^2$$\` - Proper block (can be on separate lines)

## Block Math Formatting

Block math can be written on multiple lines:

\`\`\`
$$
\\begin{aligned}
E &= mc^2 \\\\
p &= mv \\\\
F &= ma
\\end{aligned}
$$
\`\`\`

## Best Practices

✅ **Do:**
- Use \`$\` for inline math (within text)
- Use \`$$\` for block math (standalone equations)
- Use \`{}\` braces to group multiple characters
- Use \`\\\\\\\\\` for line breaks in aligned equations
- Escape special characters with backslash

❌ **Don't:**
- Add spaces after \`$\` or before \`$\`
- Forget closing delimiters
- Use \`\` for math (that's for code)
- Mix inline and block delimiters
`
    }]
  };
}

function getTableSyntax() {
  return {
    contents: [{
      uri: "lokus://markdown-syntax/tables",
      mimeType: "text/markdown",
      text: `# Markdown Tables

## Basic Table

\`\`\`
| Header 1 | Header 2 | Header 3 |
| -------- | -------- | -------- |
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |
\`\`\`

Renders as:

| Header 1 | Header 2 | Header 3 |
| -------- | -------- | -------- |
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |

## Alignment

Use colons to align columns:

\`\`\`
| Left Aligned | Center Aligned | Right Aligned |
| :----------- | :------------: | ------------: |
| Left         | Center         | Right         |
| Text         | Text           | Text          |
\`\`\`

- \`:---\` Left aligned
- \`:---:\` Center aligned
- \`---:\` Right aligned

## Formatting in Cells

Tables support inline formatting:

\`\`\`
| **Bold** | *Italic* | \`Code\` |
| -------- | -------- | -------- |
| **Text** | *Text*   | \`text\` |
\`\`\`

## Tips

✅ **Do:**
- Keep separator row (| --- | --- |)
- Align pipes for readability (optional)
- Use at least 3 hyphens in separator

❌ **Don't:**
- Forget separator row
- Put spaces inside cells at edges (optional)
- Use newlines inside cells

## Examples

**Simple 2-column table:**
\`\`\`
| Name | Age |
| ---- | --- |
| John | 25  |
| Jane | 30  |
\`\`\`

**With alignment:**
\`\`\`
| Item     | Price   | Quantity |
| :------- | ------: | :------: |
| Apple    | $1.50   | 10       |
| Banana   | $0.75   | 20       |
\`\`\`
`
    }]
  };
}

function getCodeSyntax() {
  return {
    contents: [{
      uri: "lokus://markdown-syntax/code",
      mimeType: "text/markdown",
      text: `# Code Syntax

## Inline Code

Use single backticks for inline code:

\`\`\`
Use the \`console.log()\` function to print.
The \`Array.map()\` method is useful.
\`\`\`

Result: Use the \`console.log()\` function to print.

## Code Blocks

Use triple backticks for code blocks:

\\\`\\\`\\\`
function hello() {
}
\\\`\\\`\\\`

## Syntax Highlighting

Add language identifier after opening backticks:

\\\`\\\`\\\`javascript
function greet(name) {
  return \`Hello, \${name}!\`;
}
\\\`\\\`\\\`

\\\`\\\`\\\`python
def greet(name):
    return f"Hello, {name}!"
\\\`\\\`\\\`

\\\`\\\`\\\`rust
fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}
\\\`\\\`\\\`

## Supported Languages

Common languages with syntax highlighting:
- **JavaScript/TypeScript**: \`javascript\`, \`typescript\`, \`js\`, \`ts\`
- **Python**: \`python\`, \`py\`
- **Rust**: \`rust\`, \`rs\`
- **Java**: \`java\`
- **C/C++**: \`c\`, \`cpp\`, \`c++\`
- **Go**: \`go\`
- **Ruby**: \`ruby\`, \`rb\`
- **PHP**: \`php\`
- **Shell**: \`bash\`, \`sh\`, \`shell\`
- **HTML**: \`html\`
- **CSS**: \`css\`, \`scss\`, \`sass\`
- **SQL**: \`sql\`
- **JSON**: \`json\`
- **YAML**: \`yaml\`, \`yml\`
- **Markdown**: \`markdown\`, \`md\`

## Examples

**JavaScript:**
\\\`\\\`\\\`javascript
const users = ['Alice', 'Bob', 'Charlie'];
users.map(name => \`Hello, \${name}!\`);
\\\`\\\`\\\`

**Python:**
\\\`\\\`\\\`python
users = ['Alice', 'Bob', 'Charlie']
greetings = [f"Hello, {name}!" for name in users]
\\\`\\\`\\\`

**JSON:**
\\\`\\\`\\\`json
{
  "name": "John Doe",
  "age": 30,
  "email": "john@example.com"
}
\\\`\\\`\\\`

## Tips

✅ **Do:**
- Use specific language identifier for syntax highlighting
- Keep code properly indented
- Close code blocks with triple backticks

❌ **Don't:**
- Forget closing backticks
- Use 4-space indentation (use triple backticks instead)
- Nest backticks incorrectly
`
    }]
  };
}

function getListSyntax() {
  return {
    contents: [{
      uri: "lokus://markdown-syntax/lists",
      mimeType: "text/markdown",
      text: `# Lists and Tasks

## Unordered Lists

Use \`-\`, \`*\`, or \`+\` for bullet points:

\`\`\`
- Item 1
- Item 2
- Item 3
\`\`\`

Result:
- Item 1
- Item 2
- Item 3

## Ordered Lists

Use numbers followed by period:

\`\`\`
1. First item
2. Second item
3. Third item
\`\`\`

Result:
1. First item
2. Second item
3. Third item

## Nested Lists

Indent with 2-4 spaces:

\`\`\`
- Main item 1
  - Sub item 1.1
  - Sub item 1.2
    - Sub sub item 1.2.1
- Main item 2
  - Sub item 2.1
\`\`\`

Result:
- Main item 1
  - Sub item 1.1
  - Sub item 1.2
    - Sub sub item 1.2.1
- Main item 2
  - Sub item 2.1

## Task Lists (Checkboxes)

Use \`- [ ]\` for unchecked, \`- [x]\` for checked:

\`\`\`
- [ ] Incomplete task
- [x] Completed task
- [ ] Another incomplete task
- [x] Another completed task
\`\`\`

Result:
- [ ] Incomplete task
- [x] Completed task
- [ ] Another incomplete task
- [x] Another completed task

**IMPORTANT:** Space required after \`-\` and inside brackets!

## Mixed Lists

Combine ordered and unordered:

\`\`\`
1. First step
   - Sub-point A
   - Sub-point B
2. Second step
   - Sub-point A
   - Sub-point B
\`\`\`

## Task Lists with Nesting

\`\`\`
- [x] Project setup
  - [x] Initialize repository
  - [x] Install dependencies
- [ ] Development
  - [x] Create components
  - [ ] Write tests
  - [ ] Documentation
\`\`\`

## Tips

✅ **Do:**
- Use consistent markers (\`-\` or \`*\` or \`+\`)
- Add space after marker
- Indent nested items consistently
- For tasks: \`[ ]\` or \`[x]\` only

❌ **Don't:**
- Mix markers in same list
- Forget space: \`-item\` (wrong), \`- item\` (correct)
- Use \`[X]\` (capital X) - use lowercase \`[x]\`
- Use other characters in brackets

## Examples

**Shopping list:**
\`\`\`
- [ ] Groceries
  - [x] Milk
  - [x] Bread
  - [ ] Eggs
- [ ] Hardware store
  - [ ] Screws
  - [ ] Paint
\`\`\`

**Project tasks:**
\`\`\`
1. [x] Planning phase
2. [x] Design phase
3. [ ] Development phase
   - [x] Backend API
   - [ ] Frontend UI
   - [ ] Testing
4. [ ] Deployment
\`\`\`
`
    }]
  };
}

function getFormattingSyntax() {
  return {
    contents: [{
      uri: "lokus://markdown-syntax/formatting",
      mimeType: "text/markdown",
      text: `# Text Formatting

## Bold

Use double asterisks or double underscores:

\`\`\`
**This is bold text**
__This is also bold__
\`\`\`

Result: **This is bold text**

## Italic

Use single asterisk or single underscore:

\`\`\`
*This is italic text*
_This is also italic_
\`\`\`

Result: *This is italic text*

## Bold + Italic

Combine both:

\`\`\`
***Bold and italic***
___Bold and italic___
**_Bold and italic_**
*__Bold and italic__*
\`\`\`

Result: ***Bold and italic***

## Strikethrough

Use double tildes:

\`\`\`
~~This text is crossed out~~
\`\`\`

Result: ~~This text is crossed out~~

## Highlight

Use double equals signs:

\`\`\`
==This text is highlighted==
\`\`\`

Result: ==This text is highlighted==

## Superscript

Use \`^\` with content between them:

\`\`\`
H^2^O
E = mc^2^
x^2^
\`\`\`

Result: H²O, E = mc², x²

## Subscript

Use \`~\` with content between them:

\`\`\`
H~2~O
CO~2~
x~i~
\`\`\`

Result: H₂O, CO₂, xᵢ

## Combining Formats

You can combine multiple formats:

\`\`\`
**Bold with _italic inside_**
*Italic with **bold inside***
~~Strikethrough with **bold**~~
==Highlight with *italic*==
\`\`\`

## Blockquotes

Use \`>\` for quotes:

\`\`\`
> This is a quote
> It can span multiple lines
\`\`\`

Result:
> This is a quote
> It can span multiple lines

**Nested quotes:**
\`\`\`
> Level 1 quote
>> Level 2 quote
>>> Level 3 quote
\`\`\`

## Horizontal Rules

Use three or more hyphens, asterisks, or underscores:

\`\`\`
---
***
___
\`\`\`

Result:

---

## Line Breaks

Two spaces at end of line or backslash:

\`\`\`
Line 1  
Line 2

OR

Line 1\\
Line 2
\`\`\`

## Escape Characters

Use backslash to escape special characters:

\`\`\`
\\* Not a bullet point
\\** Not bold **
\\# Not a heading
\`\`\`

## Common Combinations

**Chemistry formulas:**
\`\`\`
H~2~O (water)
CO~2~ (carbon dioxide)
C~6~H~12~O~6~ (glucose)
\`\`\`

**Math expressions:**
\`\`\`
x^2^ + y^2^ = z^2^
a~n~ = a~1~ + (n-1)d
\`\`\`

**Emphasized text:**
\`\`\`
**Important:** This is ==critical== information!
*Note:* ~~Old info~~ Updated: **New info**
\`\`\`

## Tips

✅ **Do:**
- Use \`**bold**\` for strong emphasis
- Use \`*italic*\` for subtle emphasis
- Use \`==highlight==\` for important points
- Use \`~~strikethrough~~\` for deleted/outdated info

❌ **Don't:**
- Use spaces: \`** bold **\` (wrong)
- Mix markers: \`*bold**\` (wrong)
- Forget closing markers
- Use \`<u>\` for underline (not supported)
`
    }]
  };
}

function getDiagramSyntax() {
  return {
    contents: [{
      uri: "lokus://markdown-syntax/diagrams",
      mimeType: "text/markdown",
      text: `# Mermaid Diagrams

Lokus supports Mermaid for creating diagrams using text.

## Flowcharts

\\\`\\\`\\\`mermaid
graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E
\\\`\\\`\\\`

**Direction options:**
- \`graph TD\` - Top to Down
- \`graph LR\` - Left to Right
- \`graph BT\` - Bottom to Top
- \`graph RL\` - Right to Left

## Sequence Diagrams

\\\`\\\`\\\`mermaid
sequenceDiagram
    participant User
    participant App
    participant Server
    
    User->>App: Click button
    App->>Server: Send request
    Server-->>App: Return data
    App-->>User: Display result
\\\`\\\`\\\`

## Class Diagrams

\\\`\\\`\\\`mermaid
classDiagram
    class Animal {
        +String name
        +int age
        +makeSound()
    }
    class Dog {
        +bark()
    }
    class Cat {
        +meow()
    }
    Animal <|-- Dog
    Animal <|-- Cat
\\\`\\\`\\\`

## State Diagrams

\\\`\\\`\\\`mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Processing
    Processing --> Success
    Processing --> Error
    Success --> [*]
    Error --> Idle
\\\`\\\`\\\`

## Gantt Charts

\\\`\\\`\\\`mermaid
gantt
    title Project Timeline
    dateFormat  YYYY-MM-DD
    section Planning
    Task 1           :2024-01-01, 30d
    Task 2           :2024-02-01, 20d
    section Development
    Task 3           :2024-02-15, 45d
    Task 4           :2024-03-01, 30d
\\\`\\\`\\\`

## Pie Charts

\\\`\\\`\\\`mermaid
pie
    title Distribution
    "Category A" : 45
    "Category B" : 30
    "Category C" : 25
\\\`\\\`\\\`

## Entity Relationship Diagrams

\\\`\\\`\\\`mermaid
erDiagram
    USER ||--o{ ORDER : places
    ORDER ||--|{ ORDER_ITEM : contains
    PRODUCT ||--o{ ORDER_ITEM : "ordered in"
    
    USER {
        int id
        string name
        string email
    }
    ORDER {
        int id
        date order_date
    }
\\\`\\\`\\\`

## Node Shapes

Different shapes for flowchart nodes:

\\\`\\\`\\\`mermaid
graph LR
    A[Rectangle]
    B(Rounded)
    C([Stadium])
    D[[Subroutine]]
    E[(Database)]
    F((Circle))
    G>Flag]
    H{Diamond}
    I{{Hexagon}}
\\\`\\\`\\\`

## Arrow Types

Different connection styles:

\\\`\\\`\\\`mermaid
graph LR
    A --> B
    C --- D
    E -.-> F
    G ==> H
    I --text--> J
\\\`\\\`\\\`

- \`-->\` Solid arrow
- \`---\` Solid line
- \`-.->

\` Dotted arrow
- \`==>\` Thick arrow
- \`--text-->\` Labeled arrow

## Tips

✅ **Do:**
- Use \`\`\`mermaid\`\`\` code block
- Follow Mermaid syntax exactly
- Use meaningful labels
- Keep diagrams simple

❌ **Don't:**
- Forget closing \`\`\`
- Use invalid Mermaid syntax
- Make diagrams too complex
- Mix diagram types in one block

## Common Use Cases

**Project workflow:**
\\\`\\\`\\\`mermaid
graph TD
    A[Start] --> B[Planning]
    B --> C[Design]
    C --> D[Development]
    D --> E[Testing]
    E --> F{Pass?}
    F -->|Yes| G[Deploy]
    F -->|No| D
    G --> H[End]
\\\`\\\`\\\`

**API interaction:**
\\\`\\\`\\\`mermaid
sequenceDiagram
    Client->>API: POST /login
    API->>Database: Verify credentials
    Database-->>API: User data
    API-->>Client: JWT token
\\\`\\\`\\\`
`
    }]
  };
}
