import { expect, test } from '@playwright/test';

/**
 * A deploy replaces the content-hashed 3D scene chunk, so a tab opened beforehand requests a file
 * that no longer exists — and the asset router answers with index.html rather than a 404, so the
 * browser tries to parse HTML as a module. This reproduces exactly that and asserts the app reloads
 * into the new build instead of stranding the player on the error placeholder.
 */
test('a stale scene chunk reloads into the new build instead of breaking the table', async ({
  page,
}) => {
  test.setTimeout(120_000);
  let servedStale = false;
  // Counting document loads is what proves the recovery: without the reload the canvas could only
  // appear if the stale chunk was never actually used.
  let loads = 0;
  page.on('load', () => {
    loads += 1;
  });

  // Matches the built chunk (DiceScene-<hash>.js) and the dev module (/src/scene/DiceScene.tsx).
  await page.route(/DiceScene/, async (route) => {
    if (servedStale) return route.continue();
    servedStale = true;
    // What production actually serves for a chunk that a deploy removed.
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><html><head></head><body></body></html>',
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Create a table' }).click();
  await page.getByLabel('Display name').fill('Stale Build');
  await page.getByRole('button', { name: 'Join table' }).click();

  // The reload re-runs the join, so the scene arrives on the second attempt.
  await expect(page.locator('canvas')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.room-placeholder')).toHaveCount(0);
  expect(servedStale).toBe(true);
  expect(loads).toBeGreaterThan(1);
});
