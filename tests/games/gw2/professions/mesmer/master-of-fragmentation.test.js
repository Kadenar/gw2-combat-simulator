import assert from 'node:assert/strict';
import test from 'node:test';
import { simulateMesmer } from '#tests/helpers/mesmer-simulation.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';

const wait = { name: '__wait', waitMs: 8000 };
const selectedTraitIds = [TRAIT.MASTER_OF_FRAGMENTATION];

// Isolated casts verify the trait's per-impact effects without depending on a saved rotation.
test('Fragmentation adds 25 percentage points to every F1 strike and respects the critical cap', () => {
  for (const [specialization, skill] of [
    ['Core', 'Mind Wrack'],
    ['Chronomancer', 'Split Second'],
    ['Virtuoso', 'Bladesong Harmony'],
    ['Troubadour', 'Lively Lute']
  ]) {
    for (const precision of [1000, 4000]) {
      for (const enabled of [false, true]) {
        const result = simulateMesmer([skill, wait], {
          specialization,
          initialResource: 3,
          selectedTraitIds: enabled ? selectedTraitIds : [],
          stats: { precision },
          boons: { fury: false }
        });
        const hits = result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillName === skill);
        assert.ok(hits.length, skill);
        for (const hit of hits) {
          assert.ok(Math.abs(hit.criticalChance - (precision === 4000 ? 1 : enabled ? 0.3 : 0.05)) < 1e-12, skill);
        }
      }
    }
  }
});

test('Fragmentation applies three seconds of Cripple per F2 impact only while selected', () => {
  for (const [specialization, skill] of [
    ['Core', 'Cry of Frustration'],
    ['Chronomancer', 'Rewinder'],
    ['Virtuoso', 'Bladesong Sorrow'],
    ['Troubadour', 'Flustering Flute']
  ]) {
    for (const enabled of [false, true]) {
      const result = simulateMesmer([skill, wait], {
        specialization,
        initialResource: 3,
        selectedTraitIds: enabled ? selectedTraitIds : [],
        stats: { expertise: 0 },
        target: { conditions: {} }
      });
      const hits = result.events.filter((event) => event.type === 'damage' && event.skillName === skill);
      const cripples = result.events.filter((event) => event.type === 'condition' && event.condition === 'Cripple');
      assert.ok(hits.length, skill);
      assert.deepEqual(
        cripples.map((event) => event.at),
        enabled ? hits.map((event) => event.at) : [],
        skill
      );
      assert.ok(
        cripples.every((event) => event.duration === 3 && event.stacks === 1),
        skill
      );
    }
  }
});

test('Fragmentation excludes afterimage critical chance and Cripple', () => {
  for (const skill of ['Lively Lute', 'Flustering Flute']) {
    const result = simulateMesmer([skill, wait], {
      specialization: 'Troubadour',
      initialResource: 3,
      selectedTraitIds: [...selectedTraitIds, TRAIT.CALL_AND_RESPONSE],
      stats: { precision: 1000 },
      boons: { fury: false }
    });
    const afterimages = result.resolvedEvents.filter(
      (event) => event.type === 'damage' && event.source === 'Afterimage'
    );
    assert.ok(afterimages.length);
    assert.ok(afterimages.every((event) => Math.abs(event.criticalChance - 0.05) < 1e-12));
    assert.ok(!result.events.some((event) => event.condition === 'Cripple' && event.actorType === 'summon'));
  }
});

test('Fragmentation adds provisional three-second Weakness to Drum without duplicating it for Syncopate or afterimages', () => {
  for (const enabled of [false, true]) {
    const result = simulateMesmer(['Deafening Drum', wait], {
      specialization: 'Troubadour',
      initialResource: 3,
      selectedTraitIds: [TRAIT.SYNCOPATE, TRAIT.CALL_AND_RESPONSE, ...(enabled ? selectedTraitIds : [])],
      stats: { expertise: 0 },
      target: { conditions: {} }
    });
    const hit = result.events.find(
      (event) => event.type === 'damage' && event.skillName === 'Deafening Drum' && event.actorType === 'player'
    );
    const weakness = result.events.filter((event) => event.type === 'condition' && event.condition === 'Weakness');
    assert.deepEqual(
      weakness.map(({ at, duration, stacks }) => ({ at, duration, stacks })),
      enabled ? [{ at: hit.at, duration: 3, stacks: 1 }] : []
    );
  }
});

test('Fragmentation adds one second to Continuum Split regardless of clone count and delays automatic restoration', () => {
  for (const initialResource of [0, 3]) {
    for (const enabled of [false, true]) {
      const result = simulateMesmer(['Continuum Split', wait], {
        specialization: 'Chronomancer',
        initialResource,
        selectedTraitIds: enabled ? selectedTraitIds : []
      });
      const shift = result.events.find((event) => event.type === 'marker' && event.name === 'Continuum Shift');
      assert.equal(shift.at, 1.5 * (initialResource + 1) + Number(enabled));
      assert.equal(result.endState.profession.continuumActive, false);
    }
  }
});

test('Fragmentation appends one Requiem pulse without changing existing pulses or blade spend', () => {
  for (const initialResource of [1, 5]) {
    const config = { specialization: 'Virtuoso', initialResource };
    const baseline = simulateMesmer(['Bladeturn Requiem', wait], config);
    const improved = simulateMesmer(['Bladeturn Requiem', wait], { ...config, selectedTraitIds });
    const pulses = (result) =>
      result.events
        .filter((event) => event.type === 'damage' && event.skillName === 'Bladeturn Requiem')
        .map(({ at, coefficient }) => ({ at, coefficient }));
    const original = pulses(baseline);
    const extended = pulses(improved);
    assert.deepEqual(extended.slice(0, -1), original);
    assert.deepEqual(extended.at(-1), { at: original.at(-1).at + 1, coefficient: original.at(-1).coefficient });
    assert.equal(improved.endState.profession.resource, baseline.endState.profession.resource);
  }
});

test('Fragmentation raises Crescendo effectiveness to 30 percent per active instrument', () => {
  for (const instruments of [[], ['Lively Lute'], ['Lively Lute', 'Flustering Flute']]) {
    for (const enabled of [false, true]) {
      const result = simulateMesmer([...instruments, 'Crescendo', wait], {
        specialization: 'Troubadour',
        initialResource: 3,
        selectedTraitIds: enabled ? selectedTraitIds : []
      });
      const hit = result.events.find((event) => event.type === 'damage' && event.skillName === 'Crescendo');
      assert.equal(hit.coefficient, 2.25 * (1 + instruments.length * (enabled ? 0.3 : 0.25)));
    }
  }
});
