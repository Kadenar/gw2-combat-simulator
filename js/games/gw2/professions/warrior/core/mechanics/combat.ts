import { claimActivation } from '#gw2/platform/combat/procs/activation-claims.js';
import { criticalOpportunity } from '#gw2/platform/combat/procs/critical.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { Gw2HitResolutionContext } from '#gw2/platform/resolver/hit-resolution.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';

type WarriorRuntime = MechanicContext<WarriorRuntimeState, WarriorSkill>;
/** A surviving burst claims its activation once before ordered trait rewards; Dragon Slash keeps its completion reward. */
export const burstFirstHit = defineTriggerPoint<{ readonly event: Gw2ResolverEvent; readonly skill: WarriorSkill }>(
  'warrior.burst-first-hit',
  [TRAIT.CULL_THE_WEAK, TRAIT.BURST_PRECISION, TRAIT.BUILDING_MOMENTUM, TRAIT.MARCHING_ORDERS, TRAIT.BERSERKERS_POWER]
);
/** Every critical listener sees the same sampled opportunity, after the first-burst transaction. */
export const critical = defineTriggerPoint<{
  readonly event: Gw2ResolverEvent;
  readonly opportunity: ReturnType<typeof criticalOpportunity>;
  readonly firstBurst: boolean;
}>('warrior.critical', [
  TRAIT.BLOODLUST,
  TRAIT.FURIOUS,
  TRAIT.SUNDERING_BURST,
  TRAIT.AXE_MASTERY,
  TRAIT.FORCEFUL_GREATSWORD
]);
/** Accepted player control rewards Arms before Defense. */
export const controlAccepted = defineTriggerPoint<{ readonly event: Gw2ResolverEvent }>('warrior.control-accepted', [
  TRAIT.OPPORTUNIST,
  TRAIT.MERCILESS_HAMMER
]);
/** Completion uses the accepted spend before any weapon swap resource rewards. */
export const burstCompleted = defineTriggerPoint<{ readonly cast: RuntimeCast<WarriorSkill>; readonly spent: number }>(
  'warrior.burst-completed',
  [TRAIT.BURST_MASTERY, TRAIT.BRAVE_STRIDE]
);
/** The committed destination is visible before Focus resets and adrenaline rewards. */
export const weaponSwapped = defineTriggerPoint<Record<string, never>>('warrior.weapon-swapped', [
  TRAIT.MARTIAL_CADENCE,
  TRAIT.VERSATILE_RAGE
]);
/** Gunsaber resets Focus without granting ordinary weapon-swap adrenaline. */
export const focusReset = defineTriggerPoint<Record<string, never>>('warrior.focus-reset', [TRAIT.MARTIAL_CADENCE]);
/** Focus's accepted proc grants its shared follow-up rewards in their original order. */
export const soldierFocusApplied = defineTriggerPoint<{ readonly event: Gw2ResolverEvent }>(
  'warrior.soldier-focus-applied',
  [TRAIT.SOLDIERS_COMFORT, TRAIT.MARTIAL_CADENCE]
);
/** Core initialization arms selected recurring trait work after resources exist. */
export const coreInitialized = defineTriggerPoint<Record<string, never>>('warrior.core-initialized', [
  TRAIT.EMPOWER_ALLIES
]);
/** Physical skill acceptance schedules Peak Performance before resource spending. */
export const castStarting = defineTriggerPoint<{ readonly cast: RuntimeCast<WarriorSkill> }>('warrior.cast-starting', [
  TRAIT.PEAK_PERFORMANCE
]);
/** Damage resource gains settle before the below-health signet proc is considered. */
export const strikeResourcesGranted = defineTriggerPoint<{ readonly event: Gw2ResolverEvent }>(
  'warrior.strike-resources-granted',
  [TRAIT.SIGNET_MASTERY]
);
/** Dragon Slash grants its charge-converted Core reward at completion. */
export const dragonSlashCompleted = defineTriggerPoint<{
  readonly cast: RuntimeCast<WarriorSkill>;
  readonly adrenalineSpent: number;
}>('warrior.dragon-slash-completed', [TRAIT.BERSERKERS_POWER]);
/** Misses never enter this surviving-hit boundary; activation identity prevents later packets claiming again. */
export function firstBurstHit(runtime: WarriorRuntime, event: Gw2ResolverEvent): boolean {
  const skill = runtime.helpers.skillsById.get(event.skillId ?? '');
  if (!skill?.burst || event.activationId == null) return false;
  if (!claimActivation(runtime.profession.core.activationClaims, 'warrior.burst-hit', event.activationId)) return false;
  runtime.fireTrigger(burstFirstHit, { event, skill });
  return true;
}

/** Derive one opportunity for every critical trait so independent proc chances share the hit fact. */
export function resolveCriticalOpportunity(
  runtime: WarriorRuntime,
  event: Gw2ResolverEvent,
  hit: Gw2HitResolutionContext,
  firstBurst: boolean
): void {
  const opportunity = criticalOpportunity(
    hit.critEligible ? hit.critical.chance : 0,
    hit.critical.didCrit,
    Math.max(1, event.hits ?? 1)
  );
  runtime.fireTrigger(critical, { event, opportunity, firstBurst });
}

/** Immobilization uses the same Arms reward without the control-only hammer reward. */
export const immobilized = defineTriggerPoint<{ readonly event: Gw2ResolverEvent }>('warrior.immobilized', [
  TRAIT.OPPORTUNIST
]);

/** Dragon Slash returns the captured Flow spend before the charge-converted power reward. */
export const dragonSlashReleased = defineTriggerPoint<{
  readonly cast: RuntimeCast<WarriorSkill>;
  readonly flowSpent: number;
}>('warrior.dragon-slash-released', [TRAIT.BURST_MASTERY]);
