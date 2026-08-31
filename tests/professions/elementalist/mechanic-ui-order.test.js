import assert from 'node:assert/strict';
import test from 'node:test';

import { elementalistProfession } from '#gw2/content/professions/elementalist/definition.js';

const SPECIALIZATION_MECHANICS = Object.freeze({
  Catalyst: {
    palette: 'elementalist-catalyst-spheres',
    skillBar: 'elementalist-catalyst-spheres'
  },
  Tempest: {
    palette: 'elementalist-tempest-overloads',
    skillBar: 'elementalist-tempest-overloads'
  },
  Evoker: {
    palette: 'elementalist-evoker-familiars',
    skillBar: 'elementalist-evoker-familiar'
  }
});

// Elite mechanics lead the shared attunement row so their resource or F5 state
// is visible before the controls whose state determines the available variant.
test('Elementalist elite mechanics render above attunements', () => {
  for (const [specialization, mechanic] of Object.entries(SPECIALIZATION_MECHANICS)) {
    const context = {
      specialization,
      catalog: elementalistProfession.catalog
    };
    const paletteIds = elementalistProfession.ui.paletteGroups(context).map((group) => group.id);
    const skillBarIds = elementalistProfession.ui.skillBarGroups(context).map((group) => group.id);

    assert.ok(paletteIds.indexOf(mechanic.palette) < paletteIds.indexOf('elementalist-attunements'), specialization);
    assert.ok(skillBarIds.indexOf(mechanic.skillBar) < skillBarIds.indexOf('elementalist-attunements'), specialization);
  }
});
