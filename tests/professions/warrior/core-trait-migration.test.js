import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { warriorProfession } from '#gw2/content/professions/warrior/definition.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/content/professions/warrior/data/ids.js';

const baseConfig = Object.freeze({
  stats: {
    power: 2000,
    precision: 1500,
    ferocity: 500,
    conditionDamage: 1000,
    expertise: 0,
    vitality: 1000
  },
  target: { armor: 2597, health: 3_970_000, defiant: true, conditions: {} }
});

// Run the smallest Core rotation that reaches a migrated trait through the public dispatcher.
function simulate(rotation, config = {}) {
  return simulateGw2({
    profession: warriorProfession,
    rotation,
    config: {
      ...baseConfig,
      ...config,
      specialization: 'Core',
      stats: { ...baseConfig.stats, ...(config.stats || {}) },
      target: { ...baseConfig.target, ...(config.target || {}) }
    },
    mode: 'sequence'
  });
}

const traitCases = [
  {
    name: 'Reckless Dodge',
    trait: TRAIT.RECKLESS_DODGE,
    rotation: ['Dodge'],
    verify: (result) => assert.ok(result.events.some((event) => event.name === 'Reckless Dodge'))
  },
  {
    name: 'Building Momentum',
    trait: TRAIT.BUILDING_MOMENTUM,
    rotation: ['Dodge', 'Eviscerate'],
    config: { initialResource: 30 },
    verify: (result) =>
      assert.equal(
        result.endState.profession.endurance -
          simulate(['Dodge', 'Eviscerate'], { initialResource: 30 }).endState.profession.endurance,
        15
      )
  },
  {
    name: 'Brave Stride',
    trait: TRAIT.BRAVE_STRIDE,
    rotation: ['Kick'],
    verify: (result) => assert.ok(result.events.some((event) => event.sourceId === TRAIT.BRAVE_STRIDE))
  },
  {
    name: 'Peak Performance',
    trait: TRAIT.PEAK_PERFORMANCE,
    rotation: ['Kick'],
    verify: (result) => assert.ok(result.events.some((event) => event.kind === 'peak-performance'))
  },
  {
    name: 'Body Blow',
    trait: TRAIT.BODY_BLOW,
    rotation: ['Stomp'],
    verify: (result) =>
      assert.ok(result.events.some((event) => event.sourceId === TRAIT.BODY_BLOW && event.condition === 'Weakness'))
  },
  {
    name: "Berserker's Power",
    trait: TRAIT.BERSERKERS_POWER,
    rotation: ['Eviscerate'],
    config: { initialResource: 30 },
    verify: (result) => assert.equal(result.events.find((event) => event.kind === 'berserkers-power')?.stacks, 4)
  },
  {
    name: 'Aggressive Onslaught',
    trait: TRAIT.AGGRESSIVE_ONSLAUGHT,
    rotation: ['Stomp'],
    verify: (result) => assert.ok(result.events.some((event) => event.sourceId === TRAIT.AGGRESSIVE_ONSLAUGHT))
  },
  {
    name: 'Marching Orders',
    trait: TRAIT.MARCHING_ORDERS,
    rotation: ['Eviscerate'],
    config: { initialResource: 30 },
    verify: (result) => assert.ok(result.events.some((event) => event.sourceId === TRAIT.MARCHING_ORDERS))
  },
  {
    name: 'Leg Specialist',
    trait: TRAIT.LEG_SPECIALIST,
    rotation: ['Throw Axe'],
    verify: (result) =>
      assert.ok(
        result.events.some((event) => event.sourceId === TRAIT.LEG_SPECIALIST && event.condition === 'Immobilized')
      )
  },
  {
    name: "Soldier's Comfort",
    trait: TRAIT.SOLDIERS_COMFORT,
    extraTraits: [TRAIT.MARCHING_ORDERS],
    rotation: ['Eviscerate'],
    config: { initialResource: 30 },
    verify: (result) => assert.ok(result.events.some((event) => event.sourceId === TRAIT.SOLDIERS_COMFORT))
  },
  {
    name: 'Empower Allies',
    trait: TRAIT.EMPOWER_ALLIES,
    rotation: [{ type: 'wait', durationMs: 100 }],
    verify: (result) => assert.ok(result.events.some((event) => event.sourceId === TRAIT.EMPOWER_ALLIES))
  },
  {
    name: 'Martial Cadence',
    trait: TRAIT.MARTIAL_CADENCE,
    extraTraits: [TRAIT.MARCHING_ORDERS],
    rotation: ['Eviscerate'],
    config: { initialResource: 30 },
    verify: (result) => assert.ok(result.events.some((event) => event.sourceId === TRAIT.MARTIAL_CADENCE))
  },
  {
    name: 'Phalanx Strength',
    trait: TRAIT.PHALANX_STRENGTH,
    rotation: ['Signet of Might'],
    verify: (result) =>
      assert.ok(
        result.events.some(
          (event) => event.sourceId === TRAIT.PHALANX_STRENGTH && event.recipients === 'allies' && !event.affectsSelf
        )
      )
  },
  {
    name: 'Thick Skin',
    trait: TRAIT.THICK_SKIN,
    rotation: ['Mending'],
    verify: (result) => assert.ok(result.events.some((event) => event.sourceId === TRAIT.THICK_SKIN))
  },
  {
    name: 'Cull the Weak',
    trait: TRAIT.CULL_THE_WEAK,
    rotation: ['Eviscerate'],
    config: { initialResource: 30 },
    verify: (result) =>
      assert.ok(result.events.some((event) => event.sourceId === TRAIT.CULL_THE_WEAK && event.condition === 'Weakness'))
  },
  {
    name: 'Merciless Hammer',
    trait: TRAIT.MERCILESS_HAMMER,
    rotation: ['Kick'],
    config: { initialResource: 0 },
    verify: (result) => assert.equal(result.endState.profession.adrenaline, 8)
  },
  {
    name: 'Stalwart Strength',
    trait: TRAIT.STALWART_STRENGTH,
    rotation: ['Kick'],
    verify: (result) => assert.ok(result.events.some((event) => event.sourceId === TRAIT.STALWART_STRENGTH))
  },
  {
    name: 'Furious Burst',
    trait: TRAIT.FURIOUS_BURST,
    rotation: ['Swap Weapons'],
    verify: (result) => assert.ok(result.events.some((event) => event.sourceId === TRAIT.FURIOUS_BURST))
  },
  {
    name: 'Bloodlust',
    trait: TRAIT.BLOODLUST,
    rotation: ['Precise Cut', 'Focused Slash', 'Keen Strike', 'Precise Cut'],
    config: { primaryWeapon: 'Dagger', stats: { precision: 10_000 } },
    verify: (result) => assert.ok(result.events.some((event) => event.sourceId === TRAIT.BLOODLUST))
  },
  {
    name: 'Signet Mastery',
    trait: TRAIT.SIGNET_MASTERY,
    rotation: ['Signet of Might'],
    verify: (result) => {
      const action = result.events.find((event) => event.type === 'action' && event.skillName === 'Signet of Might');
      const mastery = result.events.find((event) => event.kind === 'signet-mastery');
      assert.ok(mastery.at > action.endsAt);
    }
  },
  {
    name: 'Opportunist',
    trait: TRAIT.OPPORTUNIST,
    rotation: ['Kick'],
    verify: (result) => assert.ok(result.events.some((event) => event.sourceId === TRAIT.OPPORTUNIST))
  },
  {
    name: 'Sundering Burst',
    trait: TRAIT.SUNDERING_BURST,
    rotation: ['Eviscerate'],
    config: { initialResource: 30 },
    verify: (result) => assert.ok(result.events.some((event) => event.sourceId === TRAIT.SUNDERING_BURST))
  },
  {
    name: 'Burst Precision',
    trait: TRAIT.BURST_PRECISION,
    rotation: ['Eviscerate'],
    config: { initialResource: 30 },
    verify: (result) => assert.equal(result.events.find((event) => event.kind === 'burst-precision')?.duration, 4)
  },
  {
    name: 'Furious',
    trait: TRAIT.FURIOUS,
    rotation: ['Throw Axe'],
    config: { stats: { precision: 10_000 } },
    verify: (result) => assert.ok(result.events.some((event) => event.kind === 'furious-surge'))
  },
  {
    name: 'Versatile Rage',
    trait: TRAIT.VERSATILE_RAGE,
    rotation: ['Swap Weapons'],
    config: { initialResource: 0 },
    verify: (result) => assert.equal(result.endState.profession.adrenaline, 5)
  },
  {
    name: 'Burst Mastery',
    trait: TRAIT.BURST_MASTERY,
    rotation: ['Eviscerate'],
    config: { initialResource: 30 },
    verify: (result) => assert.ok(result.events.some((event) => event.sourceId === TRAIT.BURST_MASTERY))
  }
];

for (const { name, trait, extraTraits = [], rotation, config, verify } of traitCases) {
  test(`${name} remains behaviorally reachable through the Core trait dispatcher`, () => {
    verify(simulate(rotation, { ...config, selectedTraitIds: [trait, ...extraTraits] }));
  });
}

// Assert dispatcher call topology directly where no single real skill exposes every ordered branch.
function assertSourceOrder(source, startToken, orderedTokens) {
  let position = source.indexOf(startToken);
  assert.notEqual(position, -1, startToken);
  for (const token of orderedTokens) {
    const next = source.indexOf(token, position + 1);
    assert.ok(next > position, token);
    position = next;
  }
}

test('Warrior dispatchers preserve cast, burst, critical, advancement, and weapon-swap order', async () => {
  const source = await readFile(
    new URL('../../../js/games/gw2/content/professions/warrior/core/traits/index.ts', import.meta.url),
    'utf8'
  );

  assertSourceOrder(source, 'export function completeWarriorSkill', [
    'applySignetMasteryCastComplete(context, skill);',
    "type: 'peitha'",
    'applyBraveStrideCastComplete(context, skill);'
  ]);
  assertSourceOrder(source, 'export function beginWarriorSkill', [
    'applyThickSkinCastStart(context, skill);',
    'applyPeakPerformanceCastStart(context, skill);'
  ]);
  assertSourceOrder(source, 'export function applyWarriorBurstSpendTraits', [
    'armBurstPrecision(context, skill, adrenalineSpent);',
    'applyBurstMastery(context, skill, adrenalineSpent, options);'
  ]);
  assertSourceOrder(source, 'export function observeWarriorEvent', [
    'state.signetOfRageNextAt = event.at + 3',
    'applyOpportunist(context, event);',
    'state.targetControlledUntil =',
    'applyMercilessHammer(context, event);',
    'applyStalwartStrength(context, event);',
    'applyBodyBlow(context, event);',
    'applyAggressiveOnslaught(context, event);',
    'applyLegSpecialist(context, event);',
    'applyPhalanxStrength(context, event);',
    'applyCullTheWeak(context, event);',
    'applyBurstPrecision(context, event, skill, activationKey);',
    'applyBuildingMomentum(context, event);',
    'applyMarchingOrders(context, event)',
    'applySoldiersComfort(context, event);',
    'applyMartialCadence(context, event);',
    "type: 'warrior.arms-critical'",
    "type: 'warrior.adrenaline-hit'"
  ]);
  assertSourceOrder(source, 'export function handleWarriorArmsCriticalTask', [
    'applyKeenStrikeCriticalMight(context, event, criticals);',
    'applyBloodlust(context, event);',
    'applyFurious(context, event, criticals);',
    'applySunderingBurst(context, event, Boolean(payload?.firstBurstHit), criticals);'
  ]);
  assertSourceOrder(source, "type: 'warrior.arms-critical'", [
    'priority: -40',
    'eventOrder: Number(event.eventOrder)',
    'firstBurstHit'
  ]);
  assertSourceOrder(source, 'export function advanceWarriorTraits', [
    "selected.has('Signet of Rage')",
    'advanceEmpowerAllies(context, target);'
  ]);
  assertSourceOrder(source, 'export function applyWarriorWeaponSwapTraits', [
    'applyMartialCadenceWeaponSwap(context, context.effectiveEnd);',
    'applyVersatileRage(context);',
    'applyFuriousBurst(context, skill);'
  ]);
});

test('Warrior trait-line modules stay private and registration-free', async () => {
  const core = new URL('../../../js/games/gw2/content/professions/warrior/core/', import.meta.url);
  const files = (await readdir(core, { recursive: true })).filter((file) => file.endsWith('.ts'));
  const lineImport = /core\/traits\/(?:arms|defense|discipline|strength|tactics)\.js/;
  const lineFiles = new Set([
    'traits/arms.ts',
    'traits/defense.ts',
    'traits/discipline.ts',
    'traits/strength.ts',
    'traits/tactics.ts'
  ]);

  for (const file of files) {
    const normalized = file.replaceAll('\\', '/');
    const source = await readFile(new URL(normalized, core), 'utf8');
    if (normalized !== 'traits/index.ts') assert.doesNotMatch(source, lineImport, file);
    if (lineFiles.has(normalized)) {
      assert.doesNotMatch(source, /warriorCoreSchedulerHooks|taskHandlers|context\.tasks\.schedule/, file);
    }
  }
});
