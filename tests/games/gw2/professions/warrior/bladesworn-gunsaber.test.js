import assert from 'node:assert/strict';
import test from 'node:test';

import { timelineWeaponRows } from '#gw2/app/rotation/timeline/model.js';
import { runGw2Runtime } from '#gw2/platform/simulation/runtime.js';
import { warriorCatalog, warriorProfession } from '#gw2/professions/warrior/profession.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';

function simulate(rotation) {
  const config = {
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
  };
  // Native family state and equipment reactions share one queue.
  return runGw2Runtime({ profession: warriorProfession.runtimeFor(config), config, rotation });
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
  assert.equal(result.planningState.activeWeaponSet, 1);
  assert.equal(result.planningState.profession.gunsaberActive, true);
});

test('Dragon Trigger does not swap again when Gunsaber is already active', () => {
  const result = simulate([ID.UNSHEATHE_GUNSABER, ID.DRAGON_TRIGGER]);

  assert.equal(result.events.filter((event) => event.type === 'sigil_swap').length, 1);
  assert.equal(result.planningState.profession.gunsaberActive, true);
});

test('Gunsaber equip and stow put the opposite action on a five-second cooldown', () => {
  // Alternating immediately must wait for the opposite action after every transition.
  const result = simulate([
    '__combat_start',
    ID.UNSHEATHE_GUNSABER,
    ID.SHEATHE_GUNSABER,
    ID.UNSHEATHE_GUNSABER,
    ID.SHEATHE_GUNSABER
  ]);

  assert.deepEqual(result.warnings, []);
  for (let index = 2; index < result.steps.length; index += 1) {
    assert.equal(result.steps[index].start - result.steps[index - 1].end, 4000);
  }

  const unsheathed = simulate(['__combat_start', ID.UNSHEATHE_GUNSABER]);
  const sheathed = simulate(['__combat_start', ID.UNSHEATHE_GUNSABER, ID.SHEATHE_GUNSABER]);
  assert.equal(unsheathed.planningState.cooldowns['Sheathe Gunsaber'].remaining, 4000);
  assert.equal(sheathed.planningState.cooldowns['Unsheathe Gunsaber'].remaining, 4000);
});

test('Dragon Trigger starts Unsheathe recharge only when entering from normal weapons', () => {
  // Existing Gunsaber entry preserves both running and expired cooldowns.
  for (const [beforeTrigger, remaining] of [
    [[], 4000],
    [[ID.UNSHEATHE_GUNSABER, { type: 'wait', durationMs: 1000 }], 3000],
    [[ID.UNSHEATHE_GUNSABER, { type: 'wait', durationMs: 6000 }], 0],
    [[ID.UNSHEATHE_GUNSABER, ID.SHEATHE_GUNSABER, { type: 'wait', durationMs: 1000 }], 4000]
  ]) {
    const result = simulate(['__combat_start', ...beforeTrigger, ID.DRAGON_TRIGGER]);
    assert.deepEqual(result.warnings, []);
    assert.equal(result.planningState.cooldowns['Unsheathe Gunsaber'].remaining, remaining);
    assert.equal(result.planningState.cooldowns['Sheathe Gunsaber'].remaining, remaining);
    assert.equal(result.planningState.cooldowns['Dragon Trigger'], undefined);
  }
});

// Dragon Trigger only allows instant casts; a cast bar drops back to plain Gunsaber, so the slash cannot follow.
test('casting a skill with a cast bar exits Dragon Trigger', () => {
  const result = simulate(['__combat_start', ID.DRAGON_TRIGGER, ID.MENDING, ID.DRAGON_SLASH_FORCE]);
  const slash = result.steps.find((step) => step.ri === 3);

  assert.equal(result.steps.find((step) => step.ri === 2).invalid, undefined);
  assert.equal(slash.invalid, true);
  assert.match(slash.invalidReason, /Enter Dragon Trigger/);
  assert.equal(result.planningState.profession.gunsaberActive, true);
});

test('Gunsaber swaps and Dragon Trigger entry leave both swap actions ready before combat', () => {
  // Both implicit setup and an explicit future combat marker allow unrestricted bar preparation.
  for (const suffix of [[], ['__combat_start']]) {
    const result = simulate([
      ID.UNSHEATHE_GUNSABER,
      ID.SHEATHE_GUNSABER,
      ID.DRAGON_TRIGGER,
      ID.SHEATHE_GUNSABER,
      ID.UNSHEATHE_GUNSABER,
      ...suffix
    ]);
    assert.deepEqual(result.warnings, []);
    assert.ok(result.steps.every((step) => step.start === 0));
    assert.equal(result.planningState.cooldowns['Unsheathe Gunsaber'].remaining, 0);
    assert.equal(result.planningState.cooldowns['Sheathe Gunsaber'].remaining, 0);
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
