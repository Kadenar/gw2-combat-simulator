import { dataField, defineFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Ranger pet fields read only by Ranger mechanics. */
export const RANGER_CORE_SKILL_FIELDS = defineFields(
  {
    // Actor actions own autonomous recharge independently of the commanded skill cooldown.
    autonomousRecharge: numberField({ unit: 'seconds', patch: 'primary' }),
    quicknessAutonomousRecharge: numberField({ unit: 'seconds', patch: 'primary' }),
    charges: numberField({ patch: 'primary' }),
    echoDelay: numberField({ unit: 'seconds', patch: 'primary' }),
    impairedDamageMultiplier: numberField({ patch: 'primary' }),
    // Executed by the pet rather than the player.
    petSkill: dataField,
    // Belongs to the selected pet family's skill set.
    petFamilySkill: dataField,
    // Pets that own this skill.
    petNames: dataField,
    // Available only while merged with the pet.
    beastmodeSkill: dataField,
    // Pet skill used while the pet is unleashed.
    unleashedPetSkill: dataField
  },
  'Ranger Core'
);

/** Declares ranger core profile tuning once for validation, patch controls, and labels. */
export const RANGER_CORE_PROFILE_FIELDS = defineFields({
  // Recharge, resource costs, and regeneration.
  vigorRegenerationMultiplier: numberField({ patch: 'primary', unit: 'factor' }),

  // Strike, condition, and general damage scaling.
  playerDamageMultiplier: numberField({ patch: 'primary', unit: 'factor' }),

  // Durations, extensions, and recurring effects.
  immobilizeDurationExtension: numberField({ patch: 'primary', unit: 'seconds' })
});
