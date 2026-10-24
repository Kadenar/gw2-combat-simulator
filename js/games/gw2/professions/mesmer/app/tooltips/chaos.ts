import { traitSkillTooltip } from '#gw2/app/shared/simulation-tooltip.js';
import {
  fromProfile,
  tooltipSeconds,
  outsideScopeTooltip,
  traitTooltip,
  tooltipPercent,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';

/** Describe chaos tooltips from the selected balance data. */
export const mesmerChaosTooltips = {
  [TRAIT.METAPHYSICAL_REJUVENATION]: outsideScopeTooltip,
  [TRAIT.ILLUSIONARY_MEMBRANE]: traitTooltip(
    'Using your second shatter activates a temporary condition-damage bonus.',
    [fromProfile(TRAIT.ILLUSIONARY_MEMBRANE, 'conditionDamageIncrease', 'Condition damage', tooltipPercent)]
  ),
  [TRAIT.CHAOTIC_PERSISTENCE]: traitTooltip('Gain expertise and concentration while regeneration is assumed active.', [
    ['expertiseBonus', 'Expertise'],
    ['concentrationBonus', 'Concentration']
  ]),
  [TRAIT.METHOD_OF_MADNESS]: traitSkillTooltip(
    [ID.LESSER_CHAOS_STORM],
    'Completing a healing skill invokes Lesser Chaos Storm, repeatedly striking the target.'
  ),
  [TRAIT.ILLUSIONARY_DEFENSE]: traitTooltip(
    'Using your second shatter or Flustering Flute grants Protection to yourself and nearby allies. Duration increases per clone, blade, or note spent, up to three resources, and scales with boon duration.',
    [['durationPerTier', 'Additional Protection per resource', tooltipSeconds]]
  ),
  [TRAIT.MASTER_OF_MANIPULATION]: outsideScopeTooltip,
  [TRAIT.AUSPICIOUS_ANGUISH]: outsideScopeTooltip,
  [TRAIT.CHAOTIC_TRANSFERENCE]: traitTooltip(
    'Gaining Chaos Aura grants Regeneration to yourself and nearby allies. Regeneration scales with boon duration.'
  ),
  [TRAIT.CHAOTIC_INTERRUPTION]: traitTooltip(
    "Interrupting a target that is activating a skill reduces the active weapon set's phantasm recharge. Repeated triggers against a defiant target are cooldown-limited.",
    // Use the same patchable recharge and proc interval as the interrupt handler.
    [
      ['recharge', 'Phantasm recharge reduction', tooltipSeconds],
      ['internalCooldown', 'Internal cooldown against defiant targets', tooltipSeconds]
    ]
  ),
  [TRAIT.SHAPER_OF_CHAOS]: outsideScopeTooltip,
  [TRAIT.PRISMATIC_UNDERSTANDING]: outsideScopeTooltip,
  [TRAIT.BOUNTIFUL_DISILLUSIONMENT]: traitTooltip(
    'Using a shatter or instrument grants Stability to yourself. Its profession slot grants an additional boon to you and nearby allies: F1 Might, F2 Vigor, F3 Fury, or F4 Regeneration.'
  )
} satisfies NonNullable<ProfessionTooltips['traits']>;
