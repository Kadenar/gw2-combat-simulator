import { expect, test } from '@playwright/test';

// The skill damage section measures only after it is opened, then follows preview edits without losing focus.
test('skill damage preview measures skills on open and explains a row', async ({ page }) => {
  // Hold only the preview worker briefly so the loading state is observable on fast machines.
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor(url, options) {
        super(url, options);
        this.preview = String(url).includes('/skill-damage/');
      }
      postMessage(message) {
        if (this.preview) setTimeout(() => super.postMessage(message), 1200);
        else super.postMessage(message);
      }
    };
  });
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/warrior.html#workspace', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  const section = page.locator('#skill-damage-preview');
  await expect(section.locator('details.skill-damage')).not.toHaveAttribute('open', '');
  await expect(section.locator('.sd-row')).toHaveCount(0);

  await section.locator('summary').click();
  await expect(section.locator('.sd-loading')).toBeVisible();
  await expect(section.locator('.sd-training-golem')).toBeVisible();
  await expect(section.getByRole('status')).toContainText('Calculating skill damage');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(section.locator('.sd-training-golem')).toHaveCSS('animation-name', 'none');
  const rows = section.locator('.sd-row');
  await expect(rows.first()).toBeVisible({ timeout: 30_000 });
  await expect(section.locator('.sd-status')).toHaveCount(0, { timeout: 30_000 });
  const firstTotal = await rows.first().locator('.sd-total').textContent();

  // Editing an input re-measures without rebuilding the controls, so the field keeps focus.
  const might = section.getByRole('spinbutton', { name: 'Might', exact: true });
  await might.fill('0');
  await expect(might).toBeFocused();
  await expect(section.locator('.sd-status')).toHaveCount(0, { timeout: 30_000 });
  await expect(rows.first().locator('.sd-total')).not.toHaveText(firstTotal);

  await rows.first().locator('.sd-skill').click();
  await expect(rows.first().locator('.sd-breakdown')).toBeVisible();
  await expect(rows.first().locator('.sd-breakdown')).toContainText('Per activation');
  await expect(section).toContainText('Damage if this skill or effect occurs under the selected conditions.');
  await expect(section).not.toContainText('Proc discovery');

  // Wide tables scroll inside their own box instead of widening the page.
  await page.setViewportSize({ width: 390, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
