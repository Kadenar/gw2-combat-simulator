import assert from 'node:assert/strict';
import test from 'node:test';

import { timelineWeaponRows } from '#gw2/app/rotation/timeline/model.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { warriorCatalog, warriorProfession } from '#gw2/professions/warrior/profession.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';

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
    }
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

test('Gunsaber equip and stow put the opposite action on a five-second cooldown', () => {
  // Alternating immediately must wait for the opposite action after every transition.
  const result = simulate([ID.UNSHEATHE_GUNSABER, ID.SHEATHE_GUNSABER, ID.UNSHEATHE_GUNSABER, ID.SHEATHE_GUNSABER]);

  assert.deepEqual(result.warnings, []);
  for (let index = 1; index < result.steps.length; index += 1) {
    assert.equal(result.steps[index].start - result.steps[index - 1].end, 5000);
  }

  const unsheathed = simulate([ID.UNSHEATHE_GUNSABER]);
  const sheathed = simulate([ID.UNSHEATHE_GUNSABER, ID.SHEATHE_GUNSABER]);
  assert.equal(unsheathed.endState.cooldowns['Sheathe Gunsaber'].remaining, 5000);
  assert.equal(sheathed.endState.cooldowns['Unsheathe Gunsaber'].remaining, 5000);
});

test('Dragon Trigger starts Unsheathe recharge only when entering from normal weapons', () => {
  // Existing Gunsaber entry preserves both running and expired cooldowns.
  for (const [beforeTrigger, remaining] of [
    [[], 5000],
    [[ID.UNSHEATHE_GUNSABER, { type: 'wait', durationMs: 1000 }], 4000],
    [[ID.UNSHEATHE_GUNSABER, { type: 'wait', durationMs: 6000 }], 0],
    [[ID.UNSHEATHE_GUNSABER, ID.SHEATHE_GUNSABER, { type: 'wait', durationMs: 1000 }], 5000]
  ]) {
    const result = simulate([...beforeTrigger, ID.DRAGON_TRIGGER]);
    assert.deepEqual(result.warnings, []);
    assert.equal(result.endState.cooldowns['Unsheathe Gunsaber'].remaining, remaining);
    assert.equal(result.endState.cooldowns['Sheathe Gunsaber'].remaining, remaining);
    assert.equal(result.endState.cooldowns['Dragon Trigger'], undefined);
  }
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
