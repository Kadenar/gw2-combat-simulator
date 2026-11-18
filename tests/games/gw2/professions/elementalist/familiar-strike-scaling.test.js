// Native and Procession strikes share familiar strength but retain player attributes and critical-hit rules.
import assert from 'node:assert/strict';
import test from 'node:test';

import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { elementalistProfession } from '#gw2/professions/elementalist/profession.js';

const familiars = [
  { id: ID.CONFLAGRATION, element: 'Fire', coefficient: 0.67 },
  { id: ID.LIGHTNING_BLITZ, element: 'Air', coefficient: 0.122 },
  { id: ID.SEISMIC_IMPACT, element: 'Earth', coefficient: 0.7238 }
];

for (const source of ['native', 'procession']) {
  test(`${source} familiar strikes use summon strength with player Power and Ferocity`, () => {
    for (const { id, element, coefficient } of familiars) {
      for (const power of [1000, 2000]) {
        const result = simulateGw2({
          profession: elementalistProfession,
          rotation: [
            { type: 'cast', skillId: source === 'native' ? id : ID.ELEMENTAL_PROCESSION },
            { type: 'wait', durationMs: 5000 }
          ],
          config: {
            specialization: 'Evoker',
            selectedTraitIds: [],
            primaryWeapon: 'Scepter',
            secondaryWeapon: 'Dagger',
            startAttunement: element,
            evokerElement: element,
            initialEvokerEmpowered: 3,
            attributeInputs: baseAttributeInputs({ power, precision: 0, ferocity: 750 }),
            boons: {},
            target: { armor: 2597, health: 1000000, conditions: {} },
            randomness: { mode: 'deterministic', seed: 1 }
          },
          collectChartData: false
        });
        assert.deepEqual(result.warnings, []);
        const strikes = result.resolvedEvents.filter(
          (event) => event.type === 'damage' && event.skillId === id && !event.procType
        );
        assert.ok(strikes.length > 0);
        const forcedCritical = id === ID.LIGHTNING_BLITZ;
        for (const strike of strikes) {
          assert.equal(strike.actorType, 'player');
          assert.equal(strike.weaponStrengthProfileId, 'summon.weapon-type-1');
          assert.equal(strike.resolvedWeaponStrength, 2553.5);
          assert.equal(strike.coefficient, coefficient);
          assert.equal(strike.criticalChance, forcedCritical ? 1 : 0);
          assert.equal(strike.didCrit, forcedCritical);
          assert.equal(strike.damage, Math.floor((power * 2553.5 * coefficient * (forcedCritical ? 2 : 1)) / 2597));
        }
      }
    }
  });
}
