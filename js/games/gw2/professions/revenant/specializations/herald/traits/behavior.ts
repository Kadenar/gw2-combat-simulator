import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import {
  revenantRuntimeCoreState,
  revenantRuntimeSpecializationState
} from '#gw2/professions/revenant/core/state-queries.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { heraldFacetPassiveActive } from '#gw2/professions/revenant/specializations/herald/mechanics/facet-passives.js';
import { scheduleFacetPulse } from '#gw2/professions/revenant/specializations/herald/mechanics/facets.js';
import {
  HERALD_DRACONIC_ECHO_PROFILE_ID,
  HERALD_ELEVATED_COMPASSION_PROFILE_ID
} from '#gw2/professions/revenant/specializations/herald/profiles.js';
import { heraldState } from '#gw2/professions/revenant/specializations/herald/state.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';
import { canonicalTime, EPSILON } from '#kernel/core/clock.js';

/** Adds Core Value after the skill-authored boon extension. */
export function coreValueExtension(runtime: RevenantRuntime): number {
  return hasTrait(runtime, TRAIT.CORE_VALUE)
    ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.CORE_VALUE), 'duration')
    : 0;
}

export const ECHO_EXPIRY = 'revenant.herald-echo-expiry';

export function echoExpiry(runtime: RevenantRuntime, data: unknown): void {
  const { skillId, expiresAt } = data as { skillId: SkillId; expiresAt: number };
  const state = heraldState.from(runtime);
  if (state.lingeringFacets[skillId]?.expiresAt === expiresAt) delete state.lingeringFacets[skillId];
}

export function draconicEchoActive(context: Gw2ModifierContext, skillId: SkillId): boolean {
  return (
    hasTrait(context, TRAIT.DRACONIC_ECHO) &&
    heraldFacetPassiveActive(
      revenantRuntimeCoreState(context),
      revenantRuntimeSpecializationState(context, 'Herald'),
      skillId,
      context.time
    )
  );
}

/** Applies the trait at the mechanic's existing execution boundary. */
export function retainDraconicEcho(runtime: RevenantRuntime, facet: RevenantSkill, wasActive: boolean): void {
  const core = runtime.profession.core;
  if (!wasActive || !hasTrait(runtime, TRAIT.DRACONIC_ECHO)) return;
  const state = heraldState.from(runtime);
  const profile = requireBalanceProfileFromContext(runtime, HERALD_DRACONIC_ECHO_PROFILE_ID);
  const expiresAt = canonicalTime(runtime.time + balanceProfileNumber(profile, 'duration'));
  // Retention preserves the pulse phase, but never keeps an Energy-draining upkeep alive.
  state.lingeringFacets[facet.id] = { startsAt: runtime.time, expiresAt, legendId: core.activeLegendId };
  const nextAt = state.facetPulseReadyAt[facet.id];
  if (facet.upkeepPulse && nextAt >= runtime.time && nextAt < expiresAt) scheduleFacetPulse(runtime, facet.id, nextAt);
  runtime.schedule(ECHO_EXPIRY, expiresAt, { skillId: facet.id, expiresAt });
}

export const COMPASSION = 'revenant.herald-elevated-compassion';

export function elevatedCompassionActive(runtime: RevenantRuntime): boolean {
  const profile = requireBalanceProfileFromContext(runtime, HERALD_ELEVATED_COMPASSION_PROFILE_ID);
  const threshold = Math.max(0, balanceProfileNumber(profile, 'threshold'));
  const upkeep = runtime.profession.core.activeUpkeeps.reduce(
    (total, active) => total + Math.max(0, active.upkeepCost || 0),
    0
  );
  // A removed Quickness packet has no cadence to schedule, including on threshold re-entry.
  return (
    hasTrait(runtime, TRAIT.ELEVATED_COMPASSION) &&
    upkeep >= threshold &&
    Boolean(requireEffect(profile, 'boon', 'quickness'))
  );
}

/** Grants one Quickness pulse and reserves the next legal pulse so threshold re-entry cannot bypass the ICD. */
export function grantCompassion(runtime: RevenantRuntime): void {
  const profile = requireBalanceProfileFromContext(runtime, HERALD_ELEVATED_COMPASSION_PROFILE_ID);
  const effect = requireEffect(profile, 'boon', 'quickness');
  // The cooldown gates only quickness, so a removed boon leaves the pulse ready.
  if (!effect) return;
  runtime.effects.emit({
    kind: 'packet',
    event: {
      type: 'buff',
      at: runtime.time,
      source: 'revenant',
      sourceId: TRAIT.ELEVATED_COMPASSION,
      actorType: 'player',
      skillId: TRAIT.ELEVATED_COMPASSION,
      skillName: 'Elevated Compassion',
      name: 'Elevated Compassion - quickness',
      kind: String(effect.boon),
      duration: Math.max(0, effectNumber(profile, effect, 'duration')),
      stacks: Math.max(1, effectNumber(profile, effect, 'stacks')),
      audience: effect.audience ?? { recipients: 'party', maximumRecipients: 5 }
    }
  });
  runtime.procs.setDeadline(
    'revenant.herald.elevatedCompassion',
    canonicalTime(runtime.time + Math.max(EPSILON, balanceProfileNumber(profile, 'cooldown')))
  );
}

export function scheduleCompassion(runtime: RevenantRuntime, at: number): void {
  heraldState.from(runtime).elevatedCompassionPulseAt = at;
  runtime.schedule(COMPASSION, at);
}

/** Upkeep-changing casts start the one Elevated Compassion cadence; falling below threshold ends it lazily. */
export function syncCompassion(runtime: RevenantRuntime): void {
  const state = heraldState.from(runtime);
  if (!elevatedCompassionActive(runtime)) {
    state.elevatedCompassionPulseAt = null;
    return;
  }

  if (state.elevatedCompassionPulseAt != null && state.elevatedCompassionPulseAt >= runtime.time) return;
  const readyAt = Math.max(runtime.time, runtime.procs.deadline('revenant.herald.elevatedCompassion') || 0);
  if (readyAt <= runtime.time + EPSILON) {
    grantCompassion(runtime);
    scheduleCompassion(runtime, runtime.procs.deadline('revenant.herald.elevatedCompassion'));
  } else scheduleCompassion(runtime, readyAt);
}

export function compassionPulse(runtime: RevenantRuntime): void {
  const state = heraldState.from(runtime);
  if (state.elevatedCompassionPulseAt !== runtime.time) return;
  if (!elevatedCompassionActive(runtime)) {
    state.elevatedCompassionPulseAt = null;
    return;
  }

  grantCompassion(runtime);
  scheduleCompassion(runtime, runtime.procs.deadline('revenant.herald.elevatedCompassion'));
}
