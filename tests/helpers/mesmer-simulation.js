import { prepareSimulationConfig } from '#tests/helpers/simulation-config.js';
import { observeGw2Runtime } from '#tests/helpers/observed-runtime.js';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';

export function createDefaultConfig() {
  return {
    duration: 30,
    specialization: 'Virtuoso',
    selectedTraitIds: [],
    // Omit the loadout for sandbox tests; explicit selections still enforce equipped skills.
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
      nearby: true,
      activatingSkills: false,
      confusionActivationsPerSecond: 0
    }
  };
}

// Tests of delayed completion effects can explicitly observe beyond the rotation's strict endpoint.
export function simulateMesmer(rotation, userConfig = {}, observationPolicy = undefined) {
  const config = prepareSimulationConfig(createDefaultConfig(), userConfig, { duration: 600 });

  return observeGw2Runtime({
    profession: mesmerProfession.runtimeFor(config),
    rotation,
    config,
    observation: observationPolicy
  });
}

/** Patched catalog scenarios exercise the same native owner as ordinary family scenarios. */
export function runMesmer({
  profession = mesmerProfession,
  config,
  rotation,
  observationPolicy,
  output,
  initialize = () => {}
}) {
  const native = profession.runtimeFor(config);
  return observeGw2Runtime({
    profession: {
      ...native,
      initialize(runtime) {
        native.initialize(runtime);
        initialize(runtime);
      }
    },
    config,
    rotation,
    observation: observationPolicy,
    output
  });
}
