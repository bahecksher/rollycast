import { expect, test } from '@playwright/test';

test('landing page creates a table with a valid room code', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'RollyCast' })).toBeVisible();

  await page.getByRole('button', { name: 'Create a table' }).click();
  await expect(page).toHaveURL(/\/room\/[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
});

test('landing page rejects an invalid room code', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Room code').fill('123');
  await page.getByRole('button', { name: 'Join' }).click();
  await expect(page.getByRole('alert')).toContainText('room code');
});
