import { expect, test } from '@playwright/test';

test('two sessions share presence and reload restores identity', async ({ browser }) => {
  const firstContext = await browser.newContext();
  const secondContext = await browser.newContext();
  const first = await firstContext.newPage();
  const second = await secondContext.newPage();

  await first.goto('/');
  await first.getByRole('button', { name: 'Create a table' }).click();
  await expect(first).toHaveURL(/\/room\/[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  const roomUrl = first.url();
  await first.getByLabel('Display name').fill('Alice');
  await first.getByRole('button', { name: 'Join table' }).click();
  await expect(first.locator('.room-status-dot.is-connected')).toBeVisible({ timeout: 15_000 });

  await second.goto(roomUrl);
  await second.getByLabel('Display name').fill('Bob');
  await second.getByRole('button', { name: 'Join table' }).click();
  await expect(second.locator('.room-status-dot.is-connected')).toBeVisible({ timeout: 15_000 });
  await expect(first.locator('.room-presence summary')).toContainText('2');
  await expect(second.locator('.room-presence summary')).toContainText('2');

  const firstPlayerId = await first.evaluate(() => {
    const entries = Object.keys(localStorage);
    const roomKey = entries.find((key) => key.startsWith('rollycast:room:'))!;
    return (JSON.parse(localStorage.getItem(roomKey)!) as { playerId: string }).playerId;
  });
  await first.reload();
  await expect(first.locator('.room-status-dot.is-connected')).toBeVisible({ timeout: 15_000 });
  await expect(first.getByRole('heading', { name: 'Choose your seat' })).toHaveCount(0);
  const restoredPlayerId = await first.evaluate(() => {
    const entries = Object.keys(localStorage);
    const roomKey = entries.find((key) => key.startsWith('rollycast:room:'))!;
    return (JSON.parse(localStorage.getItem(roomKey)!) as { playerId: string }).playerId;
  });
  expect(restoredPlayerId).toBe(firstPlayerId);

  await firstContext.close();
  await secondContext.close();
});
