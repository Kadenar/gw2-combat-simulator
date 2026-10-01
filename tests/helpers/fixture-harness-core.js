// Supply fresh sandbox defaults without loading application or simulation modules.
export function defaultSimulationConfig(overrides = {}) {
  return {
    specialization: 'Virtuoso',
    selectedTraitIds: [],
    // Omit the loadout for sandbox tests; explicit selections still enforce equipped skills.
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
        Crippled: true,
        Slow: true,
        Weakness: true,
        Vulnerability: 25
      },
      moving: false,
      activatingSkills: true,
      confusionActivationsPerSecond: 0.5
    },
    ...overrides
  };
}
