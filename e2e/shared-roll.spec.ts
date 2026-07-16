import { expect, test, type Browser, type Page } from '@playwright/test';

async function createAndJoin(page: Page, displayName: string): Promise<string> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create a table' }).click();
  await expect(page).toHaveURL(/\/room\/[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  await page.getByLabel('Display name').fill(displayName);
  await page.getByRole('button', { name: 'Join table' }).click();
  await expect(page.locator('.room-status-dot.is-connected')).toBeVisible({ timeout: 15_000 });
  return page.url();
}

async function joinExisting(browser: Browser, roomUrl: string, displayName: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(roomUrl);
  await page.getByLabel('Display name').fill(displayName);
  await page.getByRole('button', { name: 'Join table' }).click();
  await expect(page.locator('.room-status-dot.is-connected')).toBeVisible({ timeout: 15_000 });
  return { context, page };
}

test('a server-authoritative roll is shared and available to a late joiner', async ({
  browser,
}) => {
  const ownerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  const roomUrl = await createAndJoin(owner, 'Alice');
  const observer = await joinExisting(browser, roomUrl, 'Bob');

  // The dice tray is collapsed behind the floating "Dice" menu.
  await owner.locator('.dock-menu-toggle').click();
  await owner.getByRole('button', { name: 'Roll 1d20' }).click();
  await owner.getByRole('button', { name: /^History/ }).click();
  await observer.page.getByRole('button', { name: /^History/ }).click();
  await expect(owner.locator('.rolllog-entry')).toHaveCount(1, { timeout: 15_000 });
  await expect(observer.page.locator('.rolllog-entry')).toHaveCount(1, { timeout: 15_000 });
  const ownerResult = (await owner.locator('.rolllog-entry').innerText())
    .replace(/\s+/g, ' ')
    .trim();
  const observerResult = (await observer.page.locator('.rolllog-entry').innerText())
    .replace(/\s+/g, ' ')
    .trim();
  expect(observerResult).toBe(ownerResult);

  const late = await joinExisting(browser, roomUrl, 'Charlie');
  await late.page.getByRole('button', { name: /^History/ }).click();
  await expect(late.page.locator('.rolllog-entry')).toHaveCount(1);
  const lateResult = (await late.page.locator('.rolllog-entry').innerText())
    .replace(/\s+/g, ' ')
    .trim();
  expect(lateResult).toBe(ownerResult);

  await late.context.close();
  await observer.context.close();
  await ownerContext.close();
});
