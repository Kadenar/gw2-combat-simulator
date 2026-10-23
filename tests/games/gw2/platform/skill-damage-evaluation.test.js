import { normalizeTransitionDelays } from '#gw2/platform/execution/transition-lockouts.js';
import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { playerHealthFraction, targetHealthBelow } from '#gw2/platform/combat/query/runtime-query.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { defineTestProfession } from '#tests/helpers/profession.js';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import { evaluateSkillDamage } from '#gw2/platform/skill-damage/measure-occurrences.js';
import { damageOccurrences } from '#gw2/platform/skill-damage/list-occurrences.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { RELIC_IDS } from '#gw2/platform/equipment/relics/data.js';
import { headlessApp, firstPresetBuildPath } from '#tests/helpers/skill-damage.js';
import { certainTraitRandom } from '#gw2/platform/skill-damage/occurrence-driver.js';
import { COMBO_RANDOM_STREAM_PREFIX } from '#gw2/platform/combos/resolution.js';
import { createSimulationRandom } from '#kernel/core/simulation-random.js';

const occurrence = (id, fields = {}) => ({
  id: String(id),
  effect: { kind: 'skill', id },
  name: 'Test effect',
  source: 'Skill',
  icon: '',
  unit: 'activation',
  ...fields
});
const fixture = (effects, hooks = {}) =>
  defineTestProfession({
    id: 'damage-test',
    name: 'Damage test',
    catalog: createCanonicalCatalog({
      generated: [
        {
          id: 991001,
          name: 'Measured',
          castTimeMs: 0,
          effects: effects.map((effect) => (effect.type === 'strike' ? { ...effect, weaponStrength: 1000 } : effect))
        }
      ]
    }),
    hooks
  });
const evaluate = (profession, occurrences, config = {}, cache) =>
  evaluateSkillDamage({ config, occurrences }, profession, cache).occurrences;
const traitBurning = (at) => ({
  type: 'condition',
  at,
  source: 'Trait',
  sourceId: 991002,
  actorType: 'effect',
  condition: 'Burning',
  stacks: 1,
  duration: 2
});

// Assumed activation enters below eligibility; the ordinary scheduler must still consult it.
test('direct damage does not query activation availability', () => {
  let checks = 0;
  const profession = fixture([{ type: 'strike', coefficient: 1 }], {
    availability() {
      checks++;
      return { ready: false, reason: 'Not ready.' };
    }
  });
  const [row] = evaluate(profession, [occurrence(991001)]);
  assert.equal(row.status, 'measured');
  assert.equal(checks, 0);
  const combat = simulateGw2({ profession, rotation: [{ type: 'cast', skillId: 991001 }], config: {} });
  assert.ok(combat.steps[0].invalid);
  assert.ok(checks > 0);
});

test('Elemental Explosion damage is measurable without stored bullets while combat still requires them', async () => {
  const app = await headlessApp('elementalist', await firstPresetBuildPath('elementalist'));
  const config = {
    ...app.adapter
      .createBuildContext({
        build: app.build,
        transitionDelays: normalizeTransitionDelays(app.simulationSettings?.transitionDelays),
        patch: app.adapter.profession.resolvePatch({ id: app.patch.id ?? 'current' })
      })
      .simulationConfig(),
    pistolBullets: { Fire: false, Water: false, Air: false, Earth: false },
    weapons: ['Pistol', 'Warhorn']
  };
  const [row] = evaluate(app.profession, [occurrence(ID.ELEMENTAL_EXPLOSION)], config);
  assert.equal(row.status, 'measured');
  const combat = simulateGw2({
    profession: app.profession,
    config,
    rotation: [{ type: 'cast', skillId: ID.ELEMENTAL_EXPLOSION }]
  });
  assert.ok(combat.steps[0].invalid);
});

test('owned delayed applications complete their payout without an arbitrary short sampling tail', () => {
  const profession = fixture([
    {
      type: 'condition',
      timingAnchor: 'castStart',
      timingScale: 'fixed',
      ticks: [0, 2000, 4000].map((atMs) => ({ atMs, condition: 'Bleeding', stacks: 1, duration: 2 }))
    }
  ]);
  const [row] = evaluate(profession, [occurrence(991001)]);
  const combat = simulateGw2({
    profession,
    config: {},
    rotation: [{ type: 'cast', skillId: 991001 }],
    observationPolicy: { kind: 'tail', durationMs: 10000 }
  });
  assert.equal(row.status, 'measured');
  assert.equal(
    row.measurement.conditionDamage,
    combat.resolvedEvents
      .filter((event) => event.condition === 'Bleeding' && event.effectiveDuration != null)
      .reduce((total, event) => total + event.damage, 0)
  );
});

// Different application durations must not be presented as if every stack inherited the first duration.
test('condition breakdown groups matching applications and separates different durations', () => {
  const profession = fixture([
    {
      type: 'condition',
      timingAnchor: 'castStart',
      timingScale: 'fixed',
      ticks: [
        { atMs: 0, condition: 'Burning', stacks: 3, duration: 5 },
        { atMs: 1000, condition: 'Burning', stacks: 1, duration: 1 },
        { atMs: 2000, condition: 'Burning', stacks: 1, duration: 1 }
      ]
    }
  ]);
  const [result] = evaluate(profession, [occurrence(991001)]);
  const rows = result.measurement.conditions;
  assert.equal(rows.length, 2);
  for (const [duration, stacks] of [
    [5, 3],
    [1, 2]
  ]) {
    const row = rows.find((entry) => entry.baseDurationSeconds === duration);
    assert.equal(row.stacks, stacks);
    assert.equal(row.effectiveDurationSeconds, duration);
    assert.equal(row.damage, row.rate * row.multiplier * duration * stacks);
  }

  assert.equal(
    result.measurement.conditionDamage,
    rows.reduce((sum, row) => sum + row.damage, 0)
  );
});

// Equal durations still require separate explanations when later applications sample different attributes.
test('condition breakdown separates applications with different sampled damage factors', () => {
  const profession = fixture([
    {
      type: 'condition',
      timingAnchor: 'castStart',
      timingScale: 'fixed',
      ticks: [0, 2000].map((atMs) => ({ atMs, condition: 'Burning', stacks: 1, duration: 1 }))
    },
    {
      type: 'boon',
      boon: 'might',
      stacks: 1,
      duration: 10,
      atMs: 1500,
      timingAnchor: 'castStart',
      timingScale: 'fixed',
      audience: { recipients: 'self' }
    }
  ]);
  const [result] = evaluate(profession, [occurrence(991001)]);
  const rows = result.measurement.conditions;
  assert.equal(rows.length, 2);
  assert.equal(rows[0].effectiveDurationSeconds, rows[1].effectiveDurationSeconds);
  assert.ok(rows[1].conditionDamage > rows[0].conditionDamage);
  assert.ok(rows[1].rate > rows[0].rate);
});

test('unrelated damage reactions are not invoked when measuring a skill', () => {
  let reactions = 0;
  const profession = fixture([{ type: 'strike', coefficient: 1 }], {
    reactions: {
      'damage.resolved'() {
        reactions++;
      }
    }
  });
  evaluate(profession, [occurrence(991001)]);
  assert.equal(reactions, 0);
});

// Native hit reactions can earn trait payloads only for the opted-in cast, never from held preview assumptions.
test('opted-in skill reactions respect cooldowns and exclude equipment damage', () => {
  let claims = 0;
  const profession = fixture(
    [
      { type: 'strike', coefficient: 1 },
      { type: 'strike', coefficient: 1, atMs: 100, timingAnchor: 'castStart', timingScale: 'fixed' }
    ],
    {
      reactions: {
        'damage.resolved'(runtime, event) {
          if (event.source === 'Trait' || !runtime.procs.claimCooldown('preview-trait', event.at, 1)) return;

          claims++;
          for (const source of ['Trait', 'Relic', 'Sigil', 'Food'])
            runtime.effects.emit({
              kind: 'packet',
              event: {
                type: 'condition',
                at: event.at,
                source,
                sourceId: 991002,
                actorType: 'effect',
                skillName: 'Triggered',
                condition: 'Burning',
                stacks: 1,
                duration: 2
              }
            });
        }
      }
    }
  );
  const [off] = evaluate(profession, [occurrence(991001)]);
  assert.equal(claims, 0);
  assert.equal(off.measurement.conditionDamage, 0);
  for (let index = 0; index < 2; index++) {
    const [on] = evaluate(profession, [occurrence(991001, { inputs: { includeTraitProcs: 1 } })]);
    assert.equal(on.status, 'measured');
    assert.equal(claims, index + 1);
    assert.equal(on.measurement.conditions.length, 1);
    assert.equal(on.measurement.conditions[0].stacks, 1);
    assert.ok(on.measurement.total > off.measurement.total);
  }
});

// Held preview buffs still settle their profession mechanics; only the skill's actual grant can fire a trait listener.
test('trait listeners ignore held assumptions but react to the measured skill', () => {
  const granted = { id: 'fixture.granted' };
  let reactions = 0;
  let procs = 0;
  const profession = fixture([{ type: 'buff', kind: 'earned', stacks: 1, duration: 1 }], {
    reactions: {
      'buff.applied'(runtime, event) {
        reactions++;
        runtime.fireTrigger(granted, { event });
      }
    },
    triggerListeners: new Map([
      [
        granted.id,
        [
          (mechanics, { event }) => {
            procs++;
            mechanics.effects.emit({ kind: 'packet', event: traitBurning(event.at) });
          }
        ]
      ]
    ])
  });
  const [result] = evaluate(profession, [occurrence(991001, { inputs: { includeTraitProcs: 1 } })], {
    initialBuffs: [{ kind: 'held', stacks: 1, duration: 30 }]
  });
  assert.equal(result.status, 'measured');
  assert.equal(reactions, 2);
  assert.equal(procs, 1);
  assert.equal(result.measurement.conditions[0].stacks, 1);
});

// Included trait procs admit only certain trait rolls without taking ownership of combo finisher rolls.
test('trait proc randomness succeeds only certain rolls except combo rolls', () => {
  const base = createSimulationRandom({ seed: 7 });
  const reference = createSimulationRandom({ seed: 7 });
  const certain = certainTraitRandom(base);
  for (const stream of ['critical:player', 'fixture.trait-chance', undefined]) {
    assert.equal(certain.roll(1, stream), true);
    assert.equal(certain.roll(1 - 1e-9, stream), false);
    assert.equal(certain.roll(0, stream), false);
  }

  const combo = `${COMBO_RANDOM_STREAM_PREFIX}fixture`;
  const rolls = Array.from({ length: 32 }, () => certain.roll(0.2, combo));
  assert.deepEqual(
    rolls,
    Array.from({ length: 32 }, () => reference.roll(0.2, combo))
  );
  assert.ok(rolls.includes(true) && rolls.includes(false));
});

// Included trait procs are only those that always trigger; neither kind contributes to the skill alone.
test('included trait procs keep certain trait listeners and exclude chance-gated ones', () => {
  const struck = { id: 'fixture.struck' };
  const profession = fixture([{ type: 'strike', coefficient: 1 }], {
    reactions: {
      'damage.resolved'(runtime, event) {
        runtime.fireTrigger(struck, { event });
      }
    },
    triggerListeners: new Map([
      [
        struck.id,
        [
          (mechanics, { event }) => {
            if (mechanics.random.roll(1, 'fixture.trait-certain'))
              mechanics.effects.emit({ kind: 'packet', event: traitBurning(event.at) });

            if (mechanics.random.roll(0.999, 'fixture.trait-chance'))
              mechanics.effects.emit({
                kind: 'packet',
                event: { ...traitBurning(event.at), sourceId: 991003, condition: 'Bleeding' }
              });
          }
        ]
      ]
    ])
  });
  const [off, on] = [0, 1].map(
    (includeTraitProcs) => evaluate(profession, [occurrence(991001, { inputs: { includeTraitProcs } })])[0]
  );
  assert.equal(off.measurement.conditionDamage, 0);
  assert.deepEqual(
    on.measurement.conditions.map((row) => row.condition),
    ['Burning']
  );
  assert.ok(on.measurement.total > off.measurement.total);
});

// Trait-owned packets emitted inline by the skill's own execution are trait procs, not part of the skill alone.
test('inline trait-owned packets leave the skill row when trait procs are excluded', () => {
  const profession = fixture([{ type: 'buff', kind: 'earned', stacks: 1, duration: 1 }], {
    reactions: {
      'buff.applied'(runtime, event) {
        if (event.kind !== 'earned') return;

        runtime.effects.emit({
          kind: 'packet',
          event: { ...traitBurning(event.at), source: 'Player', actorType: 'player', skillId: 991001, traitId: 991090 }
        });
      }
    }
  });
  const [off, on] = [0, 1].map(
    (includeTraitProcs) => evaluate(profession, [occurrence(991001, { inputs: { includeTraitProcs } })])[0]
  );
  assert.equal(off.status, 'zero');
  assert.equal(on.status, 'measured');
  assert.equal(on.measurement.conditions.length, 1);
});

test('Fractal evaluates its shared payload without a Bleeding prerequisite and without changing target assumptions', async () => {
  const app = await headlessApp('elementalist', await firstPresetBuildPath('elementalist'));
  const config = {
    ...app.adapter
      .createBuildContext({
        build: app.build,
        transitionDelays: normalizeTransitionDelays(app.simulationSettings?.transitionDelays),
        patch: app.adapter.profession.resolvePatch({ id: app.patch.id ?? 'current' })
      })
      .simulationConfig(),
    relic: 'Fractal',
    target: { health: 0, conditions: {} }
  };
  const saved = structuredClone(config);
  const [row] = evaluate(
    app.profession,
    [occurrence('fractal', { effect: { kind: 'relic', id: RELIC_IDS.FRACTAL }, source: 'Relic', unit: 'occurrence' })],
    config
  );
  assert.equal(row.status, 'measured');
  assert.ok(row.measurement.conditionDamage > 0);
  assert.deepEqual(config, saved);
});

// The isolated occurrence uses the same delayed Torment payload and ordinary buff registration as combat.
test('Peitha isolated damage completes its delayed payload without special trigger events', () => {
  const profession = fixture([]);
  const [row] = evaluate(
    profession,
    [
      occurrence('peitha', {
        effect: { kind: 'relic', id: RELIC_IDS.PEITHA },
        source: 'Relic',
        unit: 'occurrence',
        inputs: { impactDelayMs: 2000 }
      })
    ],
    {
      relic: 'Peitha',
      attributeInputs: baseAttributeInputs({ conditionDamage: 1000 }),
      target: { health: 0, conditions: {} }
    }
  );
  assert.equal(row.status, 'measured');
  assert.ok(row.measurement.conditionDamage > 0);
  assert.equal(row.measurement.strike, 0);
});

test('measured zero, invalid inputs, and unsupported content remain distinct', () => {
  const profession = fixture([{ type: 'strike', coefficient: 0 }]);
  const rows = evaluate(profession, [
    occurrence(991001),
    occurrence(991001, { id: 'invalid', inputs: { stacks: NaN } }),
    occurrence(991002)
  ]);
  assert.deepEqual(
    rows.map((row) => row.status),
    ['zero', 'missing-input', 'unsupported']
  );
  assert.equal(rows[0].damaging, true);
  assert.equal(rows[0].measurement.total, 0);
});

test('each occurrence has fresh state and caches include damage inputs and configuration', () => {
  const profession = fixture([{ type: 'strike', coefficient: 1 }]);
  const cache = new Map();
  const [alone] = evaluate(
    profession,
    [occurrence(991001)],
    { attributeInputs: baseAttributeInputs({ power: 1000 }) },
    cache
  );
  const rows = evaluate(
    profession,
    [occurrence(991001), occurrence(991001, { id: 'second' })],
    { attributeInputs: baseAttributeInputs({ power: 1000 }) },
    cache
  );
  assert.equal(rows[0].measurement.total, alone.measurement.total);
  assert.equal(rows[1].measurement.total, alone.measurement.total);
  const [stronger] = evaluate(
    profession,
    [occurrence(991001)],
    { attributeInputs: baseAttributeInputs({ power: 2000 }) },
    cache
  );
  assert.ok(stronger.measurement.total > alone.measurement.total);
});

// Damage predicates retain their meaning even though occurrence eligibility is assumed.
test('damage modifiers retain full player health and selected target health', () => {
  const profession = defineTestProfession({
    id: 'health-damage',
    name: 'Health damage',
    catalog: fixture([{ type: 'strike', coefficient: 1 }]).catalog,
    modifiers: {
      // Damage eligibility uses full player health and the independently configured target health.
      modifierRules: [
        {
          id: 'health-damage',
          target: 'strikeDamage',
          operation: 'multiply',
          factor(context) {
            assert.equal(playerHealthFraction(context), 1);
            return targetHealthBelow(context, 0.5) ? 2 : 1;
          }
        }
      ]
    }
  });
  const [high] = evaluate(profession, [occurrence(991001)], { target: { health: 100, fixedHealthFraction: 1 } });
  const [low] = evaluate(profession, [occurrence(991001)], { target: { health: 100, fixedHealthFraction: 0.25 } });
  assert.equal(high.status, 'measured');
  assert.equal(
    low.measurement.strikeBreakdown.outgoingMultiplier,
    high.measurement.strikeBreakdown.outgoingMultiplier * 2
  );
  assert.ok(low.measurement.total > high.measurement.total);
});

test('a shared cache cannot reuse a result from different content', () => {
  const cache = new Map();
  const [first] = evaluate(fixture([{ type: 'strike', coefficient: 1 }]), [occurrence(991001)], {}, cache);
  const [second] = evaluate(fixture([{ type: 'strike', coefficient: 2 }]), [occurrence(991001)], {}, cache);
  assert.equal(second.measurement.coefficient, first.measurement.coefficient * 2);
  assert.ok(second.measurement.total > first.measurement.total);
});

// The first hit's factors must never masquerade as a formula for changing later hits.
test('strike breakdown marks changing critical and attribute inputs while preserving resolved totals', () => {
  for (const boon of ['fury', 'might']) {
    const profession = fixture([
      {
        type: 'strike',
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        ticks: [
          { atMs: 0, coefficient: 1 },
          { atMs: 1000, coefficient: 1 }
        ]
      },
      {
        type: 'boon',
        boon,
        stacks: 1,
        duration: 5,
        atMs: 500,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        audience: { recipients: 'self' }
      }
    ]);
    const config = {
      attributeInputs: baseAttributeInputs({ power: 1000 }),
      target: { armor: 1000 },
      criticalDamageMode: 'averaged'
    };
    const [row] = evaluate(profession, [occurrence(991001)], config);
    assert.equal(row.status, 'measured');
    assert.equal(row.measurement.strikeBreakdown.variesAcrossHits, true);
    const combat = simulateGw2({
      profession,
      config,
      rotation: [{ type: 'cast', skillId: 991001 }],
      observationPolicy: { kind: 'tail', durationMs: 2000 }
    });
    assert.equal(row.measurement.strike, combat.strikeDamage);
  }

  const [uniform] = evaluate(fixture([{ type: 'strike', coefficient: 1 }]), [occurrence(991001)]);
  assert.equal(uniform.measurement.strikeBreakdown.variesAcrossHits, false);
});

// Unsupported precast declarations cannot borrow the equipped relic's state or produce misleading damage.
test('relic occurrences require their own runtime owner and retain the equipped payload bonus', () => {
  const profession = fixture([]);
  const definition = occurrence('bloodstone', {
    effect: { kind: 'relic', id: RELIC_IDS.BLOODSTONE },
    source: 'Relic',
    unit: 'occurrence'
  });
  const [missing] = evaluate(profession, [definition], { relic: 'Fractal', precastRelics: ['Bloodstone'] });
  assert.equal(missing.status, 'missing-input');
  assert.equal(
    damageOccurrences(profession.runtimeFor(), { relic: 'Fractal', precastRelics: ['Bloodstone'] }).some(
      (entry) => entry.effect.kind === 'relic' && entry.effect.id === RELIC_IDS.BLOODSTONE
    ),
    false
  );
  const [equipped] = evaluate(profession, [definition], { relic: 'Bloodstone' });
  assert.equal(equipped.status, 'measured');
  assert.equal(equipped.measurement.strikeBreakdown.outgoingMultiplier, 1.07);
});
