import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { ENDURANCE } from '#gw2/platform/combat/resources/endurance-rules.js';
import { resourceAtLeast } from '#gw2/platform/combat/resources/pool.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { revenantRuntimeCoreState } from '#gw2/professions/revenant/core/state-queries.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';

/** Snapshots the pre-landing damage window before its renewal. */
export function forerunnerOfDeathActive(runtime: RevenantRuntime): boolean {
  return runtime.combat.activeBuffStacks('forerunner-of-death', runtime.time, 1) > 0;
}

export function enduranceNotFull(context: Gw2ModifierContext): boolean {
  const state = revenantRuntimeCoreState(context);
  const maximum = ENDURANCE.maximum;
  return !resourceAtLeast(state.endurance?.value ?? 0, maximum);
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
