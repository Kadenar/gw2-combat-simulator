import assert from 'node:assert/strict';
import test from 'node:test';

import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { defaultSimulationConfig } from '../../helpers/fixture-harness-core.js';

test('Flamestrike interruptions retain only committed strike packets', () => {
  // The first packet commits at 320 ms; the second, later packet only commits at 520 ms.
  const defaults = defaultSimulationConfig();
  const config = defaultSimulationConfig({
    specialization: 'Core',
    primaryWeapon: 'Scepter',
    startAttunement: 'Fire',
    boons: { ...defaults.boons, quickness: false }
  });
  for (const [interruptAfterMs, expectedHits] of [
    [300, 0],
    [401, 1],
    [440, 1],
    [480, 1],
    [520, 2]
  ]) {
    const result = simulateGw2({
      profession: elementalistProfession,
      rotation: [{ type: 'cast', skillId: ID.FLAMESTRIKE, interruptAfterMs }],
      config,
      observationPolicy: { kind: 'tail', durationMs: 3000 }
    });

    assert.equal(
      result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillId === ID.FLAMESTRIKE).length,
      expectedHits,
      `${interruptAfterMs} ms interruption`
    );
  }
});
