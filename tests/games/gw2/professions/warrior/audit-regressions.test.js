import { warriorCatalog } from '#gw2/professions/warrior/catalog.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createProfessionSimulator } from '#tests/helpers/profession-simulation.js';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { createWarriorCoreState } from '#gw2/professions/warrior/core/state.js';
import { createParagonState } from '#gw2/professions/warrior/specializations/paragon/state.js';
import { createBladeswornState } from '#gw2/professions/warrior/specializations/bladesworn/state.js';
import {
  activateChant,
  activateCommand,
  refrains,
  updateParagonCast,
  commandEchoes
} from '#gw2/professions/warrior/specializations/paragon/mechanics/chants-and-commands.js';
import {
  advanceWarriorResources,
  warriorEnduranceReadyAt
} from '#gw2/professions/warrior/core/mechanics/adrenaline-and-endurance.js';
import { applyAxeMastery } from '#gw2/professions/warrior/core/traits/discipline.js';
import { createWarriorBuildDefaults } from '#gw2/professions/warrior/build/build.js';
import { applyWarriorBuildAttributeRules } from '#gw2/professions/warrior/build/attributes.js';
import { createCalculateAttributes } from '#gw2/platform/builds/attributes.js';
import { modifyWarriorStrengthAttributes } from '#gw2/professions/warrior/core/traits/strength.js';
import { warriorCoreAttributeRules } from '#gw2/professions/warrior/core/traits/modifiers.js';
import { warriorTooltips } from '#gw2/professions/warrior/app/tooltips.js';

const simulate = createProfessionSimulator(warriorProfession, {
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

// Direct command contexts expose scheduled occurrence identity and resource state without damage aggregates.
function paragonContext() {
  const tasks = [];
  const events = [];
  return {
    config: { selectedTraitIds: [TRAIT.REVERBERATION] },
    catalog: warriorCatalog,
    start: 0,
    effectiveEnd: 0,
    action: {},
    state: {
      time: 0,
      cooldowns: new Map(),
      profession: {
        core: createWarriorCoreState({ initialResource: 30 }),
        specialization: { kind: 'Paragon', state: createParagonState() }
      }
    },
    tasks: { schedule: (task) => tasks.push(task), cancel: () => {} },
    emit: (event) => {
      events.push(event);
      return event;
    },
    events,
    scheduled: tasks
  };
}

test('Invigorating Tempo grants capped adrenaline for each point of Motivation actually spent', () => {
  // Cover each refrain cost, the final partial drain, and the trait selection gate.
  for (const [skillId, motivation, adrenaline, selected, spent, expected] of [
    [ID.CHANT_OF_ACTION, 4, 0, true, 1, 1],
    [ID.CHANT_OF_RECUPERATION, 4, 0, true, 2, 2],
    [ID.CHANT_OF_FREEDOM, 7, 0, true, 3, 3],
    [ID.CHANT_OF_RECUPERATION, 1, 0, true, 1, 1],
    [ID.CHANT_OF_RECUPERATION, 0, 0, true, 0, 0],
    [ID.CHANT_OF_FREEDOM, 7, 9, true, 3, 10],
    [ID.CHANT_OF_RECUPERATION, 4, 0, false, 2, 0]
  ]) {
    const context = paragonContext();
    context.config.selectedTraitIds = selected ? [TRAIT.INVIGORATING_TEMPO] : [];
    const core = context.state.profession.core;
    Object.assign(core, { adrenaline, maximumAdrenaline: 10 });
    const state = context.state.profession.specialization.state;
    Object.assign(state, { motivation, activeRefrainId: skillId });

    refrains.start(context, { key: 'refrain', at: 3, captured: {} });
    refrains.consumeAll(context, 3);

    assert.equal(state.motivation, motivation - spent);
    assert.equal(core.adrenaline, expected);
  }
});

test('cancelled Paragon activations leave Motivation, refrain and pending echoes untouched', () => {
  const context = paragonContext();
  const state = context.state.profession.specialization.state;
  activateCommand(context, warriorCatalog.skillsById.get(ID.WE_SHALL_RETURN));
  const pending = commandEchoes.nextAt(context);
  context.action.cancelled = true;
  const chant = warriorCatalog.skillsById.get(ID.CHANT_OF_ACTION);
  activateChant(context, chant);
  updateParagonCast(context, chant);
  activateCommand(context, warriorCatalog.skillsById.get(ID.FIND_THEIR_WEAKNESS));
  assert.equal(state.motivation, 0);
  assert.equal(state.activeRefrainId, null);
  assert.equal(commandEchoes.nextAt(context), pending);
  assert.equal(context.scheduled.length, 1);
  assert.equal(context.events.length, 0);
  assert.equal(context.state.profession.core.adrenaline, 20, 'cancelled activation retains its resource spend');
});

test('burst-flushed echoes invalidate the old task and repeat after the new interval', () => {
  const context = paragonContext();
  context.state.profession.core.adrenaline = 0;
  activateCommand(context, warriorCatalog.skillsById.get(ID.WE_SHALL_RETURN));
  const oldTask = context.scheduled[0];
  context.effectiveEnd = 1;
  updateParagonCast(context, warriorCatalog.skillsById.get(ID.CHANT_OF_ACTION));
  const nextTask = context.scheduled[1];
  assert.equal(context.state.profession.core.adrenaline, 10);
  assert.equal(nextTask.at, 4);
  commandEchoes.taskHandlers['warrior.paragon-command-echo'](context, oldTask);
  assert.equal(context.state.profession.core.adrenaline, 10);
  assert.equal(commandEchoes.nextAt(context), 4);
  commandEchoes.taskHandlers['warrior.paragon-command-echo'](context, nextTask);
  assert.equal(context.state.profession.core.adrenaline, 20);
  assert.equal(commandEchoes.nextAt(context), Infinity);
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

test('Axe Mastery keeps weapon progress isolated and follows resource caps and Bladesworn conversion', () => {
  const context = paragonContext();
  context.config.selectedTraitIds = [TRAIT.AXE_MASTERY];
  context.schedulerPolicy = { critical: () => ({ chance: 0.5 }) };
  const hit = { at: 0, skillId: ID.CHOP, coefficient: 1, hits: 1 };
  applyAxeMastery(context, { ...hit, skillId: ID.GREATSWORD_SWING });
  applyAxeMastery(context, hit);
  assert.equal(context.state.profession.core.axeMasteryProgress, 0.5);
  context.state.profession.core.adrenaline = 29;
  applyAxeMastery(context, hit);
  assert.equal(context.state.profession.core.adrenaline, 30);
  context.state.profession.specialization = { kind: 'Bladesworn', state: createBladeswornState() };
  context.schedulerPolicy.critical = () => ({ chance: 1 });
  applyAxeMastery(context, hit);
  assert.equal(context.state.profession.specialization.state.flow, 2);
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

// The same canonical Vigor history must produce the same resource and readiness for any wait partition.
test('endurance integration and Dodge readiness follow pooled Vigor windows', () => {
  for (const [events, expectedEndurance, readyAt] of [
    [[{ type: 'buff', kind: 'vigor', at: 0, duration: 4, stacks: 1 }], 60, 8],
    [
      [
        { type: 'buff', kind: 'vigor', at: 0, duration: 2, stacks: 1 },
        { type: 'buff', kind: 'vigor', at: 1, duration: 2, stacks: 1 }
      ],
      60,
      8
    ],
    [[{ type: 'buff', kind: 'vigor', at: 2, duration: 2, stacks: 1 }], 55, 9]
  ]) {
    const contexts = [paragonContext(), paragonContext()];
    for (const context of contexts) {
      context.events = events.map((event) => ({ ...event, resolvedAudience: { includesSelf: true } }));
      context.state.profession.core.endurance = 0;
      assert.equal(warriorEnduranceReadyAt(context, 50), readyAt);
    }

    advanceWarriorResources(contexts[0], 10);
    for (const at of [1, 2, 4, 10]) advanceWarriorResources(contexts[1], at);
    for (const context of contexts) {
      assert.equal(context.state.profession.core.endurance, expectedEndurance);
      advanceWarriorResources(context, 30);
      assert.equal(context.state.profession.core.endurance, 100);
    }
  }
});
