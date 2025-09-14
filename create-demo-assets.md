# 📸 Demo Assets Creation Guide

## Screenshots Needed for README

To make the README showcase irresistible, we need these screenshots:

### 1. **Math Demo** (`docs-screenshots/math-demo.png`)
- Show both inline and block math equations
- Example content:
  ```
  Einstein's famous equation: $E = mc^2$
  
  The Gaussian integral:
  $$\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}$$
  
  Maxwell's equations in differential form:
  $$\nabla \cdot \vec{E} = \frac{\rho}{\epsilon_0}$$
  ```

### 2. **Wiki Links Demo** (`docs-screenshots/wiki-demo.png`)
- Show autocomplete in action
- Type `[[` and show the suggestion dropdown
- Include bidirectional linking indicators

### 3. **Theme Demo** (`docs-screenshots/theme-demo.png`)
- Split screen: before/after theme customization
- Show the preferences panel with theme controls
- Demonstrate real-time color changes

### 4. **Editor Overview** (`docs-screenshots/editor-overview.png`)
- Clean, full editor interface
- Show rich markdown content (tables, lists, code blocks)
- Minimal, distraction-free environment

### 5. **Feature Showcase** (`docs-screenshots/features-showcase.png`)
- Multiple panels showing different features
- Task lists, code blocks, images, tables
- Professional, polished look

## How to Create Screenshots

### Setup for Consistent Screenshots:
1. **Window size**: 1200x800 pixels
2. **Zoom**: 100% (Cmd+0 to reset)
3. **Theme**: Use the default light theme for consistency
4. **Content**: Use the provided example content

### Screenshot Tools:
- **macOS**: Cmd+Shift+4 (select area)
- **Windows**: Snipping Tool or Win+Shift+S  
- **Linux**: gnome-screenshot or similar

### Post-processing:
- **Resize**: Max width 800px for README
- **Optimize**: Use tools like TinyPNG to reduce file size
- **Format**: PNG for screenshots with text/UI elements

## Demo Content Examples

### Sample Note for Screenshots:

```markdown
# Welcome to Lokus 🚀

## Mathematical Beauty

Einstein's breakthrough: $E = mc^2$

The fundamental theorem of calculus:
$$\int_a^b f'(x) dx = f(b) - f(a)$$

## Connected Thinking

Wiki links help you connect ideas: [[Project Ideas]] and [[Research Notes]]

## Rich Content

- [x] Completed tasks
- [ ] Pending items
- [ ] Future goals

### Code That Matters

```javascript
function fibonacci(n) {
  return n <= 1 ? n : fibonacci(n-1) + fibonacci(n-2);
}
```

> "The best writing tool adapts to how you think, not the other way around."
```

### Gif/Video Ideas:

1. **Real-time Theme Customization**
   - Record changing colors, fonts, spacing
   - Show instant preview updates
   - 10-15 seconds max

2. **Wiki Link Autocomplete**
   - Type `[[` and show suggestions appearing
   - Select a suggestion and see link created
   - 5-10 seconds

3. **Math Rendering**
   - Type LaTeX and watch it render in real-time
   - Both inline and block equations
   - 5-10 seconds

## File Organization

```
docs-screenshots/
├── math-demo.png
├── wiki-demo.png  
├── theme-demo.png
├── editor-overview.png
├── features-showcase.png
├── theme-customization.gif (optional)
├── wiki-autocomplete.gif (optional)
└── math-rendering.gif (optional)
```

## Quality Guidelines

- **High resolution**: At least 1200px wide
- **Clean interface**: Hide OS-specific elements
- **Consistent styling**: Use same theme across screenshots  
- **Readable text**: Ensure text is crisp and clear
- **Optimized file size**: Compress for web without quality loss

## Usage Rights

All screenshots and demo assets will be:
- Licensed under MIT (same as code)
- Available for community use
- Credited to contributors who create them

---

**Need help creating these?** Ask in [Discussions](https://github.com/CodeWithInferno/Lokus/discussions) - the community loves helping with visual content!