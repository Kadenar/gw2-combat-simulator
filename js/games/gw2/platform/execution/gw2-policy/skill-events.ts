/**
 * Canonical scheduler-side emitters for procedural skill effects. These helpers
 * keep the common GW2 event envelope aligned with declarative effects while
 * leaving unusual profession metadata and ownership explicit at the call site.
 */
import type { DynamicFields, UnvalidatedFields } from '#kernel/core/unvalidated.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/execution/gw2-policy/policy.js';
import { normalizeEffectAudience, normalizeEffectMetadata } from '#gw2/platform/engine/effects/contracts.js';

import type {
  ConditionEventFields,
  EffectAudience,
  EffectMetadata,
  SimulationEvent,
  SimulationEventBase
} from '#gw2/platform/engine/events/events.js';
import type { SimulationActorType } from '#gw2/platform/engine/events/actors.js';
import type { SchedulerContext } from '#gw2/platform/execution/types.js';
import type { Skill, SkillId } from '#gw2/platform/engine/skills/types.js';

interface SkillEventOwnership {
  /** Default attribution; sourceId may independently identify the trait or effect that produced the packet. */
  readonly skill?: Skill;
  readonly cause?: SimulationEvent;
  readonly source?: string;
  readonly sourceId?: SkillId;
  readonly actorType?: SimulationActorType;
  readonly ownerActorType?: SimulationActorType;
  readonly summonKind?: string;
  /** Undefined uses the skill identity; null omits attribution from the emitted event. */
  readonly skillId?: SkillId | null;
  readonly skillName?: string | null;
  /** Undefined generates a label; null omits the label. */
  readonly name?: string | null;
  readonly parentSkillName?: string;
  readonly activationId?: string;
  readonly triggeredBy?: string;
  readonly priority?: number;
}

interface SkillEventMetadata {
  /** Profession-specific fields that are outside the canonical GW2 envelope. */
  readonly metadata?: EffectMetadata;
}

interface StandardSkillEventEnvelope {
  readonly source: string;
  readonly sourceId: SkillId;
  /** Standard emitters always supply ownership, including their player default. */
  readonly actorType: SimulationActorType;
}

export interface EmitSkillDamageOptions extends SkillEventOwnership, SkillEventMetadata, UnvalidatedFields {
  readonly at: number;
  /** Total coefficient across every emitted hit. */
  readonly coefficient: number;
  readonly hits?: number;
  /** Delay between hit packets in simulation seconds. */
  readonly interval?: number;
  readonly hitIndex?: number;
  readonly totalHits?: number;
  readonly skillWeapon?: string;
  readonly canCrit?: boolean | null;
}

export interface EmitSkillConditionOptions extends SkillEventOwnership, SkillEventMetadata, ConditionEventFields {}

export interface EmitSkillBuffOptions extends SkillEventOwnership, SkillEventMetadata, UnvalidatedFields {
  readonly at: number;
  readonly name?: string;
  readonly kind: string;
  readonly duration: number;
  readonly stacks?: number;
  readonly fixedDuration?: boolean;
  readonly maximumDuration?: number;
  readonly audience?: EffectAudience;
}

export interface EmitSkillControlOptions extends SkillEventOwnership, SkillEventMetadata, UnvalidatedFields {
  readonly at: number;
  readonly name?: string;
  readonly controlKind?: string;
}

function skillEventFields<TProfessionState extends object>(
  context: SchedulerContext<TProfessionState>,
  skill: Skill,
  options: SkillEventOwnership & SkillEventMetadata,
  internalFields: readonly string[] = []
): StandardSkillEventEnvelope & UnvalidatedFields {
  // Separate normalized attribution from pass-through fields so omitted values cannot leak back through a spread.
  const {
    skill: _skill,
    cause: _cause,
    name: _name,
    source,
    sourceId,
    actorType,
    skillId,
    skillName,
    metadata,
    ...rest
  } = options;
  const fields: DynamicFields = rest;
  for (const field of ['type', ...internalFields]) delete fields[field];
  const normalizedMetadata = normalizeEffectMetadata(metadata);
  return {
    ...fields,
    source: source ?? context.profession.id,
    sourceId: sourceId ?? skill.id,
    actorType: actorType ?? 'player',
    ...(skillId === null ? {} : { skillId: skillId ?? skill.id }),
    ...(skillName === null ? {} : { skillName: skillName ?? skill.name }),
    ...(normalizedMetadata ? { metadata: normalizedMetadata } : {})
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
      name: options.skillName ?? String(options.name || id)
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

function emitProceduralEvent<TProfessionState extends object>(
  context: SchedulerContext<TProfessionState>,
  event: SimulationEventBase,
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
  const fields = skillEventFields(context, skill, options, [
    'at',
    'interval',
    'coefficient',
    'hits',
    'hitIndex',
    'totalHits',
    'skillWeapon',
    'canCrit'
  ]);
  const emitted: SimulationEvent[] = [];

  for (let hitIndex = 1; hitIndex <= hits; hitIndex += 1) {
    const event: SimulationEventBase = {
      ...fields,
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

/** Emits one condition application; explicit attribution overrides skill defaults, and null omits optional identity. */
export function emitSkillCondition<TProfessionState extends object>(
  context: SchedulerContext<TProfessionState>,
  options: EmitSkillConditionOptions
): SimulationEvent {
  const skill = proceduralSkill(context, options);
  const event: SimulationEventBase = {
    ...skillEventFields(context, skill, options, ['at', 'condition', 'stacks', 'duration']),
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

  const event: SimulationEventBase = {
    ...skillEventFields(context, skill, options, [
      'at',
      'kind',
      'duration',
      'stacks',
      'audience',
      'fixedDuration',
      'maximumDuration'
    ]),
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

/** Emits an instantaneous control fact for proc consumers; it does not model a disable window. */
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
  const event: SimulationEventBase = {
    ...skillEventFields(context, skill, options, ['at', 'controlKind']),
    type: 'control',
    at: options.at,
    ...(options.name ? { name: options.name } : {}),
    controlKind: options.controlKind ?? 'control'
  };
  return emitProceduralEvent(context, event, options.cause);
}
