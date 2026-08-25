import { prepareSimulationConfig } from '../../js/platform/engine/config.js';
import { simulateGw2 } from '../../js/platform/gw2/simulation/simulate.js';
import { mesmerProfession } from '../../js/professions/mesmer/definition.js';

export function createDefaultConfig() {
  return {
    duration: 30,
    specialization: 'Virtuoso',
    selectedTraitIds: [],
    selectedSkills: [],
    primaryWeapon: 'Dagger',
    secondaryWeapon: 'Sword',
    weaponSet2Primary: 'Spear',
    weaponSet2Secondary: '',
    startingWeaponSet: 1,
    sigilSets: [
      {
        criticalChanceBonus: 0,
        strike: 1,
        condition: 1,
        conditionDurationBonus: 0,
        conditionDurationBonuses: {}
      },
      {
        criticalChanceBonus: 0,
        strike: 1,
        condition: 1,
        conditionDurationBonus: 0,
        conditionDurationBonuses: {}
      }
    ],
    weaponmasterTraining: true,
    initialResource: 5,
    stats: {
      power: 2500,
      precision: 2250,
      ferocity: 1500,
      conditionDamage: 1500,
      expertise: 750,
      vitality: 1000,
      conditionDurationBonus: 0,
      conditionDurationBonuses: {}
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
      health: 3970000,
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
      boonless: true,
      moving: false,
      nearby: true,
      activatingSkills: false,
      confusionActivationsPerSecond: 0
    }
  };
}

export function simulateMesmer(rotation, userConfig = {}) {
  const config = prepareSimulationConfig(createDefaultConfig(), userConfig, { duration: 600 });

  return simulateGw2({
    profession: mesmerProfession,
    rotation,
    config,
    execution: { mode: 'sequence' }
  });
}
