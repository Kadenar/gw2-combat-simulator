import { readFile } from 'node:fs/promises';
import { mockGw2Icons } from '#tests/helpers/browser-icons.js';
import { expect, test } from '@playwright/test';

// Decode every local image used by JavaScript and CSS to catch unresolved aliases and missing artwork.
test('local artwork aliases resolve to loadable images', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const failures = await page.evaluate(async () => {
    const { professionRegistry } = await import('/js/games/gw2/profession-registry.ts');
    const tutorials = await import('/js/games/gw2/app/page/tutorial.ts');
    const { PLACEHOLDER_ICON } = await import('/js/games/gw2/app/shared/placeholder-icon.ts');
    const sources = professionRegistry.flatMap(({ specializationArtwork = [] }) =>
      specializationArtwork.flatMap(({ conceptArt, image }) => [conceptArt, image])
    );
    sources.push(
      PLACEHOLDER_ICON,
      tutorials.TUTORIAL_GIF_URL,
      tutorials.ROTATION_TUTORIAL_GIF_URL,
      tutorials.ANALYSIS_TUTORIAL_GIF_URL,
      tutorials.OPTIMIZER_TUTORIAL_GIF_URL
    );
    for (const stylesheet of ['/css/profession-ui.css', '/css/rotation-palette.css']) {
      const response = await fetch(`${stylesheet}?direct`);

      if (!response.ok) throw new Error(`Cannot load ${stylesheet}: ${response.status}`);

      const css = await response.text();
      sources.push(
        ...Array.from(css.matchAll(/url\((?:"([^"]*)"|'([^']*)'|([^)]*))\)/g), ([, double, single, bare]) =>
          (double ?? single ?? bare).trim()
        )
      );
    }

    const localSources = [...new Set(sources.filter(Boolean))].filter(
      (source) => new URL(source, location.href).origin === location.origin || source.startsWith('data:')
    );
    return (
      await Promise.all(
        localSources.map(async (source) => {
          const image = new Image();
          image.src = source;
          try {
            await image.decode();
            return null;
          } catch {
            return source;
          }
        })
      )
    ).filter(Boolean);
  });

  expect(failures).toEqual([]);
});

// Every walkthrough stays reachable on a phone and only the selected animation loads; reduced motion keeps the steps.
test('all four tutorials switch, replay and respect reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const dialog = page.locator('.tutorial-dialog');
  // The static landing link and compact header launcher must share the same lazy-loaded dialog.
  const landingTrigger = page.locator('.landing-tutorial-link');
  await expect(dialog.locator('.tutorial-animation[src]')).toHaveCount(0);
  await landingTrigger.click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(landingTrigger).toBeFocused();
  await expect(dialog.locator('.tutorial-animation[src]')).toHaveCount(0);
  await page.locator('.community-actions [data-tutorial-trigger]').click();
  const choices = dialog.locator('[data-tutorial-choice]');
  await expect(choices).toHaveCount(4);
  for (const choice of await choices.all()) {
    await choice.click();
    await expect(choice).toHaveAttribute('aria-pressed', 'true');
    const panel = dialog.locator('[data-tutorial-panel]:visible');
    await expect(panel).toHaveAttribute('data-tutorial-panel', await choice.getAttribute('data-tutorial-choice'));
    await expect(dialog.locator('.tutorial-animation[src]')).toHaveCount(1);
    await expect(panel.locator('.tutorial-step-list')).toBeVisible();
    const bounds = await choice.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  }

  await dialog.locator('[data-tutorial-panel]:visible [data-tutorial-replay]').click();
  await expect(dialog.locator('.tutorial-animation[src]')).toHaveCount(1);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(dialog.locator('.tutorial-animation[src]')).toHaveCount(0);
  await expect(dialog.locator('[data-tutorial-panel]:visible .tutorial-reduced-motion')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

// The Wiki may be completely offline: backgrounds and every backed-up icon must still decode locally.
test('Wiki image backups and trait backgrounds work with the Wiki blocked', async ({ page }) => {
  const manifest = JSON.parse(await readFile(new URL('../../images/wiki/manifest.json', import.meta.url), 'utf8'));
  const wikiRequests = [];
  await mockGw2Icons(page);
  await page.route(/https:\/\/wiki(?:-[a-z]+)?\.guildwars2\.com\//, (route) => {
    wikiRequests.push(route.request().url());
    return route.abort();
  });
  await page.goto('/guardian.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#loading-overlay')).toHaveClass(/hidden/);
  const failures = await page.evaluate(
    async (paths) => {
      const { SPECIALIZATION_BACKGROUNDS } = await import('/js/games/gw2/app/shared/specialization-backgrounds.ts');
      const { GUARDIAN_BUNDLE_SKILLS } =
        await import('/js/games/gw2/professions/guardian/data/guardian-bundle-skills.ts');
      const sources = [
        ...paths.map((path) => `/${path}`),
        ...Object.values(SPECIALIZATION_BACKGROUNDS),
        ...GUARDIAN_BUNDLE_SKILLS.filter((skill) => skill.tome).map((skill) => skill.icon)
      ];
      return (
        await Promise.all(
          sources.map(async (source) => {
            const image = new Image();
            image.src = source;
            try {
              await image.decode();
              return null;
            } catch {
              return source;
            }
          })
        )
      ).filter(Boolean);
    },
    manifest.images.map(({ localPath }) => localPath)
  );
  expect(failures).toEqual([]);
  await expect(page.locator('.spec-bg')).toHaveCount(3);
  for (const background of await page.locator('.spec-bg').all()) {
    await expect(background).toHaveCSS('background-image', /images\/wiki\//);
  }

  expect(wikiRequests).toEqual([]);
});
