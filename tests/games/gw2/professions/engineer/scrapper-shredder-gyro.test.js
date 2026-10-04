import { withSkill } from '#tests/helpers/catalog-overrides.js';
import assert from 'node:assert/strict';
import test from 'node:test';

import { runGw2Runtime } from '#gw2/platform/simulation/runtime.js';
import { engineerProfession } from '#gw2/professions/engineer/profession.js';

const baseConfig = Object.freeze({
  specialization: 'Scrapper',
  selectedSkillIds: [5857, 29921, 6161, 5933, 5868],
  stats: { power: 1000, precision: 1000, ferocity: 0 },
  target: { armor: 2597 }
});

function simulate(quickness) {
  const config = { ...baseConfig, boons: { quickness } };
  const native = engineerProfession.runtimeFor(config);
  const skill = native.catalog.skillsByName.get('Shredder Gyro');
  return runGw2Runtime({
    profession: {
      ...native,
      catalog: withSkill(native.catalog, skill.id, {
        castTimeMs: 400,
        effects: skill.effects.map((effect) =>
          effect.type === 'strike'
            ? {
                ...effect,
                ticks: [
                  { atMs: 120, coefficient: 0.2 },
                  { atMs: 520, coefficient: 0.3 }
                ]
              }
            : effect
        )
      })
    },
    rotation: ['Shredder Gyro'],
    config,
    observation: { kind: 'tail', durationMs: 1000 }
  });
}

// Controlled pulses verify cast-end anchoring and fixed deployment timing without copying live calibration.
test('Shredder Gyro resolves deployed pulses independently of player boons', () => {
  for (const quickness of [true, false]) {
    const result = simulate(quickness);
    const step = result.steps.find((candidate) => candidate.skill === 'Shredder Gyro');
    const hits = result.resolvedEvents.filter((event) => event.type === 'damage' && event.name === 'Shredder Gyro');
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(
      hits.map((event) => [Math.round(event.at * 1000 - step.end), event.coefficient]),
      [
        [120, 0.2],
        [520, 0.3]
      ]
    );
  }
});
