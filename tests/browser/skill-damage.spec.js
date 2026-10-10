import { expect, test } from '@playwright/test';

// Native select interactions preserve focus and keep the two isolated preview selections separate.
for (const [profession, skillId, label] of [
  ['thief', 13046, "Assassin's Signet"],
  ['warrior', 14410, 'Signet of Fury']
]) {
  test(`${label} dropdowns update independently without saving build changes`, async ({ page }) => {
    await page.goto(`/${profession}.html#workspace`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
    await page.evaluate((id) => {
      const app = window.professionApp;
      app.build.selectedSkillIds.Utility1 = id;
      app.changed();
    }, skillId);
    const saved = await page.evaluate(() => JSON.stringify(window.professionApp.build));
    const attributes = page.locator('#attribute-preview');
    await attributes.locator('summary').click();
    const attributeSignet = attributes.getByRole('combobox', { name: label, exact: true });
    await expect(attributeSignet).toHaveValue('passive');
    await attributeSignet.selectOption('active');

    const damage = page.locator('#skill-damage-preview');
    await damage.locator('summary').click();
    const damageSignet = damage.getByRole('combobox', { name: label, exact: true });
    await expect(damageSignet).toHaveValue('passive');
    await expect(damageSignet.locator('option')).toHaveText(['Off', 'Passive', 'Active']);
    await damageSignet.focus();
    await damageSignet.selectOption('active');
    await expect(damage.locator('.sd-status')).toHaveCount(0);
    await expect(damageSignet).toBeFocused();
    await damageSignet.selectOption('off');
    await expect(damage.locator('.sd-status')).toHaveCount(0);
    await expect(attributeSignet).toHaveValue('active');
    expect(await page.evaluate(() => JSON.stringify(window.professionApp.build))).toBe(saved);
  });
}

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

// Real worker requests must use the non-Holosmith sword IDs and react to native signet checkbox changes.
test('Mechanist sword previews have no missing variants and signet toggles keep the build intact', async ({ page }) => {
  await page.goto('/engineer.html#workspace', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.evaluate(() => {
    const app = window.professionApp;
    app.build.specializations = [{ name: 'Mechanist', traits: '0-0-0' }];
    app.build.weapons = ['Sword', 'Pistol'];
    app.build.alternateWeapons = ['', ''];
    app.build.selectedSkillIds.Utility1 = app.skills.find((skill) => skill.name === 'Force Signet').id;
    app.build.selectedSkillIds.Utility2 = app.skills.find((skill) => skill.name === 'Superconducting Signet').id;
    app.changed();
  });
  const saved = await page.evaluate(() => JSON.stringify(window.professionApp.build));
  const section = page.locator('#skill-damage-preview');
  await section.locator('summary').click();
  await expect(section.locator('.sd-row').first()).toBeVisible();
  await expect(section.locator('.sd-status')).toHaveCount(0);
  await expect(section).not.toContainText('The selected content has no implementation of this skill.');
  for (const name of ['Force Signet', 'Superconducting Signet']) {
    const toggle = section.getByRole('checkbox', { name, exact: true });
    await expect(toggle).toBeChecked();
    await toggle.uncheck();
    await expect(toggle).not.toBeChecked();
    await expect(toggle).toBeFocused();
    await expect(section.locator('.sd-status')).toHaveCount(0);
    await toggle.check();
    await expect(section.locator('.sd-status')).toHaveCount(0);
  }

  expect(await page.evaluate(() => JSON.stringify(window.professionApp.build))).toBe(saved);
});
