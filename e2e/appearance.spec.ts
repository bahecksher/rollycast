import { expect, test } from '@playwright/test';

test('the host customizes the shared table appearance and keeps it after reload', async ({
  browser,
}) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();

  await host.goto('/');
  await host.getByRole('button', { name: 'Create a table' }).click();
  // Wait for the room navigation before reading the URL, or the guest may load the landing page.
  await expect(host).toHaveURL(/\/room\/[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  const roomUrl = host.url();
  await host.getByLabel('Display name').fill('Host');
  await host.getByRole('button', { name: 'Join table' }).click();
  await expect(host.locator('.room-status-dot.is-connected')).toBeVisible({ timeout: 15_000 });

  await guest.goto(roomUrl);
  await guest.getByLabel('Display name').fill('Guest');
  await guest.getByRole('button', { name: 'Join table' }).click();
  await expect(guest.locator('.room-status-dot.is-connected')).toBeVisible({ timeout: 15_000 });
  await expect(guest.getByLabel('Table appearance')).toHaveCount(0);

  await host.getByLabel('Table appearance').click();
  const surface = host.getByLabel('Surface');
  await surface.evaluate((node) => {
    const input = node as HTMLInputElement;
    // Assigning `input.value` directly updates React's value tracker too, so React sees no change
    // and never fires onChange. Use the native setter to bypass the tracker (standard React-in-test
    // workaround) so the surface color actually reaches component state and is saved.
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    setValue.call(input, '#345678');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });

  const pngBase64 = await host.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#f2c94c';
    context.fillRect(0, 0, 16, 16);
    return canvas.toDataURL('image/png').split(',')[1]!;
  });
  await host.locator('.room-appearance-upload input').setInputFiles({
    name: 'table.png',
    mimeType: 'image/png',
    buffer: Buffer.from(pngBase64, 'base64'),
  });
  await expect(host.locator('.room-appearance-message')).toContainText('Image ready');
  await host.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(host.locator('.room-appearance-message')).toContainText('saved');

  await host.reload();
  await expect(host.locator('.room-status-dot.is-connected')).toBeVisible({ timeout: 15_000 });
  await host.getByLabel('Table appearance').click();
  await expect(host.getByLabel('Surface')).toHaveValue('#345678');
  await expect
    .poll(() =>
      host.locator('.room-appearance-preview').evaluate((element) => element.style.backgroundImage),
    )
    .toContain('data:image/jpeg');

  await hostContext.close();
  await guestContext.close();
});
