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

test('a reaction on a history row reaches the room and survives a reload', async ({ browser }) => {
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

  // React from the roll's own row, which is reachable whether or not the dice are still on the table.
  await observer.page.getByRole('button', { name: 'React to this roll' }).click();
  await observer.page.getByRole('button', { name: 'Applause', exact: true }).click();

  // The reaction is the observer's, so only their chip reads as "including yours".
  const observerChip = observer.page.getByRole('button', { name: /Applause, 1 reaction/ });
  await expect(observerChip).toHaveAttribute('aria-pressed', 'true', { timeout: 15_000 });
  const ownerChip = owner.getByRole('button', { name: /Applause, 1 reaction/ });
  await expect(ownerChip).toBeVisible({ timeout: 15_000 });
  await expect(ownerChip).toHaveAttribute('aria-pressed', 'false');

  // Reactions are stored on the roll record, so a reload must not lose them. The client rejoins on
  // its own from the stored identity, so there is no join panel to fill in here.
  await owner.reload();
  await expect(owner.locator('.room-status-dot.is-connected')).toBeVisible({ timeout: 15_000 });
  await owner.getByRole('button', { name: /^History/ }).click();
  await expect(owner.getByRole('button', { name: /Applause, 1 reaction/ })).toBeVisible({
    timeout: 15_000,
  });

  // Reacting again with the same emote takes it back, for everyone.
  await observerChip.click();
  await expect(observer.page.getByRole('button', { name: /Applause/ })).toHaveCount(0, {
    timeout: 15_000,
  });
  await expect(owner.getByRole('button', { name: /Applause/ })).toHaveCount(0, { timeout: 15_000 });

  await ownerContext.close();
  await observer.context.close();
});
