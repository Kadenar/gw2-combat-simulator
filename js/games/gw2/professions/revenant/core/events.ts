import { canonicalTime, EPSILON } from '#kernel/core/clock.js';
import { isStandardBoon } from '#gw2/platform/combat/boons.js';
import { buffApplicationStacks } from '#gw2/platform/combat/boons.js';
import { materializeSkillEffectApplications } from '#gw2/platform/engine/effects/materializer.js';
import { gw2ResolverBoonDuration } from '#gw2/platform/resolver/boons.js';
import type { SimulationEventBase } from '#gw2/platform/engine/events/events.js';
import type { BalanceProfile, Skill, SkillEffect, SkillId } from '#gw2/platform/engine/skills/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { Gw2Runtime, RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import type { RevenantRuntimeState } from '#gw2/professions/revenant/types.js';
import { cancelledBeforeInterruptCommit } from '#gw2/platform/execution/effect-adapter.js';

export type RevenantRuntime = Gw2Runtime<RevenantRuntimeState>;

/** Future boons are emitted by this task so their duration samples attributes when they actually apply. */
export const REVENANT_EMIT_TASK = 'revenant.emit';

interface DeferredEmission {
  readonly event: SimulationEventBase;
  readonly cause: { readonly activationId?: string; readonly causalOrder?: number } | null;
  readonly fixedDuration: boolean;
}

/**
 * Without an explicit marker combat is active from the start. An authored marker gates invocation effects until the
 * cursor has consumed it, so setup casts completing at the marker's own instant remain precombat.
 */
export function revenantCombatActive(runtime: RevenantRuntime, at = runtime.time): boolean {
  if (!runtime.hasExplicitCombatStart) return true;
  if (runtime.combatStartPending || runtime.cursor.command?.type === 'combat-start') return false;
  return runtime.combatStartTime != null && at + EPSILON >= runtime.combatStartTime;
}

/** Permanent configured boons and executed applications both count; pending packets never do. */
export function revenantBoonActive(runtime: RevenantRuntime, kind: string): boolean {
  if (Number(runtime.config.boons?.[kind] ?? 0) > 0 || runtime.config.boons?.[kind] === true) return true;
  return buffApplicationStacks(runtime.boons.get(kind) ?? [], kind, runtime.time, 1, { ordered: true }) > 0;
}

function emitNow(runtime: RevenantRuntime, event: SimulationEventBase, cause?: Gw2ResolverEvent | null): void {
  if (cause) runtime.emitDerived(cause, event);
  else runtime.emit(event);
}

/** Standard boons scale with boon duration at their application instant; other buffs keep authored durations. */
function scaledBuff(runtime: RevenantRuntime, event: SimulationEventBase, fixedDuration: boolean): SimulationEventBase {
  const kind = String(event.kind ?? '');
  if (fixedDuration || !isStandardBoon(kind)) return event;
  return {
    ...event,
    duration: gw2ResolverBoonDuration(runtime, event as Gw2ResolverEvent, kind, Number(event.duration))
  };
}

/** Emits a buff now, or defers it to its timestamp so a later boon-duration change still applies. */
export function emitRevenantBuff(
  runtime: RevenantRuntime,
  event: SimulationEventBase,
  cause?: Gw2ResolverEvent | null,
  fixedDuration = false
): void {
  const at = canonicalTime(event.at);
  if (at > runtime.time) {
    runtime.schedule(REVENANT_EMIT_TASK, at, {
      event: { ...event, at },
      cause: cause ? { activationId: cause.activationId, causalOrder: cause.causalOrder ?? cause.eventOrder } : null,
      fixedDuration
    } satisfies DeferredEmission);
    return;
  }

  emitNow(runtime, scaledBuff(runtime, { ...event, at }, fixedDuration), cause);
}

/** Damage and conditions are queued at their own timestamps; eligibility is decided when they execute. */
export function emitRevenantPacket(
  runtime: RevenantRuntime,
  event: SimulationEventBase,
  cause?: Gw2ResolverEvent | null
): void {
  if (event.type === 'buff') emitRevenantBuff(runtime, event, cause);
  else emitNow(runtime, event, cause);
}

/** Runs a deferred buff at its application boundary with the triggering activation's attribution. */
export function emitDeferredRevenantBuff(runtime: RevenantRuntime, data: unknown): void {
  const { event, cause, fixedDuration } = data as DeferredEmission;
  runtime.emit({ ...(cause ?? {}), ...scaledBuff(runtime, event, fixedDuration) });
}

/**
 * Materializes an authored profile or proc skill at one instant with the triggering source's attribution.
 * Invocation traits, Renegade profiles, and Numinous-style packages share this single live path.
 */
export function emitRevenantProfile(
  runtime: RevenantRuntime,
  profile: BalanceProfile | Skill,
  {
    at = runtime.time,
    fullEnd = at,
    sourceId,
    eventSkill = profile,
    activationId,
    cause = null,
    predicate = () => true,
    effects = profile.effects ?? []
  }: {
    readonly at?: number;
    readonly fullEnd?: number;
    readonly sourceId: SkillId;
    readonly eventSkill?: { readonly id: SkillId; readonly name: string };
    readonly activationId?: string;
    readonly cause?: Gw2ResolverEvent | null;
    readonly predicate?: (effect: SkillEffect) => boolean;
    readonly effects?: readonly SkillEffect[];
  }
): void {
  for (const effect of effects) {
    if (!predicate(effect)) continue;
    for (const { event } of materializeSkillEffectApplications({
      skill: profile as BalanceProfile & Skill,
      effect,
      start: at,
      fullEnd,
      baseEvent: {
        ...(activationId ? { activationId } : {}),
        source: 'revenant',
        sourceId,
        actorType: effect.actorType || 'player',
        skillId: eventSkill.id,
        skillName: eventSkill.name
      },
      skillWeaponFallback: 'Unequipped'
    }))
      emitRevenantPacket(runtime, event, cause);
  }
}

/** A cast committed when it reached its full duration or passed its declared commit point. */
export function revenantCastCommitted(cast: RuntimeCast): boolean {
  return !cancelledBeforeInterruptCommit(cast.skill, cast.start, cast.fullEnd, cast.effectiveEnd);
}
