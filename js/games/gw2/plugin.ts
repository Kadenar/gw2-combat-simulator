import { getProfessionEntry, professionRegistry } from '#gw2/app/profession/registry.js';
import type { GamePlugin, PlayableContentPlugin } from '#app/game/contracts.js';
import type { ProfessionApp } from '#gw2/app/profession-app.js';

/** Starts the existing GW2 profession application while preserving its browser globals and lifecycle. */
async function mountProfession(contentId: string, root: Document): Promise<ProfessionApp> {
  const entry = getProfessionEntry(contentId);
  if (!entry) throw new TypeError(`Unknown GW2 profession "${contentId}".`);

  const [{ ProfessionApp }, adapter] = await Promise.all([
    import('#gw2/app/profession-app.js'),
    entry.loadAppAdapter()
  ]);
  // Report the real data-to-render transition and keep unfinished controls out of keyboard navigation.
  const loadingStatus = root.getElementById('loading-status');
  if (loadingStatus) loadingStatus.textContent = 'Preparing your build workspace…';
  const app = new ProfessionApp(adapter);
  const globalScope = (root.defaultView || window) as unknown as Record<string, unknown>;
  globalScope.professionApp = app;
  if (adapter.globalName) globalScope[adapter.globalName] = app;
  await app.init();
  root.getElementById('app')?.removeAttribute('inert');
  return app;
}

/** Wraps the existing profession registry as the first game plug-in without moving GW2 domain code. */
export const gw2Plugin: GamePlugin = Object.freeze({
  id: 'gw2',
  name: 'Guild Wars 2',
  content: Object.freeze(
    professionRegistry.map(({ id, name, route, icon, themeClass, armorWeight }) =>
      Object.freeze({ id, name, route, icon, themeClass, group: armorWeight })
    )
  ),
  async loadContent(contentId: string): Promise<PlayableContentPlugin | null> {
    const entry = getProfessionEntry(contentId);
    if (!entry) return null;

    return Object.freeze({
      gameId: 'gw2',
      id: entry.id,
      name: entry.name,
      mount: (root: Document) => mountProfession(entry.id, root)
    });
  }
});
