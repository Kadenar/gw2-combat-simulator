import type { ComboFieldType, ComboFinisherType } from '#gw2/platform/combos/types.js';
import type { SimulationActorType } from '#gw2/platform/events/actors.js';
import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import {
  buildResolverBuff,
  buildResolverCondition,
  buildResolverStrike
} from '#gw2/platform/effects/packet-builders.js';
import type { EngineerResolverContext, EngineerResolverEvent, EngineerSkill } from '#gw2/professions/engineer/types.js';

interface QueueDamageOptions {
  /** Callers select the weapon identity; general strike construction must not assume Spear. */
  readonly skillWeapon: NonNullable<SimulationEventBase['skillWeapon']>;
  readonly name: string;
  readonly coefficient: number;
  readonly sourceId?: SkillId | null;
  readonly actorType?: SimulationActorType;
  readonly ownerActorType?: SimulationActorType;
  readonly at?: number;
  readonly canCrit?: boolean;
  readonly explosion?: boolean;
  // The impact supplies timing, and the shared runtime generates the attempt identity.
  readonly comboFinisher?: {
    readonly ownerId: string;
    readonly finisherType: ComboFinisherType;
    readonly chance?: number;
    readonly applications?: number;
    readonly successfulCombos?: number;
    readonly preferredFieldTypes?: readonly ComboFieldType[];
    readonly ambiguousFieldSelection?: 'none' | 'oldest';
  };
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
  readonly procCount?: number;
  readonly name: string;
  readonly condition: string;
  readonly stacks: number;
  readonly duration: number;
  readonly sourceId?: SkillId | null;
  readonly actorType?: SimulationActorType;
  readonly ownerActorType?: SimulationActorType;
  /** Derived conditions retain fixed-duration behavior and nested companion ownership metadata. */
  readonly metadata?: {
    readonly fixedDuration?: boolean;
    readonly engineerMech?: boolean;
  };
}

/** Resolves an event's skill ID to Engineer-specific catalog metadata. */
export function resolverSkill(
  context: EngineerResolverContext,
  skillId: SkillId | null | undefined
): EngineerSkill | undefined {
  if (skillId == null) return;
  return context.helpers.skillsById.get(skillId);
}

/** Builds an owned strike whose finisher is attempted by the shared runtime at impact. */
export function buildEngineerStrike(
  event: EngineerResolverEvent,
  {
    name,
    coefficient,
    skillWeapon,
    sourceId = event.skillId,
    actorType = 'player',
    ownerActorType,
    at = event.at,
    canCrit = true,
    explosion = false,
    comboFinisher,
    weaponStrength,
    weaponStrengthProfileId
  }: QueueDamageOptions
): SimulationEventBase {
  return buildResolverStrike({
    at,
    skillName: name,
    coefficient,

    source: actorType === 'effect' ? 'Trait' : 'engineer',
    sourceId: sourceId ?? event.skillId ?? event.sourceId,
    actorType,
    // Effect-owned strikes can inherit player modifiers without becoming player actors for proc eligibility.
    ...(ownerActorType == null ? {} : { ownerActorType }),
    // skillId only on player events — summon/effect damage should not carry the parent skill ID
    skillId: actorType === 'player' ? event.skillId : undefined,
    ...(actorType === 'player' ? { activationId: event.activationId, offTarget: event.offTarget } : {}),
    skillWeapon,
    canCrit,
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
}

/** Builds base-duration buff data; the shared service samples live duration when the grant executes. */
export function buildEngineerBuff(
  event: EngineerResolverEvent,
  { name, kind, stacks, duration, sourceId = event.skillId, actorType = 'player' }: QueueBuffOptions
): SimulationEventBase {
  return buildResolverBuff({
    at: event.at,
    skillName: name,
    kind,
    stacks,
    duration,
    source: actorType === 'effect' ? 'Trait' : 'engineer',
    sourceId: sourceId ?? event.skillId ?? event.sourceId,
    actorType,
    triggeredBy: event.skillName
  });
}

/** Builds a fresh condition while preserving explicit companion ownership and rejecting inherited hit annotations. */
export function buildEngineerCondition(
  event: EngineerResolverEvent,
  {
    name,
    condition,
    stacks,
    duration,
    sourceId = event.skillId,
    actorType = 'player',
    ownerActorType,
    metadata = {},
    procCount
  }: ApplyConditionOptions
): SimulationEventBase {
  const application = buildResolverCondition({
    at: event.at,

    skillName: name,
    condition,
    stacks,
    duration,
    source: actorType === 'effect' ? 'Trait' : 'engineer',
    sourceId: sourceId ?? event.skillId ?? event.sourceId,
    actorType,
    offTarget: event.offTarget,
    // Derived summon conditions retain the triggering companion's concrete identity.
    ...(actorType === 'summon'
      ? { summonOwner: event.summonOwner, independentConditionOwner: event.independentConditionOwner }
      : {}),
    // Effect-owned conditions can inherit player modifiers without becoming player actors for proc eligibility.
    ...(ownerActorType == null ? {} : { ownerActorType }),
    triggeredBy: event.skillName,
    ...(metadata.fixedDuration == null ? {} : { fixedDuration: metadata.fixedDuration }),
    // Companion identity must remain in event metadata so derived conditions use the mech's attributes.
    metadata: {
      ...(metadata.engineerMech == null ? {} : { engineerMech: metadata.engineerMech }),
      ...(procCount == null ? {} : { procCount })
    },
    ...(actorType === 'summon' && metadata.engineerMech ? { summonInheritsAttributes: true } : {})
  });
  return application;
}

/** Adapts resolver time and lowercase boon names to the shared permanent-plus-timed stack query. */
export function activeBoonStacks(context: EngineerResolverContext, kind: string, maximum = 25, at = 0): number {
  return context.combat.activeBoonStacks((kind || '').toLowerCase(), at, maximum);
}

// Keep shared explosion classification here so every later Explosives reaction consumes the same result.
export function isExplosion(context: EngineerResolverContext, event: EngineerResolverEvent): boolean {
  if (event.explosion || event.damageKind === 'explosion') return true;
  const skill = resolverSkill(context, event.skillId ?? event.sourceId);
  return Boolean(skill?.categories?.some((category) => category.toLowerCase() === 'explosion'));
}
