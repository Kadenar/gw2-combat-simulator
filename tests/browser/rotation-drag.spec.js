import { expect, test } from '@playwright/test';

// Real pointer drags must keep one visible boundary and apply the same insertion index on release.
test('timeline drag previews stay stable over card children and insertion gaps', async ({ page }) => {
  await page.goto('/mesmer.html');
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.evaluate(() => {
    const app = window.professionApp;
    app.build.rotation = [1000, 2000, 3000, 4000].map((durationMs) => ({ type: 'wait', durationMs }));
    app.changed(false);
  });
  await page.waitForFunction(() => window.professionApp.buildRevision === window.professionApp.resultRevision);
  const root = page.locator('#rotation-timeline');
  const source = root.locator('.rot-skill[data-idx="0"]');
  const destination = root.locator('.rot-skill[data-idx="2"]');
  await source.scrollIntoViewIfNeeded();
  const start = await source.boundingBox();
  const target = await destination.boundingBox();
  await page.mouse.move(start.x + start.width / 2, start.y + 20);
  await page.mouse.down();
  await page.mouse.move(start.x + start.width + 10, start.y + 20, { steps: 5 });
  await page.mouse.move(target.x + target.width - 5, target.y + 20, { steps: 5 });
  const marker = root.locator('.drag-drop-target');
  await expect(marker).toHaveAttribute('data-insertion-index', '3');
  await expect(marker.locator('.rot-insertion-marker')).toHaveCSS('opacity', '1');

  const unchanged = await destination.evaluate((card) => {
    const root = document.getElementById('rotation-timeline');
    const marker = root.querySelector('.drag-drop-target');
    const observer = new MutationObserver(() => {});
    observer.observe(marker, { attributes: true, attributeFilter: ['class'] });
    const rect = card.getBoundingClientRect();
    const options = { bubbles: true, clientX: rect.right - 5, clientY: rect.top + 20 };
    card.querySelector('img').dispatchEvent(new DragEvent('dragleave', { ...options, relatedTarget: card }));
    card.dispatchEvent(new DragEvent('dragover', { ...options, cancelable: true }));
    const mutations = observer.takeRecords();
    observer.disconnect();
    return mutations.length === 0 && marker.classList.contains('drag-drop-target');
  });
  expect(unchanged).toBe(true);

  const gap = await root.locator('.rot-insertion-gap[data-insertion-index="2"]').boundingBox();
  await page.mouse.move(gap.x + gap.width / 2, gap.y + 20, { steps: 5 });
  await expect(marker).toHaveAttribute('data-insertion-index', '2');
  await expect(root.locator('.drag-drop-target')).toHaveCount(1);
  await page.mouse.up();
  await expect(root).not.toHaveClass(/drag-active/);
  expect(await page.evaluate(() => window.professionApp.build.rotation.map((entry) => entry.durationMs))).toEqual([
    2000, 1000, 3000, 4000
  ]);
});

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
