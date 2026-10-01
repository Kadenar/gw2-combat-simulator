import { expect, test } from '@playwright/test';

// Loading and editing conditions must use the same keys that simulation reads.
test('Blindness, Crippled, and Immobilized reflect saved conditions and toggle their simulation values', async ({
  page
}) => {
  await page.goto('/thief.html');
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.evaluate(async () => {
    const { applyBuildFileImport, previewBuildFileImport } =
      await import('/js/games/gw2/app/import-export/build-file-import.ts');
    const saved = await fetch('/data/gw2/builds/thief/b-power-quick-deadeye-axe-pistol-dagger-pistol.json').then(
      (response) => response.json()
    );
    const app = window.professionApp;
    applyBuildFileImport(app, previewBuildFileImport(saved, 'build.json', app), { build: true, rotation: false });
  });
  await page.getByRole('button', { name: 'Open simulation config', exact: true }).click();
  for (const key of ['Blindness', 'Crippled', 'Immobilized']) {
    const control = page.getByRole('checkbox', { name: key, exact: true });
    await expect(control).toBeChecked();
    await control.uncheck();
    expect(
      await page.evaluate(
        (key) => window.professionApp.adapter.simulationConfig(window.professionApp).target.conditions[key] ?? false,
        key
      )
    ).toBe(false);
    await control.check();
    expect(
      await page.evaluate(
        (key) => window.professionApp.adapter.simulationConfig(window.professionApp).target.conditions[key],
        key
      )
    ).toBe(true);
  }
});
