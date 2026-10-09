import { test, expect } from '@playwright/test';
import { promises as fs } from 'fs';
import { join } from 'path';
import { QaBackend } from '../../qa/harness/backend.js';
import { createQaContext } from '../../qa/harness/driver.js';

test('Explorer sorts nested files and keeps preferences after reload', async ({ browser, baseURL }) => {
  const backend = new QaBackend();
  await backend.init();
  const vault = await backend.createVault('explorer-sorting');
  await fs.mkdir(join(vault, 'Zoo'));
  await fs.writeFile(join(vault, 'Alpha.md'), '# Alpha');
  await fs.writeFile(join(vault, 'bravo.txt'), 'bravo is the largest file');
  await fs.writeFile(join(vault, 'Charlie.md'), '# C');
  await fs.writeFile(join(vault, 'Zoo', 'b.md'), 'b');
  await fs.writeFile(join(vault, 'Zoo', 'a.md'), 'a');

  // Use the existing disk-backed Tauri mock, with controlled metadata so
  // timestamp ordering does not depend on filesystem clock resolution.
  const readTree = backend.tree.bind(backend);
  const dates = { 'Alpha.md': 20, 'bravo.txt': 30, 'Charlie.md': 10, Zoo: 40 };
  backend.tree = async (directory) => Promise.all((await readTree(directory)).map(async (entry) => ({
    ...entry,
    size: entry.is_directory ? 0 : (await fs.stat(entry.path)).size,
    modified: dates[entry.name] ?? 0,
    created: dates[entry.name] ?? 0,
  })));

  const context = await createQaContext(browser, backend);
  const page = await context.newPage();
  try {
    await page.goto(`${baseURL}/?testMode=true&workspacePath=${encodeURIComponent(vault)}`);
    const trigger = page.getByRole('button', { name: /^Sort files:/ });
    await expect(trigger).toBeVisible();
    const topLevel = page.locator('.file-tree-container li[data-level="0"]');
    const paths = () => topLevel.evaluateAll((rows) => rows.map((row) => row.dataset.path.split(/[/\\]/).pop()));
    const chooseSort = async (name) => {
      await trigger.click();
      await page.getByRole('menuitemradio', { name, exact: true }).click();
    };

    await expect.poll(paths).toEqual(['Zoo', 'Alpha.md', 'bravo.txt', 'Charlie.md']);
    await page.locator('.file-tree-container').getByText('Zoo', { exact: true }).click();
    await chooseSort('Name (Z to A)');
    await expect.poll(paths).toEqual(['Zoo', 'Charlie.md', 'bravo.txt', 'Alpha.md']);
    await expect.poll(() => page.locator('li[data-level="1"]').evaluateAll((rows) => rows.map((row) => row.dataset.path.split(/[/\\]/).pop())))
      .toEqual(['b.md', 'a.md']);

    for (const label of ['Date modified (newest first)', 'Date created (newest first)', 'Size (largest first)']) {
      await chooseSort(label);
      await expect.poll(paths).toEqual(['Zoo', 'bravo.txt', 'Alpha.md', 'Charlie.md']);
    }
    await chooseSort('Type (A to Z)');
    await expect.poll(paths).toEqual(['Zoo', 'Alpha.md', 'Charlie.md', 'bravo.txt']);
    await chooseSort('Name (A to Z)');
    await trigger.click();
    await page.getByRole('menuitemcheckbox', { name: 'Folders first', exact: true }).click();
    await expect.poll(paths).toEqual(['Alpha.md', 'bravo.txt', 'Charlie.md', 'Zoo']);

    await page.reload();
    await expect.poll(paths).toEqual(['Alpha.md', 'bravo.txt', 'Charlie.md', 'Zoo']);
    await trigger.click();
    await expect(page.getByRole('menuitemcheckbox', { name: 'Folders first', exact: true })).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByRole('menuitemradio', { name: 'Name (A to Z)', exact: true })).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);
  } finally {
    await context.close();
    await fs.rm(backend.runRoot, { recursive: true, force: true });
  }
});
