import { enqueueOrdered } from '#kernel/events/queue.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { clamp } from '#gw2/platform/combat/numeric.js';
import {
  enqueueGw2OwnedComboFinisher,
  type EnqueueGw2OwnedComboFinisherOptions
} from '#gw2/platform/resolver/combo-resolution.js';
import { gw2ResolverBoonDuration } from '#gw2/platform/resolver/boon-duration.js';
import type { SchedulerRecord, SimulationActorType, SkillId } from '#gw2/platform/engine/types.js';
import type { Gw2EventDraft } from '#gw2/platform/equipment/relics/types.js';
import type {
  EngineerResolverContext,
  EngineerResolverEvent,
  EngineerSkill
} from '#gw2/content/professions/engineer/types.js';

interface QueueDamageOptions {
  readonly name: string;
  readonly coefficient: number;
  readonly sourceId?: SkillId | null;
  readonly actorType?: SimulationActorType;
  readonly ownerActorType?: SimulationActorType;
  readonly at?: number;
  readonly noCrit?: boolean;
  readonly explosion?: boolean;
  readonly comboFinisher?: Omit<EnqueueGw2OwnedComboFinisherOptions, 'at' | 'effectAt'>;
  readonly weaponStrength?: number;
  readonly weaponStrengthProfileId?: string;
}

interface QueueBuffOptions {
  readonly name: string;
  readonly kind: string;
  readonly stacks: number;
  readonly duration: number;
  readonly sourceId?: SkillId | null;
  readonly actorType?: SimulationActorType;
}

interface ApplyConditionOptions {
  readonly name: string;
  readonly condition: string;
  readonly stacks: number;
  readonly duration: number;
  readonly sourceId?: SkillId | null;
  readonly actorType?: SimulationActorType;
  readonly metadata?: SchedulerRecord;
}

/** Resolves an event's skill ID to Engineer-specific catalog metadata. */
export function resolverSkill(
  context: EngineerResolverContext,
  skillId: SkillId | null | undefined
): EngineerSkill | undefined {
  if (skillId == null) return;
  return context.helpers.skillsById?.get(skillId) as EngineerSkill | undefined;
}

/** Enqueues one derived Engineer strike and materializes any attached combo finisher. */
export function queueDamage(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
  {
    name,
    coefficient,
    sourceId = event.skillId,
    actorType = 'player',
    ownerActorType,
    at = event.at,
    noCrit = false,
    explosion = false,
    comboFinisher,
    weaponStrength,
    weaponStrengthProfileId
  }: QueueDamageOptions
): void {
  const damage = enqueueOrdered(context.queue, {
    type: 'damage',
    at,
    name,
    skillName: name,
    coefficient,
    hits: 1,
    hitIndex: 1,
    totalHits: 1,
    source: actorType === 'effect' ? 'Trait' : 'engineer',
    sourceId: sourceId ?? event.skillId ?? event.sourceId,
    actorType,
    // Effect-owned strikes can inherit player modifiers without becoming player actors for proc eligibility.
    ...(ownerActorType == null ? {} : { ownerActorType }),
    // skillId only on player events — summon/effect damage should not carry the parent skill ID
    skillId: actorType === 'player' ? event.skillId : undefined,
    // "Spear" default for player spear skills; non-player damage uses "Unequipped" for weapon lookups
    skillWeapon: actorType === 'player' ? 'Spear' : 'Unequipped',
    noCrit,
    explosion,
    ...(comboFinisher
      ? {
          comboFinishers: [
            {
              ownerId: comboFinisher.ownerId,
              finisherType: comboFinisher.finisherType,
              chance: comboFinisher.chance ?? 1,
              applications: comboFinisher.applications ?? 1,
              successfulCombos: comboFinisher.successfulCombos ?? 1,
              preferredFieldTypes: comboFinisher.preferredFieldTypes,
              ambiguousFieldSelection: comboFinisher.ambiguousFieldSelection ?? 'none'
            }
          ]
        }
      : {}),
    ...(weaponStrength == null ? {} : { weaponStrength }),
    ...(weaponStrengthProfileId == null ? {} : { weaponStrengthProfileId }),
    triggeredBy: event.skillName
  });
  if (comboFinisher) {
    enqueueGw2OwnedComboFinisher(context, damage, {
      ...comboFinisher,
      at,
      effectAt: at
    });
  }
}

/** Enqueues a derived Engineer buff after applying the shared boon-duration rules. */
export function queueBuff(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
  { name, kind, stacks, duration, sourceId = event.skillId, actorType = 'player' }: QueueBuffOptions
): void {
  const adjustedDuration = gw2ResolverBoonDuration(context, event, kind, duration);
  enqueueOrdered(context.queue, {
    type: 'buff',
    at: event.at,
    name,
    skillName: name,
    kind,
    stacks,
    duration: adjustedDuration,
    source: actorType === 'effect' ? 'Trait' : 'engineer',
    sourceId: sourceId ?? event.skillId ?? event.sourceId,
    actorType,
    triggeredBy: event.skillName
  });
}

/** Applies a derived condition immediately so same-timestamp reactions observe it in order. */
export function applyEngineerDerivedCondition(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
  {
    name,
    condition,
    stacks,
    duration,
    sourceId = event.skillId,
    actorType = 'player',
    metadata = {}
  }: ApplyConditionOptions
): void {
  const application: Gw2EventDraft = {
    type: 'condition',
    at: event.at,
    name: `${name} — ${condition}`,
    skillName: name,
    condition,
    stacks,
    duration,
    source: actorType === 'effect' ? 'Trait' : 'engineer',
    sourceId: sourceId ?? event.skillId ?? event.sourceId,
    actorType,
    triggeredBy: event.skillName,
    ...metadata
  };
  // Apply resolver-derived conditions immediately so downstream reactions at
  // this timestamp observe the newly inserted condition state.
  context.applyCondition(application);
}

/** Returns the lazily initialized Core trait proc state shared by Engineer reactions. */
export function procState(context: EngineerResolverContext): Record<string, number | boolean> {
  const state = professionCoreState(context);
  state.traitProcReadyAt ||= {};
  return state.traitProcReadyAt;
}

/** Records a trait proc for result attribution without changing combat state. */
export function recordTrait(
  context: EngineerResolverContext,
  name: string,
  event: EngineerResolverEvent,
  icon = ''
): void {
  context.recordProc?.('trait', name, event.at, event.skillName, '', icon);
}

/** Counts permanent and timed boon applications at a timestamp, capped to the requested maximum. */
export function activeBoonStacks(context: EngineerResolverContext, kind: string, maximum = 25, at = 0): number {
  const normalized = String(kind || '').toLowerCase();
  const permanent = context.config?.boons?.[normalized];
  // config true = permanently 1 stack; numeric value = assumed stack count
  const base = permanent === true ? 1 : Number(permanent || 0);
  const applications = context.boons?.get(normalized) || [];
  const dynamic = applications
    .filter((application) => application.at <= at && application.expiresAt > at)
    .reduce((sum, application) => sum + Number(application.stacks || 1), 0);
  return clamp(base + dynamic, 0, maximum);
}
