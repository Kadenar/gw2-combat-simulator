// Small histories test observation windows and yield attribution independently of saved rotations.
import assert from 'node:assert/strict';
import test from 'node:test';

import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import {
  buildBoonGeneration,
  generatedBoonCoverage,
  projectedPartyEffects
} from '#gw2/platform/results/boon-generation.js';
import { effectStateAt, effectSummary } from '#gw2/platform/results/effect-report.js';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import { observeGw2Runtime } from '#tests/helpers/observed-runtime.js';
import { defineTestProfession } from '#tests/helpers/profession.js';

const grant = (at, duration, sourceId = 'skill', options = {}) => ({
  type: 'buff',
  kind: 'quickness',
  at,
  duration,
  stacks: 1,
  source: 'Fixture',
  sourceId,
  actorType: 'player',
  audience: { recipients: 'party' },
  boonGeneration: {
    activationId: `${sourceId}:${at}`,
    at,
    batchId: `${sourceId}:${at}`,
    applicationIndex: 1,
    expectedApplications: 1
  },
  ...options
});
const estimate = (events, end, scheduled = events, start = 0) =>
  buildBoonGeneration(
    events,
    start,
    end,
    scheduled.map((event) => ({ event, rejected: false }))
  );
const ally = (result) => result.sustained.quickness.ally;

test('completed intervals preserve 25% while benchmark coverage follows the endpoint', () => {
  const events = [0, 20, 40].map((at) => grant(at, 5));
  for (const end of [41, 45, 59]) {
    const result = estimate(events, end);
    assert.equal(ally(result).percent, 25);
    assert.equal(ally(result).intervals, 2);
    assert.equal(generatedBoonCoverage(result.boons, end).quickness.allyPercent, (15 / end) * 100);
  }

  assert.equal(generatedBoonCoverage(estimate(events, 45).boons, 45).quickness.allyPercent.toFixed(1), '33.3');
  const repeated = estimate([...events, grant(60, 5)], 65);
  assert.equal(ally(repeated).percent, 25);
  assert.equal(ally(repeated).intervals, 3);
});

test('source rates weight elapsed intervals and sum independent repeat frequencies', () => {
  const events = [
    grant(0, 2),
    grant(10, 9),
    grant(40, 100),
    grant(0, 3, 'other'),
    grant(5, 8, 'other'),
    grant(20, 200, 'other')
  ];
  const sample = ally(estimate(events, 45));
  assert.ok(Math.abs(sample.percent - 82.5) < 1e-9);
  assert.equal(sample.intervals, 4);
  assert.deepEqual(sample.sources.map((source) => source.percent.toFixed(1)).sort(), ['27.5', '55.0']);
});

const pulse = (activationAt, at, index, expected = 2) =>
  grant(at, 3, 'pulse', {
    boonGeneration: {
      activationId: `cast:${activationAt}`,
      at: activationAt,
      batchId: `batch:${activationAt}`,
      applicationIndex: index,
      expectedApplications: expected
    }
  });

test('delayed pulses belong to their activation and overlapping incomplete yields exclude their own intervals', () => {
  const scheduled = [
    pulse(0, 2, 1),
    pulse(0, 8, 2),
    pulse(20, 22, 1),
    pulse(20, 28, 2),
    pulse(40, 42, 1),
    pulse(40, 48, 2)
  ];
  const result = estimate(scheduled, 45);
  assert.equal(ally(result).percent, 30);
  assert.equal(ally(result).intervals, 2);
  // An earlier yield still awaiting a pulse cannot borrow the next activation's interval as its denominator.
  const overlapping = [
    pulse(0, 2, 1),
    pulse(0, 80, 2),
    pulse(20, 22, 1),
    pulse(20, 28, 2),
    pulse(40, 42, 1),
    pulse(40, 48, 2)
  ];
  const incomplete = ally(estimate(overlapping, 45));
  assert.equal(incomplete.percent, null);
  assert.equal(incomplete.status, 'incomplete');
  assert.equal(incomplete.intervals, 1);
  assert.equal(incomplete.sources[0].percent, 30);
  assert.equal(incomplete.sources[0].excludedIntervals, 1);
  assert.deepEqual(incomplete.sources[0].reasons, ['Incomplete activation yield']);
});

test('planned but unobserved batches prevent a partial cast yield from appearing complete', () => {
  const first = grant(0, 5);
  const delayed = grant(80, 10, 'skill', { boonGeneration: { ...first.boonGeneration, batchId: 'delayed' } });
  const result = estimate([first, grant(20, 5)], 30, [first, delayed, grant(20, 5)]);
  assert.equal(ally(result).percent, null);
  assert.ok(ally(result).sources[0].reasons.includes('Incomplete activation yield'));
});

test('single uses, missing lineage, and empty windows remain explicit', () => {
  const events = [grant(0, 5), grant(20, 5), grant(10, 4, 'single')];
  const partial = ally(estimate(events, 30));
  assert.equal(partial.status, 'incomplete');
  assert.equal(partial.percent, null);
  assert.ok(
    partial.sources.find((source) => source.name === 'single').reasons.includes('Fewer than two observed activations')
  );
  const unknown = ally(estimate([grant(0, 5, 'unknown', { boonGeneration: undefined })], 10));
  assert.equal(unknown.status, 'unavailable');
  assert.deepEqual(unknown.sources[0].reasons, ['Missing activation lineage']);
  const simultaneous = ally(
    estimate(
      [
        grant(0, 5),
        grant(0, 5, 'skill', {
          boonGeneration: { ...grant(0, 5).boonGeneration, activationId: 'other', batchId: 'other' }
        })
      ],
      10
    )
  );
  assert.equal(simultaneous.percent, null);
  assert.deepEqual(simultaneous.sources[0].reasons, ['Fewer than two observed activations']);
  assert.deepEqual(estimate([], 0).sustained, {});
  assert.deepEqual(estimate([grant(0, 5)], 0).sustained, {});
  assert.deepEqual(estimate([grant(0, 5, 'might', { kind: 'might' })], 10).sustained, {});
});

// Duplicate trigger times form one repeat boundary without dropping either proc's yield.
test('simultaneous source activations sum their yields and retain incomplete sibling batches', () => {
  const events = [0, 20, 40].flatMap((at) => [
    grant(at, 3),
    grant(at, 5, 'skill', {
      boonGeneration: { ...grant(at, 5).boonGeneration, activationId: `sibling:${at}`, batchId: `sibling:${at}` }
    })
  ]);
  const result = ally(estimate(events, 45));
  assert.equal(result.percent, 40);
  assert.equal(result.intervals, 2);
  assert.deepEqual(result.sources[0].reasons, []);
  const unfinished = events.map((event, index) =>
    index === 1
      ? {
          ...event,
          boonGeneration: { ...event.boonGeneration, expectedApplications: 2 }
        }
      : event
  );
  const partial = ally(estimate(unfinished, 45));
  assert.equal(partial.percent, null);
  assert.equal(partial.intervals, 1);
  assert.equal(partial.sources[0].percent, 40);
  assert.deepEqual(partial.sources[0].reasons, ['Incomplete activation yield']);
});

test('precast yields leave the estimate while later complete intervals remain usable', () => {
  const events = [0, 20, 40].flatMap((at) => [pulse(at, at + 2, 1), pulse(at, at + 8, 2)]);
  events.push(grant(2, 5, 'precast-only', { boonGeneration: grant(0, 5, 'precast-only').boonGeneration }));
  const result = estimate(events, 45, events, 1);
  assert.equal(ally(result).percent, 30);
  assert.equal(ally(result).intervals, 1);
  assert.equal(ally(result).sources.length, 1);
  assert.deepEqual(ally(result).sources[0].reasons, []);
  assert.equal(result.boons.get('quickness').ally.generatedStackSeconds, 20);
});

test('self and named allies retain separate supply and extension eligibility', () => {
  const events = [0, 20, 40].flatMap((at) => [
    grant(at, 5, 'party'),
    grant(at, 10, 'self', { audience: { recipients: 'self' } }),
    grant(at, 100, 'ally2', { audience: { recipients: 'party', affectsSelf: false, alliedPlayerIndex: 2 } }),
    grant(at + 1, 2, 'extension', { type: 'boon_extension', extensionAudience: 'all' })
  ]);
  const result = estimate(events, 45);
  assert.equal(result.sustained.quickness.ally.percent, 35);
  assert.equal(result.sustained.quickness.self.percent, 85);
  assert.equal(result.boons.get('quickness').ally.generatedStackSeconds, 21);
  assert.equal(result.boons.get('quickness').self.generatedStackSeconds, 51);
});

test('one source keeps each boon label and audience independent of its first expected packet', () => {
  // Might arrives first, while personal and allied duration boons have their own labels and yields.
  const events = [0, 20, 40].flatMap((at) => [
    grant(at, 5, 'skill', { kind: 'might', name: 'Skill - might' }),
    ...['fury', 'swiftness'].flatMap((kind) =>
      ['self', 'party'].map((recipient) =>
        grant(at, recipient === 'self' ? 2 : 3, 'skill', {
          kind,
          name: `Skill - ${kind} - ${recipient}`,
          audience: { recipients: recipient, affectsSelf: recipient === 'self' },
          boonGeneration: { ...grant(at, 1).boonGeneration, batchId: `${at}:${kind}:${recipient}` }
        })
      )
    )
  ]);
  const scheduled = events.map((event) => ({ event, rejected: false }));
  const result = buildBoonGeneration(events, 0, 45, scheduled);
  assert.deepEqual(buildBoonGeneration(events, 0, 45).sustained, result.sustained);
  for (const kind of ['fury', 'swiftness']) {
    assert.equal(result.sustained[kind].self.sources[0].name, `Skill - ${kind} - self`);
    assert.equal(result.sustained[kind].ally.sources[0].name, `Skill - ${kind} - party`);
    assert.equal(result.sustained[kind].self.percent, 10);
    assert.equal(result.sustained[kind].ally.percent, 15);
  }
});

test('cap waste and the final activation remain in generation, timeline, and uptime', () => {
  const events = [0, 20, 40].map((at) => grant(at, 40));
  const result = estimate(events, 45);
  assert.equal(ally(result).percent, 200);
  assert.equal(result.boons.get('quickness').ally.generatedStackSeconds, 120);
  const report = projectedPartyEffects(result, 45);
  const track = report.tracks.find((track) => track.kind === 'quickness');
  assert.equal(effectSummary(track, 0, 45).uptime, 1);
  assert.equal(effectStateAt(report, track, 44).expiresAt, 70);
  const withoutFinal = projectedPartyEffects(estimate(events.slice(0, 2), 45), 45);
  assert.equal(effectStateAt(withoutFinal, withoutFinal.tracks[0], 44).expiresAt, 50);
});

const profession = defineTestProfession({ id: 'sustained-fixture', name: 'Sustained fixture' });

// Reporting policy must not change combat or optimizer coverage, even when transforms copy old lineage.
test('only detailed chart runs retain boon lineage while score coverage remains available', () => {
  const runs = [
    {},
    { output: 'detailed', collectChartData: false },
    { output: 'score' },
    { output: 'observations' }
  ].map((options) => {
    const receipts = [];
    const result = observeGw2Runtime({
      profession: profession.runtimeFor({}),
      config: {},
      collectBoonCoverage: true,
      ...options,
      rotation: [{ type: 'combat-start' }, { type: 'wait', durationMs: 30000 }],
      engineInitialize(runtime) {
        for (const at of [0, 20])
          receipts.push(
            ...runtime.effects.emit({
              kind: 'profile',
              receipt: true,
              at,
              profile: { id: 'fixture', name: 'Fixture' },
              attribution: { source: 'Fixture', sourceId: 'fixture', actorType: 'player' },
              effects: [
                { type: 'strike', coefficient: 1, weaponStrength: 1000 },
                { type: 'boon', boon: 'quickness', duration: 5, audience: { recipients: 'party' } }
              ],
              transform: (event) => ({ ...event, boonGeneration: grant(0, 5).boonGeneration })
            })
          );
      }
    });
    const collect = options.output == null;
    assert.ok(receipts.some((event) => event.type === 'buff'));
    for (const event of receipts) assert.equal('boonGeneration' in event, collect && event.type === 'buff');
    return result;
  });
  for (const result of runs.slice(1)) assert.equal(result.dps, runs[0].dps);
  for (const result of runs.slice(1, 3)) assert.deepEqual(result.boonCoverage, runs[0].boonCoverage);
  assert.equal(runs[0].boonGeneration.sustained.quickness.ally.percent, 25);
  assert.equal(runs[0].boonCoverage.quickness.allyPercent, (10 / 30) * 100);
  assert.equal(runs[1].boonGeneration, null);
});

// Classify transformed packets while preserving the full planned yield for either submission order.
test('transformed boon batches remain incomplete when a transform omits an application', () => {
  for (const order of ['effect', 'application']) {
    const result = observeGw2Runtime({
      profession: profession.runtimeFor({}),
      config: {},
      rotation: [{ type: 'combat-start' }, { type: 'wait', durationMs: 30000 }],
      engineInitialize(runtime) {
        for (const at of [0, 20])
          runtime.effects.emit({
            kind: 'profile',
            order,
            at,
            profile: { id: 'fixture', name: 'Fixture' },
            attribution: { source: 'Fixture', sourceId: 'fixture', actorType: 'player' },
            effects: [{ type: 'strike', coefficient: 1, applications: 2, intervalMs: 1000 }],
            transform: (event) =>
              event.at === at
                ? {
                    ...event,
                    type: 'buff',
                    kind: 'quickness',
                    duration: 5,
                    audience: { recipients: 'party' }
                  }
                : null
          });
      }
    });
    const sample = result.boonGeneration.sustained.quickness.ally;
    assert.equal(result.boonGeneration.boons.quickness.ally.generatedStackSeconds, 10);
    assert.equal(sample.percent, null);
    assert.equal(sample.sources[0].excludedIntervals, 1);
    assert.deepEqual(sample.sources[0].reasons, ['Incomplete activation yield']);
  }
});

test('cast lineage combines sibling effects and excludes an unfinished final pulse sequence only from the estimate', () => {
  const skill = {
    id: 990101,
    name: 'Pulse skill',
    castTimeMs: 0,
    effects: [
      {
        type: 'boon',
        boon: 'alacrity',
        duration: 2,
        applications: 2,
        intervalMs: 8000,
        audience: { recipients: 'party' }
      },
      { type: 'boon', boon: 'alacrity', duration: 1, atMs: 2000, audience: { recipients: 'party' } }
    ]
  };
  const family = defineTestProfession({
    id: 'cast-generation',
    name: 'Cast generation',
    catalog: createCanonicalCatalog({ skills: [skill] })
  });
  const result = observeGw2Runtime({
    profession: family.runtimeFor({}),
    config: {},
    collectBoonCoverage: true,
    rotation: [
      { type: 'combat-start' },
      ...[20000, 20000, 5000].flatMap((durationMs) => [
        { type: 'cast', skillId: skill.id },
        { type: 'wait', durationMs }
      ])
    ]
  });
  assert.equal(result.boonGeneration.sustained.alacrity.ally.percent, 25);
  assert.equal(result.boonGeneration.sustained.alacrity.ally.intervals, 2);
  assert.equal(result.boonGeneration.sustained.alacrity.ally.sources.length, 1);
  assert.equal(result.boonGeneration.boons.alacrity.ally.generatedStackSeconds, 13);
  assert.equal(result.boonCoverage.alacrity.allyPercent, (13 / 45) * 100);
});

test('cast-start, completion, and delayed grants share the accepted activation anchor', () => {
  // The builder supplies only cast identity, including after the reservation has completed.
  const starts = new Map();
  const skill = {
    id: 990102,
    name: 'Deferred grant',
    castTimeMs: 500,
    effects: [
      {
        type: 'boon',
        boon: 'quickness',
        duration: 1,
        atMs: 0,
        timingAnchor: 'castStart',
        audience: { recipients: 'party' }
      }
    ]
  };
  const emit = (runtime, activationId) =>
    runtime.effects.emit({
      kind: 'profile',
      profile: skill,
      at: runtime.time,
      cast: { activationId, skillId: skill.id },
      attribution: { source: 'Fixture', sourceId: skill.id, actorType: 'player' },
      effects: [{ type: 'boon', boon: 'quickness', duration: 2, audience: { recipients: 'party' } }]
    });
  const family = defineTestProfession({
    id: 'deferred-grant',
    name: 'Deferred grant',
    catalog: createCanonicalCatalog({ skills: [skill] }),
    hooks: {
      onCastStart(_runtime, cast) {
        starts.set(cast.id, cast.start);
      },
      onCastCommit(runtime, cast) {
        emit(runtime, cast.id);
        runtime.schedule('grant', runtime.time + 2, { activationId: cast.id });
      },
      tasks: {
        grant(runtime, { activationId }) {
          emit(runtime, activationId);
        }
      }
    }
  });
  const result = observeGw2Runtime({
    profession: family.runtimeFor({}),
    config: {},
    rotation: [
      { type: 'combat-start' },
      ...[10000, 5000].flatMap((durationMs) => [
        { type: 'cast', skillId: skill.id },
        { type: 'wait', durationMs }
      ])
    ]
  });
  const grants = result.resolvedEvents.filter((event) => event.type === 'buff');
  assert.ok(grants.every((event) => event.boonGeneration.at === starts.get(event.activationId)));
  const [[firstId, firstStart], [, secondStart]] = [...starts];
  const firstYield = grants
    .filter((event) => event.activationId === firstId)
    .reduce((sum, event) => sum + event.duration, 0);
  const sample = result.boonGeneration.sustained.quickness.ally;
  assert.equal(sample.intervals, 1);
  assert.equal(sample.percent, (firstYield / (secondStart - firstStart)) * 100);
});

test('profile expansion owns yield lineage and raw packets cannot inherit it from copied events', () => {
  const run = (profile) =>
    observeGw2Runtime({
      profession: profession.runtimeFor({}),
      config: {},
      rotation: [{ type: 'combat-start' }, { type: 'wait', durationMs: 45000 }],
      engineInitialize(runtime) {
        for (const at of [0, 20, 40]) {
          const event = grant(at, 5);

          if (profile)
            runtime.effects.emit({
              kind: 'profile',
              profile: { id: event.sourceId, name: 'Fixture' },
              at,
              attribution: { source: event.source, sourceId: event.sourceId, actorType: event.actorType },
              effects: [{ type: 'boon', boon: 'quickness', duration: 5, audience: event.audience }],
              // Even a transform cannot reuse an earlier activation's report metadata.
              transform: (packet) => ({ ...packet, boonGeneration: grant(0, 5).boonGeneration })
            });
          else runtime.effects.emit({ kind: 'packet', event });
        }
      }
    });
  const declared = run(true);
  const unknown = run(false);
  assert.equal(declared.boonGeneration.sustained.quickness.ally.percent, 25);
  assert.equal(unknown.boonGeneration.sustained.quickness.ally.percent, null);
  assert.ok(unknown.boonGeneration.sustained.quickness.ally.sources[0].reasons.includes('Missing activation lineage'));
  assert.deepEqual(declared.boonGeneration.boons, unknown.boonGeneration.boons);
});

// Computed profiles share cast attribution while independent procs retain their own occurrences.
test('computed profiles preserve cast ownership and independent proc occurrences', () => {
  const result = observeGw2Runtime({
    profession: profession.runtimeFor({}),
    config: {},
    rotation: [{ type: 'combat-start' }, { type: 'wait', durationMs: 45000 }],
    engineInitialize(runtime) {
      for (const at of [0, 20, 40]) {
        const copied = { ...grant(0, 3), at, activationId: 'permanent-owner' };
        runtime.effects.emit({
          kind: 'profile',
          profile: { id: 'skill', name: 'skill' },
          at,
          attribution: copied,
          effects: [{ type: 'boon', boon: 'quickness', duration: 3, audience: copied.audience }]
        });
        runtime.effects.emit({
          kind: 'profile',
          profile: { id: 'cast', name: 'cast' },
          at,
          attribution: { source: 'Fixture', sourceId: 'cast', actorType: 'player' },
          effects: [
            {
              type: 'boon',
              boon: 'quickness',
              duration: 1,
              applications: 2,
              intervalMs: 2000,
              audience: copied.audience
            }
          ],
          cast: { activationId: `cast:${at}`, skillId: 'cast' }
        });
      }
    }
  });
  const sources = result.boonGeneration.sustained.quickness.ally.sources;
  assert.equal(sources.find((source) => source.name === 'skill').percent, 15);
  assert.equal(sources.find((source) => source.name === 'cast').percent, 10);
  assert.ok(sources.every((source) => source.intervals === 2));
});

// Admission rejection and live preparation rejection finish yields without granting any duration.
for (const rejection of ['cast', 'immediate preparation', 'deferred preparation']) {
  test(`${rejection} settles rejected boon applications instead of leaving pending yields`, () => {
    const family = defineTestProfession({
      id: 'rejected-boon-fixture',
      name: 'Rejected boon fixture',
      hooks: {
        prepareEvent(_runtime, event) {
          return rejection !== 'cast' && event.duration === 10 ? null : event;
        }
      }
    });
    const result = observeGw2Runtime({
      profession: family.runtimeFor({}),
      config: {},
      rotation: [{ type: 'combat-start' }, { type: 'wait', durationMs: 45000 }],
      engineInitialize(runtime) {
        for (const at of [0, 20, 40])
          runtime.effects.emit({
            kind: 'profile',
            profile: { id: 'fixture', name: 'Fixture' },
            at,
            cast: { activationId: `cast:${at}`, skillId: 'fixture', effectiveEnd: at + 1 },
            attribution: { source: 'Fixture', sourceId: 'fixture', actorType: 'player' },
            effects:
              rejection === 'cast'
                ? [
                    {
                      type: 'boon',
                      boon: 'quickness',
                      duration: 2,
                      applications: 2,
                      intervalMs: 2000,
                      audience: { recipients: 'party' }
                    }
                  ]
                : [
                    { type: 'boon', boon: 'quickness', duration: 2, audience: { recipients: 'party' } },
                    {
                      type: 'boon',
                      boon: 'quickness',
                      name: 'Rejected',
                      duration: 10,
                      atMs: rejection === 'immediate preparation' ? 0 : 500,
                      audience: { recipients: 'party' }
                    }
                  ]
          });
      }
    });
    assert.equal(result.boonGeneration.sustained.quickness.ally.percent, 10);
    assert.deepEqual(result.boonGeneration.sustained.quickness.ally.sources[0].reasons, []);
    assert.equal(result.boonGeneration.boons.quickness.ally.generatedStackSeconds, 6);
  });
}

test('owner cancellation completes the cancelled yield and preserves later owner generations', () => {
  // Already applied duration survives cancellation; only the cancelled generation loses its pending grant.
  const family = defineTestProfession({
    id: 'owned-boon-fixture',
    name: 'Owned boon fixture',
    hooks: {
      initialize(runtime) {
        runtime.schedule('cancel', 1);
      },
      tasks: {
        cancel(runtime) {
          runtime.cancelOwner({ id: 'pool', generation: 0 });
        }
      }
    }
  });
  const result = observeGw2Runtime({
    profession: family.runtimeFor({}),
    config: {},
    rotation: [{ type: 'combat-start' }, { type: 'wait', durationMs: 50000 }],
    engineInitialize(runtime) {
      for (const at of [0, 20, 40])
        runtime.effects.emit({
          kind: 'profile',
          profile: { id: 'fixture', name: 'Fixture' },
          at,
          owner: { id: 'pool', generation: at === 0 ? 0 : 1 },
          attribution: { source: 'Fixture', sourceId: 'fixture', actorType: 'player' },
          effects: [
            {
              type: 'boon',
              boon: 'quickness',
              duration: 3,
              applications: 2,
              intervalMs: 8000,
              audience: { recipients: 'party' }
            }
          ]
        });
    }
  });
  assert.equal(result.boonGeneration.boons.quickness.ally.generatedStackSeconds, 15);
  assert.equal(result.boonGeneration.sustained.quickness.ally.percent, 22.5);
  assert.deepEqual(result.boonGeneration.sustained.quickness.ally.sources[0].reasons, []);
});

test('runtime profiles retain actual modified yields and independent recurring trait occurrences', () => {
  const run = (collectChartData) =>
    observeGw2Runtime({
      profession: profession.runtimeFor({}),
      collectChartData,
      collectBoonCoverage: true,
      config: { attributeInputs: baseAttributeInputs({ concentration: 1500 }) },
      rotation: [{ type: 'combat-start' }, { type: 'wait', durationMs: 45000 }],
      engineInitialize(runtime) {
        for (const at of [0, 20, 40]) {
          runtime.effects.emit({
            kind: 'profile',
            at,
            profile: {
              id: 'profile',
              name: 'Repeated proc',
              effects: [
                {
                  type: 'boon',
                  boon: 'quickness',
                  duration: 2,
                  applications: 2,
                  intervalMs: 2000,
                  audience: { recipients: 'party' }
                }
              ]
            },
            // Permanent summon lineage is deliberately shared; each proc emission must retain its own occurrence.
            attribution: { source: 'Trait', sourceId: 'trait', actorType: 'effect', activationId: 'permanent-summon' }
          });
        }
      }
    });
  const result = run(true);
  const plain = run(false);
  assert.deepEqual(result.boonCoverage, plain.boonCoverage);
  assert.equal(result.dps, plain.dps);
  assert.equal(result.boonGeneration.sustained.quickness.ally.percent, 40);
  assert.equal(result.boonGeneration.sustained.quickness.ally.intervals, 2);
  assert.equal(result.boonGeneration.boons.quickness.ally.generatedStackSeconds, 24);
  const track = result.effectReport.tracks.find((track) => track.kind === 'quickness');
  assert.equal(effectStateAt(result.effectReport, track, 44).expiresAt, 48);
});
