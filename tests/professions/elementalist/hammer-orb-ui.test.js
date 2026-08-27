import assert from 'node:assert/strict';
import test from 'node:test';

import { renderPalette } from '../../../js/games/gw2/app/rotation/palette/view.js';
import { elementalistAppAdapter } from '../../../js/games/gw2/content/professions/elementalist/app/app-definition.js';
import { elementalistCatalog } from '../../../js/games/gw2/content/professions/elementalist/catalog.js';
import { elementalistProfession } from '../../../js/games/gw2/content/professions/elementalist/definition.js';

function createHammerApp(hammerOrbs, time = 0) {
  const build = elementalistAppAdapter.toApplicationBuild({
    ...elementalistProfession.createBuildDefaults(),
    weapons: ['Hammer', ''],
    specializations: [
      { name: 'Fire', traits: '1-1-1' },
      { name: 'Air', traits: '1-1-1' },
      { name: 'Catalyst', traits: '1-1-1' }
    ]
  });

  return {
    build,
    adapter: elementalistAppAdapter,
    profession: elementalistProfession,
    skills: elementalistCatalog.skills,
    skillByName: elementalistCatalog.skillsByName,
    skillById: elementalistCatalog.skillsById,
    weaponData: elementalistAppAdapter.weaponData,
    results: {
      endState: {
        activeWeaponSet: 1,
        time,
        cooldowns: {},
        profession: {
          primaryAttunement: 'Fire',
          secondaryAttunement: null,
          autoattackChains: {},
          hammerOrbs
        }
      }
    }
  };
}

function renderPaletteMarkup(app) {
  const palette = { innerHTML: '', querySelectorAll: () => [] };
  const previousDocument = globalThis.document;

  globalThis.document = {
    getElementById: (id) => (id === 'rotation-palette' ? palette : null)
  };
  try {
    renderPalette(app);
  } finally {
    globalThis.document = previousDocument;
  }

  return palette.innerHTML;
}

test('hammer orb generators remain visible while an orb is active', () => {
  const html = renderPaletteMarkup(createHammerApp({ Fire: 15, Water: null, Air: null, Earth: null }));

  assert.match(html, /data-skill="Grand Finale"/);
  for (const orbSkill of ['Flame Wheel', 'Icy Coil', 'Crescent Wind', 'Rocky Loop']) {
    assert.match(html, new RegExp(`data-skill="${orbSkill}"`));
  }
});

test('Flame Wheel is disabled for the shared active-orb window', () => {
  const flameWheel = elementalistCatalog.skillsByName.get('Flame Wheel');
  const icyCoil = elementalistCatalog.skillsByName.get('Icy Coil');
  const activeContext = {
    time: 0,
    build: { startAttunement: 'Fire' },
    professionState: {
      primaryAttunement: 'Fire',
      secondaryAttunement: null,
      hammerOrbs: { Fire: 15, Water: 15, Air: null, Earth: null }
    }
  };

  assert.deepEqual(elementalistProfession.ui.paletteSkillAvailability(activeContext, flameWheel), {
    available: false,
    message: 'Grand Finale must consume the active orb before it can be created again.'
  });
  const waterContext = {
    ...activeContext,
    build: { startAttunement: 'Water' },
    professionState: { ...activeContext.professionState, primaryAttunement: 'Water' }
  };

  assert.deepEqual(elementalistProfession.ui.paletteSkillAvailability(waterContext, icyCoil), {
    available: false,
    message: 'Grand Finale must consume the active orb before it can be created again.'
  });
  assert.deepEqual(elementalistProfession.ui.paletteSkillAvailability({ ...activeContext, time: 16 }, flameWheel), {
    available: true,
    message: ''
  });
  assert.deepEqual(elementalistProfession.ui.paletteSkillAvailability({ ...waterContext, time: 16 }, icyCoil), {
    available: true,
    message: ''
  });
});

test('Grand Finale requires at least one active hammer orb', () => {
  const grandFinale = elementalistCatalog.skillsByName.get('Grand Finale');
  const context = {
    time: 0,
    build: { startAttunement: 'Fire' },
    professionState: {
      primaryAttunement: 'Fire',
      secondaryAttunement: null,
      hammerOrbs: { Fire: null, Water: null, Air: null, Earth: null }
    }
  };

  assert.deepEqual(elementalistProfession.ui.paletteSkillAvailability(context, grandFinale), {
    available: false,
    message: 'Requires at least one active hammer orb.'
  });
  assert.deepEqual(
    elementalistProfession.ui.paletteSkillAvailability(
      {
        ...context,
        professionState: {
          ...context.professionState,
          hammerOrbs: { ...context.professionState.hammerOrbs, Fire: 15 }
        }
      },
      grandFinale
    ),
    { available: true, message: '' }
  );
  assert.deepEqual(
    elementalistProfession.ui.paletteSkillAvailability(
      {
        ...context,
        time: 16,
        professionState: {
          ...context.professionState,
          hammerOrbs: { ...context.professionState.hammerOrbs, Fire: 15 }
        }
      },
      grandFinale
    ),
    {
      available: false,
      message: 'Requires at least one active hammer orb.'
    }
  );
});
