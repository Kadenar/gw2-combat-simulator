import { defineFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Core Elementalist skill fields consumed by its weapon and summon mechanics. */
export const ELEMENTALIST_CORE_SKILL_FIELDS = defineFields(
  {
    meteorCancelCooldown: numberField({ unit: 'seconds', patch: 'advanced' }),
    // A point target covers one quarter of the shower area; stochastic runs sample each committed impact.
    meteorSmallTargetHitChance: numberField({ unit: 'probability', maximum: 1, patch: 'advanced' }),
    meteorDamageReductionPerHit: numberField({ unit: 'fraction', maximum: 1, patch: 'primary' }),
    meteorMinimumDamageFactor: numberField({ unit: 'fraction', maximum: 1, patch: 'primary' }),
    // Creating an orb refreshes every active orb to this skill's duration.
    orbDuration: numberField({ unit: 'seconds', patch: 'primary' }),
    // Fraction of a weapon skill's recharge retained by its own mechanic, before trait recharge reductions.
    rechargeMultiplier: numberField({ patch: 'primary' }),
    // Dazing Discharge and Ripple apply this factor to the next eligible weapon skill's recharge.
    nextSkillRechargeMultiplier: numberField({ patch: 'primary' }),
    // Seethe empowers the next eligible spear activation, including its captured delayed strikes.
    nextSkillDamageMultiplier: numberField({ patch: 'primary' }),
    // Glyph recharge starts after the summon expires; it is distinct from the activation cooldown.
    rechargeAfterExpiry: numberField({ unit: 'seconds', patch: 'primary' }),
    // Target acquisition begins when a live elemental can start autonomous combat.
    summonStartupDelay: numberField({ unit: 'seconds', patch: 'advanced' }),
    // Seconds from Frozen Fusillade's release to its enhanced Water-bullet detonation.
    detonationDelay: numberField({ label: 'enhanced detonation delay', unit: 'seconds', patch: 'primary' })
  },
  'Elementalist Core'
);

/** Declares elementalist core profile tuning once for validation, patch controls, and labels. */
export const ELEMENTALIST_CORE_PROFILE_FIELDS = defineFields({
  // Strike, condition, and general damage scaling.
  waterFactor: numberField({ patch: 'primary', unit: 'factor' }),
  otherFactor: numberField({ patch: 'primary', unit: 'factor' })
});
