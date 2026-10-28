import { expect, test } from '@playwright/test';
import { openSimulator } from '#tests/helpers/browser-workspace.js';

// A bound side mouse button adds its skill without also committing the browser's history action on release.
test('side mouse rotation hotkeys suppress browser navigation', async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem('gw2-rotation-hotkeys-v1', JSON.stringify({ 'weapon-1': 'Mouse4' }))
  );
  await openSimulator(page);
  const skill = page.locator('.pal-skill[data-hotkey-action="weapon-1"]:not(.pal-context-disabled)').first();
  await skill.click();
  // The worker result replaces palette nodes; wait for that refresh before reading mouse coordinates.
  await page.waitForFunction(() => window.professionApp.buildRevision === window.professionApp.resultRevision);
  await expect(page.locator('.rotation-hotkey-button')).toHaveText('Hotkeys: On');
  await page.evaluate(() => history.pushState({}, '', '?mouse-hotkey'));
  const url = page.url();
  const casts = await page.evaluate(() => window.professionApp.build.rotation.length);
  const bounds = await skill.boundingBox();
  const session = await page.context().newCDPSession(page);
  const mouse = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2, button: 'back', clickCount: 1 };

  await session.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...mouse, buttons: 8 });
  await session.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...mouse, buttons: 0 });

  await expect.poll(() => page.evaluate(() => window.professionApp.build.rotation.length)).toBe(casts + 1);
  await page.waitForTimeout(100);
  expect(page.url()).toBe(url);
});

// Native closest() matching must protect controls and dialog descendants for both rotation keyboard handlers.
test('shared hotkey exclusion protects editable controls and dialogs', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const failures = await page.evaluate(async () => {
    const { shouldIgnoreHotkey } = await import('/js/ui/shared/dom.ts');
    const cases = [
      ['<input>', true],
      ['<textarea></textarea>', true],
      ['<select><option>Choice</option></select>', true],
      ['<div contenteditable="true"><span>Text</span></div>', true],
      ['<div role="dialog"><button>Action</button></div>', true],
      ['<dialog><button>Action</button></dialog>', true],
      ['<div contenteditable="false"><span>Text</span></div>', false],
      ['<button>Action</button>', false]
    ];
    const failures = cases.flatMap(([html, ignored]) => {
      const container = document.createElement('div');
      container.innerHTML = html;
      const targets = [...container.querySelectorAll('*')];
      return targets.some((target) => shouldIgnoreHotkey({ target }) !== ignored) ? [html] : [];
    });
    for (const target of [null, document, document.createTextNode('Text')]) {
      if (shouldIgnoreHotkey({ target })) failures.push(String(target));
    }

    return failures;
  });
  expect(failures).toEqual([]);
});
