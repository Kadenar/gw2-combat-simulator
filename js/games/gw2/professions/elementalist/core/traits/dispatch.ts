import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicCombatContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { applyElementalistAura } from '#gw2/professions/elementalist/core/mechanics/auras.js';
import type { ElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';
import { applyAirAttunementTraits } from '#gw2/professions/elementalist/core/traits/air/attunement-entry.js';
import { ragingStormCritical } from '#gw2/professions/elementalist/core/traits/air/critical-procs.js';
import {
  applyInscriptionPostCast,
  applyLightningRod,
  applyResolverZephyrsBoon
} from '#gw2/professions/elementalist/core/traits/air/index.js';
import { applyArcaneAttunementTraits } from '#gw2/professions/elementalist/core/traits/arcane/attunement-swap.js';
import {
  arcanePrecisionCritical,
  renewingStaminaCritical
} from '#gw2/professions/elementalist/core/traits/arcane/critical-procs.js';
import {
  applyArcaneLightning,
  applyElementalLockdown
} from '#gw2/professions/elementalist/core/traits/arcane/index.js';
import { applyEarthAttunementTraits } from '#gw2/professions/elementalist/core/traits/earth/attunement-entry.js';
import {
  applyEarthsEmbrace,
  applyResolverElementalShielding,
  applyWrittenInStone
} from '#gw2/professions/elementalist/core/traits/earth/index.js';
import {
  applyFireAttunementTraits,
  triggerSunspot as triggerFireSunspot
} from '#gw2/professions/elementalist/core/traits/fire/attunement-transition.js';
import { burningPrecisionCritical } from '#gw2/professions/elementalist/core/traits/fire/critical-procs.js';
import { applyPyromancersPuissance } from '#gw2/professions/elementalist/core/traits/fire/index.js';
import { applySoothingIce } from '#gw2/professions/elementalist/core/traits/water/index.js';
import type {
  ElementalistResolverContext,
  ElementalistRuntime,
  ElementalistSkill
} from '#gw2/professions/elementalist/types.js';

/** Public Sunspot entry point supplies the shared aura dispatcher before emitting its remaining effects. */
export function triggerSunspot(
  context: ElementalistRuntime,
  at: number,
  sourceId: Skill['id'],
  emissionCast?: EffectDelivery['cast']
): void {
  triggerFireSunspot(context, at, sourceId, applyElementalistAura, emissionCast);
}

export interface ElementalistAttunementTraitDispatch {
  readonly at: number;
  readonly skill: Skill;
  readonly previous: ElementalistAttunement;
  readonly target: ElementalistAttunement;
  readonly dualAttunement: boolean;
  readonly shouldTrigger: (attunement: ElementalistAttunement, profileId: Skill['id']) => boolean;
}
// Keep the cross-line attunement contract explicit: Fire exit/entry, Air, Earth, then Arcane.
export function applyElementalistAttunementTraits(
  context: ElementalistRuntime,
  dispatch: ElementalistAttunementTraitDispatch,
  emissionCast?: EffectDelivery['cast']
): void {
  applyFireAttunementTraits(context, dispatch, applyElementalistAura, emissionCast);
  applyAirAttunementTraits(context, dispatch, emissionCast);
  applyEarthAttunementTraits(context, dispatch, emissionCast);
  applyArcaneAttunementTraits(context, dispatch, emissionCast);
}

// Preserve post-cast interleaving across Fire, Earth, Water, Earth, Air, and Arcane trait lines.
export function applyGenericPostCast(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: Skill
): void {
  applyPyromancersPuissance(context, cast, skill);
  applyEarthsEmbrace(context, cast, skill);
  applySoothingIce(context, cast, skill, applyElementalistAura);
  applyWrittenInStone(context, cast, skill, applyElementalistAura);
  applyInscriptionPostCast(context, cast, skill);
  applyArcaneLightning(context, cast, skill);
}

/** Observes Fresh Air before routing a player control event through Lightning Rod and Elemental Lockdown. */
export function observeElementalistTraitEvent(context: ElementalistRuntime, event: SimulationEvent): void {
  if (event.type !== 'control' || event.actorType !== 'player') return;
  applyLightningRod(context, event, undefined);
  applyElementalLockdown(context, event, undefined);
}

/** Grants each actual aura its Air traits before its Earth traits. */
export function applyElementalistResolverAuraTraits(context: MechanicCombatContext, event: Gw2ResolverEvent): void {
  applyResolverZephyrsBoon(context, event);
  applyResolverElementalShielding(context, event);
}

/** Fresh Air has already resolved; process the remaining Core critical traits before field/weapon reactions. */
export function reactElementalistCoreCritical(
  context: ElementalistResolverContext,
  event: Gw2ResolverEvent,
  details: NativeResolvedDamageDetails
): void {
  ragingStormCritical(context, event, details);
  arcanePrecisionCritical(context, event, details);
  renewingStaminaCritical(context, event, details);
  burningPrecisionCritical(context, event, details);
}
