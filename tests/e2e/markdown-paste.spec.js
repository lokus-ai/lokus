import { test, expect } from '@playwright/test';

test.describe('Markdown Paste Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for editor to load
    await page.waitForSelector('.ProseMirror, .tiptap-area', { timeout: 5000 });
  });

  test.describe('Basic Markdown Paste', () => {
    test('should convert pasted markdown bold text to rich text', async ({ page }) => {
      const editor = page.locator('.ProseMirror').first();
      await editor.click();

      // Simulate pasting markdown bold text
      await page.evaluate(() => {
        const editor = document.querySelector('.ProseMirror');
        const event = new ClipboardEvent('paste', {
          clipboardData: new DataTransfer()
        });
        event.clipboardData.setData('text/plain', '**bold text**');
        editor.dispatchEvent(event);
      });

      // Wait for conversion and check result
      await expect(editor.locator('strong')).toContainText('bold text');
    });

    test('should convert pasted markdown italic text to rich text', async ({ page }) => {
      const editor = page.locator('.ProseMirror').first();
      await editor.click();

      await page.evaluate(() => {
        const editor = document.querySelector('.ProseMirror');
        const event = new ClipboardEvent('paste', {
          clipboardData: new DataTransfer()
        });
        event.clipboardData.setData('text/plain', '*italic text*');
        editor.dispatchEvent(event);
      });

      await expect(editor.locator('em')).toContainText('italic text');
    });

    test('should convert pasted markdown strikethrough to rich text', async ({ page }) => {
      const editor = page.locator('.ProseMirror').first();
      await editor.click();

      await page.evaluate(() => {
        const editor = document.querySelector('.ProseMirror');
        const event = new ClipboardEvent('paste', {
          clipboardData: new DataTransfer()
        });
        event.clipboardData.setData('text/plain', '~~strikethrough text~~');
        editor.dispatchEvent(event);
      });

      await expect(editor.locator('s')).toContainText('strikethrough text');
    });

    test('should convert pasted markdown highlight to rich text', async ({ page }) => {
      const editor = page.locator('.ProseMirror').first();
      await editor.click();

      await page.evaluate(() => {
        const editor = document.querySelector('.ProseMirror');
        const event = new ClipboardEvent('paste', {
          clipboardData: new DataTransfer()
        });
        event.clipboardData.setData('text/plain', '==highlighted text==');
        editor.dispatchEvent(event);
      });

      await expect(editor.locator('mark')).toContainText('highlighted text');
    });

    test('should convert pasted markdown code to rich text', async ({ page }) => {
      const editor = page.locator('.ProseMirror').first();
      await editor.click();

      await page.evaluate(() => {
        const editor = document.querySelector('.ProseMirror');
        const event = new ClipboardEvent('paste', {
          clipboardData: new DataTransfer()
        });
        event.clipboardData.setData('text/plain', '`inline code`');
        editor.dispatchEvent(event);
      });

      await expect(editor.locator('code')).toContainText('inline code');
    });
  });

  test.describe('Complex Markdown Paste', () => {
    test('should convert pasted markdown headings', async ({ page }) => {
      const editor = page.locator('.ProseMirror').first();
      await editor.click();

      await page.evaluate(() => {
        const editor = document.querySelector('.ProseMirror');
        const event = new ClipboardEvent('paste', {
          clipboardData: new DataTransfer()
        });
        event.clipboardData.setData('text/plain', '# Main Heading\\n## Sub Heading');
        editor.dispatchEvent(event);
      });

      await expect(editor.locator('h1')).toContainText('Main Heading');
      await expect(editor.locator('h2')).toContainText('Sub Heading');
    });

    test('should convert pasted markdown lists', async ({ page }) => {
      const editor = page.locator('.ProseMirror').first();
      await editor.click();

      await page.evaluate(() => {
        const editor = document.querySelector('.ProseMirror');
        const event = new ClipboardEvent('paste', {
          clipboardData: new DataTransfer()
        });
        event.clipboardData.setData('text/plain', '- Item 1\\n- Item 2\\n- Item 3');
        editor.dispatchEvent(event);
      });

      await expect(editor.locator('ul li')).toHaveCount(3);
      await expect(editor.locator('ul li').first()).toContainText('Item 1');
    });

    test('should convert pasted markdown numbered lists', async ({ page }) => {
      const editor = page.locator('.ProseMirror').first();
      await editor.click();

      await page.evaluate(() => {
        const editor = document.querySelector('.ProseMirror');
        const event = new ClipboardEvent('paste', {
          clipboardData: new DataTransfer()
        });
        event.clipboardData.setData('text/plain', '1. First item\\n2. Second item\\n3. Third item');
        editor.dispatchEvent(event);
      });

      await expect(editor.locator('ol li')).toHaveCount(3);
      await expect(editor.locator('ol li').first()).toContainText('First item');
    });

    test('should convert pasted markdown blockquotes', async ({ page }) => {
      const editor = page.locator('.ProseMirror').first();
      await editor.click();

      await page.evaluate(() => {
        const editor = document.querySelector('.ProseMirror');
        const event = new ClipboardEvent('paste', {
          clipboardData: new DataTransfer()
        });
        event.clipboardData.setData('text/plain', '> This is a blockquote\\n> with multiple lines');
        editor.dispatchEvent(event);
      });

      await expect(editor.locator('blockquote')).toContainText('This is a blockquote');
    });

    test('should convert pasted markdown code blocks', async ({ page }) => {
      const editor = page.locator('.ProseMirror').first();
      await editor.click();

      await page.evaluate(() => {
        const editor = document.querySelector('.ProseMirror');
        const event = new ClipboardEvent('paste', {
          clipboardData: new DataTransfer()
        });
        event.clipboardData.setData('text/plain', '```javascript\\nconst hello = "world";\\nconsole.log(hello);\\n```');
        editor.dispatchEvent(event);
      });

      await expect(editor.locator('pre code')).toContainText('const hello = "world"');
    });

    test('should handle mixed markdown formatting', async ({ page }) => {
      const editor = page.locator('.ProseMirror').first();
      await editor.click();

      await page.evaluate(() => {
        const editor = document.querySelector('.ProseMirror');
        const event = new ClipboardEvent('paste', {
          clipboardData: new DataTransfer()
        });
        event.clipboardData.setData('text/plain', '# Heading\\n\\nThis has **bold** and *italic* text with `code`.\\n\\n- List item 1\\n- List item 2');
        editor.dispatchEvent(event);
      });

      await expect(editor.locator('h1')).toContainText('Heading');
      await expect(editor.locator('strong')).toContainText('bold');
      await expect(editor.locator('em')).toContainText('italic');
      await expect(editor.locator('code')).toContainText('code');
      await expect(editor.locator('ul li')).toHaveCount(2);
    });
  });

  test.describe('Markdown Table Paste', () => {
    test('should convert pasted markdown table to HTML table', async ({ page }) => {
      const editor = page.locator('.ProseMirror').first();
      await editor.click();

      await page.evaluate(() => {
        const editor = document.querySelector('.ProseMirror');
        const event = new ClipboardEvent('paste', {
          clipboardData: new DataTransfer()
        });
        event.clipboardData.setData('text/plain', 
          '| Header 1 | Header 2 | Header 3 |\\n' +
          '| --- | --- | --- |\\n' +
          '| Cell 1 | Cell 2 | Cell 3 |\\n' +
          '| Cell 4 | Cell 5 | Cell 6 |'
        );
        editor.dispatchEvent(event);
      });

      // Wait for table to be inserted
      await expect(editor.locator('table')).toBeVisible();
      await expect(editor.locator('thead th')).toHaveCount(3);
      await expect(editor.locator('tbody tr')).toHaveCount(2);
      await expect(editor.locator('thead th').first()).toContainText('Header 1');
      await expect(editor.locator('tbody td').first()).toContainText('Cell 1');
    });

    test('should handle table without leading/trailing pipes', async ({ page }) => {
      const editor = page.locator('.ProseMirror').first();
      await editor.click();

      await page.evaluate(() => {
        const editor = document.querySelector('.ProseMirror');
        const event = new ClipboardEvent('paste', {
          clipboardData: new DataTransfer()
        });
        event.clipboardData.setData('text/plain', 
          'Header A | Header B\\n' +
          '--- | ---\\n' +
          'Data 1 | Data 2'
        );
        editor.dispatchEvent(event);
      });

      await expect(editor.locator('table')).toBeVisible();
      await expect(editor.locator('thead th')).toHaveCount(2);
      await expect(editor.locator('tbody tr')).toHaveCount(1);
    });

    test('should handle table with alignment indicators', async ({ page }) => {
      const editor = page.locator('.ProseMirror').first();
      await editor.click();

      await page.evaluate(() => {
        const editor = document.querySelector('.ProseMirror');
        const event = new ClipboardEvent('paste', {
          clipboardData: new DataTransfer()
        });
        event.clipboardData.setData('text/plain', 
          '| Left | Center | Right |\\n' +
          '| :--- | :---: | ---: |\\n' +
          '| L1 | C1 | R1 |'
        );
        editor.dispatchEvent(event);
      });

      await expect(editor.locator('table')).toBeVisible();
      await expect(editor.locator('thead th')).toHaveCount(3);
    });

    test('should handle table with varying cell counts', async ({ page }) => {
      const editor = page.locator('.ProseMirror').first();
      await editor.click();

      await page.evaluate(() => {
        const editor = document.querySelector('.ProseMirror');
        const event = new ClipboardEvent('paste', {
          clipboardData: new DataTransfer()
        });
        event.clipboardData.setData('text/plain', 
          '| H1 | H2 | H3 |\\n' +
          '| --- | --- | --- |\\n' +
          '| C1 | C2 |\\n' +
          '| C3 | C4 | C5 | C6 |'
        );
        editor.dispatchEvent(event);
      });

      await expect(editor.locator('table')).toBeVisible();
      await expect(editor.locator('thead th')).toHaveCount(3);
      // Should normalize to 3 columns based on header
    });

    test('should escape HTML in table cells', async ({ page }) => {
      const editor = page.locator('.ProseMirror').first();
      await editor.click();

      await page.evaluate(() => {
        const editor = document.querySelector('.ProseMirror');
        const event = new ClipboardEvent('paste', {
          clipboardData: new DataTransfer()
        });
        event.clipboardData.setData('text/plain', 
          '| Header | Content |\\n' +
          '| --- | --- |\\n' +
          '| Cell | <script>alert("xss")</script> |'
        );
        editor.dispatchEvent(event);
      });

      await expect(editor.locator('table')).toBeVisible();
      // The script tag should be escaped and not executed
      await expect(editor.locator('tbody td').last()).toContainText('<script>');
    });
  });

  test.describe('Non-Markdown Paste Behavior', () => {
    test('should not convert regular text without markdown', async ({ page }) => {
      const editor = page.locator('.ProseMirror').first();
      await editor.click();

      await page.evaluate(() => {
        const editor = document.querySelector('.ProseMirror');
        const event = new ClipboardEvent('paste', {
          clipboardData: new DataTransfer()
        });
        event.clipboardData.setData('text/plain', 'This is just regular text without any markdown');
        editor.dispatchEvent(event);
      });

      // Should remain as plain text
      await expect(editor).toContainText('This is just regular text without any markdown');
      await expect(editor.locator('strong')).toHaveCount(0);
      await expect(editor.locator('em')).toHaveCount(0);
    });

    test('should not process HTML content', async ({ page }) => {
      const editor = page.locator('.ProseMirror').first();
      await editor.click();

      await page.evaluate(() => {
        const editor = document.querySelector('.ProseMirror');
        const event = new ClipboardEvent('paste', {
          clipboardData: new DataTransfer()
        });
        event.clipboardData.setData('text/plain', '**bold text**');
        event.clipboardData.setData('text/html', '<p><strong>bold text</strong></p>');
        editor.dispatchEvent(event);
      });

      // Should use default paste behavior when HTML is present
      // The exact behavior depends on TipTap's default HTML handling
      await expect(editor).toContainText('bold text');
    });

    test('should handle empty clipboard gracefully', async ({ page }) => {
      const editor = page.locator('.ProseMirror').first();
      await editor.click();

      await page.evaluate(() => {
        const editor = document.querySelector('.ProseMirror');
        const event = new ClipboardEvent('paste', {
          clipboardData: new DataTransfer()
        });
        // No data set
        editor.dispatchEvent(event);
      });

      // Should not crash or cause errors
      await expect(editor).toBeVisible();
    });
  });

  test.describe('Edge Cases and Error Handling', () => {
    test('should handle malformed markdown gracefully', async ({ page }) => {
      const editor = page.locator('.ProseMirror').first();
      await editor.click();

      await page.evaluate(() => {
        const editor = document.querySelector('.ProseMirror');
        const event = new ClipboardEvent('paste', {
          clipboardData: new DataTransfer()
        });
        event.clipboardData.setData('text/plain', '**unclosed bold and *unclosed italic');
        editor.dispatchEvent(event);
      });

      // Should handle gracefully without crashing
      await expect(editor).toContainText('**unclosed bold and *unclosed italic');
    });

    test('should handle very long markdown content', async ({ page }) => {
      const editor = page.locator('.ProseMirror').first();
      await editor.click();

      const longContent = '# Heading\\n\\n' + 'This is a very long paragraph with **bold** text. '.repeat(100);

      await page.evaluate((content) => {
        const editor = document.querySelector('.ProseMirror');
        const event = new ClipboardEvent('paste', {
          clipboardData: new DataTransfer()
        });
        event.clipboardData.setData('text/plain', content);
        editor.dispatchEvent(event);
      }, longContent);

      await expect(editor.locator('h1')).toContainText('Heading');
      await expect(editor.locator('strong')).toHaveCount(100);
    });

    test('should handle unicode characters in markdown', async ({ page }) => {
      const editor = page.locator('.ProseMirror').first();
      await editor.click();

      await page.evaluate(() => {
        const editor = document.querySelector('.ProseMirror');
        const event = new ClipboardEvent('paste', {
          clipboardData: new DataTransfer()
        });
        event.clipboardData.setData('text/plain', '**Bold with émojis 🎉** and *italic with ñañes*');
        editor.dispatchEvent(event);
      });

      await expect(editor.locator('strong')).toContainText('Bold with émojis 🎉');
      await expect(editor.locator('em')).toContainText('italic with ñañes');
    });

    test('should not interfere with existing content', async ({ page }) => {
      const editor = page.locator('.ProseMirror').first();
      await editor.click();

      // Add some existing content
      await editor.fill('Existing content');
      await page.keyboard.press('Enter');
      await page.keyboard.press('Enter');

      // Paste markdown
      await page.evaluate(() => {
        const editor = document.querySelector('.ProseMirror');
        const event = new ClipboardEvent('paste', {
          clipboardData: new DataTransfer()
        });
        event.clipboardData.setData('text/plain', '**New bold content**');
        editor.dispatchEvent(event);
      });

      await expect(editor).toContainText('Existing content');
      await expect(editor.locator('strong')).toContainText('New bold content');
    });
  });

  test.describe('Performance and Responsiveness', () => {
    test('should handle multiple rapid paste operations', async ({ page }) => {
      const editor = page.locator('.ProseMirror').first();
      await editor.click();

      // Simulate multiple rapid paste operations
      for (let i = 0; i < 5; i++) {
        await page.evaluate((index) => {
          const editor = document.querySelector('.ProseMirror');
          const event = new ClipboardEvent('paste', {
            clipboardData: new DataTransfer()
          });
          event.clipboardData.setData('text/plain', `**Bold ${index}** and *italic ${index}*`);
          editor.dispatchEvent(event);
        }, i);
        
        // Small delay between pastes
        await page.waitForTimeout(50);
      }

      await expect(editor.locator('strong')).toHaveCount(5);
      await expect(editor.locator('em')).toHaveCount(5);
    });

    test('should maintain editor focus after paste', async ({ page }) => {
      const editor = page.locator('.ProseMirror').first();
      await editor.click();

      await page.evaluate(() => {
        const editor = document.querySelector('.ProseMirror');
        const event = new ClipboardEvent('paste', {
          clipboardData: new DataTransfer()
        });
        event.clipboardData.setData('text/plain', '**bold text**');
        editor.dispatchEvent(event);
      });

      // Editor should maintain focus after paste
      await expect(editor).toBeFocused();
    });
  });
});