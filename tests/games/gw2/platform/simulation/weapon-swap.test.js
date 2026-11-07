import assert from 'node:assert/strict';
import test from 'node:test';

import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import { defaultSimulationConfig } from '#tests/helpers/fixture-harness-core.js';
import { simulateMesmer } from '#tests/helpers/mesmer-simulation.js';
import { defineTestProfession } from '#tests/helpers/profession.js';

const gw2WeaponSwapSkill = { id: -3, name: 'Swap Weapons', inputCategory: 'weapon-swap', castTimeMs: 0, effects: [] };

test('shared weapon swap commits canonical state and event before profession extensions', () => {
  const observed = [];
  const profession = defineTestProfession({
    id: 'swap-fixture',
    name: 'Swap fixture',
    catalog: createCanonicalCatalog({
      skills: [gw2WeaponSwapSkill, { id: 100, name: 'Root', effects: [] }, { id: 101, name: 'Next', effects: [] }],
      autoattackChains: [[100, 101]]
    }),
    hooks: {
      onCastCommit(runtime, cast) {
        // The swap must reset progress before profession extensions observe its commitment.
        observed.push([runtime.activeWeaponSet, runtime.autoattackController.read(100), cast.skill.id]);
      }
    }
  });
  const result = simulateGw2({ profession, rotation: ['Root', 'Swap Weapons'] });
  assert.deepEqual(observed, [
    [1, 101, 100],
    [2, 100, gw2WeaponSwapSkill.id]
  ]);
  assert.equal(result.events.find((event) => event.type === 'weapon_set').weaponSet, 2);
});

test('weapon swap only starts its cooldown in combat', () => {
  const config = defaultSimulationConfig({
    specialization: 'Core',
    initialResource: 0,
    primaryWeapon: 'Scepter',
    secondaryWeapon: 'Sword',
    weaponSet2Primary: 'Spear',
    weaponSet2Secondary: ''
  });
  const precombat = simulateMesmer(['Swap Weapons', 'Swap Weapons'], config);

  assert.deepEqual(
    precombat.steps.map((step) => step.start),
    [0, 0]
  );
  assert.equal(precombat.planningState.activeWeaponSet, 1);
  assert.equal(precombat.planningState.cooldownsBySkillId[-3], undefined);

  const inCombat = simulateMesmer(['__combat_start', 'Swap Weapons', 'Swap Weapons'], config);

  assert.deepEqual(
    inCombat.steps.filter((step) => step.skillName === 'Swap Weapons').map((step) => step.start),
    [0, 10000]
  );
  assert.equal(inCombat.planningState.activeWeaponSet, 1);
  assert.equal(inCombat.planningState.cooldownsBySkillId[-3].readyAtMs, 20000);
});
