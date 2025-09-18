<h1>Comprehensive Markdown Test File</h1><p>This file contains examples of all supported markdown features in Lokus. Use this to test and showcase the editor’s capabilities.</p><h2>Basic Formatting</h2><p><strong>Bold text</strong> and <em>italic text</em> and <strong><em>bold italic text</em></strong></p><p><s>Strikethrough text</s></p><p><mark>Highlighted text</mark></p><p><code>inline code</code></p><blockquote><p>This is a blockquote</p><p>It can span multiple lines</p><blockquote><p>And can be nested</p><blockquote><p>Like this</p></blockquote></blockquote></blockquote><h2>Headings</h2><h1>Heading 1</h1><h2>Heading 2</h2><h3>Heading 3</h3><h4>Heading 4</h4><h5>Heading 5</h5><h6>Heading 6</h6><h2>Lists</h2><h3>Unordered Lists</h3><ul><li><p>First item</p></li><li><p>Second item
</p><ul><li><p>Nested item</p></li><li><p>Another nested item
</p><ul><li><p>Double nested</p></li><li><p>More double nested</p></li></ul></li></ul></li><li><p>Third item</p></li></ul><h3>Ordered Lists</h3><ol><li><p>First numbered item</p></li><li><p>Second numbered item
</p><ol><li><p>Nested numbered item</p></li><li><p>Another nested numbered item</p></li></ol></li><li><p>Third numbered item</p></li></ol><h3>Task Lists</h3><ul><li><p>[x] Completed task</p></li><li><p>[x] Another completed task</p></li><li><p>[ ] Incomplete task</p></li><li><p>[ ] Another incomplete task
</p><ul><li><p>[ ] Nested incomplete task</p></li><li><p>[x] Nested completed task</p></li></ul></li></ul><h2>Code Blocks</h2><h3>Plain Code Block</h3><pre><code>function hello() {
  console.log("Hello, World!");
}
</code></pre><h3>JavaScript Code Block</h3><pre><code class="language-javascript">const greeting = "Hello, Lokus!";

function greetUser(name) {
  return `${greeting} Welcome, ${name}!`;
}

// Arrow function example
const multiply = (a, b) =&gt; a * b;

// Async/await example
async function fetchData() {
  try {
    const response = await fetch('/api/data');
    return await response.json();
  } catch (error) {
    console.error('Error:', error);
  }
}
</code></pre><h3>Python Code Block</h3><pre><code class="language-python">def fibonacci(n):
    """Generate Fibonacci sequence up to n terms"""
    if n &lt;= 0:
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
</code></pre><h3>CSS Code Block</h3><pre><code class="language-css">.markdown-editor {
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
</code></pre><h3>HTML Code Block</h3><pre><code class="language-html">&lt;!DOCTYPE html&gt;
&lt;html lang="en"&gt;
&lt;head&gt;
    &lt;meta charset="UTF-8"&gt;
    &lt;meta name="viewport" content="width=device-width, initial-scale=1.0"&gt;
    &lt;title&gt;Lokus - Note Taking App&lt;/title&gt;
&lt;/head&gt;
&lt;body&gt;
    &lt;header&gt;
        &lt;h1&gt;Welcome to Lokus&lt;/h1&gt;
        &lt;nav&gt;
            &lt;a href="#features"&gt;Features&lt;/a&gt;
            &lt;a href="#docs"&gt;Documentation&lt;/a&gt;
        &lt;/nav&gt;
    &lt;/header&gt;
    
    &lt;main&gt;
        &lt;section id="features"&gt;
            &lt;h2&gt;Amazing Features&lt;/h2&gt;
            &lt;ul&gt;
                &lt;li&gt;Real-time editing&lt;/li&gt;
                &lt;li&gt;Wiki-style linking&lt;/li&gt;
                &lt;li&gt;Beautiful themes&lt;/li&gt;
            &lt;/ul&gt;
        &lt;/section&gt;
    &lt;/main&gt;
&lt;/body&gt;
&lt;/html&gt;
</code></pre><h2>Tables</h2><h3>Simple Table</h3><table style="min-width: 75px;"><colgroup><col style="min-width: 25px;"><col style="min-width: 25px;"><col style="min-width: 25px;"></colgroup><tbody><tr><th colspan="1" rowspan="1"><p>Feature</p></th><th colspan="1" rowspan="1"><p>Status</p></th><th colspan="1" rowspan="1"><p>Notes</p></th></tr><tr><td colspan="1" rowspan="1"><p>Basic formatting</p></td><td colspan="1" rowspan="1"><p>✅ Complete</p></td><td colspan="1" rowspan="1"><p>Bold, italic, code</p></td></tr><tr><td colspan="1" rowspan="1"><p>Tables</p></td><td colspan="1" rowspan="1"><p>✅ Complete</p></td><td colspan="1" rowspan="1"><p>Resizable columns</p></td></tr><tr><td colspan="1" rowspan="1"><p>Math</p></td><td colspan="1" rowspan="1"><p>✅ Complete</p></td><td colspan="1" rowspan="1"><p>LaTeX support</p></td></tr><tr><td colspan="1" rowspan="1"><p>Wiki links</p></td><td colspan="1" rowspan="1"><p>✅ Complete</p></td><td colspan="1" rowspan="1"><p>[[link]] syntax</p></td></tr></tbody></table><h3>Complex Table</h3><table style="min-width: 100px;"><colgroup><col style="min-width: 25px;"><col style="min-width: 25px;"><col style="min-width: 25px;"><col style="min-width: 25px;"></colgroup><tbody><tr><th colspan="1" rowspan="1"><p>Programming Language</p></th><th colspan="1" rowspan="1"><p>Popularity</p></th><th colspan="1" rowspan="1"><p>Use Cases</p></th><th colspan="1" rowspan="1"><p>Learning Difficulty</p></th></tr><tr><td colspan="1" rowspan="1"><p>JavaScript</p></td><td colspan="1" rowspan="1"><p>Very High</p></td><td colspan="1" rowspan="1"><p>Web dev, mobile, backend</p></td><td colspan="1" rowspan="1"><p>Easy</p></td></tr><tr><td colspan="1" rowspan="1"><p>Python</p></td><td colspan="1" rowspan="1"><p>Very High</p></td><td colspan="1" rowspan="1"><p>Data science, AI, web</p></td><td colspan="1" rowspan="1"><p>Easy</p></td></tr><tr><td colspan="1" rowspan="1"><p>Java</p></td><td colspan="1" rowspan="1"><p>High</p></td><td colspan="1" rowspan="1"><p>Enterprise, Android</p></td><td colspan="1" rowspan="1"><p>Medium</p></td></tr><tr><td colspan="1" rowspan="1"><p>C++</p></td><td colspan="1" rowspan="1"><p>Medium</p></td><td colspan="1" rowspan="1"><p>System programming, games</p></td><td colspan="1" rowspan="1"><p>Hard</p></td></tr><tr><td colspan="1" rowspan="1"><p>Rust</p></td><td colspan="1" rowspan="1"><p>Growing</p></td><td colspan="1" rowspan="1"><p>System programming, web</p></td><td colspan="1" rowspan="1"><p>Hard</p></td></tr></tbody></table><h2>Math (LaTeX)</h2><h3>Inline Math</h3><p>The quadratic formula is $x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}$ and Einstein’s famous equation is $E = mc^2$.</p><h3>Block Math</h3><p>$$<br>
\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}<br>
$$</p><h1>$$<br>
\begin{bmatrix}<br>
a &amp; b \<br>
c &amp; d<br>
\end{bmatrix}<br>
\begin{bmatrix}<br>
x \<br>
y<br>
\end{bmatrix}</h1><p>\begin{bmatrix}<br>
ax + by \<br>
cx + dy<br>
\end{bmatrix}<br>
$$</p><p>$$<br>
f(x) = \begin{cases}<br>
x^2 &amp; \text{if } x \geq 0 \<br>
-x^2 &amp; \text{if } x &lt; 0<br>
\end{cases}<br>
$$</p><h2>Links and References</h2><h3>Regular Links</h3><ul><li><p><a target="_blank" rel="noopener noreferrer nofollow" href="https://lokus-docs.example.com">Lokus Documentation</a></p></li><li><p><a target="_blank" rel="noopener noreferrer nofollow" href="https://github.com/user/lokus">GitHub Repository</a></p></li><li><p><a target="_blank" rel="noopener noreferrer nofollow" href="https://automatic-link-detection.com">https://automatic-link-detection.com</a></p></li></ul><h3>Wiki Links</h3><ul><li><p>[[Getting Started]]</p></li><li><p>[[Advanced Features]]</p></li><li><p>[[Configuration Guide]]</p></li><li><p>[[Troubleshooting]]</p></li></ul><h3>Image Links</h3><p></p><h2>Advanced Formatting</h2><h3>Superscript and Subscript</h3><ul><li><p>Water formula: H^2^O</p></li><li><p>Mathematical notation: x~1~, x~2~, x~n~</p></li><li><p>Footnote reference^[This is a footnote]</p></li></ul><h3>Horizontal Rules</h3><hr><p>Above and below this line are horizontal rules.</p><hr><h2>Special Characters and Symbols</h2><h3>Common Symbols</h3><ul><li><p>Arrows: → ← ↑ ↓ ↔ ⇒ ⇐ ⇔</p></li><li><p>Math: ∞ ± × ÷ ≈ ≠ ≤ ≥ ∫ ∑ ∏ √</p></li><li><p>Currency: $ € £ ¥ ₹ ₿</p></li><li><p>Misc: © ® ™ § ¶ † ‡ • ‰ ‱</p></li></ul><h3>Emoji Support</h3><ul><li><p>🚀 Rocket for productivity</p></li><li><p>📝 Note-taking made easy</p></li><li><p>✨ Beautiful and intuitive</p></li><li><p>🎯 Focus on what matters</p></li><li><p>💡 Bright ideas ahead</p></li></ul><h2>Testing Instructions</h2><h3>Copy-Paste Tests</h3><ol><li><p>Copy any section above and paste it into the editor</p></li><li><p>Verify that formatting is preserved</p></li><li><p>Test editing capabilities</p></li></ol><h3>Feature Tests</h3><ul><li><p>[ ] Test <strong>bold</strong> formatting</p></li><li><p>[ ] Test <em>italic</em> formatting</p></li><li><p>[ ] Test <s>strikethrough</s> formatting</p></li><li><p>[ ] Test <mark>highlight</mark> formatting</p></li><li><p>[ ] Test <code>inline code</code> formatting</p></li><li><p>[ ] Test &gt; blockquotes</p></li><li><p>[ ] Test unordered lists</p></li><li><p>[ ] Test ordered lists</p></li><li><p>[ ] Test task lists with checkboxes</p></li><li><p>[ ] Test tables with resizing</p></li><li><p>[ ] Test code blocks with syntax highlighting</p></li><li><p>[ ] Test math equations (inline and block)</p></li><li><p>[ ] Test wiki links [[example]]</p></li><li><p>[ ] Test regular links</p></li><li><p>[ ] Test images</p></li><li><p>[ ] Test horizontal rules</p></li><li><p>[ ] Test headings (all levels)</p></li><li><p>[ ] Test superscript^text^</p></li><li><p>[ ] Test subscript~text~</p></li></ul><h3>Performance Tests</h3><ul><li><p>[ ] Large documents (1000+ lines)</p></li><li><p>[ ] Complex tables (10x10 or larger)</p></li><li><p>[ ] Multiple code blocks</p></li><li><p>[ ] Heavy math content</p></li><li><p>[ ] Many wiki links</p></li></ul><h2>Notes</h2><p>This test file should help you verify that all markdown features work correctly in Lokus. Each section tests different aspects of the editor’s capabilities.</p><p>Remember to test:</p><ul><li><p>Real-time rendering</p></li><li><p>Copy-paste functionality</p></li><li><p>Keyboard shortcuts</p></li><li><p>Mobile responsiveness (if applicable)</p></li><li><p>Performance with large content</p></li></ul><hr><p><em>Last updated: September 12, 2025</em><br><strong>Created by:</strong> Lokus Development Team<br><strong>Purpose:</strong> Comprehensive markdown feature testing</p>