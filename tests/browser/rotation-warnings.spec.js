import { expect, test } from '@playwright/test';

// Worker-produced rejection timestamps must reach the warning panel and survive disclosure toggling.
test('rotation warnings show each rejected input on the combat-relative timeline', async ({ page }) => {
  await page.goto('/thief.html');
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.evaluate(async () => {
    const app = window.professionApp;
    const saved = await (await fetch('/data/gw2/builds/thief/b-condi-antiquary-scepter-dagger.json')).json();
    const skillId = app.skillByName.get('Triple Bolt').id;
    app.build = app.adapter.toApplicationBuild({
      ...saved,
      targetHealth: 0,
      rotation: [
        { type: 'wait', durationMs: 1000 },
        { type: 'cast', skillId },
        { type: 'wait', durationMs: 1000 },
        { type: 'combat-start' },
        { type: 'wait', durationMs: 2000 },
        { type: 'cast', skillId }
      ]
    });
    app.changed();
  });
  await page.waitForFunction(() => window.professionApp.buildRevision === window.professionApp.resultRevision);
  const panel = page.locator('#rotation-warnings');
  await panel.locator('summary').click();
  await expect(panel.locator('.rotation-warning-time')).toHaveText(['-1.000s', '2.000s']);
  await expect(panel.locator('.rotation-warning-message')).toHaveText([
    'Triple Bolt: Triple Bolt is unavailable — cast Shadow Bolt first.',
    'Triple Bolt: Triple Bolt is unavailable — cast Shadow Bolt first.'
  ]);
});
