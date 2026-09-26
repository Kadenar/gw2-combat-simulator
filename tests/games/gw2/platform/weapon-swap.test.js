import { createCanonicalCatalog } from '#gw2/platform/engine/skills/canonical-skill-catalog.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { defineProfession } from '#gw2/platform/engine/profession/contract.js';
import { defaultSimulationConfig } from '#tests/helpers/fixture-harness-core.js';
import { simulateMesmer } from '#tests/helpers/mesmer-simulation.js';
const gw2WeaponSwapSkill = { id: -3, name: 'Swap Weapons', inputCategory: 'weapon-swap', castTimeMs: 0, effects: [] };

test('shared weapon swap commits canonical state and event before profession extensions', () => {
  const observed = [];
  const profession = defineProfession({
    id: 'swap-fixture',
    name: 'Swap fixture',
    catalog: createCanonicalCatalog({ generated: [gw2WeaponSwapSkill] }),
    resources: {
      createState: () => ({ core: { autoattackChains: { 100: 101 } }, specialization: { kind: 'Core', state: {} } })
    },
    live: {
      onCastComplete(runtime, cast) {
        observed.push([runtime.activeWeaponSet, { ...runtime.profession.core.autoattackChains }, cast.skill.id]);
      }
    }
  });
  const result = simulateGw2({ profession, rotation: ['Swap Weapons'] });
  assert.deepEqual(observed, [[2, {}, gw2WeaponSwapSkill.id]]);
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
  assert.equal(precombat.planningState.cooldowns['Swap Weapons'], undefined);

  const inCombat = simulateMesmer(['__combat_start', 'Swap Weapons', 'Swap Weapons'], config);

  assert.deepEqual(
    inCombat.steps.filter((step) => step.skill === 'Swap Weapons').map((step) => step.start),
    [0, 10000]
  );
  assert.equal(inCombat.planningState.activeWeaponSet, 1);
  assert.equal(inCombat.planningState.cooldowns['Swap Weapons'].readyAt, 20000);
});
