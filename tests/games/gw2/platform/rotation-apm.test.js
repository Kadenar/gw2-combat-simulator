import assert from 'node:assert/strict';
import test from 'node:test';
import { createCanonicalCatalog } from '#gw2/platform/engine/skills/canonical-skill-catalog.js';
import { isAutoattackSkill } from '#gw2/platform/engine/skills/autoattack-chains.js';
import { defineProfession } from '#gw2/platform/engine/profession/contract.js';
import { createScheduler } from '#gw2/platform/execution/scheduler.js';
import { rotationApm } from '#gw2/platform/results/rotation-apm.js';
import { simulateDeclarativeGw2 } from '#gw2/platform/simulation/pipeline.js';
import { testProfession } from '#tests/fixtures/profession.js';

// Minimal commands isolate input accounting from damage formulas and saved benchmark rotations.
const catalog = createCanonicalCatalog({
  generated: [
    { id: 980001, name: 'Auto one', type: 'Weapon', slot: 'Weapon_1', nextChainId: 980002, castTimeMs: 1000 },
    { id: 980002, name: 'Auto two', type: 'Weapon', slot: 'Weapon_1', castTimeMs: 1000 },
    { id: 980003, name: 'Replacement', slot: 'Weapon_1', castTimeMs: 600 },
    { id: 980004, name: 'Instant', castTimeMs: 0 },
    { id: 980005, name: 'Ammo', castTimeMs: 0, ammo: 2, ammoRecharge: 10 },
    { id: 980006, name: 'Swap', castTimeMs: 0, inputCategory: 'weapon-swap' },
    { id: 980007, name: 'Bar', castTimeMs: 0, inputCategory: 'bar-swap' },
    { id: 980008, name: 'Initial', castTimeMs: 0, initialStateOnly: true },
    { id: 980009, name: 'Pet command', castTimeMs: 1000, independentCast: true },
    { id: 980010, name: 'Standalone auto', castTimeMs: 1000, autoattack: true },
    {
      id: 980011,
      name: 'Channel',
      castTimeMs: 1000,
      effects: [{ type: 'strike', ticks: [200, 500, 900].map((atMs) => ({ atMs, coefficient: 1 })) }]
    }
  ]
});
const profession = defineProfession({ id: 'apm-fixture', name: 'APM fixture', catalog });

function analyze(rotation, options = {}) {
  const scheduled = createScheduler({ profession, ...options }).run(rotation);
  return { scheduled, metrics: rotationApm(scheduled, rotation, catalog, options.startingTime ?? 0) };
}

test('150 executed inputs over 90 seconds give unrounded 100 APM', () => {
  const { metrics } = analyze(Array(150).fill('Replacement'));
  assert.equal(metrics.actionCount, 150);
  assert.ok(Math.abs(metrics.durationSeconds - 90) < 1e-9);
  assert.ok(Math.abs(metrics.apm - 100) < 1e-9);
  assert.ok(Math.abs(analyze(['Replacement', { type: 'wait', durationMs: 1100 }]).metrics.apm - 60 / 1.7) < 1e-10);
});

test('auto chains and standalone autos are excluded; replacements, waits, and autos keep their execution time', () => {
  const { metrics } = analyze([
    'Auto one',
    'Auto two',
    'Standalone auto',
    'Replacement',
    { type: 'wait', durationMs: 1400 }
  ]);
  assert.equal(metrics.actionCount, 1);
  assert.equal(metrics.autoattackCount, 3);
  assert.equal(metrics.autoattackTimeSeconds, 3);
  assert.equal(metrics.durationSeconds, 5);
  assert.equal(metrics.apm, 12);
});

test('non-damaging, concurrent, ammo, bar, weapon and manual pet inputs each count once', () => {
  const { metrics } = analyze([
    'Replacement',
    { name: 'Instant', offset: 0 },
    { name: 'Ammo', offset: 0 },
    { name: 'Ammo', offset: 0 },
    { name: 'Swap', offset: 0 },
    { name: 'Bar', offset: 0 },
    { name: 'Pet command', offset: 0 }
  ]);
  assert.equal(metrics.actionCount, 7);
  assert.equal(metrics.instantActionCount, 5);
  assert.equal(metrics.weaponSwapCount, 1);
  assert.equal(metrics.barSwapCount, 1);
  assert.equal(metrics.castingTimeSeconds, 0.6);
  assert.equal(metrics.durationSeconds, 1);
});

test('multi-hit effects, passive activations and duplicate scheduler records cannot inflate input counts', () => {
  const rotation = ['Channel'];
  const { scheduled } = analyze(rotation);
  const duplicated = {
    steps: [...scheduled.steps, ...scheduled.steps, { ...scheduled.steps[0], ri: 50, activationId: 'effect:1' }],
    stream: {
      ...scheduled.stream,
      events: [...scheduled.stream.events, { type: 'action', activationId: 'effect:1', skillId: 980011, at: 0.5 }]
    }
  };
  assert.equal(rotationApm(duplicated, rotation, catalog).actionCount, 1);
});

test('an interrupted activation and its explicit swap count, but invalid and synthetic records do not', () => {
  const { scheduled, metrics } = analyze([
    { name: 'Replacement', interruptMs: 0 },
    'Swap',
    'Unknown command',
    'Initial',
    { name: 'Instant', initialStateDurationMs: 500 },
    '__cooldown_reset',
    { type: 'wait', durationMs: 1000 }
  ]);
  assert.equal(scheduled.steps[0].interrupted, true);
  assert.equal(scheduled.steps[2].invalid, true);
  assert.equal(metrics.actionCount, 2);
  assert.equal(metrics.apm, 120);
  assert.equal(analyze([{ name: 'Replacement', interruptMs: 100 }]).metrics.actionCount, 1);
});

test('combat-start excludes precasts, includes carried cast time, and ignores observation tails', () => {
  const rotation = [
    'Channel',
    { type: 'combat-start', concurrentOffsetMs: 500 },
    'Instant',
    { type: 'wait', durationMs: 500 }
  ];
  for (const observationPolicy of [{ kind: 'rotation' }, { kind: 'tail', durationMs: 10000 }]) {
    const { metrics } = analyze(rotation, { observationPolicy });
    assert.equal(metrics.actionCount, 1);
    assert.equal(metrics.durationSeconds, 1);
    assert.equal(metrics.castingTimeSeconds, 0.5);
    assert.equal(metrics.apm, 60);
  }

  assert.ok(Math.abs(analyze(['Replacement'], { startingTime: 5 }).metrics.durationSeconds - 0.6) < 1e-10);
});

test('fractional marker boundaries use exact activation seconds instead of rounded display timestamps', () => {
  const { metrics } = analyze([
    { type: 'wait', durationMs: 1000 / 3 },
    '__combat_start',
    'Instant',
    { type: 'wait', durationMs: 1000 }
  ]);
  assert.equal(metrics.actionCount, 1);
  assert.equal(metrics.durationSeconds, 1);
});

test('empty, zero-duration, endpoint instant, and autoattack-only rotations have finite accounting', () => {
  assert.equal(analyze([]).metrics.apm, null);
  const instant = analyze(['Instant']).metrics;
  assert.equal(instant.actionCount, 1);
  assert.equal(instant.apm, null);
  assert.equal(analyze(['Auto one']).metrics.apm, 0);
  assert.equal(analyze([{ type: 'wait', durationMs: 1000 }, 'Instant']).metrics.apm, 60);
});

test('rolling 5s and 10s windows report sustained peaks with their actual timestamps', () => {
  const rotation = [
    { type: 'wait', durationMs: 7500 },
    ...Array(6).fill('Instant'),
    { type: 'wait', durationMs: 4000 },
    ...Array(6).fill('Instant'),
    { type: 'wait', durationMs: 8500 }
  ];
  const { metrics } = analyze(rotation);
  assert.deepEqual(metrics.peak5s, { startSeconds: 7.5, endSeconds: 12.5, actionCount: 12, apm: 144 });
  assert.deepEqual(metrics.peak10s, { startSeconds: 7.5, endSeconds: 17.5, actionCount: 12, apm: 72 });
  assert.equal(analyze(['Replacement']).metrics.peak5s, null);
  assert.equal(analyze([{ type: 'wait', durationMs: 5000 }]).metrics.peak10s, null);
  assert.equal(analyze(Array(10).fill('Standalone auto')).metrics.peak10s.apm, 0);
});

test('rolling windows respect exact edges and keep the final window inside execution', () => {
  const { metrics } = analyze([
    'Instant',
    { type: 'wait', durationMs: 5000 },
    'Instant',
    { type: 'wait', durationMs: 5000 },
    'Instant'
  ]);
  assert.deepEqual(metrics.peak5s, { startSeconds: 5, endSeconds: 10, actionCount: 2, apm: 24 });
  assert.deepEqual(metrics.peak10s, { startSeconds: 0, endSeconds: 10, actionCount: 3, apm: 18 });
});

test('canonical autoattack metadata covers kits, transformed bars and manual replacements across professions', async () => {
  const cases = {
    elementalist: [
      [5491, 71929],
      [71907, 71857, -1264, 71796]
    ],
    engineer: [[5842, 5882, 5928, 30521], [5812]],
    guardian: [[9122, 51660, 51645, 76982], [41258]],
    mesmer: [
      [10219, 62510],
      [44241, 73067]
    ],
    necromancer: [[10554, 62611, 77061], [10574]],
    ranger: [
      [31796, 77183],
      [76664, 63438]
    ],
    revenant: [[28549, 73015], [-4]],
    thief: [
      [41422, 40710, 63362],
      [13115, 44087]
    ],
    warrior: [[14431, 72958], [62797]]
  };
  for (const [name, [autos, manual]] of Object.entries(cases)) {
    const canonical = (await import(`#gw2/professions/${name}/catalog.js`))[`${name}Catalog`];
    for (const id of autos)
      assert.equal(isAutoattackSkill(canonical, canonical.skillsById.get(id)), true, `${name}: ${id}`);
    for (const id of manual)
      assert.equal(isAutoattackSkill(canonical, canonical.skillsById.get(id)), false, `${name}: ${id}`);
  }
});

test('detailed pipeline exposes input metrics independently of the damage observation duration', () => {
  const result = simulateDeclarativeGw2({
    profession: testProfession,
    rotation: ['Fixture Slash'],
    observationPolicy: { kind: 'tail', durationMs: 5000 }
  });
  assert.equal(result.rotationApm.actionCount, 1);
  assert.equal(result.rotationApm.durationSeconds, 1);
  assert.equal(result.rotationApm.apm, 60);
});
