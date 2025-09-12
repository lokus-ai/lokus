# Comprehensive Markdown Test File

This file contains examples of all supported markdown features in Lokus. Use this to test and showcase the editor's capabilities.

## Basic Formatting

**Bold text** and *italic text* and ***bold italic text***

~~Strikethrough text~~ 

==Highlighted text== 

`inline code`

> This is a blockquote
> 
> It can span multiple lines
> 
> > And can be nested
> > 
> > Like this

## Headings

# Heading 1
## Heading 2  
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6

## Lists

### Unordered Lists
- First item
- Second item
  - Nested item
  - Another nested item
    - Double nested
    - More double nested
- Third item

### Ordered Lists
1. First numbered item
2. Second numbered item
   1. Nested numbered item
   2. Another nested numbered item
3. Third numbered item

### Task Lists
- [x] Completed task
- [x] Another completed task
- [ ] Incomplete task
- [ ] Another incomplete task
  - [ ] Nested incomplete task
  - [x] Nested completed task

## Code Blocks

### Plain Code Block
```
function hello() {
  console.log("Hello, World!");
}
```

### JavaScript Code Block
```javascript
const greeting = "Hello, Lokus!";

function greetUser(name) {
  return `${greeting} Welcome, ${name}!`;
}

// Arrow function example
const multiply = (a, b) => a * b;

// Async/await example
async function fetchData() {
  try {
    const response = await fetch('/api/data');
    return await response.json();
  } catch (error) {
    console.error('Error:', error);
  }
}
```

### Python Code Block
```python
def fibonacci(n):
    """Generate Fibonacci sequence up to n terms"""
    if n <= 0:
        return []
    elif n == 1:
        return [0]
    elif n == 2:
        return [0, 1]
    
    sequence = [0, 1]
    for i in range(2, n):
        sequence.append(sequence[i-1] + sequence[i-2])
    
    return sequence

# Class example
class DataProcessor:
    def __init__(self, data):
        self.data = data
    
    def process(self):
        return [item.upper() for item in self.data if item]
```

### CSS Code Block
```css
.markdown-editor {
  font-family: 'Inter', sans-serif;
  line-height: 1.6;
  color: var(--text-primary);
}

.code-block {
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 1rem;
  overflow-x: auto;
}

/* Responsive design */
@media (max-width: 768px) {
  .markdown-editor {
    font-size: 14px;
    padding: 0.5rem;
  }
}
```

### HTML Code Block
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lokus - Note Taking App</title>
</head>
<body>
    <header>
        <h1>Welcome to Lokus</h1>
        <nav>
            <a href="#features">Features</a>
            <a href="#docs">Documentation</a>
        </nav>
    </header>
    
    <main>
        <section id="features">
            <h2>Amazing Features</h2>
            <ul>
                <li>Real-time editing</li>
                <li>Wiki-style linking</li>
                <li>Beautiful themes</li>
            </ul>
        </section>
    </main>
</body>
</html>
```

## Tables

### Simple Table
| Feature | Status | Notes |
|---------|--------|-------|
| Basic formatting | ✅ Complete | Bold, italic, code |
| Tables | ✅ Complete | Resizable columns |
| Math | ✅ Complete | LaTeX support |
| Wiki links | ✅ Complete | [[link]] syntax |

### Complex Table
| Programming Language | Popularity | Use Cases | Learning Difficulty |
|---------------------|------------|-----------|-------------------|
| JavaScript | Very High | Web dev, mobile, backend | Easy |
| Python | Very High | Data science, AI, web | Easy |
| Java | High | Enterprise, Android | Medium |
| C++ | Medium | System programming, games | Hard |
| Rust | Growing | System programming, web | Hard |

## Math (LaTeX)

### Inline Math
The quadratic formula is $x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}$ and Einstein's famous equation is $E = mc^2$.

### Block Math
$$
\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
$$

$$
\begin{bmatrix}
a & b \\
c & d
\end{bmatrix}
\begin{bmatrix}
x \\
y
\end{bmatrix}
=
\begin{bmatrix}
ax + by \\
cx + dy
\end{bmatrix}
$$

$$
f(x) = \begin{cases}
x^2 & \text{if } x \geq 0 \\
-x^2 & \text{if } x < 0
\end{cases}
$$

## Links and References

### Regular Links
- [Lokus Documentation](https://lokus-docs.example.com)
- [GitHub Repository](https://github.com/user/lokus)
- https://automatic-link-detection.com

### Wiki Links
- [[Getting Started]]
- [[Advanced Features]]
- [[Configuration Guide]]
- [[Troubleshooting]]

### Image Links
![Lokus](/Users/pratham/Programming/Lokus/lokus/IMG_0822.png)

## Advanced Formatting

### Superscript and Subscript
- Water formula: H^2^O
- Mathematical notation: x~1~, x~2~, x~n~
- Footnote reference^[This is a footnote]

### Horizontal Rules

---

Above and below this line are horizontal rules.

---

## Special Characters and Symbols

### Common Symbols
- Arrows: → ← ↑ ↓ ↔ ⇒ ⇐ ⇔
- Math: ∞ ± × ÷ ≈ ≠ ≤ ≥ ∫ ∑ ∏ √
- Currency: $ € £ ¥ ₹ ₿
- Misc: © ® ™ § ¶ † ‡ • ‰ ‱

### Emoji Support
- 🚀 Rocket for productivity
- 📝 Note-taking made easy  
- ✨ Beautiful and intuitive
- 🎯 Focus on what matters
- 💡 Bright ideas ahead

## Testing Instructions

### Copy-Paste Tests
1. Copy any section above and paste it into the editor
2. Verify that formatting is preserved
3. Test editing capabilities

### Feature Tests
- [ ] Test **bold** formatting
- [ ] Test *italic* formatting  
- [ ] Test ~~strikethrough~~ formatting
- [ ] Test ==highlight== formatting
- [ ] Test `inline code` formatting
- [ ] Test > blockquotes
- [ ] Test unordered lists
- [ ] Test ordered lists
- [ ] Test task lists with checkboxes
- [ ] Test tables with resizing
- [ ] Test code blocks with syntax highlighting
- [ ] Test math equations (inline and block)
- [ ] Test wiki links [[example]]
- [ ] Test regular links
- [ ] Test images
- [ ] Test horizontal rules
- [ ] Test headings (all levels)
- [ ] Test superscript^text^
- [ ] Test subscript~text~

### Performance Tests
- [ ] Large documents (1000+ lines)
- [ ] Complex tables (10x10 or larger)
- [ ] Multiple code blocks
- [ ] Heavy math content
- [ ] Many wiki links

## Notes

This test file should help you verify that all markdown features work correctly in Lokus. Each section tests different aspects of the editor's capabilities.

Remember to test:
- Real-time rendering
- Copy-paste functionality
- Keyboard shortcuts
- Mobile responsiveness (if applicable)
- Performance with large content

---

*Last updated: September 12, 2025*
**Created by:** Lokus Development Team  
**Purpose:** Comprehensive markdown feature testing