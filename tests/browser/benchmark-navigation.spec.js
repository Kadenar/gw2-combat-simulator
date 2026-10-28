import { expect, test } from '@playwright/test';
import { openDashboard } from '#tests/helpers/browser-benchmarks.js';

// Home-page users can reach the all-profession tool directly, including in an embedded host.
test('home page links directly to benchmarks and preserves hosting modes', async ({ page }) => {
  await page.goto('/index.html');
  const navigation = page.getByRole('navigation', { name: 'Main navigation' });
  const link = navigation.getByRole('link', { name: 'Benchmarks', exact: true });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', 'benchmarks.html');
  await expect(navigation.getByRole('link', { name: 'Simulator', exact: true })).toHaveAttribute(
    'aria-current',
    'page'
  );
  await page.goto('/index.html?embed=1&standalone=1');
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', 'benchmarks.html?embed=1&standalone=1');
  await link.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/benchmarks\.html\?embed=1&standalone=1$/);
  await expect(link).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('[data-benchmark-dashboard]')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('[data-benchmark-cards]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Build benchmarks', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await navigation.getByRole('link', { name: 'Simulator', exact: true }).click();
  await expect(page).toHaveURL(/index\.html\?embed=1&standalone=1$/);
  await expect(page.locator('[data-profession-grid]')).toBeVisible();
});

// Profession deep links must survive reloads and open a real saved build with the hosting mode intact.
test('home profession actions open filtered benchmarks and their simulator builds', async ({ page }) => {
  await page.goto('/index.html?embed=1&standalone=1');
  const card = page.locator('.profession-showcase.profession-card-mesmer');
  await expect(card.getByRole('link', { name: 'Open Mesmer simulator', exact: true })).toHaveAttribute(
    'href',
    'mesmer.html?embed=1&standalone=1'
  );
  await card.getByRole('link', { name: 'View Mesmer benchmarks', exact: true }).click();
  await expect(page).toHaveURL(/benchmarks\.html\?profession=mesmer&embed=1&standalone=1$/);
  await expect(page.locator('[data-benchmark-dashboard]')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('button[data-benchmark-profession="mesmer"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-build-table]')).toBeVisible();
  await expect(page.locator('[data-benchmark-cards]')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Table', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-build-table] tbody tr').first()).toContainText('Mesmer');
  await expect(page.locator('[data-build-table] tbody .profession-card-elementalist')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('button[data-benchmark-profession="mesmer"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-build-table]')).toBeVisible();
  await page.locator('[data-build-table] [data-inspect-overview]').first().click();
  const build = page.locator('#benchmark-overview-inspector').getByRole('link', { name: 'Open in workspace' });
  await build.click();
  await expect(page).toHaveURL(/mesmer\.html\?.*benchmark=.*embed=1&standalone=1#workspace$/);
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await page.goBack();
  await expect(page.locator('button[data-benchmark-profession="mesmer"]')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.locator('button[data-benchmark-profession="all"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/benchmarks\.html\?embed=1&standalone=1$/);
});

// Card actions and primary navigation remain reachable without horizontal page scrolling on narrow screens.
test('home benchmark access fits a phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 1000 });
  await page.goto('/index.html');
  const navigation = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(navigation.getByRole('link', { name: 'Benchmarks', exact: true })).toBeInViewport();
  await expect(page.locator('.profession-showcase-actions')).toHaveCount(9);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const actionsFit = await page
    .locator('.profession-showcase-actions a')
    .evaluateAll((links) =>
      links.every((link) => link.scrollWidth <= link.clientWidth && link.getBoundingClientRect().height >= 44)
    );
  expect(actionsFit).toBe(true);
  await navigation.getByRole('link', { name: 'Benchmarks', exact: true }).click();
  await expect(page.locator('[data-benchmark-dashboard]')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('[data-benchmark-cards]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  // Profession controls keep their position and selection when changing the results presentation.
  const professions = page.getByRole('group', { name: 'Benchmark professions' });
  const ranger = professions.getByRole('button', { name: 'Ranger', exact: true });
  await professions.getByRole('button', { name: 'All professions', exact: true }).click();
  await ranger.focus();
  await page.keyboard.press('Enter');
  await expect(ranger).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#benchmarks-ranger')).toBeVisible();
  await expect(page.locator('.benchmark-card')).toHaveCount(1);
  const filterBounds = await page.locator('.benchmark-filters').boundingBox();
  await page.getByRole('button', { name: 'Table', exact: true }).click();
  await expect(page.locator('[data-build-table]')).toBeVisible();
  await expect(ranger).toHaveAttribute('aria-pressed', 'true');
  expect(await page.locator('.benchmark-filters').boundingBox()).toEqual(filterBounds);
  await professions.getByRole('button', { name: 'Mesmer', exact: true }).click();
  await page.getByRole('button', { name: 'Cards', exact: true }).click();
  await expect(professions.getByRole('button', { name: 'Mesmer', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await expect(page.locator('#benchmarks-mesmer')).toBeVisible();
  await expect(page.locator('.benchmark-card')).toHaveCount(2);
});

// The entry page paints a responsive skeleton before the lazy dashboard module can mount.
test('benchmark startup shows a skeleton before loading its module', async ({ page }) => {
  const moduleReady = Promise.withResolvers();
  await page.route('**/js/games/gw2/app/page/benchmark-dashboard.ts*', async (route) => {
    await moduleReady.promise;
    await route.continue();
  });
  try {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    // Inspect initial HTML without waiting for a load event that can depend on the held module.
    await page.goto('/benchmarks.html', { waitUntil: 'commit' });
    const skeleton = page.locator('.benchmark-startup-skeleton');
    await expect(skeleton).toBeVisible();
    await expect(skeleton).toHaveAccessibleName('Loading benchmarks');
    await expect(skeleton).toHaveAttribute('aria-busy', 'true');
    await expect(skeleton.locator('.benchmark-skeleton-bar').first()).toHaveCSS('animation-name', 'none');
    await expect(page.locator('#benchmarks-view')).toHaveText('');
    await expect(page.getByRole('heading', { name: 'Benchmarks', exact: true })).toHaveCount(0);
    expect(await skeleton.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  } finally {
    moduleReady.resolve();
  }

  await expect(page.locator('[data-benchmark-dashboard]')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.benchmark-startup-skeleton')).toHaveCount(0);
  await expect(page.locator('.build-benchmark').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Benchmarks', exact: true })).toHaveCount(0);
});

// Delayed manifests retain the selected presentation and accessible loading state until real results arrive.
test('benchmark loading skeleton follows cards and table views until manifests resolve', async ({ page }) => {
  let releaseManifests;
  const pending = new Promise((resolve) => {
    releaseManifests = resolve;
  });
  await page.route('**/data/gw2/builds/*/manifest.json', async (route) => {
    await pending;
    await route.continue();
  });
  try {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/benchmarks.html?profession=ranger');
    await expect(page.locator('#benchmarks-view')).toHaveAttribute('aria-busy', 'true');
    await expect(page.locator('[data-benchmark-status]')).toBeEmpty();
    await expect(page.locator('.benchmark-status-row')).toBeHidden();
    await expect(page.locator('[data-build-table] .benchmark-skeleton')).toBeVisible();
    await expect(page.locator('[data-build-table] .benchmark-skeleton')).toHaveAttribute('aria-hidden', 'true');
    expect(
      await page
        .locator('[data-build-table] .benchmark-skeleton-bar')
        .first()
        .evaluate((bar) => getComputedStyle(bar).animationName)
    ).toBe('none');
    await page.getByRole('button', { name: 'Cards', exact: true }).click();
    await expect(page.locator('[data-benchmark-cards] .benchmark-skeleton')).toBeVisible();
    await page
      .getByRole('group', { name: 'Benchmark professions' })
      .getByRole('button', { name: 'Mesmer', exact: true })
      .click();
    await expect(page.locator('[data-benchmark-cards] .benchmark-skeleton')).toHaveCount(2);
    await expect(page.locator('[data-benchmark-cards] .benchmark-skeleton').last()).toBeVisible();
    await page.getByRole('button', { name: 'Table', exact: true }).click();
    await expect(page.locator('[data-build-table] .benchmark-skeleton')).toBeVisible();
  } finally {
    releaseManifests();
  }

  await expect(page.locator('#benchmarks-view')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.benchmark-skeleton')).toHaveCount(0);
  await expect(page.locator('[data-build-table] tbody tr').first()).toBeVisible();
  await expect(page.locator('button[data-benchmark-profession="mesmer"]')).toHaveAttribute('aria-pressed', 'true');
});

// A failed manifest is disclosed and retryable while successful professions remain usable.
test('benchmarks report partial manifest failures and retry successfully', async ({ page }) => {
  await page.route('**/builds/mesmer/manifest.json', (route) => route.fulfill({ status: 503, body: 'Unavailable' }));
  await openDashboard(page);
  await expect(page.locator('[data-benchmark-status]')).toContainText('Could not load Mesmer');
  await expect(page.locator('#benchmarks-mesmer')).toContainText('Benchmark data unavailable');
  await expect(page.locator('.build-benchmark').first()).toBeVisible();
  await page.unroute('**/builds/mesmer/manifest.json');
  await page.getByRole('button', { name: 'Retry loading' }).click();
  await expect(page.locator('[data-benchmark-retry]')).toBeHidden();
  await page.getByRole('button', { name: 'Build benchmarks', exact: true }).click();
  await expect(page.locator('#benchmarks-mesmer .build-benchmark').first()).toBeVisible();
});

test('benchmark navigation preserves the workspace, filters, browser history, and embedding', async ({ page }) => {
  await openDashboard(page, '/mesmer.html?embed=1&standalone=1#benchmarks');
  const navigation = page.getByRole('navigation', { name: 'Simulator sections' });
  await expect(navigation.getByRole('link', { name: 'Benchmarks', exact: true })).toHaveAttribute(
    'aria-current',
    'page'
  );
  await page.evaluate(() => {
    window.benchmarkTestBuild = window.professionApp.build;
  });
  await page.getByRole('searchbox', { name: 'Search benchmarks' }).fill('Chronomancer');
  await navigation.getByRole('link', { name: 'Golem', exact: true }).click();
  await expect(page.locator('#benchmarks-view')).toBeHidden();
  await page.goBack();
  await expect(page.locator('#benchmarks-view')).toBeVisible();
  await expect(page.getByRole('searchbox', { name: 'Search benchmarks' })).toHaveValue('Chronomancer');
  expect(await page.evaluate(() => window.professionApp.build === window.benchmarkTestBuild)).toBe(true);
  await page.getByRole('button', { name: 'Build benchmarks', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Open Mesmer workspace' })).toHaveAttribute(
    'href',
    /mesmer\.html\?embed=1&standalone=1/
  );
  await navigation.getByRole('button', { name: 'Choose profession' }).click();
  await page
    .getByRole('group', { name: 'Professions', exact: true })
    .getByRole('link', { name: 'Guardian', exact: true })
    .click();
  // Profession changes open Golem while preserving the embedding flags from the benchmark page.
  await expect(page).toHaveURL(/guardian\.html\?embed=1&standalone=1#workspace$/);
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  await expect(navigation.getByRole('link', { name: 'Golem', exact: true })).toHaveAttribute('aria-current', 'page');
});
