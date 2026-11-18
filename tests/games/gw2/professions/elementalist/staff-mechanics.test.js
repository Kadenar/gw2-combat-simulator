// Staff support effects must reach traits and allies; meteor misses must not consume damage falloff.
import assert from 'node:assert/strict';
import test from 'node:test';

import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { strikeTimeline } from '#gw2/platform/effects/authoring.js';
import { effectStateAt } from '#gw2/platform/results/effect-report.js';
import { selectMeteorShowerImpacts } from '#gw2/professions/elementalist/core/mechanics/staff.js';
import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
import { elementalistCatalog } from '#gw2/professions/elementalist/profession.js';
import { createSimulationRandom } from '#kernel/core/simulation-random.js';
import { cast, wait } from '#tests/helpers/commands.js';
import { runElementalist } from '#tests/helpers/elementalist-simulation.js';

test('Frozen Grounds grants an expiring aura and triggers selected aura traits', () => {
  for (const selected of [false, true]) {
    const auraStates = [];
    const result = runElementalist(
      [cast(ID.FROZEN_GROUNDS), wait(8000)],
      {
        primaryWeapon: 'Staff',
        startAttunement: 'Water',
        specialization: 'Tempest',
        selectedTraitIds: selected ? [TRAIT.TEMPESTUOUS_ARIA] : []
      },
      {
        probes: [1, 4].map((at) => [
          at,
          (runtime) => auraStates.push(runtime.profession.core.activeAuras.some((aura) => aura.type === 'Frost Aura'))
        ])
      }
    );
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(auraStates, [true, false]);
    const aura = result.events.find((event) => event.type === 'aura' && event.sourceId === ID.FROZEN_GROUNDS);
    assert.equal(aura.duration, 3);
    const grants = result.resolvedEvents.filter((event) => event.kind === 'tempestuous aria');
    assert.equal(grants.length, Number(selected));

    if (selected) {
      assert.equal(grants[0].at, aura.at);
      assert.equal(grants[0].triggeredBy, 'Frozen Grounds');
      assert.equal(grants[0].duration, 5);
    }
  }
});

test('Transmute Earth consumes its aura and grants concentration-scaled party Stability with its blast', () => {
  const auraStates = [];
  const result = runElementalist(
    [cast(ID.MAGNETIC_AURA), cast(ID.TRANSMUTE_EARTH), wait(12000)],
    {
      primaryWeapon: 'Staff',
      startAttunement: 'Earth',
      selectedTraitIds: [],
      allies: { count: 8 },
      attributeInputs: baseAttributeInputs({ concentration: 750 })
    },
    { probes: [[1, (runtime) => auraStates.push(...runtime.profession.core.activeAuras)]] }
  );
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(auraStates, []);
  const stability = result.resolvedEvents.find((event) => event.kind === 'stability');
  const blast = result.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === ID.TRANSMUTE_EARTH);
  assert.equal(stability.stacks, 2);
  assert.equal(stability.duration, 9);
  assert.equal(stability.resolvedAudience.recipientCount, 5);
  assert.equal(stability.resolvedAudience.includesSelf, true);
  assert.equal(stability.at, blast.at);
  assert.equal(stability.activationId, blast.activationId);
});

test('Healing Rain grants future Regeneration only when its pulses resolve', () => {
  const result = runElementalist([cast(ID.HEALING_RAIN), wait(16000)], {
    primaryWeapon: 'Staff',
    startAttunement: 'Water',
    selectedTraitIds: []
  });
  assert.deepEqual(result.warnings, []);
  const grants = result.resolvedEvents.filter((event) => event.kind === 'regeneration');
  const track = result.effectReport.tracks.find((track) => track.kind === 'regeneration' && track.recipient === 'self');
  const first = grants[0];
  const next = grants[1];
  assert.ok(next, 'rain must renew regeneration after its initial grant');
  const initial = effectStateAt(result.effectReport, track, first.at);
  assert.equal(initial.expiresAt, first.at + first.duration);
  const renewed = effectStateAt(result.effectReport, track, next.at);
  assert.ok(Math.abs(renewed.expiresAt - initial.expiresAt - next.duration) < 1e-9);
  assert.equal(effectStateAt(result.effectReport, track, result.rotationEndTime).count, 0);
});

test('stationary targets do not trigger perimeter controls or Lightning Rod', () => {
  for (const [skillId, startAttunement] of [
    [ID.STATIC_FIELD, 'Air'],
    [ID.UNSTEADY_GROUND, 'Earth']
  ]) {
    for (const moving of [false, true]) {
      const result = runElementalist([cast(skillId), wait(5000)], {
        primaryWeapon: 'Staff',
        startAttunement,
        selectedTraitIds: [TRAIT.LIGHTNING_ROD],
        target: { moving }
      });
      assert.deepEqual(result.warnings, []);
      assert.equal(
        result.events.some((event) => event.type === 'control' && event.skillId === skillId),
        moving
      );
      assert.equal(
        result.resolvedEvents.some((event) => event.type === 'damage' && event.skillName === 'Lightning Rod'),
        moving
      );

      if (!moving) assert.equal(result.combatStartTime, null);

      if (skillId === ID.STATIC_FIELD)
        assert.ok(result.events.some((event) => event.type === 'combo_field' && event.fieldType === 'Lightning'));
    }
  }
});

// Synthetic impacts isolate hit selection and falloff without pinning the native meteor schedule.
test('meteor damage falls only on landed hits and stops at its configured floor', () => {
  const skill = {
    ...elementalistCatalog.skillsById.get(ID.METEOR_SHOWER),
    meteorSmallTargetHitChance: 0.5,
    meteorDamageReductionPerHit: 0.2,
    meteorMinimumDamageFactor: 0.4
  };
  const effects = [strikeTimeline(Array.from({ length: 10 }, (_, index) => ({ atMs: index * 100, coefficient: 3 })))];
  const select = (chance, random) =>
    selectMeteorShowerImpacts(
      {
        combat: { targetHitboxSize: () => 'small' },
        random
      },
      { skill: { ...skill, meteorSmallTargetHitChance: chance }, start: 0, fullEnd: 1, effectiveEnd: 1 },
      effects
    );
  const result = select(0.5, createSimulationRandom());
  assert.deepEqual(
    result.flatMap((effect) => effect.ticks.map((tick) => Number(tick.coefficient.toFixed(6)))),
    [3, 2.4, 1.8, 1.2, 1.2]
  );
  assert.deepEqual(select(0, createSimulationRandom()), []);
  assert.ok(
    effects[0].ticks.every((tick) => tick.coefficient === 3),
    'selection must not mutate shared catalog effects'
  );
  const seeded = () => createSimulationRandom({ mode: 'stochastic', seed: 79 });
  assert.deepEqual(select(0.5, seeded()), select(0.5, seeded()));
});

test('early Meteor Shower cancellation replaces normal recharge with a fixed cooldown', () => {
  for (const alacrity of [false, true]) {
    let readyAt;
    const result = runElementalist(
      [cast(ID.METEOR_SHOWER, { interruptAfterMs: 400 }), wait(5000)],
      {
        primaryWeapon: 'Staff',
        startAttunement: 'Fire',
        selectedTraitIds: [],
        boons: { alacrity }
      },
      {
        probes: [
          [
            1,
            (runtime) => {
              readyAt = runtime.cooldownController.readyAt(ID.METEOR_SHOWER);
            }
          ]
        ]
      }
    );
    assert.deepEqual(result.warnings, []);
    const cancellation = result.steps.find((step) => step.skillId === ID.METEOR_SHOWER);
    assert.equal(readyAt, cancellation.end / 1000 + 4);
  }
});
