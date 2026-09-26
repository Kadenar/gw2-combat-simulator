import { canonicalTime, EPSILON } from '#kernel/core/clock.js';
import { armSkillFlip, expireSkillFlip } from '#gw2/platform/engine/skills/skill-flips.js';
import { normalizeEffectAudience } from '#gw2/platform/engine/effects/contracts.js';
import { cancelledBeforeInterruptCommit } from '#gw2/platform/execution/effect-adapter.js';
import { gw2ResolverBoonDuration } from '#gw2/platform/resolver/boons.js';
import type { EffectAudience, EffectMetadata, SimulationEventBase } from '#gw2/platform/engine/events/events.js';
import type { SimulationActorType } from '#gw2/platform/engine/events/actors.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { Gw2Runtime, RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import type { ThiefRuntimeState, ThiefSkill } from '#gw2/professions/thief/types.js';

export type ThiefRuntime = Gw2Runtime<ThiefRuntimeState>;

/** Future standard boons are emitted by this task so their duration samples attributes when they actually apply. */
export const THIEF_EMIT_TASK = 'thief.emit';

interface DeferredBuff {
  readonly event: SimulationEventBase;
  readonly cause: { readonly activationId?: string; readonly causalOrder?: number } | null;
  readonly fixedDuration: boolean;
}

/** After the cast's own priority-zero packets at the completion instant. */
const THIEF_COMPLETION_PRIORITY = 20;
const pendingCompletions = new WeakMap<object, Map<string, RuntimeCast>>();

/**
 * Thief completion transitions apply after the cast's own same-instant packets, so a finishing hit resolves against
 * the state that existed while the skill was still executing. The cast is retained by identity until its task runs.
 */
export function deferThiefCompletion(runtime: ThiefRuntime, task: string, cast: RuntimeCast): void {
  let pending = pendingCompletions.get(runtime);
  if (!pending) pendingCompletions.set(runtime, (pending = new Map()));
  pending.set(`${task}:${cast.id}`, cast);
  runtime.schedule(task, runtime.time, { castId: cast.id }, undefined, THIEF_COMPLETION_PRIORITY);
}

/** Returns the cast a deferred completion task was scheduled for, releasing its retention. */
export function takeThiefCompletion(runtime: ThiefRuntime, task: string, data: unknown): RuntimeCast | undefined {
  const pending = pendingCompletions.get(runtime);
  const key = `${task}:${(data as { castId: string }).castId}`;
  const cast = pending?.get(key);
  pending?.delete(key);
  return cast;
}

/** A cast committed when it reached its full duration or passed its declared commit point. */
export function thiefCastCommitted(cast: Pick<RuntimeCast, 'skill' | 'start' | 'fullEnd' | 'effectiveEnd'>): boolean {
  return !cancelledBeforeInterruptCommit(cast.skill, cast.start, cast.fullEnd, cast.effectiveEnd);
}

/**
 * Without an explicit marker combat is active from the start. An authored marker gates combat-only effects until the
 * cursor has consumed it, so setup casts completing at the marker's own instant remain precombat.
 */
export function thiefCombatActive(runtime: ThiefRuntime, at = runtime.time): boolean {
  if (!runtime.hasExplicitCombatStart) return true;
  if (runtime.combatStartPending || runtime.cursor.command?.type === 'combat-start') return false;
  return runtime.combatStartTime != null && at + EPSILON >= runtime.combatStartTime;
}

export const THIEF_FLIP_EXPIRY = 'thief.flip-expiry';

/** Opens a timed follow-up window; its expiry retires only this occurrence, never a later rearm. */
export function armThiefFlip(
  runtime: ThiefRuntime,
  skillId: SkillId,
  availableAt: number,
  expiresAt: number,
  visibleAt = availableAt
): void {
  const window = armSkillFlip(runtime.profession.core.availableFlips, skillId, availableAt, expiresAt, visibleAt);
  if (Number.isFinite(expiresAt))
    runtime.schedule(THIEF_FLIP_EXPIRY, expiresAt, { skillId, identity: window.identity }, undefined, -20);
}

/** Retires an expired follow-up window unless a later arm replaced it. */
export function expireThiefFlip(runtime: ThiefRuntime, data: unknown): void {
  const { skillId, identity } = data as { skillId: SkillId; identity: number | string };
  expireSkillFlip(runtime.profession.core.availableFlips, skillId, runtime.time, identity);
}

/** Resolves a Thief catalog skill by id from the live catalog. */
export function thiefSkill(runtime: ThiefRuntime, id: SkillId | null | undefined): ThiefSkill | undefined {
  return id == null ? undefined : (runtime.helpers.skillsById.get(id) as ThiefSkill | undefined);
}

function emitNow(runtime: ThiefRuntime, event: SimulationEventBase, cause?: Gw2ResolverEvent | null): void {
  if (cause) runtime.emitDerived(cause, event);
  else runtime.emit(event);
}

interface ThiefPacketAttribution {
  readonly at: number;
  readonly source?: string;
  readonly sourceId?: SkillId;
  readonly actorType?: SimulationActorType;
  readonly skillId?: SkillId | null;
  readonly skillName?: string | null;
  readonly name?: string;
  readonly metadata?: EffectMetadata;
  readonly [field: string]: unknown;
}

/** Builds the common packet envelope, defaulting ownership to the triggering Thief skill. */
function envelope(skill: { readonly id: SkillId; readonly name: string } | null, options: ThiefPacketAttribution) {
  const { skillId, skillName, source, sourceId, actorType, ...rest } = options;
  const id = skillId === undefined ? skill?.id : skillId;
  const label = skillName === undefined ? skill?.name : skillName;
  return {
    ...rest,
    source: source ?? 'thief',
    sourceId: sourceId ?? skill?.id ?? id ?? 'thief.procedural',
    actorType: actorType ?? 'player',
    ...(id == null ? {} : { skillId: id }),
    ...(label == null ? {} : { skillName: label })
  };
}

/** Emits equally divided strike packets; weapon identity defaults to the owning skill, or none for procedural strikes. */
export function emitThiefDamage(
  runtime: ThiefRuntime,
  skill: ThiefSkill | null,
  options: ThiefPacketAttribution & {
    readonly coefficient: number;
    readonly hits?: number;
    readonly hitIndex?: number;
    readonly totalHits?: number;
    readonly skillWeapon?: string;
    readonly canCrit?: boolean;
  },
  cause?: Gw2ResolverEvent | null
): void {
  const { coefficient, hits: requested, hitIndex, totalHits, skillWeapon, canCrit, ...attribution } = options;
  const hits = Math.max(1, Math.trunc(Number(requested ?? 1)));
  const fields = envelope(skill, attribution);
  for (let index = 1; index <= hits; index += 1)
    emitNow(
      runtime,
      {
        ...fields,
        type: 'damage',
        at: canonicalTime(options.at),
        name: options.name ?? fields.skillName ?? skill?.name,
        coefficient: Number(coefficient || 0) / hits,
        hits: 1,
        hitIndex: hitIndex ?? index,
        totalHits: totalHits ?? hits,
        skillWeapon:
          skillWeapon ??
          (skill ? (skill.skillWeapon ?? (skill.type === 'Weapon' ? String(skill.weapon || '') : 'Unequipped')) : ''),
        canCrit: canCrit !== false
      },
      cause
    );
}

/** Emits one condition application at its own timestamp; eligibility is decided when it executes. */
export function emitThiefCondition(
  runtime: ThiefRuntime,
  skill: ThiefSkill | null,
  options: ThiefPacketAttribution & { readonly condition: string; readonly stacks: number; readonly duration: number },
  cause?: Gw2ResolverEvent | null
): void {
  const fields = envelope(skill, options);
  emitNow(
    runtime,
    {
      ...fields,
      type: 'condition',
      at: canonicalTime(options.at),
      name: options.name ?? `${fields.skillName ?? skill?.name} — ${options.condition}`
    },
    cause
  );
}

/** Emits an instantaneous control fact for proc consumers. */
export function emitThiefControl(
  runtime: ThiefRuntime,
  skill: ThiefSkill | null,
  options: ThiefPacketAttribution & { readonly controlKind?: string },
  cause?: Gw2ResolverEvent | null
): void {
  emitNow(
    runtime,
    {
      ...envelope(skill, options),
      type: 'control',
      at: canonicalTime(options.at),
      controlKind: options.controlKind ?? 'control'
    },
    cause
  );
}

/** Standard boons scale with boon duration at their application instant; other buffs keep authored durations. */
function scaledBuff(runtime: ThiefRuntime, event: SimulationEventBase, fixedDuration: boolean): SimulationEventBase {
  if (fixedDuration) return event;
  return {
    ...event,
    duration: gw2ResolverBoonDuration(runtime, event as Gw2ResolverEvent, String(event.kind), Number(event.duration))
  };
}

/** Emits one positive status now, or defers it to its timestamp so a later boon-duration change still applies. */
export function emitThiefBuff(
  runtime: ThiefRuntime,
  skill: ThiefSkill | null,
  options: ThiefPacketAttribution & {
    readonly kind: string;
    readonly duration: number;
    readonly stacks?: number;
    readonly audience?: EffectAudience;
    readonly fixedDuration?: boolean;
  },
  cause?: Gw2ResolverEvent | null
): void {
  const { kind, duration, stacks, audience, fixedDuration = false, ...attribution } = options;
  const normalizedAudience = normalizeEffectAudience(audience);
  const at = canonicalTime(options.at);
  const event: SimulationEventBase = {
    ...envelope(skill, attribution),
    type: 'buff',
    at,
    kind,
    duration,
    stacks: stacks ?? 1,
    ...(normalizedAudience ? { audience: normalizedAudience } : {})
  };
  if (at > runtime.time) {
    runtime.schedule(THIEF_EMIT_TASK, at, {
      event,
      cause: cause ? { activationId: cause.activationId, causalOrder: cause.causalOrder ?? cause.eventOrder } : null,
      fixedDuration
    } satisfies DeferredBuff);
    return;
  }

  emitNow(runtime, scaledBuff(runtime, event, fixedDuration), cause);
}

/** Runs a deferred buff at its application boundary with the triggering activation's attribution. */
export function emitDeferredThiefBuff(runtime: ThiefRuntime, data: unknown): void {
  const { event, cause, fixedDuration } = data as DeferredBuff;
  runtime.emit({ ...(cause ?? {}), ...scaledBuff(runtime, event, fixedDuration) });
}
