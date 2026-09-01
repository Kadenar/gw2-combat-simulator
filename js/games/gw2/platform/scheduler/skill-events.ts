/**
 * Canonical scheduler-side emitters for procedural skill effects. These helpers
 * keep the common GW2 event envelope aligned with declarative effects while
 * leaving unusual profession metadata and ownership explicit at the call site.
 */
import { gw2SchedulerBoonDuration } from '#gw2/platform/scheduler/policy.js';
import { normalizeEffectAudience, normalizeEffectMetadata } from '#gw2/platform/engine/effects/contracts.js';

import type {
  EffectAudience,
  EffectMetadata,
  SchedulerContext,
  SchedulerRecord,
  SimulationActorType,
  SimulationEvent,
  SimulationEventInput,
  Skill,
  SkillId
} from '#gw2/platform/engine/types.js';

interface SkillEventOwnership extends SchedulerRecord {
  /** Optional identity for procedural events that do not have a catalog skill in scope. */
  readonly skill?: Skill;
  readonly cause?: SimulationEvent;
  readonly source?: string;
  readonly sourceId?: SkillId;
  readonly actorType?: SimulationActorType;
  readonly ownerActorType?: SimulationActorType;
  readonly summonKind?: string;
  readonly skillId?: SkillId | null;
  readonly skillName?: string | null;
  readonly parentSkillName?: string;
  readonly activationId?: string;
  readonly triggeredBy?: string;
  readonly priority?: number;
}

interface SkillEventMetadata {
  /** Profession-specific fields that are outside the canonical GW2 envelope. */
  readonly metadata?: EffectMetadata;
}

interface StandardSkillEventEnvelope extends SchedulerRecord {
  readonly source: string;
  readonly sourceId: SkillId;
}

export interface EmitSkillDamageOptions extends SkillEventOwnership, SkillEventMetadata {
  readonly at: number;
  /** Total coefficient across every emitted hit. */
  readonly coefficient: number;
  readonly hits?: number;
  /** Delay between hit packets in simulation seconds. */
  readonly interval?: number;
  readonly hitIndex?: number;
  readonly totalHits?: number;
  readonly name?: string | null;
  readonly skillWeapon?: string;
  readonly canCrit?: boolean | null;
}

export interface EmitSkillConditionOptions extends SkillEventOwnership, SkillEventMetadata {
  readonly at: number;
  readonly condition: string;
  readonly stacks: number;
  readonly duration: number;
  readonly name?: string | null;
}

export interface EmitSkillBuffOptions extends SkillEventOwnership, SkillEventMetadata {
  readonly at: number;
  readonly name?: string;
  readonly kind: string;
  readonly duration: number;
  readonly stacks?: number;
  readonly fixedDuration?: boolean;
  readonly maximumDuration?: number;
  readonly audience?: EffectAudience;
}

export interface EmitSkillControlOptions extends SkillEventOwnership, SkillEventMetadata {
  readonly at: number;
  readonly name?: string;
  readonly controlKind?: string;
  readonly duration?: number;
}

function standardEnvelope<TProfessionState extends object>(
  context: SchedulerContext<TProfessionState>,
  skill: Skill,
  options: SkillEventOwnership
): StandardSkillEventEnvelope {
  return {
    source: options.source ?? context.profession.id,
    sourceId: options.sourceId ?? skill.id,
    actorType: options.actorType ?? 'player',
    ...(options.ownerActorType ? { ownerActorType: options.ownerActorType } : {}),
    ...(options.summonKind ? { summonKind: options.summonKind } : {}),
    ...(options.skillId === null ? {} : { skillId: options.skillId ?? skill.id }),
    ...(options.skillName === null ? {} : { skillName: options.skillName ?? skill.name }),
    ...(options.parentSkillName ? { parentSkillName: options.parentSkillName } : {}),
    ...(options.activationId ? { activationId: options.activationId } : {}),
    ...(options.triggeredBy ? { triggeredBy: options.triggeredBy } : {}),
    ...(options.priority == null ? {} : { priority: options.priority })
  };
}

function proceduralSkill<TProfessionState extends object>(
  context: SchedulerContext<TProfessionState>,
  options: SkillEventOwnership
): Skill {
  const id = options.skillId ?? options.sourceId ?? `${context.profession.id}.procedural`;
  return (
    options.skill ?? {
      id,
      name: options.skillName ?? String((options as SchedulerRecord).name || id)
    }
  );
}

function skillEventArguments<TProfessionState extends object, TOptions extends SkillEventOwnership>(
  context: SchedulerContext<TProfessionState>,
  skillOrOptions: Skill | TOptions,
  maybeOptions?: TOptions
): { readonly skill: Skill; readonly options: TOptions } {
  const options = (maybeOptions ?? skillOrOptions) as TOptions;
  const skill = maybeOptions ? (skillOrOptions as Skill) : proceduralSkill(context, options);
  return { skill, options };
}

function supplementalEventFields(
  options: SkillEventOwnership & SkillEventMetadata,
  internalFields: readonly string[] = []
): SchedulerRecord {
  // Preserve nested metadata while keeping helper-only controls out of the emitted event.
  const metadata = normalizeEffectMetadata(options.metadata);
  const fields: SchedulerRecord = { ...options, ...(metadata ? { metadata } : {}) };
  for (const field of ['skill', 'cause', 'type', ...internalFields]) delete fields[field];
  return fields;
}

function emitProceduralEvent<TProfessionState extends object>(
  context: SchedulerContext<TProfessionState>,
  event: SimulationEventInput,
  cause?: SimulationEvent
): SimulationEvent {
  return cause ? context.emitDerived(cause, event) : context.emit(event);
}

/** Emits ordered, equally divided strike packets with canonical skill attribution. */
export function emitSkillDamage<TProfessionState extends object>(
  context: SchedulerContext<TProfessionState>,
  skill: Skill,
  options: EmitSkillDamageOptions
): readonly SimulationEvent[];
export function emitSkillDamage<TProfessionState extends object>(
  context: SchedulerContext<TProfessionState>,
  options: EmitSkillDamageOptions
): readonly SimulationEvent[];
export function emitSkillDamage<TProfessionState extends object>(
  context: SchedulerContext<TProfessionState>,
  skillOrOptions: Skill | EmitSkillDamageOptions,
  maybeOptions?: EmitSkillDamageOptions
): readonly SimulationEvent[] {
  const { skill, options } = skillEventArguments(context, skillOrOptions, maybeOptions);
  const preservesExistingEnvelope = maybeOptions == null && options.skill == null;
  const hits = Math.max(1, Math.trunc(Number(options.hits ?? 1)));
  const interval = Math.max(0, Number(options.interval ?? 0));
  const coefficient = Number(options.coefficient || 0) / hits;
  const envelope = standardEnvelope(context, skill, options);
  const emitted: SimulationEvent[] = [];

  for (let hitIndex = 1; hitIndex <= hits; hitIndex += 1) {
    const event: SimulationEventInput = {
      ...supplementalEventFields(options, ['interval']),
      ...envelope,
      type: 'damage',
      at: options.at + (hitIndex - 1) * interval,
      ...(options.name === null ? {} : { name: options.name ?? options.skillName ?? skill.name }),
      coefficient,
      hits: 1,
      hitIndex: options.hitIndex ?? hitIndex,
      totalHits: options.totalHits ?? hits,
      skillWeapon:
        options.skillWeapon ??
        (preservesExistingEnvelope
          ? ''
          : (skill.skillWeapon ?? (skill.type === 'Weapon' ? String(skill.weapon || '') : 'Unequipped'))),
      ...(options.canCrit === null ? {} : { canCrit: options.canCrit !== false })
    };
    emitted.push(emitProceduralEvent(context, event, options.cause));
  }

  return emitted;
}

/** Emits one condition application with canonical skill attribution. */
export function emitSkillCondition<TProfessionState extends object>(
  context: SchedulerContext<TProfessionState>,
  skill: Skill,
  options: EmitSkillConditionOptions
): SimulationEvent;
export function emitSkillCondition<TProfessionState extends object>(
  context: SchedulerContext<TProfessionState>,
  options: EmitSkillConditionOptions
): SimulationEvent;
export function emitSkillCondition<TProfessionState extends object>(
  context: SchedulerContext<TProfessionState>,
  skillOrOptions: Skill | EmitSkillConditionOptions,
  maybeOptions?: EmitSkillConditionOptions
): SimulationEvent {
  const { skill, options } = skillEventArguments(context, skillOrOptions, maybeOptions);
  const event: SimulationEventInput = {
    ...supplementalEventFields(options),
    ...standardEnvelope(context, skill, options),
    type: 'condition',
    at: options.at,
    ...(options.name === null
      ? {}
      : { name: options.name ?? `${options.skillName ?? skill.name} — ${options.condition}` }),
    condition: options.condition,
    stacks: options.stacks,
    duration: options.duration
  };
  return emitProceduralEvent(context, event, options.cause);
}

/** Emits one positive status, applying boon duration only to standard boons. */
export function emitSkillBuff<TProfessionState extends object>(
  context: SchedulerContext<TProfessionState>,
  skill: Skill,
  options: EmitSkillBuffOptions
): SimulationEvent;
export function emitSkillBuff<TProfessionState extends object>(
  context: SchedulerContext<TProfessionState>,
  options: EmitSkillBuffOptions
): SimulationEvent;
export function emitSkillBuff<TProfessionState extends object>(
  context: SchedulerContext<TProfessionState>,
  skillOrOptions: Skill | EmitSkillBuffOptions,
  maybeOptions?: EmitSkillBuffOptions
): SimulationEvent {
  const { skill, options } = skillEventArguments(context, skillOrOptions, maybeOptions);
  const adjustedDuration = gw2SchedulerBoonDuration(context, skill, options.kind, options.duration, {
    // Identity-only calls are migrations of complete event records, whose
    // durations have already crossed the profession's policy boundary.
    fixedDuration: options.fixedDuration ?? (maybeOptions === undefined && options.skill == null)
  });
  const duration =
    options.maximumDuration == null ? adjustedDuration : Math.min(options.maximumDuration, adjustedDuration);
  const audience = normalizeEffectAudience(options.audience);

  const event: SimulationEventInput = {
    ...supplementalEventFields(options, ['fixedDuration', 'maximumDuration']),
    ...standardEnvelope(context, skill, options),
    type: 'buff',
    at: options.at,
    ...(options.name ? { name: options.name } : {}),
    kind: options.kind,
    duration,
    stacks: options.stacks ?? 1,
    ...(audience ? { audience } : {})
  };
  return emitProceduralEvent(context, event, options.cause);
}

/** Emits one control packet with an explicit control kind and optional duration. */
export function emitSkillControl<TProfessionState extends object>(
  context: SchedulerContext<TProfessionState>,
  skill: Skill,
  options: EmitSkillControlOptions
): SimulationEvent;
export function emitSkillControl<TProfessionState extends object>(
  context: SchedulerContext<TProfessionState>,
  options: EmitSkillControlOptions
): SimulationEvent;
export function emitSkillControl<TProfessionState extends object>(
  context: SchedulerContext<TProfessionState>,
  skillOrOptions: Skill | EmitSkillControlOptions,
  maybeOptions?: EmitSkillControlOptions
): SimulationEvent {
  const { skill, options } = skillEventArguments(context, skillOrOptions, maybeOptions);
  const event: SimulationEventInput = {
    ...supplementalEventFields(options),
    ...standardEnvelope(context, skill, options),
    type: 'control',
    at: options.at,
    ...(options.name ? { name: options.name } : {}),
    controlKind: options.controlKind ?? 'control',
    ...(options.duration == null ? {} : { duration: options.duration })
  };
  return emitProceduralEvent(context, event, options.cause);
}
