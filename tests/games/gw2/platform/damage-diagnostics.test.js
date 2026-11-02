import assert from 'node:assert/strict';
import test from 'node:test';

import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { timedEffectState } from '#gw2/platform/combat/effect-state.js';
import { BASE_CRITICAL_DAMAGE_MULTIPLIER } from '#gw2/platform/combat/formulas.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { canonicalTargetConditionName } from '#gw2/platform/combat/state/targets.js';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import { roundHalfToEven } from '#kernel/core/numeric.js';
import { resolveTestGw2Events } from '#tests/helpers/gw2-resolver.js';
import { observeGw2Runtime } from '#tests/helpers/observed-runtime.js';
import { defineTestProfession } from '#tests/helpers/profession.js';

// Minimal packets exercise each formula branch and expose query/RNG consumption without saved-rotation expectations.
function resolveHits(damageDiagnostics, output = 'detailed', target = { health: 100000, startingHealthFraction: 0.4 }) {
  let queries = 0;
  const rolls = [];
  const retained = [];
  const events = [
    {
      coefficient: 1,
      weaponStrengthProfileId: 'weapon.axe',
      coefficientModifiers: [{ kind: 'target-health-below', threshold: 0.5, multiplier: 2 }]
    },
    {
      flatStrikeBase: 10,
      flatStrikePowerCoeff: 0.1,
      flatStrikeMultiplier: 1.2,
      flatStrikeHealthThreshold: 0.5,
      flatStrikeThresholdMultiplier: 2
    },
    {
      coefficient: 1,
      independentSummonStrike: true,
      summonDamagePerCoefficient: 100,
      summonBasePower: 1000,
      actorType: 'summon'
    },
    {
      coefficient: 1,
      independentSummonStrike: true,
      weaponStrengthProfileId: 'summon.weapon-type-1',
      actorType: 'summon'
    },
    { flatDamage: 10.5, damageKind: 'condition' }
  ].map((event, index) => ({
    type: 'damage',
    at: 0.600001 + index,
    source: 'Player',
    sourceId: `hit-${index}`,
    actorType: 'player',
    ...event
  }));
  const result = resolveTestGw2Events({
    damageDiagnostics,
    output,
    ...{ events, endTime: 5 },
    config: { target, randomness: { mode: 'stochastic', seed: 42 }, sigilSets: [{ names: [] }] },
    traits: new Set(),
    query: {
      statsAt: () => {
        queries += 1;
        return { power: 1000, precision: 1800, ferocity: 500 };
      },
      critical: () => {
        queries += 1;
        return { chance: 0.5, damage: 1.75 };
      },
      strikeMultiplier: () => {
        queries += 1;
        return 1.2;
      }
    },
    helpers: { conditionName: canonicalTargetConditionName, skills: [] },
    engineReactions: {
      'damage.resolved': (ctx) => {
        rolls.push(
          ctx.random.next('critical:player'),
          ctx.random.next('weapon-strength:player'),
          ctx.random.next('weapon-strength:summon')
        );
        retained.push(ctx.resolved.at(-1)?.damageCalculation);
      }
    }
  });
  return { result, queries, rolls, retained };
}

test('diagnostic factors reconstruct actual rounded packets without changing queries, RNG, or numeric output', () => {
  const plain = resolveHits(false);
  const diagnostic = resolveHits(true);
  const score = resolveHits(true, 'score');
  for (const run of [diagnostic, score]) {
    for (const key of ['totalDamage', 'strikeDamage', 'conditionDamage', 'deathTime', 'duration', 'dpsWindow']) {
      assert.equal(run.result[key], plain.result[key], key);
    }

    assert.equal(run.queries, plain.queries);
    assert.deepEqual(run.rolls, plain.rolls);
  }

  assert.ok(plain.retained.every((value) => value === undefined));
  assert.ok(score.retained.every((value) => value === undefined));
  const hits = diagnostic.result.resolvedEvents;
  for (const hit of hits) {
    const calculation = hit.damageCalculation;
    assert.equal(calculation.phase, 'Ordinary');
    assert.equal(
      calculation.unroundedDamage,
      calculation.baseDamage * calculation.criticalMultiplier * calculation.outgoingMultiplier
    );
    assert.equal(
      hit.damage,
      calculation.rounding === 'floor'
        ? Math.floor(calculation.unroundedDamage)
        : roundHalfToEven(calculation.unroundedDamage)
    );
    assert.equal(calculation.power, 1000);
    assert.equal(calculation.precision, 1800);
    assert.equal(calculation.ferocity, 500);
    // Armor scales strikes only, so fixed packets must not claim an armor divisor.
    assert.equal('targetArmor' in calculation, !Number.isFinite(hit.flatDamage ?? hit.flatStrikeBase));
    // Diagnostics must describe the same crit outcome used for damage, including summon and flat packets.
    assert.equal(calculation.criticalMultiplier, hit.didCrit ? hit.criticalDamage : 1);
  }

  assert.equal(hits[0].damageCalculation.targetHealthBefore, 40000);
  assert.equal(hits[0].damageCalculation.coefficientMultiplier, 2);
  assert.equal(hits[1].damageCalculation.targetHealthBefore, 40000 - hits[0].damage);
  assert.equal(hits[1].damageCalculation.baseDamage, 110);
  assert.equal(hits[1].damageCalculation.outgoingMultiplier, 2.4);
  for (const index of [1, 2, 4]) assert.equal(hits[index].resolvedWeaponStrength, undefined);
  assert.equal(hits[2].damageCalculation.baseDamage, 100);
  assert.equal(hits[3].weaponStrengthProfileId, 'summon.weapon-type-1');
  assert.equal(hits[4].damageCalculation.rounding, 'half-even');
  assert.equal(hits[4].damage, 10);
  const unbounded = resolveHits(true, 'detailed', {}).result.resolvedEvents[0].damageCalculation;
  assert.equal(unbounded.targetHealthBefore, null);
  assert.equal(unbounded.targetHealthFractionBefore, null);
  assert.equal(unbounded.coefficientMultiplier, 1);
});

test('diagnostics capture settlement and environment health before the following hit', () => {
  const result = resolveTestGw2Events({
    damageDiagnostics: true,
    ...{
      events: [
        {
          type: 'condition',
          at: 0,
          source: 'Player',
          sourceId: 'bleed',
          actorType: 'player',
          condition: 'Bleeding',
          duration: 1,
          stacks: 1
        },
        { type: 'damage', at: 1, source: 'Player', sourceId: 'hit', actorType: 'player', flatDamage: 1, priority: -100 }
      ],
      endTime: 1
    },
    config: { target: { health: 1000, startingHealthFraction: 0.53, conditions: { Bleeding: 1 } } },
    traits: new Set(),
    query: {
      statsAt: () => ({ power: 1000, conditionDamage: 125 }),
      conditionDurationMultiplier: () => 1,
      conditionMultiplier: () => 1,
      vulnerabilityStacksAt: () => 0
    },
    helpers: { conditionName: canonicalTargetConditionName, skills: [] }
  });
  const calculation = result.resolvedEvents.find((event) => event.type === 'damage').damageCalculation;
  assert.equal(result.environmentDamage, 22);
  assert.equal(result.conditionDamage, 30);
  assert.ok(Math.abs(calculation.targetHealthBefore - 478) < 1e-10);
  assert.ok(Math.abs(calculation.targetHealthFractionBefore - 0.478) < 1e-12);
  assert.equal('precision' in calculation, false);
  assert.equal('ferocity' in calculation, false);
});

// Hit snapshots must preserve executed order, recipient filtering, and state before on-hit consumption or grants.
test('active buff diagnostics preserve player stacks before same-time grants and after-hit reactions', () => {
  let charges = 2;
  const profession = defineTestProfession({
    id: 'diagnostic-buffs',
    name: 'Diagnostic buffs',
    hooks: {
      observeEffects: () => [
        timedEffectState('native-charge', [{ stacks: charges, expiresAt: 10 }], 2, { name: 'Native Charge' })
      ]
    }
  });
  const owner = { source: 'Player', sourceId: 'probe', actorType: 'player' };
  const buff = (kind, extra = {}) => ({
    ...owner,
    type: 'buff',
    at: 0,
    kind,
    stacks: 1,
    duration: 10,
    audience: { recipients: 'self' },
    ...extra
  });
  const hit = (name, at, priority = 0) => ({ ...owner, type: 'damage', name, at, priority, flatDamage: 1 });
  const result = resolveTestGw2Events({
    profession,
    damageDiagnostics: true,
    config: { boons: { might: 20, alacrity: true } },
    buffPolicies: [
      { kind: 'charge', maximumStacks: 2 },
      ...['party-only', 'later', 'after-hit', 'future'].map((kind) => ({ kind, maximumStacks: 1 }))
    ],
    endTime: 3,
    events: [
      buff('might', { stacks: 10 }),
      buff('fury', { duration: 1 }),
      buff('quickness', { duration: 1 }),
      buff('quickness', { duration: 1 }),
      buff('charge', { stacks: 3 }),
      buff('party-only', { audience: { recipients: 'party', affectsSelf: false, maximumRecipients: 5 } }),
      hit('Before', 1),
      buff('later', { at: 1, priority: 100 }),
      hit('After', 1, 200),
      hit('Expired', 2),
      buff('future', { at: 3 })
    ],
    engineReactions: {
      'damage.resolved': (ctx, event) => {
        if (event.name !== 'Before') return;

        // Mutating the live applications cannot retroactively alter the retained hit's facts.
        charges -= 1;
        ctx.buffs.set(
          'charge',
          ctx.buffs.get('charge').map((application) => ({ ...application, expiresAt: event.at }))
        );
        ctx.effects.emit({ kind: 'packet', event: buff('after-hit', { at: event.at }) });
      }
    }
  });
  const snapshots = Object.fromEntries(
    result.resolvedEvents
      .filter((event) => event.type === 'damage')
      .map((event) => [
        event.name,
        Object.fromEntries(event.damageCalculation.activeBuffs.map(({ kind, stacks }) => [kind, stacks]))
      ])
  );
  assert.deepEqual(snapshots.Before, { alacrity: 1, might: 25, quickness: 1, charge: 2, 'native-charge': 2 });
  assert.deepEqual(snapshots.After, {
    alacrity: 1,
    might: 25,
    quickness: 1,
    'after-hit': 1,
    later: 1,
    'native-charge': 1
  });
  assert.deepEqual(snapshots.Expired, { alacrity: 1, might: 25, 'after-hit': 1, later: 1, 'native-charge': 1 });
});

// Crit modifiers can bypass the Ferocity attribute, so recorded steps must rebuild the multiplier the hit really used.
test('scaling hits record armor and critical-damage steps that rebuild their multiplier', () => {
  const catalog = createCanonicalCatalog({
    skills: [
      {
        id: 990002,
        name: 'Hit',
        type: 'Weapon',
        weapon: 'Axe',
        castTimeMs: 100,
        cooldown: 0,
        effects: [{ type: 'strike', coefficient: 1 }]
      }
    ],
    weapons: ['Axe'],
    weaponHands: { Axe: 'mh+oh' }
  });
  const profession = defineTestProfession({
    id: 'diagnostic-critical',
    name: 'Diagnostic critical',
    catalog,
    modifiers: {
      modifierRules: [
        {
          id: 'test.keen-critical-damage',
          target: MODIFIER_TARGET.CRITICAL_DAMAGE,
          operation: 'multiply',
          factor: 1.1
        }
      ]
    }
  });
  const options = {
    profession: profession.runtimeFor({}),
    rotation: ['Hit'],
    config: {
      primaryWeapon: 'Axe',
      target: { armor: 1500 },
      attributeInputs: baseAttributeInputs({ power: 1000, precision: 1800, ferocity: 500 }),
      sigilSets: [{ names: ['Severance'] }],
      randomness: { mode: 'stochastic', seed: 72 }
    },
    engineInitialize(runtime) {
      runtime.effects.emit({
        kind: 'packet',
        event: {
          source: 'Fixture',
          sourceId: 'fixture',
          actorType: 'player',
          type: 'buff',
          at: 0,
          kind: 'sigil-severance',
          stacks: 1,
          duration: 5
        }
      });
    }
  };
  const hit = observeGw2Runtime({ ...options, damageDiagnostics: true }).resolvedEvents.find(
    (event) => event.type === 'damage'
  );
  const calculation = hit.damageCalculation;
  assert.equal(calculation.targetArmor, 1500);
  assert.deepEqual(
    calculation.criticalDamageContributors.map(({ id, label }) => [id, label]),
    [
      ['ferocity', 'Ferocity'],
      ['test.keen-critical-damage', 'Keen'],
      ['sigil-severance', 'Severance']
    ]
  );
  assert.equal(calculation.criticalDamageContributors[1].value, 1.1);
  const rebuilt = calculation.criticalDamageContributors.reduce(
    (value, step) => (step.bucket === 'additive' ? value + step.value : value * step.value),
    BASE_CRITICAL_DAMAGE_MULTIPLIER
  );
  assert.ok(Math.abs(rebuilt - hit.criticalDamage) < 1e-12);
  // Ordinary runs pass no sink, so they retain no explanatory steps.
  const plain = observeGw2Runtime(options).resolvedEvents.find((event) => event.type === 'damage');
  assert.equal(plain.damageCalculation, undefined);
  assert.equal(plain.criticalDamage, hit.criticalDamage);
});

// Capture observes the same actual execution and never adds a gameplay pass.
test('public diagnostics capture one execution and are suppressed in score output', () => {
  const capture = [];
  let owner;
  const catalog = createCanonicalCatalog({
    skills: [
      {
        id: 990001,
        name: 'Hit',
        type: 'Weapon',
        weapon: 'Axe',
        castTimeMs: 100,
        cooldown: 0,
        effects: [{ type: 'strike', coefficient: 1 }]
      }
    ],
    weapons: ['Axe'],
    weaponHands: { Axe: 'mh+oh' }
  });
  const profession = defineTestProfession({
    id: 'diagnostic-live',
    name: 'Diagnostic live',
    catalog,
    hooks: {
      reactions: {
        'damage.resolved': () => {
          capture.push(owner.damageDiagnostics);
        }
      }
    }
  });
  const options = {
    profession: profession.runtimeFor({}),
    engineInitialize(runtime) {
      owner = runtime;
    },
    rotation: ['Hit'],
    config: {
      primaryWeapon: 'Axe',
      attributeInputs: baseAttributeInputs({ power: 1000, precision: 1800, ferocity: 500 }),
      randomness: { mode: 'stochastic', seed: 72 }
    }
  };
  const plain = observeGw2Runtime(options);
  assert.deepEqual(capture.splice(0), [false]);
  const diagnostic = observeGw2Runtime({ ...options, damageDiagnostics: true });
  assert.deepEqual(capture.splice(0), [true]);
  const score = observeGw2Runtime({ ...options, damageDiagnostics: true, output: 'score' });
  assert.deepEqual(capture.splice(0), [false]);
  assert.equal(diagnostic.totalDamage, plain.totalDamage);
  assert.equal(score.totalDamage, plain.totalDamage);
  assert.equal(diagnostic.resolvedEvents.find((event) => event.type === 'damage').damageCalculation.power, 1000);
  assert.deepEqual(diagnostic.randomness, plain.randomness);
  observeGw2Runtime({ ...options, profession: profession.runtimeFor({}), damageDiagnostics: true });
  assert.deepEqual(capture, [true]);
});
