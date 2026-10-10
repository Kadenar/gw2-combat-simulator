import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { playerHealthFraction } from '#gw2/platform/combat/query/runtime-query.js';
import { resourceAtLeast } from '#gw2/platform/combat/resources/pool.js';
import type { Gw2Stats } from '#gw2/platform/combat/stats.js';

import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { revenantRuntimeCoreState } from '#gw2/professions/revenant/core/state-queries.js';
import { REVENANT_MAXIMUM_ENDURANCE } from '#gw2/professions/revenant/core/state.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';

export function modifyVindicatorAttributes(context: Gw2ModifierContext, attributes: Gw2Stats): Gw2Stats {
  const modified = { ...attributes };
  if (
    hasTrait(context, TRAIT.EMPIRE_DIVIDED) &&
    // Skip if the caller already baked static profession rules into the supplied attributes.
    !professionStaticRulesApplied(context.config) &&
    playerHealthFraction(context) >
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.EMPIRE_DIVIDED), 'threshold')
  ) {
    // Runtime-only attributes use the same patchable bonus as the build calculator.
    modified.power =
      (modified.power || 0) +
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.EMPIRE_DIVIDED), 'attributeBonus');
  }

  return modified;
}

/** Snapshots the pre-landing damage window before its renewal. */
export function forerunnerOfDeathActive(runtime: RevenantRuntime): boolean {
  return runtime.combat.activeBuffStacks('forerunner-of-death', runtime.time, 1) > 0;
}

export function enduranceNotFull(context: Gw2ModifierContext): boolean {
  const state = revenantRuntimeCoreState(context);
  const maximum = REVENANT_MAXIMUM_ENDURANCE;
  return !resourceAtLeast(state.endurance?.value ?? 0, maximum);
}

/** Applies the consumed landing charge only when materializing a strike packet. */
export function reaversCurseMultiplier(runtime: RevenantRuntime, armed: boolean): number {
  return armed
    ? Math.max(
        0,
        balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.REAVERS_CURSE), 'damageMultiplier')
      )
    : 1;
}

/** Overrides the dodge landing only while this grandmaster is selected. */
export function saintsShieldDodge(runtime: Pick<RevenantRuntime, 'config' | 'traits'>) {
  return hasTrait(runtime, TRAIT.SAINT_OF_ZU_HELTZER) ? ID.SAINTS_SHIELD : undefined;
}

/** Overrides the dodge landing only while this grandmaster is selected. */
export function imperialImpactDodge(runtime: Pick<RevenantRuntime, 'config' | 'traits'>) {
  return hasTrait(runtime, TRAIT.VASSALS_OF_THE_EMPIRE) ? ID.IMPERIAL_IMPACT : undefined;
}

/** The skill uses this policy to suppress its base reward when Song supplies the replacement. */
export function songOfArboreumSelected(runtime: Parameters<typeof hasTrait>[0]): boolean {
  return hasTrait(runtime, TRAIT.SONG_OF_ARBOREUM);
}
