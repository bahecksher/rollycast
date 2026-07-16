import { expect, test } from '@playwright/test';

test('every standard die type can produce a finalized shared result', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await page.getByRole('button', { name: 'Create a table' }).click();
  await page.getByLabel('Display name').fill('Polyhedral Tester');
  await page.getByRole('button', { name: 'Join table' }).click();
  await expect(page.locator('.room-status-dot.is-connected')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('canvas')).toBeVisible({ timeout: 45_000 });

  for (const type of ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100']) {
    await page.getByRole('button', { name: type, exact: true }).click();
    await page.getByRole('button', { name: `Roll 1${type}` }).click();
  }

  await page.getByRole('button', { name: /^History/ }).click();
  await expect(page.locator('.rolllog-entry')).toHaveCount(7, { timeout: 20_000 });
  await expect(page.locator('.rolllog-entry').filter({ hasText: '1d100' })).toHaveCount(1);

  await page.getByRole('button', { name: 'd6', exact: true }).click();
  await page.getByRole('button', { name: 'More dice' }).click();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('button', { name: 'd20', exact: true }).click();
  await page.getByRole('button', { name: 'Fewer dice' }).click();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByLabel('Roll modifier').fill('5');
  await page.getByRole('button', { name: 'Roll 2d6 + 1d20 + 5' }).click();
  await expect(page.locator('.rolllog-entry')).toHaveCount(8, { timeout: 20_000 });
  await expect(page.locator('.rolllog-entry').filter({ hasText: '2d6 + 1d20 + 5' })).toHaveCount(1);
});
