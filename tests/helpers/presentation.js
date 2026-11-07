/** Builds complete presentation fixtures through the same composer used by professions. */
import { createProfessionFamilyUi } from '#gw2/platform/profession-presentation/compose.js';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';

export function professionUiFixture(core = {}, definition = {}) {
  return createProfessionFamilyUi({
    professionId: 'fixture',
    catalog: createCanonicalCatalog({ skills: [] }),
    core,
    specializations: {},
    ...definition
  });
}
