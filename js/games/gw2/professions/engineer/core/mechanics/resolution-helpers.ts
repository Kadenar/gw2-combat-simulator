import type { ComboFieldSelectionAnchor } from '#gw2/platform/combos/types.js';
import { ACTOR, type BoonId, type ComboFinisherType, type SimulationActorType } from '#gw2/platform/constants.js';
import { buildResolverCondition, buildResolverStrike } from '#gw2/platform/effects/packet-builders.js';
import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { EngineerResolverContext, EngineerResolverEvent, EngineerSkill } from '#gw2/professions/engineer/types.js';

interface QueueDamageOptions {
  /** Callers select the weapon identity; general strike construction must not assume Spear. */
  readonly skillWeapon: NonNullable<SimulationEventBase['skillWeapon']>;
  readonly name: string;
  readonly coefficient: number;
  readonly sourceId?: SkillId | null;
  readonly actorType?: SimulationActorType;
  readonly ownerActorType?: SimulationActorType;
  readonly damageKind?: string;
  // The impact supplies timing, and the shared runtime generates the attempt identity.
  readonly comboFinisher?: {
    readonly ownerId: string;
    readonly finisherType: ComboFinisherType;
    /** Moving finishers can retain a field encountered before impact. */
    readonly fieldSelectionAnchor?: ComboFieldSelectionAnchor;
    readonly chance?: number;
    readonly applications?: number;
    readonly successfulCombos?: number;
  };
}

interface ApplyConditionOptions {
  readonly name: string;
  readonly condition: string;
  readonly stacks: number;
  readonly duration: number;
  /** Summon conditions receive companion ownership from their specialization, so this builder excludes them. */
  readonly actorType?: typeof ACTOR.PLAYER | typeof ACTOR.EFFECT;
  readonly ownerActorType?: SimulationActorType;
  /** Some derived conditions ignore condition duration. */
  readonly fixedDuration?: boolean;
}

/** Resolves an event's skill ID to Engineer-specific catalog metadata. */
export function resolverSkill(
  context: EngineerResolverContext,
  skillId: SkillId | null | undefined
): EngineerSkill | undefined {
  if (skillId == null) return;

  return context.helpers.skillsById.get(skillId);
}

/** Builds a crit-eligible strike at the triggering impact; shared resolution selects strength and attempts finishers. */
export function buildEngineerStrike(
  event: EngineerResolverEvent,
  {
    name,
    coefficient,
    skillWeapon,
    sourceId = event.skillId,
    actorType = ACTOR.PLAYER,
    ownerActorType,
    damageKind,
    comboFinisher
  }: QueueDamageOptions
): SimulationEventBase {
  return buildResolverStrike({
    at: event.at,
    skillName: name,
    coefficient,

    source: actorType === ACTOR.EFFECT ? 'Trait' : 'engineer',
    sourceId: sourceId ?? event.skillId ?? event.sourceId,
    actorType,
    // Effect-owned strikes can inherit player modifiers without becoming player actors for proc eligibility.
    ...(ownerActorType == null ? {} : { ownerActorType }),
    // Set skillId only on player events. Summon and effect damage must not carry the parent skill ID.
    skillId: actorType === ACTOR.PLAYER ? event.skillId : undefined,
    ...(actorType === ACTOR.PLAYER ? { activationId: event.activationId, offTarget: event.offTarget } : {}),
    skillWeapon,
    canCrit: true,
    // Derived strikes declare their damage kind independently of the triggering packet.
    ...(damageKind == null ? {} : { damageKind }),
    ...(comboFinisher
      ? {
          comboFinishers: [
            {
              ownerId: comboFinisher.ownerId,
              finisherType: comboFinisher.finisherType,
              fieldSelectionAnchor: comboFinisher.fieldSelectionAnchor,
              chance: comboFinisher.chance ?? 1,
              applications: comboFinisher.applications ?? 1,
              successfulCombos: comboFinisher.successfulCombos ?? 1
            }
          ]
        }
      : {}),
    triggeredBy: event.skillName
  });
}

/** Builds a fresh player or effect condition without inheriting the triggering hit's annotations. */
export function buildEngineerCondition(
  event: EngineerResolverEvent,
  { name, condition, stacks, duration, actorType = ACTOR.PLAYER, ownerActorType, fixedDuration }: ApplyConditionOptions
): SimulationEventBase {
  return buildResolverCondition({
    at: event.at,

    skillName: name,
    condition,
    stacks,
    duration,
    source: actorType === ACTOR.EFFECT ? 'Trait' : 'engineer',
    // Derived conditions keep the triggering skill identity, including packets that only name a source.
    sourceId: event.skillId ?? event.sourceId,
    actorType,
    offTarget: event.offTarget,
    // Effect-owned conditions can inherit player modifiers without becoming player actors for proc eligibility.
    ...(ownerActorType == null ? {} : { ownerActorType }),
    triggeredBy: event.skillName,
    ...(fixedDuration == null ? {} : { fixedDuration })
  });
}

/** Read player boon stacks at the explicit event time, including permanent and accepted timed grants. */
export function resolverBoonStacks(
  context: EngineerResolverContext,
  kind: BoonId,
  maximum: number,
  at: number
): number {
  return context.combat.activeBoonStacks(kind, at, maximum);
}

/** Damage modifiers and on-hit traits read the accepted packet's explicit explosion classification. */
export function isExplosion(event: Partial<SimulationEventBase> | null | undefined): boolean {
  return event?.damageKind === 'explosion';
}
