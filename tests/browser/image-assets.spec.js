import { expect, test } from '@playwright/test';

// Decode every local image used by JavaScript and CSS to catch unresolved aliases and missing artwork.
test('local artwork aliases resolve to loadable images', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const failures = await page.evaluate(async () => {
    const { professionRegistry } = await import('/js/games/gw2/app/profession/registry.ts');
    const tutorials = await import('/js/games/gw2/app/tutorial.ts');
    const { WARRIOR_WEAPON_STOW } = await import('/js/games/gw2/professions/warrior/core/skills/actions.ts');
    const sources = professionRegistry.flatMap(({ specializationArtwork = [] }) =>
      specializationArtwork.flatMap(({ conceptArt, image }) => [conceptArt, image])
    );
    sources.push(tutorials.TUTORIAL_GIF_URL, tutorials.ROTATION_TUTORIAL_GIF_URL, tutorials.ANALYSIS_TUTORIAL_GIF_URL);
    sources.push(WARRIOR_WEAPON_STOW.icon);
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
