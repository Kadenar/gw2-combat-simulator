import { createDefaultBuild } from '#gw2/app/build/state/persistence.js';
import { createCalculateAttributes } from '#gw2/platform/builds/attributes.js';
import { mesmerAppAdapter } from '#gw2/content/professions/mesmer/app/app-definition.js';
import { applyMesmerBuildAttributeRules } from '#gw2/content/professions/mesmer/build/attributes.js';
import { simulateMesmer } from './mesmer-simulation.js';

// Fixtures use the same attribute calculator composed into the Mesmer adapter.
const calcAttributes = createCalculateAttributes(applyMesmerBuildAttributeRules);

export function defaultSimulationConfig(overrides = {}) {
  return {
    specialization: 'Virtuoso',
    selectedTraitIds: [],
    selectedSkills: [],
    primaryWeapon: 'Dagger',
    secondaryWeapon: 'Sword',
    initialResource: 5,
    stats: {
      power: 3000,
      precision: 2200,
      ferocity: 1400,
      conditionDamage: 1000,
      expertise: 500,
      vitality: 1000
    },
    boons: {
      might: 25,
      fury: true,
      quickness: true,
      alacrity: true,
      regeneration: true,
      vigor: true
    },
    target: {
      armor: 2597,
      health: 4000000,
      conditions: {
        Bleeding: 1,
        Burning: true,
        Torment: 1,
        Confusion: 1,
        Poisoned: true,
        Chilled: true,
        Cripple: true,
        Slow: true,
        Weakness: true,
        Vulnerability: 25
      },
      moving: false,
      boonless: true,
      nearby: true,
      activatingSkills: true,
      confusionActivationsPerSecond: 0.5
    },
    ...overrides
  };
}

export function runCoreFixtures() {
  const build = createDefaultBuild(mesmerAppAdapter);
  const attributes = calcAttributes(build, []);
  const cooldown = simulateMesmer(['Bladecall', 'Bladecall'], defaultSimulationConfig());
  const concurrent = simulateMesmer(
    ['Bladecall', { name: 'Bladesong Distortion', offset: 100 }],
    defaultSimulationConfig()
  );

  return {
    attributes,
    cooldown,
    concurrent
  };
}
