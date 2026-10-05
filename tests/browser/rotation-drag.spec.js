import { expect, test } from '@playwright/test';

// Real wrapping geometry must select the adjacent card; reorder semantics are covered by Node tests.
test('whitespace on a wrapped line drops beside the nearest card', async ({ page }) => {
  await page.goto('/mesmer.html');
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.evaluate(() => {
    const app = window.professionApp;
    app.build.rotation = Array.from({ length: 24 }, (_, index) => ({ type: 'wait', durationMs: 100 + index }));
    app.changed(false);
  });
  await page.waitForFunction(() => window.professionApp.buildRevision === window.professionApp.resultRevision);

  const result = await page.evaluate(() => {
    const root = document.getElementById('rotation-timeline');
    const row = root.querySelector('.rot-row-skills');
    row.style.maxWidth = '300px';
    const cards = [...row.querySelectorAll('.rot-skill[data-idx]')];
    const secondLineTop = cards.find((card) => card.offsetTop > cards[0].offsetTop).offsetTop;
    const lastOnLine = cards.filter((card) => card.offsetTop === secondLineTop).at(-1);
    const index = Number(lastOnLine.dataset.idx) + 1;
    const rect = lastOnLine.getBoundingClientRect();
    const coordinates = {
      bubbles: true,
      cancelable: true,
      clientX: row.getBoundingClientRect().right - 1,
      clientY: rect.top + 10
    };
    cards[0].dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true }));
    row.dispatchEvent(new DragEvent('dragover', coordinates));
    const preview = Number(root.querySelector('.drag-drop-target').dataset.insertionIndex);
    row.dispatchEvent(new DragEvent('drop', coordinates));
    return {
      index,
      preview,
      moved: window.professionApp.build.rotation.findIndex((entry) => entry.durationMs === 100)
    };
  });
  expect(result.index).toBeLessThan(24);
  expect(result.preview).toBe(result.index);
  expect(result.moved).toBe(result.index - 1);
});
