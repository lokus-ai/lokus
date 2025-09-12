import { expect } from '@playwright/test';

/**
 * Helper functions for E2E tests
 */

export async function waitForEditorLoad(page) {
  await page.waitForSelector('.ProseMirror, .tiptap-area', { timeout: 10000 });
  await page.waitForTimeout(500); // Additional wait for editor to be ready
}

export async function getEditor(page) {
  return page.locator('.ProseMirror').first();
}

export async function typeInEditor(page, text) {
  const editor = await getEditor(page);
  await editor.click();
  await editor.fill(text);
  return editor;
}

export async function useSlashCommand(page, command) {
  const editor = await getEditor(page);
  await editor.click();
  await editor.type(`/${command}`);
  await page.waitForTimeout(500);
  
  const commandMenu = page.locator('.slash-command-list, .command-menu, [data-testid="slash-menu"]');
  if (await commandMenu.count() > 0) {
    await page.keyboard.press('Enter');
    return true;
  }
  return false;
}

export async function navigateToPreferences(page) {
  const preferencesButton = page.locator(
    '[data-testid="preferences"], ' +
    'button:has-text("Preferences"), ' +
    '.preferences-button, ' +
    '[aria-label="Preferences"]'
  );
  
  if (await preferencesButton.count() > 0) {
    await preferencesButton.first().click();
    await page.waitForTimeout(1000);
    return true;
  }
  
  // Try keyboard shortcut
  await page.keyboard.press('Control+,');
  await page.waitForTimeout(1000);
  return false;
}

export async function selectPreferencesSection(page, section) {
  const sectionButton = page.locator(`button:has-text("${section}")`);
  if (await sectionButton.count() > 0) {
    await sectionButton.click();
    await page.waitForTimeout(500);
    return true;
  }
  return false;
}

export async function expectMathRendering(page, mathText) {
  const editor = await getEditor(page);
  
  // Check for math-specific elements
  const mathElements = editor.locator('.math-inline, .math-block, [data-type="math-inline"], [data-type="math-block"]');
  
  if (await mathElements.count() > 0) {
    await expect(mathElements.first()).toBeVisible();
    return true;
  }
  
  // Fallback: check content
  const content = await editor.textContent();
  expect(content).toContain(mathText);
  return false;
}

export async function expectWikiLink(page, linkText) {
  const editor = await getEditor(page);
  const wikiLink = editor.locator('[data-type="wiki-link"], .wiki-link');
  
  if (await wikiLink.count() > 0) {
    await expect(wikiLink).toContainText(linkText);
    return true;
  }
  return false;
}

export async function createTestFile(page, filename = 'test-file') {
  // Try to create a new file
  const newFileButton = page.locator(
    'button:has-text("New"), ' +
    'button:has-text("Create"), ' +
    '[data-testid="new-file"]'
  );
  
  if (await newFileButton.count() > 0) {
    await newFileButton.first().click();
    await page.waitForTimeout(1000);
    return true;
  }
  
  // Try keyboard shortcut
  await page.keyboard.press('Control+n');
  await page.waitForTimeout(1000);
  return false;
}

export async function saveFile(page) {
  await page.keyboard.press('Control+s');
  await page.waitForTimeout(1000);
}

export async function dismissDialog(page) {
  // Handle any dialogs that might appear
  page.on('dialog', async dialog => {
    await dialog.dismiss();
  });
}

export async function acceptPrompt(page, text) {
  page.on('dialog', async dialog => {
    if (dialog.type() === 'prompt') {
      await dialog.accept(text);
    }
  });
}