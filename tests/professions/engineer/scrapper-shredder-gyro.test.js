import assert from 'node:assert/strict';
import test from 'node:test';

import { simulateGw2 } from '../../../js/platform/gw2/simulation/simulate.js';
import { engineerCatalog } from '../../../js/professions/engineer/catalog.js';
import { engineerProfession } from '../../../js/professions/engineer/definition.js';

const baseConfig = Object.freeze({
  specialization: 'Scrapper',
  selectedSkills: ['Healing Turret', 'Shredder Gyro', 'Throw Mine', 'Rifle Turret', 'Supply Crate'],
  stats: { power: 1000, precision: 1000, ferocity: 0 },
  target: { armor: 2597 }
});

function simulate(quickness) {
  return simulateGw2({
    profession: engineerProfession,
    rotation: ['Shredder Gyro'],
    config: { ...baseConfig, boons: { quickness } },
    observationPolicy: { kind: 'tail', durationMs: 7000 }
  });
}

test('Shredder Gyro uses its measured coefficient and fixed damage cadence', () => {
  const skill = engineerCatalog.skillsByName.get('Shredder Gyro');
  const strike = skill.effects.find((effect) => effect.type === 'strike');

  assert.equal(skill.quicknessCastTimeMs, 520);
  assert.equal(skill.castTimeMs, 780);
  assert.equal(strike.coefficient, 4.8);
  assert.equal(strike.hits, 12);
  assert.equal(strike.atMs, 360);
  assert.equal(strike.intervalMs, 520);
  assert.equal(strike.timingAnchor, 'castEnd');
  assert.equal(strike.timingScale, 'fixed');

  // The EVTC packet cadence belongs to the deployed gyro and therefore stays fixed across cast-speed states.
  for (const [quickness, expectedCastMs] of [
    [true, 520],
    [false, 780]
  ]) {
    const result = simulate(quickness);
    const step = result.steps.find((candidate) => candidate.skill === 'Shredder Gyro');
    const hits = result.resolvedEvents.filter((event) => event.type === 'damage' && event.name === 'Shredder Gyro');

    assert.equal(step.end - step.start, expectedCastMs);
    assert.equal(hits.length, 12);
    assert.ok(hits.every((event) => Math.abs(event.coefficient - 0.4) < 1e-12));
    assert.deepEqual(
      hits.map((event) => Math.round(event.at * 1000 - step.end)),
      [360, 880, 1400, 1920, 2440, 2960, 3480, 4000, 4520, 5040, 5560, 6080]
    );
  }
});
