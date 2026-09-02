import { expect, test } from '@playwright/test';

// Opens a profession page only after its application and React-owned assumptions panel are ready.
async function openProfession(page, profession) {
  await page.goto(`/${profession}.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.professionApp);
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await expect(page.locator('#perma-boons details')).not.toHaveCount(0);
  await page.getByRole('button', { name: 'Open simulation config' }).click();
}

test('assumption controls commit through ProfessionApp with native change timing', async ({ page }) => {
  await openProfession(page, 'mesmer');

  const fury = page.getByRole('checkbox', { name: 'Fury' });
  await fury.uncheck();
  expect(await page.evaluate(() => window.professionApp.build.assumptions.fury)).toBe(false);

  await page.getByLabel('Time of day').selectOption('night');
  expect(await page.evaluate(() => window.professionApp.build.assumptions.timeOfDay)).toBe('night');

  const activations = page.locator('#target-skill-activations');
  const originalValue = await page.evaluate(
    () => window.professionApp.build.assumptions.targetSkillActivationsPerSecond
  );
  await activations.fill('99');
  expect(await page.evaluate(() => window.professionApp.build.assumptions.targetSkillActivationsPerSecond)).toBe(
    originalValue
  );
  await activations.blur();
  await expect(activations).toHaveValue('10');
  expect(await page.evaluate(() => window.professionApp.build.assumptions.targetSkillActivationsPerSecond)).toBe(10);
});

test('profession-provided assumption controls render and update the build', async ({ page }) => {
  await openProfession(page, 'elementalist');

  await page.getByLabel('Target hitbox').selectOption('large');
  expect(await page.evaluate(() => window.professionApp.build.assumptions.hitboxSize)).toBe('large');
});
