import type { ThiefSummonDefinition } from '../../types.js';

// Daredevil replaces the third Thieves Guild summon with its staff-wielding specialist.
export const DAREDEVIL_THIEVES_GUILD_SUMMON: ThiefSummonDefinition = Object.freeze({
  name: 'Staff Daredevil',
  displayName: 'Daredevil',
  variant: 'Daredevil',
  weapon: 'Staff',
  weaponStrengthProfileId: 'weapon.staff',
  attacks: [
    {
      name: 'Vault',
      skillId: 41056,
      coefficientPerHit: 2.4,
      hits: 1,
      initialDelay: 1.72,
      interval: 11.36
    },
    {
      name: 'Impairing Daggers',
      skillId: 40482,
      coefficientPerHit: 0.25,
      hits: 3,
      initialDelay: 2.72,
      conditions: [
        { condition: 'Poisoned', stacks: 3, duration: 8 },
        { condition: 'Slow', stacks: 1, duration: 4 },
        { condition: 'Immobilized', stacks: 1, duration: 2 }
      ]
    },
    {
      name: 'Weakening Charge',
      skillId: 40005,
      coefficientPerHit: 0.45,
      hits: 2,
      initialDelay: 4.04,
      interval: 3.36
    }
  ]
});
