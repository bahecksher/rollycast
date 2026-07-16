import { expect, test } from '@playwright/test';

async function enterNewRoom(page: import('@playwright/test').Page, displayName: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create a table' }).click();
  await expect(page).toHaveURL(/\/room\/[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  await page.getByLabel('Display name').fill(displayName);
  await page.getByRole('button', { name: 'Join table' }).click();
  await expect(page.locator('.room-status-dot.is-connected')).toBeVisible({ timeout: 15_000 });
}

/** The dice tray is collapsed behind the floating "Dice" menu, so the Roll button starts hidden. */
async function openDiceTray(page: import('@playwright/test').Page) {
  await page.locator('.dock-menu-toggle').click();
  await expect(page.getByRole('button', { name: /^Roll / })).toBeVisible();
}

test.describe('local 3D dice roller (Milestone 1)', () => {
  test('loads the scene and records rolls', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    await enterNewRoom(page, 'Roll Tester');

    // The lazy 3D scene mounts a canvas once three.js + Rapier load.
    await expect(page.locator('canvas')).toBeVisible({ timeout: 45_000 });
    await openDiceTray(page);

    const roll = page.getByRole('button', { name: /^Roll / });
    for (let i = 0; i < 3; i += 1) {
      await roll.click();
      await page.waitForTimeout(150);
    }

    await page.getByRole('button', { name: /^History/ }).click();
    await expect(page.locator('.rolllog-entry')).toHaveCount(3, { timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('stays responsive across 100 sequential rolls', async ({ page }) => {
    // Software WebGL (swiftshader) in CI renders many dice slowly; on real GPUs this is quick.
    test.setTimeout(180_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    await enterNewRoom(page, 'Stress Tester');
    await expect(page.locator('canvas')).toBeVisible({ timeout: 45_000 });
    await openDiceTray(page);

    const roll = page.getByRole('button', { name: /^Roll / });
    for (let i = 0; i < 100; i += 1) {
      await roll.click({ timeout: 15_000 });
    }

    // Scene survived the barrage: canvas still present, no page errors, UI still interactive.
    await expect(page.locator('canvas')).toBeVisible();
    await page.getByRole('button', { name: /^History/ }).click();
    await expect(page.locator('.rolllog-entry').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});
