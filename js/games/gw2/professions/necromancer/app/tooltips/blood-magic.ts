import { traitSkillTooltip } from '#gw2/app/shared/simulation-tooltip.js';
import {
  outsideScopeTooltip,
  tooltipFactorChange,
  tooltipSeconds,
  traitTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';

/** Describe blood magic tooltips from the selected balance data. */
export const necromancerBloodMagicTooltips = {
  [TRAIT.MARK_OF_EVASION]: traitSkillTooltip(
    [ID.LESSER_MARK_OF_BLOOD],
    'Completing a dodge in combat invokes Lesser Mark of Blood.'
  ),
  [TRAIT.VAMPIRIC]: traitTooltip(
    'Eligible player and creature attacks trigger life-steal damage. Healing is outside simulation scope.'
  ),
  [TRAIT.LAST_RITES]: traitTooltip('Gain healing power at full player health.', [['attributeBonus', 'Healing power']]),
  [TRAIT.RITUAL_OF_LIFE]: outsideScopeTooltip,
  [TRAIT.OVERFLOWING_THIRST]: traitTooltip(
    'Dagger skills grant Taste for Blood. Each recipient consumes their own stacks on eligible hits to deal life-steal damage.',
    [['minimumStacks', 'Necrotic Bite stacks']]
  ),
  [TRAIT.BLOOD_RENEWAL]: outsideScopeTooltip,
  [TRAIT.LIFE_FROM_DEATH]: outsideScopeTooltip,
  [TRAIT.BANSHEES_WAIL]: traitTooltip(
    'Increase Locust Swarm siphon base damage, pulse count, and swiftness duration. Power scaling is unchanged.',
    [
      ['durationMultiplier', 'Effectiveness', tooltipFactorChange],
      ['pulseInterval', 'Extended pulse interval', tooltipSeconds]
    ]
  ),
  [TRAIT.VAMPIRIC_PRESENCE]: traitTooltip(
    'Eligible player, creature, and configured allied hits trigger life-steal damage once Vampiric Aura is up; the first aura pulse is assumed half an interval after combat starts. The stronger payload applies to every recipient while you are in shroud.',
    [
      ['cooldown', 'Internal cooldown per recipient', tooltipSeconds],
      ['auraPulseInterval', 'Vampiric Aura pulse interval', tooltipSeconds]
    ]
  ),
  [TRAIT.BLOOD_BANK]: outsideScopeTooltip,
  [TRAIT.UNHOLY_MARTYR]: outsideScopeTooltip,
  [TRAIT.TRANSFUSION]: traitSkillTooltip([ID.LESSER_CHILBLAINS], 'Using shroud skill 4 invokes Lesser Chilblains.')
} satisfies NonNullable<ProfessionTooltips['traits']>;
