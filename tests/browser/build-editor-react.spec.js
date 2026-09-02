import { expect, test } from '@playwright/test';

// Opens the real build editor after its application and React panel roots finish their initial render.
async function openProfession(page, profession = 'mesmer') {
  await page.goto(`/${profession}.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.professionApp);
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await expect(page.locator('#attributes-list .attr-row')).not.toHaveCount(0);
}

test('attributes update and gear controls preserve focus while enforcing infusion totals', async ({ page }) => {
  await openProfession(page);

  const weaponSet = page.locator('#attribute-weapon-set');
  await weaponSet.selectOption('2');
  expect(await page.evaluate(() => window.professionApp.attributeWeaponSet)).toBe(2);

  const originalPower = await page.evaluate(() => window.professionApp.attributeData.attributes.Power.final);
  const prefixChange = await page.locator('[data-slot="Helm"]').evaluate((select) => {
    window.focusedGearSelect = select;
    select.focus();
    const value = [...select.options].find((option) => option.value !== select.value)?.value;
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return value;
  });

  await expect.poll(() => page.evaluate(() => window.professionApp.build.gear.Helm)).toBe(prefixChange);
  expect(
    await page.evaluate(
      () =>
        window.focusedGearSelect === document.querySelector('[data-slot="Helm"]') &&
        window.focusedGearSelect.isConnected &&
        document.activeElement === window.focusedGearSelect
    )
  ).toBe(true);
  await expect
    .poll(() => page.evaluate(() => window.professionApp.attributeData.attributes.Power.final))
    .not.toBe(originalPower);

  const infusionCounts = page.locator('.inf-count');
  await infusionCounts.nth(0).fill('10');
  await infusionCounts.nth(0).blur();
  await infusionCounts.nth(1).fill('99');
  expect(await page.evaluate(() => window.professionApp.build.infusions[1].count)).toBe(0);
  await infusionCounts.nth(1).blur();
  await expect(infusionCounts.nth(1)).toHaveValue('8');
  expect(
    await page.evaluate(() => window.professionApp.build.infusions.reduce((sum, item) => sum + item.count, 0))
  ).toBe(18);
});

test('trait and skill choices update the build without replacing their focused controls', async ({ page }) => {
  await openProfession(page);

  const trait = page.locator('.spec-row').first().locator('.spec-trait-major.dim').first();
  const expectedTrait = await trait.getAttribute('data-pick');
  const tier = Number(await trait.getAttribute('data-tier'));
  const selectedTrait = page.locator(
    `.spec-row:first-child .spec-trait-major[data-tier="${tier}"][data-pick="${expectedTrait}"]`
  );
  await selectedTrait.evaluate((element) => {
    window.focusedTrait = element;
  });
  await selectedTrait.focus();
  await selectedTrait.click();
  await expect(selectedTrait).toHaveAttribute('aria-pressed', 'true');
  expect(
    await selectedTrait.evaluate(
      (element) => window.focusedTrait === element && element.isConnected && document.activeElement === element
    )
  ).toBe(true);
  expect(
    await page.evaluate(
      ({ tier, expectedTrait }) =>
        window.professionApp.build.specializations[0].traits.split('-')[tier] === expectedTrait,
      { tier, expectedTrait }
    )
  ).toBe(true);

  const utilitySlot = page.locator('#skill-bar [data-key="Utility1"]');
  await utilitySlot.locator('.sbar-icon').click();
  const currentSkill = await page.evaluate(() => window.professionApp.build.selectedSkills.Utility1);
  const optionIndex = await utilitySlot
    .locator('.dd-item')
    .evaluateAll((options, current) => options.findIndex((option) => option.dataset.name !== current), currentSkill);
  const option = utilitySlot.locator('.dd-item').nth(optionIndex);
  const selectedName = await option.getAttribute('data-name');
  await option.click();
  expect(await page.evaluate(() => window.professionApp.build.selectedSkills.Utility1)).toBe(selectedName);
  await expect(utilitySlot.locator('.sbar-icon')).toHaveAttribute('aria-expanded', 'false');
});

test('fixed profession loadouts stay selectable in their React root', async ({ page }) => {
  await openProfession(page, 'revenant');

  const trigger = page.locator('.fixed-loadout-trigger').first();
  await trigger.click();
  const option = page
    .locator('.fixed-loadout-dropdown.open .fixed-loadout-option:not(.selected):not(:disabled)')
    .first();
  const selection = await option.evaluate((element) => ({
    key: element.dataset.loadoutKey,
    value: element.dataset.loadoutValue
  }));
  expect(selection.key).toBeTruthy();
  expect(selection.value).toBeTruthy();
  await option.click();

  expect(
    await page.evaluate(({ key, value }) => {
      const [field, rawIndex] = key.split(':');
      const selected =
        rawIndex === undefined
          ? window.professionApp.build[field]
          : window.professionApp.build[field]?.[Number(rawIndex)];
      return String(selected) === value;
    }, selection)
  ).toBe(true);
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
});
