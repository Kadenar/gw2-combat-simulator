import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { createCanonicalCatalog } from '#gw2/platform/engine/skills/catalog.js';
import { defineProfession } from '#gw2/platform/engine/profession/contract.js';
import { createScheduler } from '#gw2/platform/engine/execution/scheduler.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { timelineDeadTimeMarkers } from '#gw2/app/presentation/rotation/timeline.js';

const forbiddenHorizonField = ['extends', 'Resolution', 'Horizon'].join('');
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function fixtureConfig(overrides = {}) {
  return {
    attributes: {
      power: 1000,
      precision: 1000,
      ferocity: 0,
      conditionDamage: 1000,
      expertise: 0
    },
    target: { armor: 2597, ...(overrides.target || {}) },
    weaponStrength: 1000,
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
            metadata: { flatDamage: 1 }
          },
          {
            type: 'strike',
            coefficient: 0,
            atMs: 800,
            timingAnchor: 'castStart',
            timingScale: 'fixed',
            metadata: { flatDamage: 100 }
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
        id: 990003,
        name: 'Committed Channel',
        castTimeMs: 1000,
        interruptCommitMs: 300,
        effects: [
          {
            type: 'strike',
            ticks: [
              { atMs: 200, coefficient: 1 },
              { atMs: 600, coefficient: 1 },
              { atMs: 900, coefficient: 1 }
            ],
            timingAnchor: 'castStart',
            timingScale: 'fixed',
            persistsAfterInterrupt: true
          }
        ]
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
      },
      {
        id: 990008,
        name: 'Staged Projectiles',
        castTimeMs: 1000,
        effects: [
          {
            type: 'strike',
            coefficient: 0,
            atMs: 100,
            timingAnchor: 'castStart',
            timingScale: 'fixed',
            persistsAfterInterrupt: true,
            interruptCommitMs: 50,
            metadata: { flatDamage: 1 }
          },
          {
            type: 'strike',
            coefficient: 0,
            atMs: 800,
            timingAnchor: 'castStart',
            timingScale: 'fixed',
            persistsAfterInterrupt: true,
            interruptCommitMs: 400,
            metadata: { flatDamage: 100 }
          }
        ]
      },
      {
        id: 990009,
        name: 'Default Commit Timeline',
        castTimeMs: 1000,
        effects: [
          {
            type: 'strike',
            ticks: [
              { atMs: 200, coefficient: 1 },
              { atMs: 600, coefficient: 1 }
            ],
            timingAnchor: 'castStart',
            timingScale: 'fixed'
          }
        ]
      },
      {
        id: 990010,
        name: 'Per-packet Channel',
        castTimeMs: 1000,
        interruptMode: 'per-packet',
        effects: [
          {
            type: 'strike',
            ticks: [
              { atMs: 200, coefficient: 1 },
              { atMs: 600, coefficient: 1 },
              { atMs: 900, coefficient: 1 }
            ],
            timingAnchor: 'castStart',
            timingScale: 'fixed',
            persistsAfterInterrupt: true,
            interruptCommitMs: 100
          }
        ]
      },
      {
        id: 990011,
        name: 'Retained Failed Commit',
        castTimeMs: 1000,
        interruptCommitMs: 300,
        retainsCastLockoutAfterInterrupt: true,
        effects: [
          {
            type: 'strike',
            coefficient: 0,
            atMs: 600,
            timingAnchor: 'castStart',
            timingScale: 'fixed',
            persistsAfterInterrupt: true,
            metadata: { flatDamage: 1 }
          }
        ]
      }
    ]
  });

  return defineProfession({
    id: 'resolution-contract',
    name: 'Resolution Contract',
    catalog,
    resources: {
      createProfessionState: () => ({ actorActiveUntil: 0 })
    },
    schedulerHooks: {
      onCastStart(context, skill) {
        if (skill.id !== 990005) return;
        context.emit({
          type: 'damage',
          at: context.start + 2,
          source: 'Metadata Bait',
          sourceId: skill.id,
          flatDamage: 100,
          [forbiddenHorizonField]: true
        });
      },
      onCastComplete(context, skill) {
        if (skill.id !== 990006) return;
        context.state.profession.actorActiveUntil = context.effectiveEnd + 4;
        context.tasks.schedule({
          type: 'fixture.persistent-actor',
          at: context.effectiveEnd + 1,
          ownerId: context.reservationId,
          payload: {}
        });
      },
      taskHandlers: {
        'fixture.persistent-actor': (context, task) => {
          if (task.at > context.state.profession.actorActiveUntil + context.epsilon) {
            return;
          }

          context.emit({
            type: 'damage',
            at: task.at,
            source: 'Persistent Actor',
            sourceId: 'fixture.actor',
            actorType: 'summon',
            flatDamage: 10
          });
          context.tasks.schedule({
            type: 'fixture.persistent-actor',
            at: task.at + 1,
            ownerId: task.ownerId,
            payload: {}
          });
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
  assert.equal(nonlethal.duration, 2.2);

  const lethal = simulateGw2({
    profession,
    rotation: ['Delayed Packet', 'Long Follow-up'],
    config: fixtureConfig({ target: { health: 50 } })
  });

  assert.equal(lethal.deathTime, 0.8);
  assert.equal(lethal.duration, 2.2);
  assert.ok(Math.abs(lethal.dpsWindow - 0.7) < 1e-12);
  assert.equal(
    lethal.resolvedEvents.some((event) => event.at > 0.8),
    false
  );
});

test('terminal packets require an explicit observation tail or wait', () => {
  const scheduled = createScheduler({ profession }).run(['Delayed Packet']);

  assert.equal(scheduled.stream.rotationEndTime, 0.2);
  assert.equal(scheduled.stream.resolutionEndTime, 0.2);
  assert.ok(scheduled.events.some((event) => event.type === 'damage' && event.at === 0.8));

  const defaultResult = simulateGw2({
    profession,
    rotation: ['Delayed Packet'],
    config: fixtureConfig()
  });

  assert.equal(defaultResult.duration, 0.2);
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

  assert.equal(tailed.duration, 0.2);
  assert.ok(tailed.resolvedEvents.some((event) => event.at === 0.8));
  assert.ok(Math.abs(tailed.dpsWindow - 1.1) < 1e-12);

  const waited = simulateGw2({
    profession,
    rotation: ['Delayed Packet', { type: 'wait', durationMs: 1000 }],
    config: fixtureConfig()
  });

  assert.equal(waited.duration, 1.2);
  assert.ok(waited.resolvedEvents.some((event) => event.at === 0.8));
});

test('absolute observation is finite and target death clips it', () => {
  const absolute = simulateGw2({
    profession,
    rotation: ['Delayed Packet'],
    config: fixtureConfig(),
    observationPolicy: { kind: 'absolute', endTimeMs: 900 }
  });

  assert.equal(absolute.duration, 0.2);
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
    assert.throws(() => createScheduler({ profession, observationPolicy }), /Observation|observation/);
  }

  assert.throws(
    () =>
      createScheduler({
        profession,
        observationPolicy: { kind: 'absolute', endTimeMs: 100 }
      }).run(['Delayed Packet']),
    /cannot precede rotation end/
  );
});

test('interrupt persistence requires the declared commit point', () => {
  assert.throws(
    () =>
      createCanonicalCatalog({
        generated: [{ id: 990098, name: 'Invalid Interrupt Mode', interruptMode: 'packets', effects: [] }]
      }),
    /interruptMode/
  );

  assert.throws(
    () =>
      createCanonicalCatalog({
        generated: [
          {
            id: 990099,
            name: 'Implicit Commit',
            effects: [
              {
                type: 'strike',
                coefficient: 0,
                persistsAfterInterrupt: true
              }
            ]
          }
        ]
      }),
    /interruptCommitMs/
  );

  const beforeCommit = createScheduler({ profession }).run([
    { name: 'Committed Channel', interruptMs: 200 },
    'Long Follow-up'
  ]);

  assert.deepEqual(
    beforeCommit.events
      .filter((event) => event.skillName === 'Committed Channel')
      .filter((event) => event.type === 'damage')
      .map((event) => event.at),
    []
  );

  const afterCommit = createScheduler({ profession }).run([
    { name: 'Committed Channel', interruptMs: 400 },
    'Long Follow-up'
  ]);

  assert.deepEqual(
    afterCommit.events
      .filter((event) => event.skillName === 'Committed Channel')
      .filter((event) => event.type === 'damage')
      .map((event) => event.at),
    [0.2, 0.6, 0.9]
  );
  const resolved = simulateGw2({
    profession,
    rotation: [{ name: 'Committed Channel', interruptMs: 400 }, 'Long Follow-up'],
    config: fixtureConfig()
  });

  assert.ok(resolved.resolvedEvents.some((event) => event.at === 0.9));
});

test('interrupt modes distinguish whole-effect commits from per-packet channels', () => {
  const committed = createScheduler({ profession }).run([{ name: 'Default Commit Timeline', interruptMs: 400 }]);
  assert.deepEqual(
    committed.events.filter((event) => event.type === 'damage').map((event) => event.at),
    []
  );

  const channel = createScheduler({ profession }).run([{ name: 'Per-packet Channel', interruptMs: 600 }]);
  assert.deepEqual(
    channel.events.filter((event) => event.type === 'damage').map((event) => event.at),
    [0.2, 0.6]
  );
});

test('dead time includes entire attempted casts below declared commit cutoffs and excludes partial channels', () => {
  const missingCommit = simulateGw2({
    profession,
    rotation: [{ name: 'Default Commit Timeline', interruptMs: 400 }],
    config: fixtureConfig()
  });
  const explicitCommit = simulateGw2({
    profession,
    rotation: [{ name: 'Committed Channel', interruptMs: 200 }],
    config: fixtureConfig()
  });
  const channel = simulateGw2({
    profession,
    rotation: [{ name: 'Per-packet Channel', interruptMs: 100 }],
    config: fixtureConfig()
  });
  const effectLevelCommit = simulateGw2({
    profession,
    rotation: [{ name: 'Staged Projectiles', interruptMs: 25 }],
    config: fixtureConfig()
  });
  const retainedFailedCommit = simulateGw2({
    profession,
    rotation: [{ name: 'Retained Failed Commit', interruptMs: 200 }, 'Long Follow-up'],
    config: fixtureConfig()
  });

  assert.deepEqual(
    timelineDeadTimeMarkers(missingCommit.steps, missingCommit.resolvedEvents).map((marker) => marker.durationMs),
    [400]
  );
  assert.equal(explicitCommit.steps[0].cancelledBeforeCommit, true);
  assert.deepEqual(
    timelineDeadTimeMarkers(explicitCommit.steps, explicitCommit.resolvedEvents).map((marker) => marker.durationMs),
    [200]
  );
  assert.equal(effectLevelCommit.steps[0].cancelledBeforeCommit, true);
  assert.deepEqual(
    timelineDeadTimeMarkers(effectLevelCommit.steps, effectLevelCommit.resolvedEvents).map(
      (marker) => marker.durationMs
    ),
    [25]
  );
  const retainedMarkers = timelineDeadTimeMarkers(retainedFailedCommit.steps, retainedFailedCommit.resolvedEvents);

  // Count the entire failed attempt, while the retained aftercast remains forced busy time rather than additional idle time.
  assert.equal(retainedFailedCommit.steps[0].castLockoutEnd, 1000);
  assert.deepEqual(
    retainedMarkers.map((marker) => marker.durationMs),
    [200]
  );
  assert.deepEqual(timelineDeadTimeMarkers(channel.steps, channel.resolvedEvents), []);
});

test('persistent effects require their own declared interrupt cutoffs', () => {
  const beforeSecondLaunch = createScheduler({ profession }).run([
    {
      name: 'Staged Projectiles',
      interruptMs: 150
    },
    'Long Follow-up'
  ]);

  assert.deepEqual(
    beforeSecondLaunch.events
      .filter((event) => event.skillName === 'Staged Projectiles')
      .filter((event) => event.type === 'damage')
      .map((event) => event.at),
    [0.1]
  );

  const afterSecondLaunch = createScheduler({ profession }).run([
    {
      name: 'Staged Projectiles',
      interruptMs: 400
    },
    'Long Follow-up'
  ]);

  assert.deepEqual(
    afterSecondLaunch.events
      .filter((event) => event.skillName === 'Staged Projectiles')
      .filter((event) => event.type === 'damage')
      .map((event) => event.at),
    [0.1, 0.8]
  );
  assert.equal(afterSecondLaunch.stream.rotationEndTime, 2.4);
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
  assert.equal(withMetadataBait.duration, 0.2);
  assert.equal(
    withMetadataBait.resolvedEvents.some((event) => event.at === 2.1),
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
    [1.1, 2.1]
  );

  const longerThanLifetime = simulateGw2({
    profession,
    rotation: ['Persistent Actor'],
    config: fixtureConfig(),
    observationPolicy: { kind: 'tail', durationMs: 10_000 }
  });

  assert.deepEqual(
    longerThanLifetime.resolvedEvents.filter((event) => event.source === 'Persistent Actor').map((event) => event.at),
    [1.1, 2.1, 3.1, 4.1]
  );

  const deathClipped = simulateGw2({
    profession,
    rotation: ['Persistent Actor'],
    config: fixtureConfig({ target: { health: 5 } }),
    observationPolicy: { kind: 'tail', durationMs: 10_000 }
  });

  assert.equal(deathClipped.deathTime, 1.1);
  assert.deepEqual(
    deathClipped.events.filter((event) => event.source === 'Persistent Actor').map((event) => event.at),
    [1.1]
  );
});

test('production source and catalog data cannot declare event-owned horizons', () => {
  const roots = [path.join(repoRoot, 'js'), path.join(repoRoot, 'data', 'gw2', 'builds')];
  const violations = [];
  const visit = (entry) => {
    if (statSync(entry).isDirectory()) {
      for (const child of readdirSync(entry)) visit(path.join(entry, child));

      return;
    }

    if (!/\.(?:js|ts|json)$/.test(entry)) return;

    if (readFileSync(entry, 'utf8').includes(forbiddenHorizonField)) {
      violations.push(path.relative(repoRoot, entry));
    }
  };

  for (const root of roots) visit(root);
  assert.deepEqual(violations, []);
});

test('saved rotations and regression tooling cannot select observation policy', () => {
  const observationPolicyField = ['observation', 'Policy'].join('');
  const violations = [];
  const visit = (entry) => {
    if (statSync(entry).isDirectory()) {
      for (const child of readdirSync(entry)) visit(path.join(entry, child));

      return;
    }

    if (!entry.endsWith('.json')) return;

    if (readFileSync(entry, 'utf8').includes(observationPolicyField)) {
      violations.push(path.relative(repoRoot, entry));
    }
  };

  visit(path.join(repoRoot, 'data', 'gw2', 'rotations'));
  for (const relativePath of [
    'tests/app/benchmarks/preset-benchmark.js',
    'scripts/analysis/capture-supported-build-metrics.mjs'
  ]) {
    const source = readFileSync(path.join(repoRoot, relativePath), 'utf8');

    if (source.includes(observationPolicyField)) violations.push(relativePath);
  }

  assert.deepEqual(violations, []);
});
