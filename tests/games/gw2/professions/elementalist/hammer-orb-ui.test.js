import { planningFixture } from '#tests/helpers/observed-runtime.js';
import assert from 'node:assert/strict';
import test from 'node:test';

import { renderPaletteMarkup } from '#tests/helpers/palette.js';
import { elementalistAppAdapter } from '#gw2/professions/elementalist/app/app-definition.js';
import { elementalistCatalog, elementalistProfession } from '#gw2/professions/elementalist/profession.js';

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
    activeCatalog: elementalistProfession.catalog,
    skills: elementalistCatalog.skills,
    skillByName: elementalistCatalog.skillsByName,
    skillById: elementalistCatalog.skillsById,
    weaponData: elementalistAppAdapter.weaponData,
    results: {
      planningState: {
        availability: {},
        activeWeaponSet: 1,
        atSeconds: time,
        cooldowns: {},
        // Orb state changes independently of the canonical ammo projection.
        ammo: {},
        ammoBySkillId: {},
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

test('hammer orb generators remain visible while an orb is active', () => {
  const html = renderPaletteMarkup(createHammerApp({ Fire: 15, Water: null, Air: null, Earth: null }));

  assert.match(html, /data-skill="Grand Finale"/);
  for (const orbSkill of ['Flame Wheel', 'Icy Coil', 'Crescent Wind', 'Rocky Loop']) {
    assert.match(html, new RegExp(`data-skill="${orbSkill}"`));
  }
});

test('Flame Wheel is disabled for the shared active-orb window', () => {
  for (const [element, name] of [
    ['Fire', 'Flame Wheel'],
    ['Water', 'Icy Coil']
  ]) {
    for (const expiry of [-1, 15]) {
      const state = planningFixture(
        elementalistProfession,
        { specialization: 'Core', startAttunement: element },
        (runtime) => {
          runtime.profession.core.hammerOrbs[element] = expiry;
        }
      );
      const verdict = state.availability[elementalistCatalog.skillsByName.get(name).id];
      assert.equal(verdict.ready, expiry < 0);
      if (!verdict.ready) assert.equal(verdict.code, 'elementalist.hammer-orb-active');
    }
  }
});

test('Grand Finale requires at least one active hammer orb', () => {
  for (const expiry of [null, -1, 15]) {
    const state = planningFixture(
      elementalistProfession,
      { specialization: 'Core', startAttunement: 'Fire' },
      (runtime) => {
        runtime.profession.core.hammerOrbs.Fire = expiry;
      }
    );
    assert.equal(state.availability[elementalistCatalog.skillsByName.get('Grand Finale').id].ready, expiry === 15);
  }
});
