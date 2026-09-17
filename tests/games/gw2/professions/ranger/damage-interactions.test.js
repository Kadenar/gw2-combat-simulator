import assert from 'node:assert/strict';
import test from 'node:test';
import { rangerCoreModifierRules } from '#gw2/professions/ranger/core/traits/modifiers.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { rangerCatalog, rangerProfession } from '#gw2/professions/ranger/profession.js';
import { createRangerCoreState } from '#gw2/professions/ranger/core/state.js';
import { rangerCoreEventReactions } from '#gw2/professions/ranger/core/mechanics/reactions.js';
import {
  skillBreakdownRows,
  skillDamageKeyByIdentity,
  skillDamageIdentityKey
} from '#gw2/app/results/skill-breakdown.js';
import { createProfessionSimulator } from '#tests/helpers/profession-simulation.js';

const simulate = createProfessionSimulator(rangerProfession, {
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
  state.bloodThirstCharges = 2;
  const queued = [];
  const context = {
    config,
    profession: { core: state },
    helpers: { skillsById: rangerCatalog.skillsById },
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
  const react = rangerCoreEventReactions.damage.find(({ id }) => id === 'ranger.core-damage').handler;
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
  assert.equal(state.bloodThirstCharges, 1);
  assert.deepEqual(state.sharpeningStoneExpirations, [10]);

  queued.length = 0;
  react(context, event);
  assert.deepEqual(
    queued.map(({ sourceId }) => sourceId),
    [ID.SHARPENING_STONE, ID.CRIPPLING_SHOT]
  );
  assert.equal(state.bloodThirstCharges, 0);
  assert.deepEqual(state.sharpeningStoneExpirations, []);

  state.bloodThirstCharges = 1;
  queued.length = 0;
  react(context, { ...event, sourceId: ID.CRIPPLING_SHOT });
  assert.equal(state.bloodThirstCharges, 1);
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

test('One Wolf Pack uses its own strength and accepts periodic hits at the recharge boundary', () => {
  // Five evenly spaced pulses must each produce one echo; weapon triggers must use the same stance formula.
  const trap = simulate('Soulbeast', [ID.ONE_WOLF_PACK, ID.FROST_TRAP, wait(6000)]);
  const echoes = hits(trap, ID.ONE_WOLF_PACK);
  assert.equal(echoes.length, hits(trap, ID.FROST_TRAP).length);
  const weapon = simulate('Soulbeast', [ID.ONE_WOLF_PACK, ID.DRAKES_SWIPE, wait(1000)]);
  const echo = hits(weapon, ID.ONE_WOLF_PACK)[0];
  assert.equal(echo.skillWeapon, 'Unequipped');
  assert.equal(echo.resolvedWeaponStrength, echoes[0].resolvedWeaponStrength);
  assert.equal(echo.damage, echoes[0].damage);
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
  assert.equal(precast.schedulerState.profession.core.pendingFrostTrapEvents.length, 0);
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
