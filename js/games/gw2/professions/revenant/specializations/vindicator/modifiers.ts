import { resourceAtLeast } from '#gw2/platform/combat/resources/pool.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { playerHealthFraction } from '#gw2/platform/combat/query/runtime-query.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';

import { REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import {
  revenantRuntimeCoreState,
  revenantRuntimeSpecializationState
} from '#gw2/professions/revenant/core/modifiers.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import type { Gw2Stats } from '#gw2/platform/combat/types.js';
import { REVENANT_MAXIMUM_ENDURANCE } from '#gw2/professions/revenant/core/state.js';

function enduranceNotFull(context: Gw2ModifierContext): boolean {
  const state = revenantRuntimeCoreState(context);
  const maximum = REVENANT_MAXIMUM_ENDURANCE;
  return !resourceAtLeast(state.endurance || 0, maximum);
}

const vindicatorModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'revenant.leviathan-strength',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    // "multiply" runs after the damage-additive bucket, so Leviathan compounds on top of Forerunner.
    operation: 'multiply',
    factor: 1.1,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      hasTrait(context, TRAIT.LEVIATHAN_STRENGTH) &&
      enduranceNotFull(context)
  },
  {
    id: 'revenant.forerunner-of-death',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    // "damage-additive" goes into the GW2 shared outgoing-damage bucket alongside other % modifiers.
    operation: 'damage-additive',
    amount: 0.25,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      hasTrait(context, TRAIT.FORERUNNER_OF_DEATH) &&
      // Prefer the event-baked flag when present; fall back to runtime state for non-dodge strikes.
      (context.event?.forerunnerOfDeathActive != null
        ? Boolean(context.event.forerunnerOfDeathActive)
        : (revenantRuntimeSpecializationState(context, 'Vindicator').forerunnerOfDeathUntil || 0) > context.time)
  }
]);

function modifyVindicatorAttributes(context: Gw2ModifierContext, attributes: Gw2Stats): Gw2Stats {
  const modified = { ...attributes };
  if (
    hasTrait(context, TRAIT.EMPIRE_DIVIDED) &&
    // Skip if the caller already baked static profession rules into the supplied attributes.
    !professionStaticRulesApplied(context.config) &&
    playerHealthFraction(context) > 0.5
  ) {
    // Runtime-only attributes use the same patchable bonus as the build calculator.
    modified.power =
      (modified.power || 0) +
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.EMPIRE_DIVIDED), 'attributeBonus');
  }

  return modified;
}

export const vindicatorModifiers = Object.freeze({
  modifierRules: vindicatorModifierRules,
  modifyAttributes: modifyVindicatorAttributes
});
