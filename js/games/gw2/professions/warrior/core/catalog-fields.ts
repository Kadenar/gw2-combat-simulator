import { defineFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Warrior owns adrenaline, burst, and trait-specific timing; shared consumers use the resolved skill timing. */
export const WARRIOR_CORE_SKILL_FIELDS = defineFields(
  {
    /** Measured duration with Dual Wielding and Quickness; only skills declaring it receive the adjustment. */
    dualWieldCastTimeMs: numberField({ unit: 'milliseconds' }),
    /** Fixed commit cutoff with Dual Wielding; independent of cast-duration scaling. */
    dualWieldInterruptCommitMs: numberField({ unit: 'milliseconds' }),
    // Intrinsic skill tuning is editable on its canonical owner.
    enduranceRegenerationBonus: numberField({ patch: 'primary' }),
    pulseInterval: numberField({ unit: 'seconds', patch: 'primary' }),
    durationPerTier: numberField({ unit: 'seconds', patch: 'primary' }),
    // Adrenaline spent by the skill.
    adrenalineCost: numberField()
  },
  'Warrior Core'
);

/** Declares warrior core profile tuning once for validation, patch controls, and labels. */
export const WARRIOR_CORE_PROFILE_FIELDS = defineFields({
  // Recharge, resource costs, and regeneration.
  bladeswornResourceGain: numberField({ patch: 'primary' }),

  // Strike, condition, and general damage scaling.
  baseBonus: numberField({ patch: 'primary' }),
  activeBonus: numberField({ patch: 'primary' }),

  // Stacks, targets, and proc gates.
  stackMultiplier: numberField({ patch: 'primary', unit: 'factor' }),
  weaponProcChanceMultiplier: numberField({ patch: 'primary', unit: 'factor' })
});
