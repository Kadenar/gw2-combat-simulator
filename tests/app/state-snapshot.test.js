import assert from 'node:assert/strict';
import test from 'node:test';
import { criticalChanceTooltip, rotationStateSnapshot } from '#gw2/app/rotation/state-snapshot/model.js';
import { thiefProfession } from '#gw2/professions/thief/definition.js';
import { mesmerProfession } from '#gw2/professions/mesmer/definition.js';
import { MESMER_TRAIT_IDS as MESMER_TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';

test('critical chance tooltips list contributors and cap behavior', () => {
  const event = {
    type: 'damage',
    at: 1,
    actorType: 'player',
    criticalChance: 1,
    criticalChanceBeforeCap: 1.0371,
    criticalChanceContributors: [
      { id: 'precision', label: 'Precision', amount: 0.4371 },
      { id: 'fury', label: 'Fury', amount: 0.25 },
      {
        id: 'necromancer.death-perception-critical-chance',
        label: 'Death Perception',
        amount: 0.15
      },
      {
        id: 'necromancer.target-the-weak-critical-chance',
        label: 'Target the Weak',
        amount: 0.2
      }
    ]
  };

  assert.equal(
    criticalChanceTooltip(event, 'Critical strike chance'),
    [
      'Critical strike chance',
      'Precision: 43.71%',
      'Fury: +25%',
      'Death Perception: +15%',
      'Target the Weak: +20%',
      'Before cap: 103.71%',
      'Final: 100%'
    ].join('\n')
  );
});

// Cursor snapshots must use only buffs already granted, including refreshes and elapsed precast windows.
test('active state shows one countdown per active relic and ignores future, expired, and untimed procs', () => {
  const proc = (skill, start, expiresAt, type = 'relic_proc') => ({ skill, start, expiresAt, type });
  const app = {
    build: { relic: 'Claw', rotation: ['a', 'b'] },
    results: {
      duration: 15,
      endState: { time: 15000 },
      procSteps: [
        proc('Relic of the Claw', 8000, 16000),
        proc('Relic of the Claw', 0, 8000),
        proc('Relic of the Claw', 2000, 10000),
        proc('Relic of the Director', -2000, 4000),
        proc('Relic of Akeem', 1000),
        proc('Sigil of Test', 0, 10000, 'sigil_proc')
      ]
    },
    adapter: { eliteSpecialization: () => 'Core', rotationEndStateAt: () => ({ time: 3000 }) },
    profession: { ui: { rotationStateSnapshot: () => [] } },
    rotationInsertionIndex: 1
  };
  const snapshot = rotationStateSnapshot(app);
  assert.equal(snapshot.atInsertion, true);
  assert.deepEqual(
    snapshot.items.map(({ label, value }) => [label, value]),
    [
      ['Relic of the Claw', '7.0s'],
      ['Relic of the Director', '1.0s']
    ]
  );
  app.rotationInsertionIndex = null;
  assert.equal(rotationStateSnapshot(app).items[0].value, '1.0s');
  app.results.endState.time = 16000;
  app.results.duration = 16;
  assert.deepEqual(rotationStateSnapshot(app).items, []);
  app.results = null;
  assert.deepEqual(rotationStateSnapshot(app).items, []);
});

test('Deadeye cantrip relic windows reach the shared active-state display and expire', () => {
  for (const waitMs of [0, 8000]) {
    const result = simulateGw2({
      profession: thiefProfession,
      rotation: ['Shadow Gust', { type: 'wait', durationMs: waitMs }],
      config: {
        specialization: 'Deadeye',
        relic: 'Deadeye',
        selectedSkills: ['Shadow Gust'],
        primaryWeapon: 'Rifle'
      }
    });
    assert.deepEqual(result.warnings, []);
    const { items } = rotationStateSnapshot({
      build: { relic: 'Deadeye', rotation: ['Shadow Gust', '__wait'] },
      results: result,
      profession: thiefProfession,
      adapter: { eliteSpecialization: () => 'Deadeye' }
    });
    assert.equal(items.find((item) => item.id === 'relic:Relic of the Deadeye')?.value, waitMs ? undefined : '8.0s');
  }
});

// Conversion countdowns follow the actual scheduled grants, including separate entities, repeats, and cursor history.
test('Chronomancer active state shows only pending conversions from phantasms already summoned', () => {
  const result = simulateGw2({
    profession: mesmerProfession,
    rotation: ['Phantasmal Warlock', { type: 'wait', durationMs: 12000 }],
    config: {
      specialization: 'Chronomancer',
      selectedTraitIds: [MESMER_TRAIT.CHRONOPHANTASMA],
      primaryWeapon: 'Staff',
      initialResource: 0
    }
  });
  const summon = result.events.find((event) => event.type === 'mesmer.phantasm-summoned');
  const conversions = result.events.filter(
    (event) => event.type === 'resource' && event.reason === 'Phantasmal Warlock phantasm conversion'
  );
  assert.deepEqual(
    summon.conversionTimes,
    conversions.map((event) => event.at)
  );
  const snapshot = (at) =>
    rotationStateSnapshot({
      build: { rotation: ['Phantasmal Warlock', '__wait'] },
      results: result,
      profession: mesmerProfession,
      rotationInsertionIndex: 1,
      adapter: {
        eliteSpecialization: () => 'Chronomancer',
        rotationEndStateAt: () => ({ time: at * 1000, profession: {} })
      }
    }).items.filter((item) => item.id.startsWith('chronomancer-phantasm:'));

  assert.deepEqual(snapshot(summon.at - 0.1), []);
  const [pending] = snapshot(summon.at);
  assert.equal(pending.label, 'Phantasmal Warlock → clone');
  assert.equal(pending.value, conversions.map((event) => `${(event.at - summon.at).toFixed(3)}s`).join(', '));
  const between = (conversions[0].at + conversions[1].at) / 2;
  assert.equal(snapshot(between)[0].value, `${(conversions[1].at - between).toFixed(3)}s`);
  assert.deepEqual(snapshot(conversions[1].at + 0.1), []);
});
