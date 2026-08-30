import assert from 'node:assert/strict';
import test from 'node:test';

import { timelineWeaponRows } from '#gw2/app/rotation/timeline/model.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { warriorCatalog } from '#gw2/content/professions/warrior/catalog.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/content/professions/warrior/data/ids.js';
import { warriorProfession } from '#gw2/content/professions/warrior/definition.js';

function simulate(rotation) {
  return simulateGw2({
    profession: warriorProfession,
    rotation,
    config: {
      specialization: 'Bladesworn',
      initialResource: 100,
      stats: {
        power: 2000,
        precision: 1500,
        ferocity: 500,
        conditionDamage: 1000
      },
      target: {
        armor: 2597,
        health: 3_970_000,
        defiant: true,
        conditions: { Vulnerability: 25 }
      }
    },
    mode: 'sequence'
  });
}

test('Gunsaber equip and stow count as weapon swaps', () => {
  const result = simulate([ID.UNSHEATHE_GUNSABER, ID.SHEATHE_GUNSABER, ID.DRAGON_TRIGGER]);
  const swaps = result.events.filter((event) => event.type === 'sigil_swap');

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    swaps.map((event) => event.skillId),
    [ID.UNSHEATHE_GUNSABER, ID.SHEATHE_GUNSABER, ID.DRAGON_TRIGGER]
  );
  assert.ok(swaps.every((event) => event.weaponSet === 1));
  assert.equal(result.endState.activeWeaponSet, 1);
  assert.equal(result.endState.profession.gunsaberActive, true);
});

test('Dragon Trigger does not swap again when Gunsaber is already active', () => {
  const result = simulate([ID.UNSHEATHE_GUNSABER, ID.DRAGON_TRIGGER]);

  assert.equal(result.events.filter((event) => event.type === 'sigil_swap').length, 1);
  assert.equal(result.endState.profession.gunsaberActive, true);
});

test('Gunsaber transitions start separate rotation lines', () => {
  const transition = warriorProfession.ui.timelineWeaponLineTransition;
  const rotation = [
    'Chop',
    'Unsheathe Gunsaber',
    'Swift Cut',
    'Sheathe Gunsaber',
    'Chop',
    'Dragon Trigger',
    'Dragon Slash—Force'
  ];
  const rows = timelineWeaponRows(rotation, {
    startingWeaponSet: 1,
    weaponSwapChangesSet: false,
    weaponLineTransition(entry, current) {
      const name = typeof entry === 'string' ? entry : entry.name;

      return transition({
        entry: { name },
        skill: warriorCatalog.skillsByName.get(name),
        specialization: 'Bladesworn',
        ...current
      });
    }
  });

  assert.deepEqual(
    rows.map((row) => row.weaponLine),
    [null, 'Gunsaber', null, 'Gunsaber']
  );
  assert.deepEqual(
    rows.map((row) => row.skills.map((skill) => skill.index)),
    [[0, 1], [2, 3], [4, 5], [6]]
  );
  assert.ok(rows.every((row) => row.weaponSet === 1));

  const alreadyUnsheathed = timelineWeaponRows(
    ['Unsheathe Gunsaber', 'Swift Cut', 'Dragon Trigger', 'Dragon Slash—Force'],
    {
      weaponSwapChangesSet: false,
      weaponLineTransition(entry, current) {
        const name = typeof entry === 'string' ? entry : entry.name;

        return transition({
          entry: { name },
          skill: warriorCatalog.skillsByName.get(name),
          specialization: 'Bladesworn',
          ...current
        });
      }
    }
  );

  assert.deepEqual(
    alreadyUnsheathed.map((row) => row.skills.map((skill) => skill.index)),
    [[0], [1, 2, 3]]
  );
});
