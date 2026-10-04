// Headless application state for skill damage tests: a saved build loaded through the real adapter, without a DOM.
import { readFile } from 'node:fs/promises';

import { loadProfessionAppAdapter } from '#gw2/profession-registry.js';

const repoUrl = (path) => new URL(`../../${path}`, import.meta.url);

/** Loads a saved build into the minimal app shape the build editor's projections read. */
export async function headlessApp(professionId, buildPath) {
  const adapter = await loadProfessionAppAdapter(professionId);
  const saved = JSON.parse(await readFile(repoUrl(buildPath), 'utf8'));
  const catalog = adapter.profession.catalog;
  const app = {
    gameId: 'gw2',
    contentId: professionId,
    patchId: 'current',
    adapter,
    profession: adapter.profession,
    activeCatalog: catalog,
    skills: [...catalog.skills],
    skillById: catalog.skillsById,
    skillByName: catalog.skillsByName,
    weaponData: adapter.weaponData,
    attributeWeaponSet: 1,
    results: null,
    build: adapter.toApplicationBuild({ ...saved, rotation: [] })
  };
  adapter.recalculate(app);
  return app;
}

/** The first saved build listed in a profession's manifest. */
export async function firstPresetBuildPath(professionId) {
  const manifest = JSON.parse(await readFile(repoUrl(`data/gw2/builds/${professionId}/manifest.json`), 'utf8'));
  return manifest.flatMap((section) => section.presets)[0].build;
}
