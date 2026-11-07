/** Exercises the same completed projection and markup seam as the mounted palette. */
import { capturePaletteInput } from '#gw2/app/rotation/palette/input.js';
import { projectPalette } from '#gw2/app/rotation/palette/model.js';
import { paletteHtml } from '#gw2/app/rotation/palette/view.js';
import { normalizeProfessionUi } from '#gw2/platform/profession-presentation/contract.js';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';

/** Minimal explicit palette facts let projection tests vary observations without constructing an application session. */
export function paletteInputFixture({ build = {}, ...overrides } = {}) {
  return {
    catalog: createCanonicalCatalog({ skills: [] }),
    specialization: 'Core',
    weaponData: {},
    selectedTraitIds: [],
    isSkillAvailable: () => true,
    ui: normalizeProfessionUi('palette-fixture'),
    slotLoadout: null,
    canSwapWeaponSetsInCombat: true,
    combatReferenceMs: 0,
    tooltip: () => ({ description: '', facts: [] }),
    planning: null,
    ...overrides,
    build: {
      weapons: ['', ''],
      alternateWeapons: ['', ''],
      selectedSkillIds: {},
      rotation: [],
      startingWeaponSet: 1,
      ...build
    }
  };
}

export function renderPaletteMarkup(app) {
  return paletteHtml(projectPalette(capturePaletteInput(app)));
}
