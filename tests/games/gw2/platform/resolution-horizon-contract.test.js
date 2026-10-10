import { baseAttributeInputs } from '#gw2/platform/builds/attribute-inputs.js';
import assert from 'node:assert/strict';
import test from 'node:test';

import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import { defineTestProfession } from '#tests/helpers/profession.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';

const forbiddenHorizonField = ['extends', 'Resolution', 'Horizon'].join('');

function fixtureConfig(overrides = {}) {
  return {
    weaponStrength: 1000,
    attributeInputs: baseAttributeInputs({
      power: 1000,
      precision: 1000,
      ferocity: 0,
      conditionDamage: 1000,
      expertise: 0
    }),
    target: { armor: 2597, ...(overrides.target || {}) },
    ...overrides
  };
}

function contractProfession() {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 990001,
        name: 'Delayed Packet',
        castTimeMs: 200,
        effects: [
          {
            type: 'strike',
            coefficient: 0,
            atMs: 100,
            timingAnchor: 'castStart',
            timingScale: 'fixed',
            flatDamage: 1
          },
          {
            type: 'strike',
            coefficient: 0,
            atMs: 800,
            timingAnchor: 'castStart',
            timingScale: 'fixed',
            flatDamage: 100
          }
        ]
      },
      {
        id: 990002,
        name: 'Long Follow-up',
        castTimeMs: 2000,
        effects: []
      },
      {
        id: 990004,
        name: 'Long Condition',
        castTimeMs: 100,
        effects: [
          {
            type: 'condition',
            condition: 'Bleeding',
            stacks: 1,
            duration: 5,
            atMs: 0,
            timingAnchor: 'castStart',
            timingScale: 'fixed'
          }
        ]
      },
      {
        id: 990005,
        name: 'Metadata Bait',
        castTimeMs: 100,
        effects: [
          {
            type: 'strike',
            coefficient: 1,
            atMs: 2000,
            timingAnchor: 'castStart',
            timingScale: 'fixed'
          }
        ]
      },
      {
        id: 990006,
        name: 'Persistent Actor',
        castTimeMs: 100,
        effects: []
      },
      {
        id: 990007,
        name: 'Clean Metadata Bait',
        castTimeMs: 100,
        effects: [
          {
            type: 'strike',
            coefficient: 1,
            atMs: 2000,
            timingAnchor: 'castStart',
            timingScale: 'fixed'
          }
        ]
      }
    ]
  });

  return defineTestProfession({
    id: 'resolution-contract',
    name: 'Resolution Contract',
    catalog,
    resources: {
      createState: () => ({ actorActiveUntil: 0 })
    },
    hooks: {
      onCastStart(context, { skill, start }) {
        if (skill.id !== 990005) return;
        context.effects.emit({
          kind: 'packet',
          event: {
            type: 'damage',
            actorType: 'player',
            at: start + 2,
            source: 'Metadata Bait',
            sourceId: skill.id,
            flatDamage: 100,
            [forbiddenHorizonField]: true
          }
        });
      },
      onCastCommit(context, { skill, effectiveEnd }) {
        if (skill.id !== 990006) return;
        context.profession.actorActiveUntil = effectiveEnd + 4;
        context.schedule('fixture.persistent-actor', effectiveEnd + 1);
      },
      tasks: {
        'fixture.persistent-actor': (context) => {
          if (context.time > context.profession.actorActiveUntil) {
            return;
          }

          context.effects.emit({
            kind: 'packet',
            event: {
              type: 'damage',
              at: context.time,
              source: 'Persistent Actor',
              sourceId: 'fixture.actor',
              actorType: 'summon',
              flatDamage: 10
            }
          });
          context.schedule('fixture.persistent-actor', context.time + 1);
        }
      }
    }
  });
}

const profession = contractProfession();

test('delayed packets resolve during later casts and lethal packets clip them', () => {
  const nonlethal = simulateGw2({
    profession,
    rotation: ['Delayed Packet', 'Long Follow-up'],
    config: fixtureConfig()
  });
  const delayed = nonlethal.resolvedEvents.find((event) => event.type === 'damage' && event.at === 0.8);

  assert.ok(delayed);
  assert.equal(nonlethal.rotationEndTime, 2.2);

  const lethal = simulateGw2({
    profession,
    rotation: ['Delayed Packet', 'Long Follow-up'],
    config: fixtureConfig({ target: { health: 50 } })
  });

  assert.equal(lethal.deathTime, 0.8);
  assert.equal(lethal.rotationEndTime, 2.2);
  assert.ok(Math.abs(lethal.dpsWindow - 0.7) < 1e-12);
  assert.equal(
    lethal.resolvedEvents.some((event) => event.at > 0.8),
    false
  );
});

test('terminal packets require an explicit observation tail or wait', () => {
  const scheduled = simulateGw2({ profession, rotation: ['Delayed Packet'] });

  assert.equal(scheduled.rotationEndTime, 0.2);
  assert.equal(scheduled.planningState.atSeconds, 0.2);
  assert.equal(
    scheduled.events.some((event) => event.type === 'damage' && event.at === 0.8),
    false
  );

  const defaultResult = simulateGw2({
    profession,
    rotation: ['Delayed Packet'],
    config: fixtureConfig()
  });

  assert.equal(defaultResult.rotationEndTime, 0.2);
  assert.equal(
    defaultResult.resolvedEvents.some((event) => event.at === 0.8),
    false
  );

  const tailed = simulateGw2({
    profession,
    rotation: ['Delayed Packet'],
    config: fixtureConfig(),
    observationPolicy: { kind: 'tail', durationMs: 1000 }
  });

  assert.equal(tailed.rotationEndTime, 0.2);
  assert.ok(tailed.resolvedEvents.some((event) => event.at === 0.8));
  assert.ok(Math.abs(tailed.dpsWindow - 1.1) < 1e-12);

  const waited = simulateGw2({
    profession,
    rotation: ['Delayed Packet', { type: 'wait', durationMs: 1000 }],
    config: fixtureConfig()
  });

  assert.equal(waited.rotationEndTime, 1.2);
  assert.ok(waited.resolvedEvents.some((event) => event.at === 0.8));
});

test('absolute observation is finite and target death clips it', () => {
  const absolute = simulateGw2({
    profession,
    rotation: ['Delayed Packet'],
    config: fixtureConfig(),
    observationPolicy: { kind: 'absolute', endTimeMs: 900 }
  });

  assert.equal(absolute.rotationEndTime, 0.2);
  assert.equal(
    absolute.events.every((event) => event.at <= 0.9),
    true
  );
  assert.ok(absolute.resolvedEvents.some((event) => event.at === 0.8));

  const deathClipped = simulateGw2({
    profession,
    rotation: ['Delayed Packet'],
    config: fixtureConfig({ target: { health: 50 } }),
    observationPolicy: { kind: 'tail', durationMs: 5000 }
  });

  assert.equal(deathClipped.deathTime, 0.8);
  assert.equal(
    deathClipped.events.every((event) => event.at <= 0.8),
    true
  );
  assert.equal(
    deathClipped.resolvedEvents.every((event) => event.at <= 0.8),
    true
  );
});

test('invalid and contradictory observation boundaries are rejected', () => {
  for (const observationPolicy of [
    { kind: 'tail', durationMs: -1 },
    { kind: 'tail', durationMs: Number.POSITIVE_INFINITY },
    { kind: 'absolute', endTimeMs: Number.NaN },
    { kind: 'unknown' }
  ]) {
    assert.throws(() => simulateGw2({ profession, observationPolicy, rotation: [] }), /Observation|observation/);
  }

  assert.throws(
    () =>
      simulateGw2({
        profession,
        observationPolicy: { kind: 'absolute', endTimeMs: 100 },
        rotation: ['Delayed Packet']
      }),
    /cannot precede rotation end/
  );
});

test('event metadata cannot extend an unrelated condition', () => {
  const clean = simulateGw2({
    profession,
    rotation: ['Long Condition', 'Clean Metadata Bait'],
    config: fixtureConfig()
  });
  const withMetadataBait = simulateGw2({
    profession,
    rotation: ['Long Condition', 'Metadata Bait'],
    config: fixtureConfig()
  });

  assert.equal(withMetadataBait.conditionDamage, clean.conditionDamage);
  assert.equal(withMetadataBait.rotationEndTime, 0.24);
  assert.equal(
    withMetadataBait.resolvedEvents.some((event) => event.at === 2.12),
    false
  );
});

test('persistent actors respect lifetime, observation end, and target death', () => {
  const defaultResult = simulateGw2({
    profession,
    rotation: ['Persistent Actor'],
    config: fixtureConfig()
  });

  assert.equal(defaultResult.totalDamage, 0);

  const tailed = simulateGw2({
    profession,
    rotation: ['Persistent Actor'],
    config: fixtureConfig(),
    observationPolicy: { kind: 'tail', durationMs: 2500 }
  });

  assert.deepEqual(
    tailed.resolvedEvents.filter((event) => event.source === 'Persistent Actor').map((event) => event.at),
    [1.12, 2.12]
  );

  const longerThanLifetime = simulateGw2({
    profession,
    rotation: ['Persistent Actor'],
    config: fixtureConfig(),
    observationPolicy: { kind: 'tail', durationMs: 10_000 }
  });

  assert.deepEqual(
    longerThanLifetime.resolvedEvents.filter((event) => event.source === 'Persistent Actor').map((event) => event.at),
    [1.12, 2.12, 3.12, 4.12]
  );

  const deathClipped = simulateGw2({
    profession,
    rotation: ['Persistent Actor'],
    config: fixtureConfig({ target: { health: 5 } }),
    observationPolicy: { kind: 'tail', durationMs: 10_000 }
  });

  assert.equal(deathClipped.deathTime, 1.12);
  assert.deepEqual(
    deathClipped.events.filter((event) => event.source === 'Persistent Actor').map((event) => event.at),
    [1.12]
  );
});
