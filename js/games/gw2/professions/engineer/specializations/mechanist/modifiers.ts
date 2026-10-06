import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { MIGHT_ATTRIBUTE_BONUS_PER_STACK } from '#gw2/platform/combat/boons.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import type { Gw2MutableStats, Gw2Stats } from '#gw2/platform/combat/types.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { noScopeBoonFerocity } from '#gw2/professions/engineer/core/traits/behavior.js';
import { activeBoonStacks } from '#gw2/professions/engineer/core/traits/query-helpers.js';
import { engineerMechModifierEvent } from '#gw2/professions/engineer/specializations/mechanist/mechanics/mech-ownership.js';
import { MECHANIST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/engineer/specializations/mechanist/profiles.js';
import {
  selectedSignet,
  signetModifierRules
} from '#gw2/professions/engineer/specializations/mechanist/skills/signet-skills.js';
import { engineerMechAttributes } from '#gw2/professions/engineer/specializations/mechanist/traits/frames.js';

/** Recognizes native and replayed events that belong to the jade mech. */

const mechanistModifierRules: readonly Gw2ModifierRule[] = Object.freeze([...signetModifierRules]);

/** Replaces player attributes with the mech's inherited attribute set for mech-owned events. */
function modifyMechanistAttributes(context: Gw2ModifierContext, attributes: Gw2Stats): Gw2Stats {
  const modified: Gw2MutableStats = { ...attributes };
  if (!engineerMechModifierEvent(context)) return modified;
  const mightStacks = activeBoonStacks(context, 'might');
  // The mech inherits base player stats, not boon-amplified ones. Strip might
  // and fury bonuses before feeding into engineerMechAttributes so the mech's
  // stat formula starts from raw gear values. Shift Signet is the exception:
  // its passive re-applies might bonuses directly to the mech afterward.
  const inheritedSource = {
    ...modified,
    power: Math.max(0, (modified.power || 0) - mightStacks * MIGHT_ATTRIBUTE_BONUS_PER_STACK),
    ferocity: Math.max(0, (modified.ferocity || 0) - noScopeBoonFerocity(context)),
    conditionDamage: Math.max(0, (modified.conditionDamage || 0) - mightStacks * MIGHT_ATTRIBUTE_BONUS_PER_STACK)
  };
  const mech = engineerMechAttributes(
    context.config,
    inheritedSource,
    requireBalanceProfileFromContext(context, PROFILE.resources)
  );
  if (selectedSignet(context, ID.SHIFT_SIGNET)) {
    mech.power += mightStacks * MIGHT_ATTRIBUTE_BONUS_PER_STACK;
    mech.conditionDamage += mightStacks * MIGHT_ATTRIBUTE_BONUS_PER_STACK;
  }

  // Replacing player attributes removes panel-baked Firearms duration bonuses; restore only the mech's trait bonuses.
  // Direct configurations still receive these bonuses through the ordinary runtime trait rules.
  const conditionDurationBonuses: Record<string, number> = {};
  if (professionStaticRulesApplied(context.config)) {
    for (const [condition, trait] of [
      ['Bleeding', TRAIT.SERRATED_STEEL],
      ['Burning', TRAIT.INCENDIARY_POWDER]
    ] as const) {
      if (hasTrait(context, trait)) {
        conditionDurationBonuses[condition] =
          100 * balanceProfileNumber(requireBalanceProfileFromContext(context, trait), 'durationMultiplier');
      }
    }
  }

  return { ...mech, conditionDurationBonuses };
}

export const mechanistModifiers = Object.freeze({
  modifyAttributes: modifyMechanistAttributes,
  modifierRules: mechanistModifierRules
});
