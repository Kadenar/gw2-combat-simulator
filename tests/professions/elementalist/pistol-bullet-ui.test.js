import assert from 'node:assert/strict';
import test from 'node:test';

import { displayedWeaponSkills, weaponSkills } from '#gw2/app/rotation/palette/model.js';
import { elementalistAppAdapter } from '#gw2/content/professions/elementalist/app/app-definition.js';
import { elementalistCatalog } from '#gw2/content/professions/elementalist/catalog.js';
import { elementalistProfession } from '#gw2/content/professions/elementalist/definition.js';

function createPistolApp() {
  const build = elementalistAppAdapter.toApplicationBuild({
    ...elementalistProfession.createBuildDefaults(),
    weapons: ['Pistol', 'Warhorn'],
    pistolBullets: {
      Fire: true,
      Water: false,
      Air: false,
      Earth: false
    },
    specializations: [
      { name: 'Fire', traits: '1-1-1' },
      { name: 'Air', traits: '1-1-1' },
      { name: 'Tempest', traits: '1-1-1' }
    ]
  });
  let changeCount = 0;
  const app = {
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
        time: 0,
        cooldowns: {},
        profession: {
          primaryAttunement: 'Air',
          secondaryAttunement: null,
          autoattackChains: {},
          pistolBullets: {
            Fire: false,
            Water: true,
            Air: true,
            Earth: false
          }
        }
      }
    },
    changed() {
      changeCount += 1;
    }
  };

  return { app, changeCount: () => changeCount };
}

function paletteContext(app) {
  return {
    specialization: 'Tempest',
    build: app.build,
    professionState: app.results?.endState?.profession || {},
    time: Number(app.results?.endState?.time || 0) / 1000
  };
}

test('Elementalist pistol controls distinguish starting and current bullets', () => {
  const { app } = createPistolApp();
  const group = elementalistProfession.ui
    .paletteGroups(paletteContext(app))
    .find((candidate) => candidate.id === 'elementalist-pistol-bullets');
  const [fire, water, air] = group.controls;

  assert.equal(group.controls.length, 4);
  assert.deepEqual(
    { active: fire.active, pressed: fire.pressed, muted: fire.muted, badge: fire.badge },
    { active: false, pressed: true, muted: true, badge: 'S' }
  );
  assert.deepEqual(
    { active: water.active, pressed: water.pressed, muted: water.muted },
    { active: true, pressed: false, muted: true }
  );
  assert.equal(air.active, true);
  assert.equal(air.muted, false);
  assert.match(fire.title, /not currently stocked; starts stocked/);
  assert.equal(fire.icon, elementalistCatalog.skillsByName.get('Scorching Shot').icon);
});

test('Elementalist pistol controls toggle the selected starting bullet', () => {
  const { app, changeCount } = createPistolApp();
  const changed = elementalistProfession.ui.updatePaletteControl(
    paletteContext(app),
    'elementalist-pistol-bullet:Water'
  );

  if (changed) app.changed();

  assert.equal(changed, true);
  assert.equal(app.build.pistolBullets.Water, true);
  assert.equal(changeCount(), 1);
});

test('Elemental Explosion replaces the active pistol autoattack at full stock', () => {
  const { app } = createPistolApp();
  const skillNames = () =>
    elementalistProfession.ui
      .paletteWeaponSkills(paletteContext(app), displayedWeaponSkills(app, weaponSkills(app, 1), 1))
      .map((skill) => skill.name);

  assert.equal(skillNames().includes('Elemental Explosion'), false);
  assert.equal(skillNames().includes('Electric Exposure'), true);

  app.results.endState.profession.pistolBullets = {
    Fire: true,
    Water: true,
    Air: true,
    Earth: true
  };

  assert.equal(skillNames().includes('Elemental Explosion'), true);
  assert.equal(skillNames().includes('Electric Exposure'), false);
  assert.equal(skillNames().includes('Scorching Shot'), true);
});

test('Aerial Agility collapses its chain into one pistol palette tile', () => {
  const { app } = createPistolApp();
  const names = displayedWeaponSkills(app, weaponSkills(app, 1), 1).map((skill) => skill.name);

  assert.equal(names.includes('Aerial Agility'), true);
  assert.equal(names.includes('Aerial Agility (chain)'), false);
  assert.equal(names.includes('Aerial Agility (dash)'), false);
});

test('Elementalist bullet controls stay hidden without a pistol', () => {
  const { app } = createPistolApp();

  app.build.weapons = ['Sword', 'Warhorn'];

  assert.equal(
    elementalistProfession.ui
      .paletteGroups(paletteContext(app))
      .some((group) => group.id === 'elementalist-pistol-bullets'),
    false
  );
});
