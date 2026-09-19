import { expect, test } from '@playwright/test';

// Profession selectors share the desktop skill strip and wrap below it on phones.
test('profession selectors stay compact beside skills and wrap on phones', async ({ page }) => {
  for (const profession of ['engineer', 'ranger', 'elementalist']) {
    await page.setViewportSize({ width: 1800, height: 1100 });
    await page.goto(`/${profession}.html#workspace`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
    if (profession === 'engineer' || profession === 'elementalist') {
      const picker = page.locator('.spec-picker').last();
      await picker.locator('summary').click();
      await picker.getByRole('button', { name: profession === 'engineer' ? 'Amalgam' : 'Evoker', exact: true }).click();
    }

    const selections = page.locator('.profession-build-selections');
    const skills = page.locator('#skill-bar > .skill-bar-selected');
    const icons = selections.locator('.sbar-icon');
    await expect(icons.first()).toBeVisible();
    const wideSkills = await skills.boundingBox();
    const wideSelections = await selections.boundingBox();
    const labels = selections.locator('.skill-bar-inspection-label');
    expect(await labels.evaluateAll((items) => items.every((item) => item.scrollWidth <= item.clientWidth))).toBe(true);
    expect(wideSelections.x).toBeGreaterThanOrEqual(wideSkills.x + wideSkills.width);
    expect(wideSelections.y).toBeLessThan(wideSkills.y + wideSkills.height);
    await icons.first().click();
    await expect(selections.locator('.sbar-dropdown.open')).toBeVisible();
    await page.locator('.selectable-skills-title').click();
    await page.setViewportSize({ width: 390, height: 1000 });
    const narrowSkills = await skills.boundingBox();
    const narrowSelections = await selections.boundingBox();
    expect(await labels.evaluateAll((items) => items.every((item) => item.scrollWidth <= item.clientWidth))).toBe(true);
    expect(narrowSelections.y).toBeGreaterThanOrEqual(narrowSkills.y + narrowSkills.height);
    expect(narrowSelections.x + narrowSelections.width).toBeLessThanOrEqual(390);
  }
});

// The visible familiar selector drives F5 and survives reloading the saved build.
test('Evoker familiar selection updates Skills and the rotation palette', async ({ page }) => {
  await page.goto('/elementalist.html#workspace', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  const picker = page.locator('.spec-picker').last();
  await picker.locator('summary').click();
  await picker.getByRole('button', { name: 'Evoker', exact: true }).click();
  const selector = page.locator('#skill-bar [data-selection-key="evokerElement"]');
  for (const [element, skill] of [
    ['Air', 'Zap'],
    ['Water', 'Splash'],
    ['Earth', 'Calcify'],
    ['Fire', 'Ignite']
  ]) {
    await selector.locator('.sbar-icon').click();
    await selector.locator(`[data-selection-value="${element}"]`).click();
    expect(await page.evaluate(() => window.professionApp.build.evokerElement)).toBe(element);
    await expect(page.locator('#skill-bar .skill-bar-inspection-label')).toHaveText(`${element} Familiar`);
    await expect(page.locator(`#rotation-palette .pal-skill[data-skill="${skill}"]`)).toBeVisible();
  }

  await selector.locator('.sbar-icon').click();
  await selector.locator('[data-selection-value="Air"]').click();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  expect(await page.evaluate(() => window.professionApp.build.evokerElement)).toBe('Air');
  await expect(page.locator('#skill-bar .skill-bar-inspection-label')).toHaveText('Air Familiar');
});

// Representative workspace variants must fit desktop, wrapped, and phone layouts.
test('workspace regions stay within the viewport across professions', async ({ page }) => {
  // Standard skills, extra profession controls, and fixed legends cover the distinct workspace layouts.
  for (const profession of ['thief', 'engineer', 'revenant']) {
    await page.goto(`/${profession}.html#workspace`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
    await expect(page.locator('.infusion-row')).toHaveCount(2);
    for (const width of [1130, 1024, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      if (width === 1130) {
        const traits = await page.locator('.workspace-build-choices').boundingBox();
        const equipment = await page.locator('.gear-main').boundingBox();
        const attributes = await page.locator('.attributes-panel').boundingBox();
        expect(equipment.y).toBeCloseTo(traits.y, 0);
        expect(attributes.y).toBeCloseTo(traits.y, 0);
        expect(equipment.x).toBeGreaterThanOrEqual(traits.x + traits.width);
        expect(attributes.x).toBeGreaterThanOrEqual(equipment.x + equipment.width);
      }

      for (const selector of ['.workspace-build-choices', '.gear-main', '.attributes-panel']) {
        const bounds = await page.locator(selector).boundingBox();
        expect(bounds.x, `${profession} ${width} ${selector}`).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width, `${profession} ${width} ${selector}`).toBeLessThanOrEqual(width);
        expect(
          await page.locator(selector).evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
          `${profession} ${width} ${selector} overflow`
        ).toBe(true);
      }
    }
  }
});
