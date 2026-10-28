import assert from 'node:assert/strict';
import test from 'node:test';

import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { mesmerCatalog } from '#gw2/professions/mesmer/catalog.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { simulateMesmer } from '#tests/helpers/mesmer-simulation.js';

const wait = { name: '__wait', waitMs: 8000 };
const selectedTraitIds = [TRAIT.MASTER_OF_FRAGMENTATION];

test('Fragmentation excludes afterimage critical chance and Cripple', () => {
  for (const skill of ['Lively Lute', 'Flustering Flute']) {
    const result = simulateMesmer(
      [
        skill === 'Harmonious Harp' ? 77077 : mesmerCatalog.skills.find((candidate) => candidate.name === skill).id,
        wait
      ],
      {
        specialization: 'Troubadour',
        initialResource: 3,
        selectedTraitIds: [...selectedTraitIds, TRAIT.CALL_AND_RESPONSE],
        attributeInputs: baseAttributeInputs({ precision: 1000 }),
        boons: { fury: false }
      }
    );
    const afterimages = result.resolvedEvents.filter(
      (event) => event.type === 'damage' && event.source === 'Afterimage'
    );
    assert.ok(afterimages.length);
    assert.ok(afterimages.every((event) => Math.abs(event.criticalChance - 0.05) < 1e-12));
    assert.ok(!result.events.some((event) => event.condition === 'Crippled' && event.actorType === 'summon'));
  }
});
