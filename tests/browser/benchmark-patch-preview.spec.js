import { expect, test } from '@playwright/test';

// Small captured fixtures keep UI contracts independent of whichever real preview is authored next.
async function previewFixtures(page, state = { active: true, removePreview: false, failWarrior: false }) {
  const preview = state.active
    ? {
        id: 'ui-preview',
        label: 'UI placeholder preview',
        professions: {},
        pendingBenchmarks: state.summaryVariants
          ? [{ profession: 'guardian', specialization: 'Pending rework', reason: 'Fixture rework pending.' }]
          : []
      }
    : null;
  await page.route('**/integrations/patches/active-preview.ts*', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: `export const activePatchPreview = ${JSON.stringify(preview)};`
    })
  );
  await page.route('**/data/gw2/builds/*/manifest.json', async (route) => {
    const profession = route.request().url().split('/').at(-2);

    if (state.failWarrior && profession === 'warrior') return route.fulfill({ status: 503, body: 'Unavailable' });

    if (!['guardian', 'mesmer'].includes(profession)) return route.fulfill({ json: [] });

    const response = await route.fetch();
    const sections = await response.json();
    const section = sections.find((entry) => entry.presets.some((preset) => preset.rotation));
    const preset = { ...section.presets.find((entry) => entry.rotation) };
    delete preset.patchPreview;

    if (!state.removePreview)
      preset.patchPreview = {
        patchId: 'ui-preview',
        benchmarkDps: preset.benchmarkDps + (profession === 'guardian' ? 100 : -100),
        benchmarkDpsByHealth: preset.benchmarkDpsByHealth
      };

    const fixtures = [{ section: section.section, presets: [preset] }];

    // Mixed summary fixtures exercise wrapping and the pending disclosure in one row.
    if (state.summaryVariants && profession === 'guardian') {
      fixtures[0].presets.push({
        ...preset,
        label: 'Condition loss with a long weapon and variant description',
        patchPreview: { ...preset.patchPreview, benchmarkDps: preset.benchmarkDps - 100 }
      });
      fixtures.push({
        section: 'Pending rework',
        presets: [{ ...preset, label: 'Pending build', patchPreview: undefined }]
      });
    }

    if (state.extraSpecialization && profession === 'guardian')
      fixtures.push({
        section: 'Second specialization',
        presets: [
          {
            ...preset,
            label: 'Second build',
            patchPreview: { ...preset.patchPreview, benchmarkDps: preset.benchmarkDps }
          }
        ]
      });

    await route.fulfill({ response, json: fixtures });
  });
}

// Native filters and grouped headings must work without running simulations.
test('patch preview groups and shared selectors', async ({ page }) => {
  await previewFixtures(page);
  await page.goto('/benchmarks.html');
  await expect(page.locator('[data-benchmark-dashboard]')).toHaveAttribute('aria-busy', 'false');
  await page.getByRole('button', { name: 'Patch preview', exact: true }).click();
  const panel = page.locator('[data-chart-panel="patch"]');
  const profession = panel.locator('[data-patch-profession]');
  await profession.selectOption('guardian');
  await expect(panel.locator('[data-patch-group]')).toHaveCount(1);
  await expect(panel.getByRole('button', { name: 'Guardian', exact: true })).toHaveAttribute('aria-expanded', 'false');
  await panel.getByRole('button', { name: 'Guardian', exact: true }).click();
  await expect(page.locator('[data-benchmark-profession="guardian"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-benchmark-profession="mesmer"]')).toHaveAttribute('aria-pressed', 'false');
  await panel.locator('[data-patch-outcome]').selectOption('up');
  await expect(panel.locator('[data-patch-row]').first()).toBeVisible();
  await page.getByRole('button', { name: 'DPS by health', exact: true }).click();
  const sharedStyle = await page.locator('[data-health-metric]').evaluate((node) => {
    const style = getComputedStyle(node);
    return [style.fontSize, style.backgroundColor, style.borderWidth, style.borderRadius];
  });
  await page.getByRole('button', { name: 'Patch preview', exact: true }).click();
  expect(
    await profession.evaluate((node) => {
      const style = getComputedStyle(node);
      return [style.fontSize, style.backgroundColor, style.borderWidth, style.borderRadius];
    })
  ).toEqual(sharedStyle);
  await expect(profession).toHaveValue('guardian');
  await expect(panel.locator('[data-patch-outcome]')).toHaveValue('up');
  await page.setViewportSize({ width: 390, height: 844 });
  const scroll = panel.getByRole('region', { name: 'Guardian patch DPS changes' });
  await expect(scroll).toBeVisible();
  expect(await scroll.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
  expect(await panel.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(profession).toHaveValue('all');
  await expect(panel.locator('[data-patch-outcome]')).toHaveValue('all');
});

// Patch rows use native links to preserve keyboard/new-tab navigation and load the selected saved build and rotation.
// Profession-page hosting is covered by the inspector and navigation tests, so the standalone page suffices here.
test('patch preview opens measured and pending builds in their profession workspace', async ({ page }) => {
  await previewFixtures(page, { active: true, summaryVariants: true });
  await page.goto('/benchmarks.html?embed=1&standalone=1#benchmarks');
  await expect(page.locator('[data-benchmark-dashboard]')).toHaveAttribute('aria-busy', 'false');
  await page.getByRole('button', { name: 'Patch preview', exact: true }).click();
  const group = page.locator('[data-chart-panel="patch"] [data-patch-group="guardian"]');
  await group.getByRole('button', { name: 'Guardian', exact: true }).click();
  const pending = group
    .locator('[data-patch-row]')
    .filter({ hasText: 'Pending build' })
    .getByRole('link', { name: /^Open in workspace:/ });
  const measured = group
    .locator('[data-patch-row]')
    .filter({ hasNotText: 'Pending build' })
    .first()
    .getByRole('link', { name: /^Open in workspace:/ });
  await expect(pending).toBeVisible();
  await expect(measured).toBeVisible();
  const url = new URL(await pending.getAttribute('href'), page.url());
  expect(url.pathname).toBe('/guardian.html');
  expect(url.hash).toBe('#workspace');
  expect(url.searchParams.get('embed')).toBe('1');
  expect(url.searchParams.get('standalone')).toBe('1');
  expect(url.searchParams.get('rotation')).toMatch(/^data\/gw2\/rotations\/guardian\//);
  const build = await (await page.request.get('/' + url.searchParams.get('benchmark'))).json();
  // A modified click must leave the preview mounted and create a normal browser tab.
  const popupPromise = page.context().waitForEvent('page');
  await pending.click({ modifiers: ['ControlOrMeta'] });
  const popup = await popupPromise;
  await expect(popup).toHaveURL(/guardian\.html\?embed=1&standalone=1#workspace$/);
  await expect.poll(() => popup.evaluate(() => window.professionApp?.workspace.tabs.length)).toBe(2);
  await expect(group).toBeVisible();
  await popup.close();
  await measured.focus();
  await measured.press('Enter');
  await expect(page).toHaveURL(/guardian\.html\?embed=1&standalone=1#workspace$/);
  await expect.poll(() => page.evaluate(() => window.professionApp?.workspace.tabs.length)).toBe(3);
  expect(
    await page.evaluate(() => ({
      profession: window.professionApp.build.profession,
      weapons: window.professionApp.build.weapons,
      hasRotation: window.professionApp.build.rotation.length > 0
    }))
  ).toEqual({ profession: build.profession, weapons: build.weapons, hasRotation: true });
});

// Eligibility is decided before filters; a reload that removes results must also recover keyboard focus.
test('preview availability handles missing data, empty filters, and retry removal', async ({ page }) => {
  const state = { active: true, removePreview: false, failWarrior: true };
  await previewFixtures(page, state);
  await page.goto('/benchmarks.html');
  const button = page.getByRole('button', { name: 'Patch preview', exact: true });
  await button.click();
  await page.locator('#benchmark-search').fill('no such build');
  await expect(button).toBeVisible();
  await expect(page.locator('[data-chart-panel="patch"]')).toContainText('No preview benchmarks match');
  state.removePreview = true;
  // Trigger the existing retry without moving focus away from the selected tab.
  await button.focus();
  await page.locator('[data-benchmark-retry]').evaluate((node) => node.click());
  await expect(button).toBeHidden();
  await expect(page.locator('[data-benchmark-panel="builds"]')).toBeFocused();
  await expect(page.locator('[data-chart-panel="builds"]')).toBeVisible();
  await expect(page.locator('[data-benchmark-status]')).toContainText('not been captured');
});

// Removing the authored preview hides its entry point even when old results still exist in the manifests.
test('inactive preview hides the panel despite saved preview results', async ({ page }) => {
  await previewFixtures(page, { active: false, removePreview: false, failWarrior: false });
  await page.goto('/benchmarks.html');
  await expect(page.locator('[data-benchmark-dashboard]')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('[data-benchmark-panel="patch"]')).toBeHidden();
  await expect(page.locator('[data-chart-panel="builds"]')).toBeVisible();
});

// Nested disclosure keeps keyboard focus and child choices through parent toggles and filtered rerenders.
test('patch preview headers collapse independently and retain state through filters and sorting', async ({ page }) => {
  await previewFixtures(page, { active: true, removePreview: false, failWarrior: false, extraSpecialization: true });
  await page.goto('/benchmarks.html');
  await page.getByRole('button', { name: 'Patch preview', exact: true }).click();
  const panel = page.locator('[data-chart-panel="patch"]');
  const group = panel.locator('[data-patch-group="guardian"]');
  const parent = group.locator('.benchmark-patch-profession button');
  const child = group.locator('.benchmark-patch-specialization button').first();
  const secondChild = group.getByRole('button', { name: 'Second specialization', exact: true });
  const firstBuild = group.locator('[data-patch-row]').first();
  const secondBuild = group.locator('[data-patch-row]').last();
  const blurb = group.locator('[data-patch-profession-summary]');
  await expect(parent).toHaveAttribute('aria-expanded', 'false');
  await expect(firstBuild).toBeHidden();
  await expect(blurb).toBeVisible();
  await expect(blurb).toContainText('1 higher');
  await expect(blurb).toContainText('1 unchanged');
  await expect(blurb).toContainText('Largest gain');
  await expect(blurb).toContainText('DPS');
  await parent.click();
  await expect(blurb).toBeHidden();
  await expect(child).toHaveAttribute('aria-expanded', 'true');
  await child.focus();
  await child.press('Space');
  await expect(child).toBeFocused();
  await expect(child).toHaveAttribute('aria-expanded', 'false');
  await expect(firstBuild).toBeHidden();
  await expect(secondBuild).toBeVisible();
  await parent.click();
  await expect(parent).toBeFocused();
  await expect(parent).toHaveAttribute('aria-expanded', 'false');
  await expect(child).toBeHidden();
  await expect(secondChild).toBeHidden();
  await expect(secondBuild).toBeHidden();
  await parent.press('Enter');
  await expect(parent).toBeFocused();
  await expect(child).toHaveAttribute('aria-expanded', 'false');
  await expect(firstBuild).toBeHidden();
  await expect(secondBuild).toBeVisible();
  await panel.locator('[data-patch-sort]').selectOption('losses');
  await expect(child).toHaveAttribute('aria-expanded', 'false');
  await page.locator('#benchmark-search').fill('Second build');
  await expect(group.locator('.benchmark-patch-specialization button')).toHaveCount(1);
  await page.locator('#benchmark-search').clear();
  await expect(child).toHaveAttribute('aria-expanded', 'false');
  await parent.click();
  await panel.locator('[data-patch-profession]').selectOption('mesmer');
  await panel.locator('[data-patch-profession]').selectOption('all');
  await expect(parent).toHaveAttribute('aria-expanded', 'false');
  await expect(blurb).toBeVisible();
  await panel.locator('[data-patch-outcome]').selectOption('same');
  await expect(blurb).toContainText('No DPS changes');
  await expect(group.locator('.benchmark-patch-profession-meta')).toContainText('1 matching build');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(parent).toHaveAttribute('aria-expanded', 'false');
  await expect(firstBuild).toBeHidden();
  await expect(blurb).toContainText('Largest gain');
  await parent.click();
  await expect(parent).toHaveAttribute('aria-expanded', 'true');
  await expect(child).toHaveAttribute('aria-expanded', 'true');
  await expect(firstBuild).toBeVisible();
  await expect(secondBuild).toBeVisible();
});

// Desktop summaries use the row width; mobile summaries wrap independently of their scrollable detail tables.
test('patch summary columns adapt to narrow panels and expose pending reworks', async ({ page }) => {
  await previewFixtures(page, { active: true, extraSpecialization: true, summaryVariants: true });
  await page.setViewportSize({ width: 1680, height: 1000 });
  await page.goto('/benchmarks.html');
  await page.getByRole('button', { name: 'Patch preview', exact: true }).click();
  const panel = page.locator('[data-chart-panel="patch"]');
  const group = panel.locator('[data-patch-group="guardian"]');
  const toggle = group.getByRole('button', { name: 'Guardian', exact: true });
  const outcomes = group.locator('.benchmark-patch-outcomes');
  const highlights = group.locator('.benchmark-patch-highlight');
  await expect(group.locator('.benchmark-patch-badge')).toHaveText('1 TBD');
  await expect(group.getByRole('columnheader', { name: 'Live DPS', exact: true })).toBeHidden();
  const headingBox = await group.locator('.benchmark-patch-profession-heading').boundingBox();
  const outcomesBox = await outcomes.boundingBox();
  const gainBox = await highlights.first().boundingBox();
  const lossBox = await highlights.last().boundingBox();
  expect(outcomesBox.x).toBeGreaterThan(headingBox.x + headingBox.width);
  expect(gainBox.x).toBeGreaterThan(outcomesBox.x + outcomesBox.width);
  expect(lossBox.x).toBeGreaterThan(gainBox.x + gainBox.width);
  expect(Math.abs(lossBox.y - outcomesBox.y)).toBeLessThan(2);
  for (const width of [820, 390]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await toggle.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
    expect(await panel.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  }

  const mobileOutcomes = await outcomes.boundingBox();
  const mobileGain = await highlights.first().boundingBox();
  expect(mobileGain.y).toBeGreaterThan(mobileOutcomes.y + mobileOutcomes.height);
  await toggle.press('Enter');
  await expect(toggle).toBeFocused();
  await expect(group.getByRole('columnheader', { name: 'Live DPS', exact: true })).toBeVisible();
  const pendingRow = group.locator('[data-patch-row]').filter({ hasText: 'Pending build' });
  await expect(pendingRow).toContainText('Fixture rework pending.');
  await expect(pendingRow.locator('td').nth(1)).toHaveText('TBD');
  await panel.locator('[data-patch-outcome]').selectOption('tbd');
  await expect(panel.locator('[data-patch-row]')).toHaveCount(1);
  await expect(pendingRow).toBeVisible();
  await panel.locator('[data-patch-outcome]').selectOption('up');
  await expect(panel.locator('[data-patch-row]').filter({ hasText: 'Pending build' })).toHaveCount(0);
});
