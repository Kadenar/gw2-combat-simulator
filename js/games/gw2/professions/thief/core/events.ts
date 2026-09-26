import { canonicalTime } from '#kernel/core/clock.js';
import { normalizeEffectAudience } from '#gw2/platform/engine/effects/contracts.js';
import { proceduralSkillWeapon, splitStrikeHits } from '#gw2/platform/simulation/procedural-emission.js';
import type { EffectAudience, EffectMetadata, SimulationEventBase } from '#gw2/platform/engine/events/events.js';
import type { SimulationActorType } from '#gw2/platform/engine/events/actors.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { Gw2Runtime, RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import type { ThiefRuntimeState, ThiefSkill } from '#gw2/professions/thief/types.js';

export type ThiefRuntime = Gw2Runtime<ThiefRuntimeState>;

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

/** Resolves a Thief catalog skill by id from the live catalog. */
export function thiefSkill(runtime: ThiefRuntime, id: SkillId | null | undefined): ThiefSkill | undefined {
  return id == null ? undefined : (runtime.helpers.skillsById.get(id) as ThiefSkill | undefined);
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
  const { coefficient, hits, hitIndex, totalHits, skillWeapon, canCrit, ...attribution } = options;
  const fields = envelope(skill, attribution);
  for (const packet of splitStrikeHits({
    ...fields,
    type: 'damage',
    at: canonicalTime(options.at),
    name: options.name ?? fields.skillName ?? skill?.name,
    coefficient,
    hits,
    hitIndex,
    totalHits,
    skillWeapon: skillWeapon ?? (skill ? proceduralSkillWeapon(skill) : ''),
    canCrit: canCrit !== false
  }))
    runtime.emitProcedural(packet, { cause });
}

/** Emits one condition application at its own timestamp; eligibility is decided when it executes. */
export function emitThiefCondition(
  runtime: ThiefRuntime,
  skill: ThiefSkill | null,
  options: ThiefPacketAttribution & { readonly condition: string; readonly stacks: number; readonly duration: number },
  cause?: Gw2ResolverEvent | null
): void {
  const fields = envelope(skill, options);
  runtime.emitProcedural(
    {
      ...fields,
      type: 'condition',
      at: canonicalTime(options.at),
      name: options.name ?? `${fields.skillName ?? skill?.name} — ${options.condition}`
    },
    { cause }
  );
}

/** Emits an instantaneous control fact for proc consumers. */
export function emitThiefControl(
  runtime: ThiefRuntime,
  skill: ThiefSkill | null,
  options: ThiefPacketAttribution & { readonly controlKind?: string },
  cause?: Gw2ResolverEvent | null
): void {
  runtime.emitProcedural(
    {
      ...envelope(skill, options),
      type: 'control',
      at: canonicalTime(options.at),
      controlKind: options.controlKind ?? 'control'
    },
    { cause }
  );
}

/** Emits one positive status with Thief attribution; the runtime defers a future one so its duration samples then. */
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
  const event: SimulationEventBase = {
    ...envelope(skill, attribution),
    type: 'buff',
    at: canonicalTime(options.at),
    kind,
    duration,
    stacks: stacks ?? 1,
    ...(normalizedAudience ? { audience: normalizedAudience } : {})
  };
  runtime.emitProcedural(event, { cause, fixedDuration });
}
