import { defineSkillFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Core Elementalist skill fields consumed by its weapon and summon mechanics. */
export const ELEMENTALIST_CORE_SKILL_FIELDS = defineSkillFields(
  {
    // Fraction of a weapon skill's recharge retained by its own mechanic, before trait recharge reductions.
    rechargeMultiplier: numberField({ patch: 'primary' }),
    // Dazing Discharge and Ripple apply this factor to the next eligible weapon skill's recharge.
    nextSkillRechargeMultiplier: numberField({ patch: 'primary' }),
    // Seethe empowers the next eligible spear activation, including its captured delayed strikes.
    nextSkillDamageMultiplier: numberField({ patch: 'primary' }),
    // Each etching root owns the completed-action threshold that unlocks its full release.
    etchingCompletionThreshold: numberField({ patch: 'primary' }),
    // Glyph recharge starts after the summon expires; it is distinct from the API activation cooldown.
    rechargeAfterExpiry: numberField({ unit: 'seconds', patch: 'primary' }),
    // Target acquisition begins when a live elemental can start autonomous combat.
    summonStartupDelay: numberField({ unit: 'seconds', patch: 'advanced' }),
    // Seconds from Frozen Fusillade's release to its enhanced Water-bullet detonation.
    detonationDelay: numberField({ label: 'enhanced detonation delay', unit: 'seconds', patch: 'primary' })
  },
  'Elementalist Core'
);
