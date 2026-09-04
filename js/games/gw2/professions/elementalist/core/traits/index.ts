/** Ordered public dispatcher for Core Elementalist trait behavior. */
import type { SimulationEvent } from '#gw2/platform/engine/events/types.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type { Gw2ResolverEvent, Gw2ResolverRuntime } from '#gw2/platform/resolver/types.js';
import type {
  ElementalistCastContext as ElementalistLifecycleContext,
  ElementalistSchedulerContext
} from '#gw2/professions/elementalist/types.js';
import type { ElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/core/profiles.js';
import {
  combatStarted,
  emitElementalistAura,
  type ElementalistAuraApplication
} from '#gw2/professions/elementalist/core/mechanics/effects.js';
import {
  applyFreshAirAttunementEntry,
  applyInscriptionAirEntry,
  applyInscriptionPostCast,
  applyLightningRod,
  applyOneWithAir,
  applyRagingStorm,
  applyResolverZephyrsBoon,
  applySchedulerZephyrsBoon,
  observeFreshAir,
  processFreshAirCandidates,
  projectedFreshAirReadyAt,
  triggerElectricDischarge
} from '#gw2/professions/elementalist/core/traits/air.js';
import {
  applyArcaneLightning,
  applyArcanePrecision,
  applyArcaneProwess,
  applyElementalLockdown,
  applyRenewingStamina,
  grantElementalAttunementBoon,
  triggerBountifulPower,
  triggerEvasiveArcana
} from '#gw2/professions/elementalist/core/traits/arcane.js';
import {
  applyEarthsEmbrace,
  applyResolverElementalShielding,
  applySchedulerElementalShielding,
  applyStrengthOfStone,
  applyWrittenInStone,
  grantElementalistRockSolid,
  triggerEarthenBlast
} from '#gw2/professions/elementalist/core/traits/earth.js';
import {
  applyBurningPrecision,
  applyPyromancersPuissance,
  elementalistAuraDuration,
  extendPersistingFlamesField,
  extendPersistingFlamesPackets,
  grantPersistingFlames,
  triggerFlameExpulsion,
  triggerSunspot as triggerFireSunspot
} from '#gw2/professions/elementalist/core/traits/fire.js';
import { applySoothingIce } from '#gw2/professions/elementalist/core/traits/water.js';

export {
  applyArcanePrecision,
  applyBurningPrecision,
  applyRagingStorm,
  applyRenewingStamina,
  applyStrengthOfStone,
  elementalistAuraDuration,
  extendPersistingFlamesField,
  extendPersistingFlamesPackets,
  grantElementalistRockSolid,
  grantPersistingFlames,
  processFreshAirCandidates,
  projectedFreshAirReadyAt,
  triggerBountifulPower,
  triggerEarthenBlast,
  triggerElectricDischarge,
  triggerEvasiveArcana,
  triggerFlameExpulsion
};

/** Applies Smothering Auras, records the aura, then grants Air and Earth aura traits in order. */
export function applyElementalistAura(
  context: ElementalistSchedulerContext,
  application: ElementalistAuraApplication
): void {
  const adjusted = {
    ...application,
    duration: elementalistAuraDuration(context, application.duration)
  };
  emitElementalistAura(context, adjusted);
  if (!combatStarted(context, application.at)) return;
  applySchedulerZephyrsBoon(context, application.at, application.skillName, application.sourceId);
  applySchedulerElementalShielding(context, application.at, application.skillName, application.sourceId);
}

/** Public Sunspot entry point supplies the shared aura dispatcher before emitting its remaining effects. */
export function triggerSunspot(context: ElementalistSchedulerContext, at: number, sourceId: Skill['id']): void {
  triggerFireSunspot(context, at, sourceId, applyElementalistAura);
}

interface ElementalistAttunementTraitDispatch {
  readonly at: number;
  readonly skill: Skill;
  readonly previous: ElementalistAttunement;
  readonly target: ElementalistAttunement;
  readonly dualAttunement: boolean;
  readonly shouldTrigger: (attunement: ElementalistAttunement, profileId: Skill['id']) => boolean;
}

// Keep the cross-line attunement contract explicit: Fire exit/entry, Air, Earth, then Arcane.
export function applyElementalistAttunementTraits(
  context: ElementalistSchedulerContext,
  dispatch: ElementalistAttunementTraitDispatch
): void {
  const { at, skill, previous, target, dualAttunement, shouldTrigger } = dispatch;
  if (previous === 'Fire' && target !== 'Fire' && shouldTrigger('Fire', PROFILE.pyromancersPuissance)) {
    triggerFlameExpulsion(context, at, skill.id);
  }

  if (target === 'Fire' && shouldTrigger('Fire', PROFILE.sunspot)) triggerSunspot(context, at, skill.id);
  if (target === 'Air') {
    if (shouldTrigger('Air', PROFILE.electricDischarge)) triggerElectricDischarge(context, at, skill.id);
    applyFreshAirAttunementEntry(context, at, skill, previous);
    applyOneWithAir(context, at, skill);
    applyInscriptionAirEntry(context, at, skill);
  }

  if (target === 'Earth') {
    if (shouldTrigger('Earth', PROFILE.earthenBlast)) triggerEarthenBlast(context, at, skill.id);
    if (shouldTrigger('Earth', PROFILE.rockSolid)) grantElementalistRockSolid(context, at, skill.id);
  }

  applyArcaneProwess(context, at, skill.id);
  if (!dualAttunement || target !== previous) grantElementalAttunementBoon(context, at, target, skill.id);
  if (!dualAttunement) triggerBountifulPower(context, at, 1, skill.id);
}

// Preserve post-cast interleaving across Fire, Earth, Water, Earth, Air, and Arcane trait lines.
export function applyGenericPostCast(context: ElementalistLifecycleContext, skill: Skill): void {
  applyPyromancersPuissance(context, skill);
  if (skill.type === 'Heal') {
    applyEarthsEmbrace(context, skill);
    applySoothingIce(context, skill, applyElementalistAura);
  }

  applyWrittenInStone(context, skill, applyElementalistAura);
  applyInscriptionPostCast(context, skill);
  applyArcaneLightning(context, skill);
}

/** Observes Fresh Air before routing a player control event through Lightning Rod and Elemental Lockdown. */
export function observeElementalistTraitEvent(context: ElementalistSchedulerContext, event: SimulationEvent): void {
  observeFreshAir(context, event);
  if (event.type !== 'control' || event.actorType !== 'player') return;
  applyLightningRod(context, event);
  applyElementalLockdown(context, event);
}

/** Grants resolver-side aura traits in the same Air-before-Earth order as scheduler applications. */
export function applyElementalistResolverAuraTraits(context: Gw2ResolverRuntime, event: Gw2ResolverEvent): void {
  applyResolverZephyrsBoon(context, event);
  applyResolverElementalShielding(context, event);
}
