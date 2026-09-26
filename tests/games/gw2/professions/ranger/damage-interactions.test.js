import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { rangerCoreModifierRules } from '#gw2/professions/ranger/core/modifiers.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { rangerCatalog, rangerProfession } from '#gw2/professions/ranger/profession.js';
import { createRangerCoreState } from '#gw2/professions/ranger/core/state.js';
import { reactToRangerCoreDamage } from '#gw2/professions/ranger/core/mechanics/reactions.js';
import {
  skillBreakdownRows,
  skillDamageKeyByIdentity,
  skillDamageIdentityKey
} from '#gw2/app/results/skill-breakdown.js';
import { createObservedProfessionSimulator } from '#tests/helpers/observed-runtime.js';
import { buildBoonGeneration } from '#gw2/app/results/charts/boon-generation.js';
import { buffApplicationStacks } from '#gw2/platform/combat/boons.js';

const simulate = createObservedProfessionSimulator(rangerProfession, {
  primaryWeapon: 'Spear',
  selectedPet: 'Pig',
  selectedTraitIds: [],
  boons: { quickness: true, alacrity: false },
  stats: { power: 2000, precision: 1000, ferocity: 0 },
  target: { armor: 2597 }
});
const wait = (durationMs) => ({ type: 'wait', durationMs });
const hits = (result, skillId) =>
  result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillId === skillId);

test('Core damage reactions preserve trait and skill ordering without spending charges on excluded hits', () => {
  // One trap activation exercises interleaved procs and independent one-use versus per-hit state.
  const config = { selectedTraitIds: [TRAIT.OPENING_STRIKE, TRAIT.TRAPPERS_EXPERTISE] };
  const state = createRangerCoreState(config);
  state.sharpeningStoneExpirations = [10, 10];
  state.bloodThirst.charges = 2;
  state.bloodThirst.expiresAt = 12;
  const queued = [];
  const context = {
    config,
    profession: { core: state },
    helpers: rangerCatalog,
    boons: new Map(),
    queue: { enqueue: (event) => queued.push(event) }
  };
  const event = {
    type: 'damage',
    at: 1,
    source: 'ranger',
    actorType: 'player',
    sourceId: ID.FROST_TRAP,
    skillId: ID.FROST_TRAP,
    skillName: 'Frost Trap',
    coefficient: 1,
    activationId: 'trap-1'
  };
  const react = reactToRangerCoreDamage;
  const initialState = structuredClone(state);
  for (const excluded of [
    { coefficient: 0 },
    { coefficient: -1 },
    { coefficient: undefined },
    { actorType: 'effect' }
  ]) {
    react(context, { ...event, ...excluded });
    assert.deepEqual(queued, []);
    assert.deepEqual(state, initialState);
  }

  react(context, event);
  assert.deepEqual(
    queued.map(({ sourceId }) => sourceId),
    [TRAIT.OPENING_STRIKE, ID.SHARPENING_STONE, TRAIT.TRAPPERS_EXPERTISE, ID.CRIPPLING_SHOT]
  );
  assert.ok(queued.every(({ at }) => at === event.at));
  assert.equal(state.bloodThirst.charges, 1);
  assert.deepEqual(state.sharpeningStoneExpirations, [10]);

  queued.length = 0;
  react(context, event);
  assert.deepEqual(
    queued.map(({ sourceId }) => sourceId),
    [ID.SHARPENING_STONE, ID.CRIPPLING_SHOT]
  );
  assert.equal(state.bloodThirst.charges, 0);
  assert.deepEqual(state.sharpeningStoneExpirations, []);

  state.bloodThirst.charges = 1;
  queued.length = 0;
  react(context, { ...event, sourceId: ID.CRIPPLING_SHOT });
  assert.equal(state.bloodThirst.charges, 1);
  assert.deepEqual(queued, []);
});

test('Ranger condition-count bonuses use canonical active conditions and query precedence', () => {
  // Both formulas must count condition variety at the observation time, not raw names or inactive stacks.
  const stack = { appliedAt: 5, expiresAt: 10, weight: 2 };
  const runtime = { conditionState: new Map([['Burning', { stacks: [stack] }]]) };
  const config = { target: { conditions: { burn: true } } };
  const cases = [
    [{ config, runtime }, 1],
    ...[{ appliedAt: 6 }, { removedAt: 5 }, { expiresAt: 5 }, { weight: 0 }].map((patch) => [
      { runtime: { conditionState: new Map([['Burning', { stacks: [{ ...stack, ...patch }] }]]) } },
      0
    ]),
    [{ config, runtime, query: { targetHasCondition: () => false } }, 0],
    [{ query: { targetHasCondition: (condition) => condition === 'Bleeding' } }, 1]
  ];
  const bonus = rangerCoreModifierRules.find((rule) => rule.id === 'ranger.condition-count-skill-bonus');
  const bite = rangerCoreModifierRules.find((rule) => rule.id === 'ranger.consuming-bite-condition-count');
  for (const [inputs, count] of cases) {
    const context = { time: 5, ...inputs };
    const strike = { ...context, event: { damageKind: 'ranger-unleashed-disabled-condition-count' } };
    const pet = { ...context, event: { skillId: ID.CONSUMING_BITE, coefficient: 0.45 } };
    assert.equal(bonus.when(strike), true);
    assert.equal(bite.when(pet), true);
    assert.equal(bonus.factor(strike, bonus.target, bonus.parameters), 1 + count * 0.02);
    assert.equal(bite.factor(pet, bite.target, bite.parameters), (0.45 + count * 0.025) / 0.45);
  }
});

test('Ranger condition bonuses retain the Consuming Bite cap and coefficient guard', () => {
  // Only Consuming Bite caps condition variety; its coefficient conversion must remain safe for nonpositive inputs.
  const config = {
    target: { conditions: { burn: true, bleed: true, poison: true, chill: true, slow: true, weakness: true } }
  };
  const bonus = rangerCoreModifierRules.find((rule) => rule.id === 'ranger.condition-count-skill-bonus');
  const bite = rangerCoreModifierRules.find((rule) => rule.id === 'ranger.consuming-bite-condition-count');
  const context = { config, time: 5, event: { skillId: ID.CONSUMING_BITE, coefficient: 0.45 } };
  assert.equal(bonus.factor(context, bonus.target, bonus.parameters), 1.12);
  assert.equal(bite.factor(context, bite.target, bite.parameters), (0.45 + 0.125) / 0.45);
  for (const coefficient of [undefined, 0, -1]) {
    assert.equal(bite.factor({ ...context, event: { coefficient } }, bite.target, bite.parameters), 1);
  }
});

test('One Wolf Pack echoes every one-second Frost Trap pulse without shifting its cadence', () => {
  // The personal stance's inclusive deadline preserves each pulse's echo while keeping the skill's exact cadence.
  const trap = simulate('Soulbeast', [ID.ONE_WOLF_PACK, ID.FROST_TRAP, wait(6000)]);
  const echoes = hits(trap, ID.ONE_WOLF_PACK);
  const pulses = hits(trap, ID.FROST_TRAP);
  for (let index = 1; index < pulses.length; index += 1) {
    assert.equal(Math.round((pulses[index].at - pulses[index - 1].at) * 1_000_000), 1_000_000);
  }

  assert.deepEqual(
    echoes.map((event) => Math.round(event.at * 1000)),
    pulses.map((event) => Math.round(event.at * 1000) + 280)
  );
  const weapon = simulate('Soulbeast', [ID.ONE_WOLF_PACK, ID.DRAKES_SWIPE, wait(1000)]);
  const echo = hits(weapon, ID.ONE_WOLF_PACK)[0];
  assert.equal(echo.skillWeapon, 'Unequipped');
  assert.equal(echo.resolvedWeaponStrength, echoes[0].resolvedWeaponStrength);
  assert.equal(echo.damage, echoes[0].damage);
});

test('Leader of the Pack shares half the extended stance window with independent allied triggers', () => {
  // An idle caster isolates allied triggers, duration boundaries, and each recipient's cooldown.
  const config = {
    selectedTraitIds: [TRAIT.LEADER_OF_THE_PACK],
    allies: { count: 2, strikesPerSecond: 4 }
  };
  for (const skillId of [ID.ONE_WOLF_PACK, ID.VULTURE_STANCE]) {
    const result = simulate('Soulbeast', [skillId, wait(8000)], config);
    assert.deepEqual(result.warnings, []);
    const applications = result.events.filter((event) => event.type === 'buff' && event.skillId === skillId);
    const personal = applications.find((event) => event.resolvedAudience.includesSelf);
    const shared = applications.find((event) => !event.resolvedAudience.includesSelf);
    assert.ok(Math.abs(personal.duration - 7.2) < 1e-9);
    assert.equal(shared.duration, personal.duration * 0.5);
    assert.equal(shared.resolvedAudience.alliedPlayerCount, 2);
    const procs = result.resolvedEvents.filter(
      (event) =>
        event.skillId === skillId &&
        event.metadata?.triggeredByAlly &&
        event.type === (skillId === ID.ONE_WOLF_PACK ? 'damage' : 'condition')
    );
    const procInterval = skillId === ID.ONE_WOLF_PACK ? 1.25 : 0.5;
    const delay = skillId === ID.ONE_WOLF_PACK ? 0.28 : 0;
    for (const allyIndex of [1, 2]) {
      const times = procs
        .filter((event) => event.metadata.triggeredByAlly === allyIndex)
        .map((event) => Number((event.at - shared.at - delay).toFixed(6)));
      // Four attacks per second continue through blocked opportunities; equality never advances the stance ICD.
      const expected = Array.from(
        { length: Math.floor((shared.duration - 0.25) / procInterval) + 1 },
        (_, i) => 0.25 + i * procInterval
      );
      assert.deepEqual(times, expected);
    }

    if (skillId === ID.VULTURE_STANCE) {
      const might = result.resolvedEvents.filter((event) => event.kind === 'might' && event.metadata?.triggeredByAlly);
      assert.ok(might.length > 0);
      assert.ok(
        might.every((event) => !event.resolvedAudience.includesSelf && event.resolvedAudience.alliedPlayerCount === 1)
      );
    }

    for (const disabled of [
      { ...config, selectedTraitIds: [] },
      { ...config, allies: { count: 0, strikesPerSecond: 4 } },
      { ...config, allies: { count: 2, strikesPerSecond: 0 } }
    ]) {
      const idle = simulate('Soulbeast', [skillId, wait(8000)], disabled);
      assert.ok(!idle.resolvedEvents.some((event) => event.metadata?.triggeredByAlly));
    }
  }
});

test('shared Vulture might stays on each triggering ally through boon reporting', () => {
  // Separate recipients must retain their own stacks rather than overflowing the first ally's cap.
  const result = simulate('Soulbeast', [ID.VULTURE_STANCE, wait(8000)], {
    selectedTraitIds: [TRAIT.LEADER_OF_THE_PACK],
    allies: { count: 4, strikesPerSecond: 4 }
  });
  const might = result.resolvedEvents.filter((event) => event.kind === 'might' && event.metadata?.triggeredByAlly);
  assert.ok(might.every((event) => event.resolvedAudience.alliedPlayerIndex === event.metadata.triggeredByAlly));
  const generation = buildBoonGeneration(result.resolvedEvents, 0, 8);
  assert.deepEqual(
    generation.alliedApplications.map((history) => buffApplicationStacks(history.get('might') || [], 'might', 3.5, 25)),
    [7, 7, 7, 7]
  );
});

test('precast shared stances start allied attacks in combat without extending expiry', () => {
  // Starting the attack clock at engagement prevents precombat procs from spending cooldowns or creating echoes.
  const config = { selectedTraitIds: [TRAIT.LEADER_OF_THE_PACK], allies: { count: 1, strikesPerSecond: 4 } };
  for (const skillId of [ID.ONE_WOLF_PACK, ID.VULTURE_STANCE]) {
    const result = simulate('Soulbeast', [skillId, wait(840), { type: 'combat-start' }, wait(8000)], config);
    const application = result.events.find(
      (event) => event.type === 'buff' && event.resolvedAudience?.alliedPlayerCount === 1
    );
    const delay = skillId === ID.ONE_WOLF_PACK ? 0.28 : 0;
    const interval = 0.25;
    const procs = result.resolvedEvents.filter(
      (event) =>
        event.metadata?.triggeredByAlly && event.type === (skillId === ID.ONE_WOLF_PACK ? 'damage' : 'condition')
    );
    assert.ok(procs.length > 0);
    assert.ok(Math.abs(procs[0].at - delay - result.combatStartTime - interval) < 1e-9);
    assert.ok(
      procs.every(
        (event) =>
          event.at - delay >= result.combatStartTime && event.at - delay <= application.at + application.duration + 1e-9
      )
    );
    const expired = simulate('Soulbeast', [skillId, wait(8000), { type: 'combat-start' }, wait(8000)], config);
    assert.ok(!expired.resolvedEvents.some((event) => event.metadata?.triggeredByAlly));
  }
});

test('shared One Wolf Pack preserves personal triggers and resolves echoes after the shared window expires', () => {
  // The allied hit lands at shared expiry; its delayed echo must survive without consuming the player's ICD.
  const config = { selectedTraitIds: [TRAIT.LEADER_OF_THE_PACK], allies: { count: 1, strikesPerSecond: 1 / 3.6 } };
  const rotation = [ID.ONE_WOLF_PACK, ID.FROST_TRAP, wait(8000)];
  const shared = simulate('Soulbeast', rotation, config);
  const solo = simulate('Soulbeast', rotation, { ...config, allies: { count: 0 } });
  const echoes = hits(shared, ID.ONE_WOLF_PACK);
  assert.deepEqual(
    echoes.filter((event) => !event.metadata?.triggeredByAlly).map((event) => event.at),
    hits(solo, ID.ONE_WOLF_PACK).map((event) => event.at)
  );
  const application = shared.events.find(
    (event) => event.kind === 'one-wolf-pack' && event.resolvedAudience?.alliedPlayerCount === 1
  );
  assert.deepEqual(
    echoes
      .filter((event) => event.metadata?.triggeredByAlly)
      .map((event) => Number((event.at - application.at).toFixed(6))),
    [3.88]
  );
});

test('precast Frost Trap waits for combat and preserves its whole pulse train and field', () => {
  const ordinary = simulate('Soulbeast', [ID.FROST_TRAP, wait(6000)]);
  const precast = simulate('Soulbeast', [ID.FROST_TRAP, wait(6000), { type: 'combat-start' }, wait(6000)]);
  const ordinaryHits = hits(ordinary, ID.FROST_TRAP),
    delayedHits = hits(precast, ID.FROST_TRAP);
  assert.deepEqual(precast.warnings, []);
  assert.equal(delayedHits.length, ordinaryHits.length);
  assert.equal(delayedHits[0].at, precast.combatStartTime);
  const offsets = (rows) => rows.map((event) => Math.round((event.at - rows[0].at) * 1000));
  assert.deepEqual(offsets(delayedHits), offsets(ordinaryHits));
  const field = precast.events.find((event) => event.type === 'combo_field' && event.offTarget !== true);
  const originalField = ordinary.events.find((event) => event.type === 'combo_field');
  assert.equal(field.at, precast.combatStartTime);
  assert.equal(field.expiresAt - field.at, originalField.expiresAt - originalField.at);
  assert.equal(observedRuntime(precast).profession.core.pendingFrostTrapEvents.length, 0);
  const early = simulate('Soulbeast', [ID.FROST_TRAP, { type: 'combat-start' }, wait(6000)]);
  assert.equal(hits(early, ID.FROST_TRAP)[0].at, ordinaryHits[0].at, 'combat cannot bypass arming');
  const cancelled = simulate('Soulbeast', [
    { type: 'cast', skillId: ID.FROST_TRAP, interruptAfterMs: 1 },
    { type: 'combat-start' },
    wait(6000)
  ]);
  assert.equal(hits(cancelled, ID.FROST_TRAP).length, 0);
});

test('Path of Scars variants share one row and chart series with both casts counted', () => {
  const result = simulate('Soulbeast', [ID.PATH_OF_SCARS, ID.PATH_OF_SCARS_MAX_RANGE, wait(2000)], {
    primaryWeapon: 'Axe',
    secondaryWeapon: 'Axe'
  });
  assert.deepEqual(result.warnings, []);
  const rows = skillBreakdownRows(result).filter((row) => row.name.startsWith('Path of Scars'));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, 'Path of Scars');
  assert.equal(rows[0].casts, 2);
  const contacts = [...hits(result, ID.PATH_OF_SCARS), ...hits(result, ID.PATH_OF_SCARS_MAX_RANGE)];
  assert.equal(rows[0].hits, contacts.length);
  const keys = skillDamageKeyByIdentity(result);
  for (const event of contacts) assert.equal(keys.get(skillDamageIdentityKey(event)), rows[0].key);
  const actions = result.events.filter(
    (event) => event.type === 'action' && [ID.PATH_OF_SCARS, ID.PATH_OF_SCARS_MAX_RANGE].includes(event.skillId)
  );
  const castTime = actions.reduce((total, event) => total + event.endsAt - event.at, 0);
  assert.ok(Math.abs(rows[0].dct - rows[0].total / castTime) < 1e-6);
});

test('Brutal Charge activates Claw on delayed contact rather than its queued activation', () => {
  const rotation = [ID.BRUTAL_CHARGE_ID_46432, ID.DRAKES_SWIPE, wait(1500)];
  const result = simulate('Soulbeast', rotation, { relic: 'Claw' });
  const baseline = simulate('Soulbeast', rotation, { relic: '' });
  const charge = hits(result, ID.BRUTAL_CHARGE_ID_46432)[0];
  const swipe = hits(result, ID.DRAKES_SWIPE)[0];
  const proc = result.procSteps.find((event) => event.skill === 'Relic of the Claw');
  assert.deepEqual(result.warnings, []);
  assert.ok(swipe.at < charge.at);
  assert.equal(swipe.damage, hits(baseline, ID.DRAKES_SWIPE)[0].damage);
  assert.equal(proc.start, Math.round(charge.at * 1000));
});

test('Path of Scars activates Claw on the returning contact after a weapon swap', () => {
  // Both range variants retain their projectile and pull after swapping, without granting Claw on the outgoing hit.
  const returnDelays = [];
  for (const skillId of [ID.PATH_OF_SCARS, ID.PATH_OF_SCARS_MAX_RANGE]) {
    const result = simulate('Soulbeast', [skillId, 'Swap Weapons', wait(3000)], {
      primaryWeapon: 'Axe',
      secondaryWeapon: 'Axe',
      weaponSet2Primary: 'Hammer',
      relic: 'Claw'
    });
    const contacts = hits(result, skillId);
    const outgoing = contacts.find((event) => event.hitIndex === 1);
    const returning = contacts.find((event) => event.hitIndex === 2);
    const pull = result.events.find((event) => event.type === 'control' && event.skillId === skillId);
    const proc = result.procSteps.find((event) => event.skill === 'Relic of the Claw');
    const swap = result.steps.find((step) => step.skill === 'Swap Weapons');
    const cast = result.steps.find((step) => step.skillId === skillId);

    assert.deepEqual(result.warnings, []);
    assert.ok(returning.at > outgoing.at);
    assert.ok(returning.at * 1000 > swap.start);
    assert.equal(pull.at, returning.at);
    assert.equal(proc.start, Math.round(returning.at * 1000));
    returnDelays.push(returning.at * 1000 - cast.start);
  }

  assert.ok(returnDelays[1] > returnDelays[0], 'maximum range delays the return and pull more than normal range');
});
