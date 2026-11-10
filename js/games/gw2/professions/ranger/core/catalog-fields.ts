import { defineFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Ranger skill fields read only by Ranger mechanics. */
export const RANGER_CORE_SKILL_FIELDS = defineFields(
  {
    // Actor actions own autonomous recharge independently of the commanded skill cooldown.
    autonomousRecharge: numberField({ unit: 'seconds', patch: 'primary' }),
    quicknessAutonomousRecharge: numberField({ unit: 'seconds', patch: 'primary' }),
    charges: numberField({ patch: 'primary' }),
    // Shortbow intrinsic extensions remain editable independently of their condition's base duration.
    durationExtension: numberField({ unit: 'seconds', patch: 'primary' }),
    echoDelay: numberField({ unit: 'seconds', patch: 'primary' }),
    impairedDamageMultiplier: numberField({ patch: 'primary' })
  },
  'Ranger Core'
);

/** Declares ranger core profile tuning once for validation, patch controls, and labels. */
export const RANGER_CORE_PROFILE_FIELDS = defineFields({
  // Recharge, resource costs, and regeneration.
  vigorRegenerationMultiplier: numberField({ patch: 'primary', unit: 'factor' }),

  // Strike, condition, and general damage scaling.
  playerDamageMultiplier: numberField({ patch: 'primary', unit: 'factor' })
});
