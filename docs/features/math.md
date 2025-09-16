# Math Rendering

Lokus includes comprehensive mathematical equation support powered by KaTeX, enabling you to write and render complex mathematical expressions directly in your notes. The math rendering system supports both inline and display-style equations with LaTeX syntax.

## Overview

The math rendering system provides:
- **KaTeX integration** - Fast, high-quality mathematical typesetting
- **Inline and block math** - Support for both inline `$...$` and display `$$...$$` equations
- **LaTeX compatibility** - Standard LaTeX syntax for mathematical expressions
- **Real-time rendering** - Equations render as you type
- **Error handling** - Clear error messages for invalid syntax
- **Copy/paste support** - Math equations copy as LaTeX and render on paste

## Math Syntax

### Inline Math
Create mathematical expressions within text using single dollar signs:
```
The quadratic formula is $x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}$ which...
```

Renders as: The quadratic formula is $x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}$ which...

### Block Math (Display Mode)
Create centered, standalone equations using double dollar signs:
```
$$
E = mc^2
$$
```

Renders as a centered, larger equation.

### Multi-line Equations
Use alignment environments for multi-line equations:
```
$$
\begin{align}
f(x) &= x^2 + 2x + 1 \\
     &= (x + 1)^2
\end{align}
$$
```

## Supported LaTeX Features

### Basic Operations
- **Arithmetic**: `+`, `-`, `\times`, `\div`, `\pm`, `\mp`
- **Fractions**: `\frac{numerator}{denominator}`
- **Exponents**: `x^2`, `x^{n+1}`
- **Subscripts**: `x_i`, `x_{i,j}`
- **Roots**: `\sqrt{x}`, `\sqrt[n]{x}`

### Greek Letters
- **Lowercase**: `\alpha`, `\beta`, `\gamma`, `\delta`, `\epsilon`, `\theta`, `\lambda`, `\mu`, `\pi`, `\sigma`, `\tau`, `\phi`, `\omega`
- **Uppercase**: `\Alpha`, `\Beta`, `\Gamma`, `\Delta`, `\Theta`, `\Lambda`, `\Pi`, `\Sigma`, `\Omega`

### Mathematical Symbols
- **Relations**: `=`, `\neq`, `<`, `>`, `\leq`, `\geq`, `\approx`, `\equiv`
- **Logic**: `\land`, `\lor`, `\neg`, `\implies`, `\iff`
- **Set Theory**: `\in`, `\notin`, `\subset`, `\supset`, `\cup`, `\cap`, `\emptyset`
- **Calculus**: `\partial`, `\nabla`, `\int`, `\sum`, `\prod`, `\lim`

### Functions and Operators
- **Trigonometric**: `\sin`, `\cos`, `\tan`, `\sec`, `\csc`, `\cot`
- **Hyperbolic**: `\sinh`, `\cosh`, `\tanh`
- **Logarithmic**: `\log`, `\ln`, `\lg`
- **Other**: `\exp`, `\max`, `\min`, `\sup`, `\inf`

### Brackets and Delimiters
- **Parentheses**: `()`, `\left( \right)`
- **Square Brackets**: `[]`, `\left[ \right]`
- **Curly Braces**: `\{\}`, `\left\{ \right\}`
- **Angle Brackets**: `\langle \rangle`
- **Vertical Bars**: `|x|`, `\left| x \right|`
- **Double Bars**: `\|x\|`, `\left\| x \right\|`

## Advanced Math Features

### Matrices and Arrays
Create matrices using various environments:
```
$$
\begin{pmatrix}
a & b \\
c & d
\end{pmatrix}
$$

$$
\begin{bmatrix}
1 & 0 & 0 \\
0 & 1 & 0 \\
0 & 0 & 1
\end{bmatrix}
$$
```

### Aligned Equations
Use the align environment for multi-line equations:
```
$$
\begin{align}
\nabla \cdot \mathbf{E} &= \frac{\rho}{\epsilon_0} \\
\nabla \cdot \mathbf{B} &= 0 \\
\nabla \times \mathbf{E} &= -\frac{\partial \mathbf{B}}{\partial t} \\
\nabla \times \mathbf{B} &= \mu_0\mathbf{J} + \mu_0\epsilon_0\frac{\partial \mathbf{E}}{\partial t}
\end{align}
$$
```

### Chemical Equations
KaTeX supports chemical equations with subscripts and superscripts:
```
$$
\ce{H2SO4 + 2NaOH -> Na2SO4 + 2H2O}
$$

$$
\ce{^{14}C + ^{1}H -> ^{14}N + e^- + \nu_e}
$$
```

### Complex Expressions
Build complex mathematical expressions:
```
$$
\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
$$

$$
\sum_{n=1}^{\infty} \frac{1}{n^2} = \frac{\pi^2}{6}
$$

$$
\lim_{x \to 0} \frac{\sin x}{x} = 1
$$
```

## Math Input and Editing

### Creating Math Expressions
1. **Type Delimiters** - Type `$` for inline or `$$` for block math
2. **Enter Math Mode** - Cursor position indicates math input mode
3. **Type LaTeX** - Use standard LaTeX syntax for expressions
4. **Live Preview** - Equations render in real-time as you type
5. **Exit Math Mode** - Close with matching delimiter

### Editing Existing Math
- **Click to Edit** - Click any rendered equation to edit its LaTeX source
- **Cursor Navigation** - Use arrow keys to navigate within math expressions
- **Selection** - Select parts of LaTeX code for editing
- **Undo/Redo** - Full undo/redo support for math editing

### Error Handling
When math syntax is invalid:
- **Error Display** - Invalid equations show with red error styling
- **Error Messages** - Detailed error messages help identify issues
- **Graceful Fallback** - Invalid math shows original LaTeX source
- **Real-time Validation** - Immediate feedback on syntax errors

## Math Formatting Options

### Font Styles
- **Bold**: `\mathbf{x}` or `\boldsymbol{\alpha}`
- **Italic**: `\mathit{text}` (default for variables)
- **Calligraphic**: `\mathcal{L}` for script letters
- **Blackboard Bold**: `\mathbb{R}` for number sets
- **Sans Serif**: `\mathsf{text}`
- **Monospace**: `\mathtt{text}`

### Spacing Control
- **Thin Space**: `\,` 
- **Medium Space**: `\:` 
- **Thick Space**: `\;`
- **Negative Space**: `\!`
- **Quad Space**: `\quad`
- **Double Quad**: `\qquad`

### Text in Math Mode
Include text within math expressions:
```
$$
f(x) = \begin{cases}
x^2 & \text{if } x \geq 0 \\
-x^2 & \text{if } x < 0
\end{cases}
$$
```

## Performance and Optimization

### Rendering Performance
- **Incremental Rendering** - Only re-render changed equations
- **Caching** - Cache rendered equations for faster display
- **Background Processing** - Render complex equations in background
- **Memory Management** - Efficient handling of many equations

### Large Document Handling
- **Lazy Rendering** - Render equations only when visible
- **Viewport Culling** - Don't process equations outside view
- **Progressive Loading** - Load equations as user scrolls
- **Memory Limits** - Prevent memory issues with many equations

### Error Recovery
- **Syntax Error Handling** - Graceful handling of invalid LaTeX
- **Partial Rendering** - Render valid parts of partially invalid expressions
- **Fallback Display** - Show source LaTeX when rendering fails
- **User Feedback** - Clear feedback about what went wrong

## Integration Features

### Copy and Paste
- **LaTeX Copying** - Copy equations as LaTeX source code
- **MathML Support** - Paste MathML and convert to KaTeX
- **Image Fallback** - Copy equations as images when needed
- **Cross-application** - Paste LaTeX from other math applications

### Template Integration
- **Math Templates** - Include common equations in templates
- **Variable Substitution** - Template variables work within math expressions
- **Formula Libraries** - Collections of frequently used formulas
- **Quick Insert** - Insert common math expressions quickly

### Export and Sharing
- **PDF Export** - High-quality math rendering in PDF export
- **HTML Export** - Math expressions preserved in HTML
- **Image Export** - Convert equations to images for sharing
- **LaTeX Export** - Export entire documents as LaTeX

## Accessibility

### Screen Reader Support
- **MathML Generation** - Generate MathML for screen readers
- **Alt Text** - Provide text descriptions of equations
- **Formula Reading** - Support for math-aware screen readers
- **Navigation** - Navigate through complex expressions logically

### Keyboard Navigation
- **Tab Navigation** - Navigate between math expressions
- **Arrow Keys** - Navigate within math expression editing
- **Keyboard Shortcuts** - Quick access to common math symbols
- **Voice Input** - Support for math dictation (system-dependent)

### Visual Accessibility
- **High Contrast** - Math equations respect high contrast settings
- **Font Scaling** - Math scales with system font size
- **Color Customization** - Adjust math colors for visibility
- **Focus Indicators** - Clear focus indicators for math editing

## Common Math Examples

### Basic Algebra
```
$ax^2 + bx + c = 0$
$x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}$
$(a + b)^2 = a^2 + 2ab + b^2$
```

### Calculus
```
$\frac{d}{dx}[f(x)] = f'(x)$
$\int_a^b f(x) dx$
$\lim_{h \to 0} \frac{f(x+h) - f(x)}{h} = f'(x)$
```

### Linear Algebra
```
$\mathbf{A}\mathbf{x} = \mathbf{b}$
$\det(\mathbf{A}) = ad - bc$ (for 2×2 matrix)
$\mathbf{A}^{-1} = \frac{1}{\det(\mathbf{A})}\text{adj}(\mathbf{A})$
```

### Statistics and Probability
```
$P(A \cap B) = P(A) \cdot P(B|A)$
$\mu = \frac{1}{n}\sum_{i=1}^n x_i$
$\sigma^2 = \frac{1}{n}\sum_{i=1}^n (x_i - \mu)^2$
```

### Physics
```
$F = ma$
$E = mc^2$
$\psi(x,t) = Ae^{i(kx - \omega t)}$
$\nabla^2 \phi = 4\pi G \rho$
```

## Troubleshooting

### Common Issues

**Math not rendering:**
- Check that delimiters match (`$...$` or `$$...$$`)
- Verify LaTeX syntax is correct
- Look for JavaScript errors in browser console
- Try refreshing the page or restarting application

**Syntax errors in equations:**
- Check for missing braces `{}` in commands
- Verify command names are spelled correctly
- Ensure proper nesting of environments
- Look for unmatched delimiters

**Performance issues with math:**
- Limit number of complex equations on one page
- Use simpler expressions when possible
- Check available system memory
- Disable real-time rendering if experiencing lag

**Copy/paste problems:**
- Verify LaTeX syntax when pasting
- Check source application formats LaTeX correctly
- Try pasting as plain text first
- Manually type equations if paste fails

### Best Practices
1. **Start simple** - Begin with basic expressions and add complexity
2. **Check syntax** - Verify LaTeX syntax before closing delimiters
3. **Use templates** - Create templates for frequently used equations
4. **Preview often** - Check rendering frequently while editing
5. **Document formulas** - Add text explanations for complex equations

## Related Features

- **[Editor](./editor.md)** - Rich text editing with math support
- **[Template System](./template-system.md)** - Math expression templates
- **[Export](./export.md)** - Exporting documents with math
- **[Copy/Paste](./clipboard.md)** - Clipboard integration for math

---

*For technical math rendering implementation details, see the [Math API Documentation](../api/math.md).*