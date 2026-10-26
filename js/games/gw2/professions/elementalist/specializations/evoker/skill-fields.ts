import { defineSkillFields, numberField } from '#gw2/platform/skills/field-specs.js';

/** Evoker familiar and meditation fields read only by Evoker mechanics. */
export const EVOKER_SKILL_FIELDS = defineSkillFields(
  {
    // Might stacks per Fox's Fury damage tier, sampled before its own boons are granted.
    mightTierThreshold: numberField({ label: 'Might stacks per tier', patch: 'primary' }),
    // Seconds after a basic familiar completes before its empowered form becomes available.
    empoweredUnlockDelay: numberField({ label: 'empowered familiar unlock delay', unit: 'seconds', patch: 'primary' }),
    // Seconds of inactivity before Ignite's consecutive-use tier resets.
    tierResetDuration: numberField({ label: 'tier reset inactivity window', unit: 'seconds', patch: 'primary' })
  },
  'Evoker'
);
