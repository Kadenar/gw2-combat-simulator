import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { balanceNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import {
  revenantRuntimeCoreState,
  revenantRuntimeSpecializationState
} from '#gw2/professions/revenant/core/state-queries.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { heraldFacetPassiveActive } from '#gw2/professions/revenant/specializations/herald/mechanics/facets.js';

/** Adds Core Value after the skill-authored boon extension. */
export function coreValueExtension(runtime: RevenantRuntime): number {
  return hasTrait(runtime, TRAIT.CORE_VALUE) ? balanceNumberFromContext(runtime, TRAIT.CORE_VALUE, 'duration') : 0;
}

/** Selected Draconic Echo attribute and modifier callbacks share the active or retained facet window. */
export function draconicEchoActive(context: Gw2ModifierContext, skillId: SkillId): boolean {
  return heraldFacetPassiveActive(
    revenantRuntimeCoreState(context),
    revenantRuntimeSpecializationState(context, 'Herald'),
    skillId,
    context.time
  );
}
