import { expect, test } from '@playwright/test';

// Host pages can auto-size an iframe far beyond the browser's visible height.
test('embedded focus keeps the builder bounded inside a tall iframe', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await page.setContent(
    '<iframe title="Simulator" src="/elementalist.html?embed=1" style="width: 1130px; height: 2400px; border: 0"></iframe>'
  );
  await page.evaluate(() => {
    window.addEventListener('message', (event) => {
      const iframe = document.querySelector('iframe');
      if (event.source === iframe?.contentWindow && event.data?.type === 'gw2sim:height') {
        iframe.style.height = `${event.data.height}px`;
      }
    });
  });
  const frame = page.frameLocator('iframe');
  await expect(frame.locator('#loading-overlay')).toHaveClass(/hidden/);
  await expect.poll(() => page.locator('iframe').evaluate((iframe) => iframe.clientHeight)).toBeGreaterThan(900);
  await frame.locator('.rotation-focus-toggle').click();

  await expect.poll(() => page.locator('iframe').evaluate((iframe) => iframe.clientHeight)).toBeLessThanOrEqual(900);
  const panel = frame.locator('.rotation-panel-shell > .rotation-panel');
  expect((await panel.boundingBox()).height).toBeLessThanOrEqual(900);
  expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  // A host with a fixed frame height still needs an opaque focus backdrop below the builder.
  await page.locator('iframe').evaluate((iframe) => {
    iframe.style.height = '2400px';
  });
  expect(
    await frame.locator('.rotation-section').evaluate((section) => {
      const backdrop = getComputedStyle(section, '::before');
      return backdrop.position === 'fixed' && Number.parseFloat(backdrop.height) === innerHeight;
    })
  ).toBe(true);
  await expect(frame.getByRole('button', { name: 'Exit focus' })).toBeVisible();
  await frame.getByRole('button', { name: 'Exit focus' }).click();
  await expect(frame.locator('body')).not.toHaveAttribute('data-rotation-focus', '');
  await expect.poll(() => page.locator('iframe').evaluate((iframe) => iframe.clientHeight)).toBeGreaterThan(900);
});
