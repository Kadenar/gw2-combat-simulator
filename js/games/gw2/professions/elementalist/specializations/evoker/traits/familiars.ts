import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type { Gw2MutableStats, Gw2Stats } from '#gw2/platform/combat/types.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { Skill, SkillId } from '#gw2/platform/engine/skills/types.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import { emitElementalistBuff } from '#gw2/professions/elementalist/core/events.js';
import { emitProfiledBuff } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import { elementalistMightStacks } from '#gw2/professions/elementalist/core/mechanics/modifier-queries.js';
import {
  activeElementalistBuffs,
  refreshElementalistBuffs
} from '#gw2/professions/elementalist/core/mechanics/resolution-helpers.js';
import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
import { FAMILIAR_ELEMENTS } from '#gw2/professions/elementalist/specializations/evoker/mechanics/constants.js';
import { applyGalvanicEnchantment } from '#gw2/professions/elementalist/specializations/evoker/traits/enchantments.js';
import type { ElementalistModifierContext, ElementalistRuntime } from '#gw2/professions/elementalist/types.js';

/** Meditation skills whose named profile effects grant Altruistic Aspect boons. */
const ALTRUISTIC_ASPECT_SKILLS: ReadonlySet<SkillId> = new Set([
  ID.FOXS_FURY,
  ID.HARES_AGILITY,
  ID.TOADS_FORTITUDE,
  ID.ELEMENTAL_PROCESSION
]);

/**
 * Grants Altruistic Aspect's per-meditation boon when the trait is slotted and
 * the completing skill is one of the four it covers; otherwise a no-op.
 */
export function applyAltruisticAspect(context: ElementalistRuntime, cast: RuntimeCast, skill: Skill): void {
  if (!hasTrait(context, TRAIT.ALTRUISTIC_ASPECT)) return;
  if (!ALTRUISTIC_ASPECT_SKILLS.has(skill.id)) return;
  const altruisticAspectProfile = requireBalanceProfileFromContext(context, TRAIT.ALTRUISTIC_ASPECT);
  const effect = requireEffect(altruisticAspectProfile, 'boon', skill.name);
  if (effect) {
    emitElementalistBuff(context, {
      skill: skill,
      at: cast.effectiveEnd,
      source: skill.name,
      sourceId: skill.id,
      actorType: 'player',
      kind: String(effect.boon).toLowerCase(),
      stacks: Number(effect.stacks),
      duration: effect.duration,
      skillName: skill.name
    });
  }
}

// refreshes the Familiar's Prowess damage buff, extending an active one rather than stacking a second
function grantFamiliarProwess(context: ElementalistRuntime, cast: RuntimeCast, skill: Skill): void {
  const at = cast.effectiveEnd;
  const familiarsProwessProfile = requireBalanceProfileFromContext(context, TRAIT.FAMILIARS_PROWESS);
  const baseDuration = balanceProfileNumber(familiarsProwessProfile, 'durationMultiplier');
  const extension = balanceProfileNumber(familiarsProwessProfile, 'durationPerTier');
  const maximumDuration = balanceProfileNumber(familiarsProwessProfile, 'maximumStacks');
  const current = activeElementalistBuffs(context, "familiar's-prowess", at).at(-1);
  if (current) {
    refreshElementalistBuffs(context, "familiar's-prowess", at, (expiry) =>
      Math.min(expiry + extension, at + maximumDuration)
    );
    return;
  }

  emitElementalistBuff(context, {
    at,
    source: "Familiar's Prowess",
    sourceId: skill.id,
    actorType: 'player',
    skillName: "Familiar's Prowess",
    kind: "familiar's-prowess",
    stacks: 1,
    duration: baseDuration
  });
}

// Familiar completions fan out through named steps so their ordering remains visible.
export function applyFamiliarTraitProcs(context: ElementalistRuntime, cast: RuntimeCast, skill: Skill): void {
  const at = cast.effectiveEnd;
  if (FAMILIAR_ELEMENTS.has(skill.id) && hasTrait(context, TRAIT.FAMILIARS_PROWESS)) {
    grantFamiliarProwess(context, cast, skill);
  }

  const familiarElement = FAMILIAR_ELEMENTS.get(skill.id);
  if (familiarElement && hasTrait(context, TRAIT.FAMILIARS_BLESSING)) {
    const quick = familiarElement === 'Fire' || familiarElement === 'Air';
    // Blessing stays after Prowess and before charge grants; only packet construction is shared.
    emitProfiledBuff(
      context,
      at,
      TRAIT.FAMILIARS_BLESSING,
      quick ? 'Quickness' : 'Alacrity',
      "Familiar's Blessing",
      skill.id
    );
  }

  applyGalvanicEnchantment(context, cast, skill);
}

/**
 * Applies Enhanced Potency's attribute bonuses: ferocity while Fury is up on an
 * Air Evoker, and might-scaled condition damage on a Fire Evoker.
 */
// ferocity and conditionDamage added here rather than as modifier rules because they must feed into crit-damage and condition scaling before those are computed
export function applyEnhancedPotencyAttributes(context: ElementalistModifierContext, attributes: Gw2Stats): Gw2Stats {
  const modified: Gw2MutableStats = { ...attributes };
  if (
    context.config?.evokerElement === 'Air' &&
    Boolean(context.query?.furyActiveAt(context.time, context.runtime, context.event))
  ) {
    const enhancedPotencyProfile = requireBalanceProfileFromContext(context, TRAIT.ENHANCED_POTENCY);
    modified.ferocity = (modified.ferocity || 0) + balanceProfileNumber(enhancedPotencyProfile, 'attributeBonus');
  }

  if (context.config?.evokerElement === 'Fire' && hasTrait(context, TRAIT.ENHANCED_POTENCY)) {
    const enhancedPotencyProfile = requireBalanceProfileFromContext(context, TRAIT.ENHANCED_POTENCY);
    // Fire Enhanced Potency scales condition damage per might stack
    modified.conditionDamage =
      (modified.conditionDamage || 0) +
      elementalistMightStacks(context) * balanceProfileNumber(enhancedPotencyProfile, 'attributePerStack');
  }

  return modified;
}
