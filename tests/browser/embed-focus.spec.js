import { expect, test } from '@playwright/test';

// Match Snow Crows' height-only host: focus must stay visible without asking the parent to scroll.
test('embedded focus and settings follow the viewport of a scrolled cross-origin host', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.context().grantPermissions(['local-network-access'], { origin: 'http://localhost:4173' });
  await page.route('http://localhost:4173/embed-host', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<style>body { margin: 0; padding-top: 60px; } iframe { width: 90%; height: 3000px; border: 0; }</style>
        <iframe title="Simulator" src="http://127.0.0.1:4173/elementalist.html?embed=1"></iframe>
        <footer style="height: 1200px">Host content below the simulator</footer>
        <script>
          window.addEventListener('message', (event) => {
            const iframe = document.querySelector('iframe');
            if (event.source === iframe.contentWindow && event.data?.type === 'gw2sim:height') {
              const height = Number(event.data.height);
              if (Number.isFinite(height) && height > 0) iframe.style.height = Math.max(600, height) + 'px';
            }
          });
        </script>`
    })
  );
  await page.goto('http://localhost:4173/embed-host');
  const frame = page.frameLocator('iframe');
  await expect(frame.locator('#loading-overlay')).toHaveClass(/hidden/);
  await expect.poll(() => page.locator('iframe').evaluate((iframe) => iframe.clientHeight)).toBeGreaterThan(900);

  const settings = frame.getByRole('button', { name: 'Open simulation config' });
  const config = frame.getByRole('dialog', { name: 'Simulation config' });
  const close = config.getByRole('button', { name: 'Close simulation config' });
  const focus = frame.locator('.rotation-focus-toggle');
  const workspace = frame.locator('.rotation-section');
  const expectInHostViewport = async (element) => {
    await expect
      .poll(async () => {
        const bounds = await element.boundingBox();
        return Boolean(bounds && bounds.y >= 0 && bounds.y + bounds.height <= page.viewportSize().height + 1);
      })
      .toBe(true);
  };

  await settings.click();
  await expect(close).toBeFocused();
  await expectInHostViewport(config);
  await config.getByLabel('Display idle time').check();
  await page.evaluate(() => scrollBy(0, -250));
  await expectInHostViewport(config);
  await page.setViewportSize({ width: 900, height: 600 });
  await expectInHostViewport(config);
  await config.getByLabel('Overlay relics').check();
  await expectInHostViewport(close);
  await page.keyboard.press('Escape');
  await expect(config).toBeHidden();
  await expect(settings).toBeFocused();

  await focus.scrollIntoViewIfNeeded();
  const hostScroll = await page.evaluate(() => scrollY);
  const frameHeight = await page.locator('iframe').evaluate((iframe) => iframe.clientHeight);
  expect(hostScroll).toBeGreaterThan(600);
  await focus.click();
  await expect(focus).toHaveText('Exit focus');
  await expectInHostViewport(workspace);
  expect(await page.evaluate(() => scrollY)).toBe(hostScroll);
  expect(await page.locator('iframe').evaluate((iframe) => iframe.clientHeight)).toBe(frameHeight);
  const panel = frame.locator('.rotation-panel-shell > .rotation-panel');
  expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.evaluate(() => scrollBy(0, -200));
  await expectInHostViewport(workspace);
  await settings.click();
  await expect(config.getByLabel('Display idle time')).toBeChecked();
  await expect(config.getByLabel('Overlay relics')).toBeChecked();
  await expectInHostViewport(config);
  await close.click();
  await expect(config).toBeHidden();
  await focus.click();
  await expect(frame.locator('body')).not.toHaveAttribute('data-rotation-focus', '');
  expect(await workspace.evaluate((element) => element.style.inset)).toBe('');
  await expect(settings).toBeVisible();
});
