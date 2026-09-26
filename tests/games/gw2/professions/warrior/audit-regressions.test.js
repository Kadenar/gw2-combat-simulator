import { warriorCatalog } from '#gw2/professions/warrior/catalog.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createLiveProfessionSimulator, observeGw2Runtime, runtimeFor } from '#tests/helpers/live-runtime.js';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';

import { createWarriorBuildDefaults } from '#gw2/professions/warrior/build/build.js';
import { applyWarriorBuildAttributeRules } from '#gw2/professions/warrior/build/attributes.js';
import { createCalculateAttributes } from '#gw2/platform/builds/attributes.js';
import { modifyWarriorStrengthAttributes } from '#gw2/professions/warrior/core/traits/strength.js';
import { warriorCoreAttributeRules } from '#gw2/professions/warrior/core/traits/modifiers.js';
import { warriorTooltips } from '#gw2/professions/warrior/app/tooltips.js';

const simulate = createLiveProfessionSimulator(warriorProfession, {
  stats: { power: 2000, precision: 4000, ferocity: 0, conditionDamage: 0, expertise: 0, vitality: 1000 },
  target: { armor: 2597, health: 1_000_000 }
});

// Minimal rotations exercise activation contracts without depending on saved benchmark packets.
test('cancelled Head Butt and Blood Reckoning cannot grant resources or reset a burst', () => {
  const headButt = simulate('Berserker', [{ name: 'Head Butt', interruptMs: 100 }], {
    selectedSkills: { elite: 'Head Butt' }
  });
  assert.deepEqual(headButt.warnings, []);
  assert.equal(
    headButt.events.some((event) => event.type === 'action' && event.cancelled),
    true
  );
  assert.equal(headButt.planningState.profession.adrenaline, 0);
  const config = { initialResource: 30, primaryWeapon: 'Greatsword', selectedSkills: { heal: 'Blood Reckoning' } };
  const primed = simulate('Berserker', ['Berserk', 'Arc Divider'], config);
  const cancelled = simulate(
    'Berserker',
    ['Berserk', 'Arc Divider', { name: 'Blood Reckoning', interruptMs: 100 }],
    config
  );
  assert.deepEqual(cancelled.warnings, []);
  assert.equal(cancelled.planningState.profession.adrenaline, primed.planningState.profession.adrenaline);
  assert.equal(
    cancelled.planningState.cooldowns['Arc Divider'].readyAt,
    primed.planningState.cooldowns['Arc Divider'].readyAt
  );
  const committed = simulate('Berserker', ['Berserk', 'Arc Divider', 'Blood Reckoning'], config);
  assert.deepEqual(committed.warnings, []);
  assert.equal(committed.planningState.cooldowns['Arc Divider'], undefined);
  assert.equal(committed.planningState.profession.adrenaline, 10);
});

test('Invigorating Tempo grants capped adrenaline for each point of Motivation actually spent', () => {
  // Seed the committed refrain's pool, then let its real queued pulse spend and reward the actual amount.
  for (const [skillId, motivation, adrenaline, selected, spent, expected] of [
    [ID.CHANT_OF_ACTION, 4, 0, true, 1, 1],
    [ID.CHANT_OF_RECUPERATION, 4, 0, true, 2, 2],
    [ID.CHANT_OF_FREEDOM, 7, 0, true, 3, 3],
    [ID.CHANT_OF_RECUPERATION, 1, 0, true, 1, 1],
    [ID.CHANT_OF_RECUPERATION, 0, 0, true, 0, 0],
    [ID.CHANT_OF_FREEDOM, 7, 29, true, 3, 30],
    [ID.CHANT_OF_RECUPERATION, 4, 0, false, 2, 0]
  ]) {
    const config = {
      specialization: 'Paragon',
      initialResource: 10,
      selectedTraitIds: selected ? [TRAIT.INVIGORATING_TEMPO] : []
    };
    const profession = warriorProfession.liveRuntimeFor(config);
    const result = observeGw2Runtime({
      profession: {
        ...profession,
        onCastComplete(runtime, cast) {
          profession.onCastComplete?.(runtime, cast);
          runtime.profession.core.adrenaline = adrenaline;
          runtime.profession.specialization.state.motivation = motivation;
        }
      },
      config,
      rotation: [skillId, { type: 'wait', durationMs: 3000 }]
    });
    assert.deepEqual(result.warnings, []);
    const owner = runtimeFor(result).profession;
    assert.equal(owner.specialization.state.motivation, motivation - spent);
    assert.equal(owner.core.adrenaline, expected);
  }
});

test('all accepted Staff and Spear burst variants spend resources and grant first-hit burst traits', () => {
  for (const [skillId, primaryWeapon] of [
    [71922, 'Staff'],
    [71932, 'Staff'],
    [71950, 'Staff'],
    [73006, 'Spear'],
    [73024, 'Spear'],
    [73042, 'Spear']
  ]) {
    for (const [specialization, remaining] of [
      ['Core', 1],
      ['Spellbreaker', 11],
      // Paragon retains its three-bar pool, spends ten, then gains one from the hit.
      ['Paragon', 21]
    ]) {
      const result = simulate(specialization, [skillId, { type: 'wait', durationMs: 1 }], {
        primaryWeapon,
        initialResource: 30,
        selectedTraitIds: [TRAIT.BERSERKERS_POWER]
      });
      assert.deepEqual(result.warnings, [], `${specialization}: ${skillId}`);
      assert.equal(result.planningState.profession.adrenaline, remaining, `${specialization}: ${skillId}`);
      assert.equal(
        result.events.some((event) => event.kind === 'berserkers-power'),
        true
      );
    }
  }
});

test('Axe Mastery adds adrenaline only to critical axe hits, including burst and primal burst hits', () => {
  for (const [specialization, rotation, initialResource] of [
    ['Core', ['Chop'], 0],
    ['Core', ['Eviscerate'], 30],
    ['Berserker', ['Berserk', 'Decapitate'], 30]
  ]) {
    const config = { primaryWeapon: 'Axe', initialResource };
    const baseline = simulate(specialization, rotation, config);
    const result = simulate(specialization, rotation, { ...config, selectedTraitIds: [TRAIT.AXE_MASTERY] });
    assert.deepEqual(result.warnings, []);
    assert.equal(result.planningState.profession.adrenaline - baseline.planningState.profession.adrenaline, 2);
  }

  for (const [skill, primaryWeapon, precision] of [
    ['Chop', 'Axe', 0],
    ['Greatsword Swing', 'Greatsword', 4000]
  ]) {
    const result = simulate('Core', [skill], {
      primaryWeapon,
      stats: { precision },
      selectedTraitIds: [TRAIT.AXE_MASTERY]
    });
    assert.deepEqual(result.warnings, []);
    assert.equal(result.planningState.profession.adrenaline, 1);
  }
});

test('Axe Mastery follows the live cap and Bladesworn resource conversion', () => {
  // Compare actual critical hits so ordinary hit grants and Flow recovery retain their own ownership.
  const config = { primaryWeapon: 'Axe', selectedTraitIds: [TRAIT.AXE_MASTERY], initialResource: 29 };
  assert.equal(simulate('Core', ['Chop'], config).planningState.profession.adrenaline, 30);
  const trained = simulate('Bladesworn', ['Chop'], config);
  const bare = simulate('Bladesworn', ['Chop'], { ...config, selectedTraitIds: [] });
  assert.ok(Math.abs(trained.planningState.profession.flow - bare.planningState.profession.flow - 2) < 1e-9);
});

test('Forceful Greatsword uses active weapon probability, isolated progress and boon duration', () => {
  const config = {
    primaryWeapon: 'Greatsword',
    weaponSet2Primary: 'Axe',
    selectedTraitIds: [TRAIT.FORCEFUL_GREATSWORD],
    stats: { concentration: 1500 }
  };
  const result = simulate('Core', ['Greatsword Swing', 'Swap Weapons', 'Chop', 'Double Chop'], config);
  assert.deepEqual(result.warnings, []);
  const might = result.events.filter((event) => event.type === 'buff' && event.sourceId === TRAIT.FORCEFUL_GREATSWORD);
  assert.equal(might[0].stacks, 1);
  assert.equal(might[0].duration, 10);
  assert.equal(
    might.some((event) => event.skillId === ID.CHOP),
    false
  );
  assert.equal(
    might.some((event) => event.skillId === ID.DOUBLE_CHOP),
    true
  );
  const noncritical = simulate('Core', ['Greatsword Swing'], { ...config, stats: { precision: 0 } });
  assert.equal(
    noncritical.events.some((event) => event.sourceId === TRAIT.FORCEFUL_GREATSWORD),
    false
  );
});

test('mixed Warrior weapon sets keep static bonuses and conversion inputs separate', () => {
  const calculate = createCalculateAttributes(applyWarriorBuildAttributeRules);
  const build = createWarriorBuildDefaults();
  build.weapons = ['Axe', 'Axe'];
  build.alternateWeapons = ['Greatsword', ''];
  build.specializations = [
    { name: 'Strength', traits: '1-2-1' },
    { name: 'Discipline', traits: '1-1-1' },
    { name: 'Tactics', traits: '1-1-2' }
  ];
  for (const [weaponSet, power, ferocity] of [
    [1, 120, 240],
    [2, 240, 120]
  ]) {
    const all = calculate(build, [], weaponSet).attributes;
    const withoutForceful = calculate(build, [], weaponSet, 'Forceful Greatsword').attributes;
    const withoutAxe = calculate(build, [], weaponSet, 'Axe Mastery').attributes;
    assert.equal(all.Power.final - withoutForceful.Power.final, power);
    assert.equal(all.Ferocity.final - withoutAxe.Ferocity.final, ferocity);
    const attributes = { power: all.Power.final, vitality: 1000, ferocity: all.Ferocity.final };
    const before = { ...attributes };
    modifyWarriorStrengthAttributes(
      {
        catalog: warriorCatalog,
        config: { primaryWeapon: 'Axe', weaponSet2Primary: 'Greatsword' },
        runtime: { activeWeaponSet: weaponSet },
        traits: new Set([TRAIT.FORCEFUL_GREATSWORD]),
        time: 0
      },
      attributes,
      true
    );
    assert.deepEqual(attributes, before, 'static provenance avoids applying weapon bonuses twice');
  }
});

// A healing-only trait stays selectable but contributes no build stats, runtime conversion, or balance profile.
test('Vigorous Shouts is outside combat simulation scope', () => {
  const build = createWarriorBuildDefaults();
  build.specializations = [{ name: 'Tactics', traits: '1-1-2' }];
  const calculate = createCalculateAttributes(applyWarriorBuildAttributeRules);
  assert.equal(
    calculate(build).attributes['Healing Power'].final,
    calculate(build, [], 1, 'Vigorous Shouts').attributes['Healing Power'].final
  );
  const attributes = warriorCoreAttributeRules.modifyAttributes(
    { catalog: warriorCatalog, config: { stats: { power: 2000 } }, traits: new Set([TRAIT.VIGOROUS_SHOUTS]), time: 0 },
    { power: 2000, healingPower: 50 }
  );
  assert.equal(attributes.healingPower, 50);
  assert.equal(warriorCatalog.balanceProfilesById.has(TRAIT.VIGOROUS_SHOUTS), false);
  const tooltip = warriorTooltips.traits[TRAIT.VIGOROUS_SHOUTS](
    { catalog: warriorCatalog },
    { id: TRAIT.VIGOROUS_SHOUTS, name: 'Vigorous Shouts' }
  );
  assert.match(tooltip.description, /outside the simulator's scope/);
  assert.deepEqual(tooltip.facts, []);
});

test('endurance integration and Dodge readiness follow actual pooled Vigor windows', () => {
  for (const [events, expectedEndurance, readyAt] of [
    [[{ at: 0, duration: 4 }], 60, 8],
    [
      [
        { at: 0, duration: 2 },
        { at: 1, duration: 2 }
      ],
      60,
      8
    ],
    [[{ at: 2, duration: 2 }], 55, 9]
  ]) {
    // Queued Vigor changes readiness only when it executes; wait partitioning cannot change accumulated recovery.
    const run = (rotation) => {
      const config = { specialization: 'Core' };
      const profession = warriorProfession.liveRuntimeFor(config);
      return observeGw2Runtime({
        profession: {
          ...profession,
          initialize(runtime) {
            profession.initialize?.(runtime);
            runtime.endurance.spend(100);
            for (const event of events)
              runtime.emit({
                ...event,
                type: 'buff',
                kind: 'vigor',
                stacks: 1,
                source: 'fixture',
                sourceId: 'vigor',
                actorType: 'player'
              });
          }
        },
        config,
        rotation
      });
    };

    for (const durations of [[10000], [1000, 1000, 2000, 6000], [30000]]) {
      const result = run(durations.map((durationMs) => ({ type: 'wait', durationMs })));
      assert.equal(result.planningState.profession.endurance, durations[0] === 30000 ? 100 : expectedEndurance);
    }

    const dodge = run(['Dodge']);
    assert.deepEqual(dodge.warnings, []);
    assert.equal(dodge.steps[0].start, readyAt * 1000);
  }
});
