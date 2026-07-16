import {
  devices,
  expect,
  test,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type Page,
} from '@playwright/test';

test.setTimeout(90_000);

async function createPlayer(browser: Browser, options: BrowserContextOptions, name: string) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  await page.goto('/');
  await page.getByRole('button', { name: 'Create a table' }).click();
  await page.getByLabel('Display name').fill(name);
  await page.getByRole('button', { name: 'Join table' }).click();
  await expect(page.locator('.room-status-dot.is-connected')).toBeVisible({ timeout: 15_000 });
  return { context, page, roomUrl: page.url() };
}

async function joinPlayer(
  browser: Browser,
  options: BrowserContextOptions,
  roomUrl: string,
  name: string,
) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  await page.goto(roomUrl);
  await page.getByLabel('Display name').fill(name);
  await page.getByRole('button', { name: 'Join table' }).click();
  await expect(page.locator('.room-status-dot.is-connected')).toBeVisible({ timeout: 15_000 });
  return { context, page };
}

async function openHistory(page: Page) {
  const toggle = page.getByRole('button', { name: /^History/ });
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
}

/** The dice tray is collapsed behind the floating "Dice" menu, so the Roll button starts hidden. */
async function openDiceTray(page: Page) {
  await page.locator('.dock-menu-toggle').click();
  await expect(page.getByRole('button', { name: /^Roll / })).toBeVisible();
}

/** Inspecting a roll shows its die's actions inline — there is no separate actions popup to open. */
async function inspectNewest(page: Page) {
  await openHistory(page);
  await page.locator('.rolllog-entry').first().click();
  await expect(page.locator('.inspection-panel')).toBeVisible();
}

function rerollAction(page: Page) {
  return page.locator('.inspection-action-grid').getByRole('button', { name: 'Reroll' });
}

async function throwHeldDie(page: Page) {
  await expect(page.locator('.inspection-grab-status')).toContainText('held', { timeout: 10_000 });
  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('3D table canvas is unavailable');
  // Drag in the upper third of the table. On mobile portrait the inspection panel overlays the
  // lower half of the canvas, so a drag any lower lands on the panel instead of the table plane.
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.34);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.3, { steps: 6 });
  await page.mouse.up();
}

async function closeContexts(...contexts: BrowserContext[]) {
  await Promise.all(contexts.map((context) => context.close()));
}

test('complete owner, shared-reroll, reaction, and reconnect flow', async ({
  browser,
}, testInfo) => {
  const options =
    testInfo.project.name === 'mobile-portrait' ? devices['Pixel 7'] : devices['Desktop Chrome'];
  const host = await createPlayer(browser, options, 'Alice');
  const guest = await joinPlayer(browser, options, host.roomUrl, 'Bob');

  await expect(host.page.getByLabel(/2 connected players/)).toBeVisible();
  await openDiceTray(host.page);
  await host.page.getByRole('button', { name: 'Roll 1d20' }).click();
  await openHistory(host.page);
  await openHistory(guest.page);
  await expect(host.page.locator('.rolllog-entry')).toHaveCount(1, { timeout: 15_000 });
  await expect(guest.page.locator('.rolllog-entry')).toHaveCount(1, { timeout: 15_000 });

  // Owner-only by default: the guest is offered no actions at all on someone else's die.
  await inspectNewest(guest.page);
  await expect(rerollAction(guest.page)).toHaveCount(0);
  await expect(guest.page.locator('.inspection-action-empty')).toBeVisible();

  await inspectNewest(host.page);
  await rerollAction(host.page).click();
  await throwHeldDie(host.page);
  await expect(host.page.locator('.rolllog-entry')).toHaveCount(2, { timeout: 15_000 });
  await expect(guest.page.locator('.rolllog-entry')).toHaveCount(2, { timeout: 15_000 });

  // Anyone may react, including on a die they do not own.
  await inspectNewest(guest.page);
  await guest.page.locator('.inspection-react').getByRole('button', { name: 'Applause' }).click();
  await expect(host.page.locator('.roll-reaction')).toContainText('Applause');

  await host.page.getByLabel('Host controls').click();
  await host.page.locator('.room-handling-setting select').selectOption('shared_rerolls');
  await expect(host.page.locator('.room-handling-setting select')).toHaveValue('shared_rerolls');
  // Close the floating appearance panel so it stops overlaying the roll log the host clicks next.
  await host.page.getByLabel('Host controls').click();

  // Shared rerolls: the guest can now pick up the host's die.
  await inspectNewest(guest.page);
  await expect(rerollAction(guest.page)).toBeVisible({ timeout: 10_000 });
  await rerollAction(guest.page).click();
  await throwHeldDie(guest.page);
  await expect(guest.page.locator('.rolllog-entry')).toHaveCount(3, { timeout: 15_000 });
  await expect(host.page.locator('.rolllog-entry')).toHaveCount(3, { timeout: 15_000 });
  await inspectNewest(host.page);
  await expect(host.page.locator('.inspection-details')).toContainText('Bob');

  await host.page.close();
  const reconnectedHost = await host.context.newPage();
  await reconnectedHost.goto(host.roomUrl);
  await expect(reconnectedHost.locator('.room-status-dot.is-connected')).toBeVisible({
    timeout: 15_000,
  });
  await openHistory(reconnectedHost);
  await expect(reconnectedHost.locator('.rolllog-entry')).toHaveCount(3);
  await inspectNewest(reconnectedHost);
  await expect(reconnectedHost.locator('.inspection-panel')).toContainText('Bob');

  await closeContexts(guest.context, host.context);
});
