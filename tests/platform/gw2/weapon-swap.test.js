import assert from 'node:assert/strict';
import test from 'node:test';
import { defineProfession } from '#gw2/platform/engine/profession/contract.js';
import { gw2WeaponSwapSkillHandler } from '#gw2/platform/equipment/weapons/swap.js';
import { defaultSimulationConfig } from '../../helpers/fixture-harness-core.js';
import { simulateMesmer } from '../../helpers/mesmer-simulation.js';

test('shared weapon swap commits canonical state and event before profession extensions', () => {
  const events = [];
  const hookObservations = [];
  const profession = defineProfession({
    id: 'test-profession',
    name: 'Test Profession',
    schedulerHooks: {
      onWeaponSwap(context, skill) {
        hookObservations.push({
          weaponSet: context.state.activeWeaponSet,
          autoattackChains: { ...context.state.profession.core.autoattackChains },
          eventCount: events.length,
          skillId: skill.id
        });
      }
    }
  });
  const context = {
    profession,
    effectiveEnd: 3.25,
    state: {
      activeWeaponSet: 1,
      profession: {
        core: { autoattackChains: { 100: 101 } },
        specialization: { kind: 'Core', state: {} }
      }
    },
    emit(event) {
      events.push(event);
      return event;
    }
  };
  const skill = { id: -3, name: 'Swap Weapons' };

  const handled = gw2WeaponSwapSkillHandler.beforeEffects(context, skill);

  assert.equal(handled, true);
  assert.equal(context.state.activeWeaponSet, 2);
  assert.deepEqual(context.state.profession.core.autoattackChains, {});
  assert.deepEqual(events, [
    {
      type: 'weapon_set',
      at: 3.25,
      source: 'test-profession',
      sourceId: -3,
      actorType: 'player',
      skillId: -3,
      skillName: 'Swap Weapons',
      weaponSet: 2
    }
  ]);
  assert.deepEqual(hookObservations, [{ weaponSet: 2, autoattackChains: {}, eventCount: 1, skillId: -3 }]);
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
  assert.equal(precombat.endState.activeWeaponSet, 1);
  assert.equal(precombat.endState.cooldowns['Swap Weapons'], undefined);

  const inCombat = simulateMesmer(['__combat_start', 'Swap Weapons', 'Swap Weapons'], config);

  assert.deepEqual(
    inCombat.steps.filter((step) => step.skill === 'Swap Weapons').map((step) => step.start),
    [0, 10000]
  );
  assert.equal(inCombat.endState.activeWeaponSet, 1);
  assert.equal(inCombat.endState.cooldowns['Swap Weapons'].readyAt, 20000);
});
