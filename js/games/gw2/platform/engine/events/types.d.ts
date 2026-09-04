/** Defines emitted events and recipient metadata shared by scheduling, resolution, and presentation. */
import type { SkillId } from '#gw2/platform/engine/skills/types.js';

export type SimulationActorType = 'player' | 'summon' | 'effect' | 'environment' | 'unknown';

export type EffectRecipientScope = 'self' | 'party' | 'summons';

/** Selects the canonical recipient group for one positive effect. */
export interface EffectAudience {
  readonly recipients: EffectRecipientScope;
  readonly affectsSelf?: boolean;
  readonly maximumRecipients?: number;
  readonly eligibleCompanionIds?: readonly string[];
}

/** Records the recipients selected after player-first audience resolution. */
export interface ResolvedEffectAudience {
  readonly includesSelf: boolean;
  readonly includesSummons: boolean;
  readonly alliedPlayerCount: number;
  readonly companionIds: readonly string[];
  readonly recipientCount: number;
}

/** Closed vocabulary of subsystem-owned annotations preserved as one nested object. */
export interface EffectMetadata {
  readonly activeSpirits?: number;
  readonly affinityOnHit?: boolean;
  readonly anguishConditionalDamage?: boolean;
  readonly blightEmpowered?: boolean;
  readonly dhuumfireDuration?: number;
  readonly dhuumfireInterval?: number;
  readonly engineerMech?: boolean;
  readonly essenceBlastDamagePerSpirit?: number;
  readonly evtcSkillId?: SkillId;
  readonly hitboxIndex?: number;
  readonly largeHitboxOnly?: boolean;
  readonly legendId?: string;
  readonly necromancerBlight?: number;
  readonly necromancerShroudSkillOne?: boolean;
  readonly packetKind?: string;
  readonly radiantWeapon?: string;
  readonly smallHitboxCap?: number;
  readonly spirit?: string;
  readonly spiritAttackType?: string;
  readonly trigger?: string;
}

export type CommonSimulationEventType =
  | 'action'
  | 'aura'
  | 'combo'
  | 'combo_field'
  | 'combo_finisher'
  | 'combat_start'
  | 'condition_tick'
  | 'control'
  | 'blind'
  | 'weapon_set'
  | 'sigil_swap'
  | 'proc'
  | 'marker'
  | 'resource'
  | 'buff'
  | 'cooldown_snapshot'
  | 'self_condition'
  | 'weakness_vulnerability'
  | 'peitha';

export type CustomSimulationEventType = `${string}.${string}`;

export interface SimulationEventBase<TType extends string = string> {
  readonly schemaVersion?: 1;
  readonly type: TType;
  readonly at: number;
  readonly source: string;
  readonly sourceId: SkillId;
  readonly actorType?: SimulationActorType;
  readonly ownerActorType?: SimulationActorType;
  readonly summonKind?: string;
  readonly name?: string;
  readonly skillName?: string;
  readonly parentSkillName?: string;
  readonly skillId?: SkillId | null;
  readonly icon?: string;
  readonly kind?: string;
  readonly duration?: number;
  readonly stacks?: number;
  readonly weaponSet?: number;
  readonly procType?: string;
  readonly sourceSkill?: string;
  readonly detail?: string;
  readonly triggeredBy?: string;
  readonly activationId?: string;
  /** Monotone identity assigned when the scheduler emits the event. */
  readonly eventOrder?: number;
  /** Same-timestamp position of an event derived from another scheduled event. */
  readonly causalOrder?: number;
  readonly weaponStrengthProfileId?: string;
  readonly weaponStrength?: number;
  readonly cooldownReduction?: number;
  readonly audience?: EffectAudience;
  readonly resolvedAudience?: ResolvedEffectAudience;
  readonly metadata?: EffectMetadata;
  readonly [field: string]: unknown;
}

export type DamageEvent = SimulationEventBase<'damage'> &
  (
    | {
        readonly coefficient: number;
      }
    | {
        readonly coefficient?: number;
        readonly flatDamage: number;
      }
    | {
        readonly coefficient?: number;
        readonly flatStrikeBase: number;
      }
    | {
        readonly coefficient?: number;
        readonly flatStrikePowerCoeff: number;
      }
  ) & {
    readonly coefficientModifiers?: ReadonlyArray<{
      readonly kind: 'target-health-below';
      readonly threshold: number;
      readonly multiplier: number;
    }>;
    readonly hits?: number;
    readonly canCrit?: boolean;
    readonly forceCrit?: boolean;
    readonly canTriggerCriticalSigils?: boolean;
    readonly canTriggerCriticalTraits?: boolean;
    readonly didCrit?: boolean;
  };

export interface ConditionEvent extends SimulationEventBase<'condition'> {
  readonly condition: string;
  readonly stacks: number;
  readonly duration: number;
}

export type CommonSimulationEvent = SimulationEventBase<CommonSimulationEventType>;

export type CustomSimulationEvent = SimulationEventBase<CustomSimulationEventType>;

export type SimulationEvent = DamageEvent | ConditionEvent | CommonSimulationEvent | CustomSimulationEvent;

export interface SimulationEventInput {
  readonly type: string;
  readonly at: number;
  readonly source: string;
  readonly sourceId: SkillId;
  readonly actorType?: SimulationActorType;
  readonly ownerActorType?: SimulationActorType;
  readonly summonKind?: string;
  readonly name?: string;
  readonly skillName?: string;
  readonly parentSkillName?: string;
  readonly skillId?: SkillId | null;
  readonly icon?: string;
  readonly kind?: string;
  readonly duration?: number;
  readonly stacks?: number;
  readonly weaponSet?: number;
  readonly procType?: string;
  readonly sourceSkill?: string;
  readonly detail?: string;
  readonly triggeredBy?: string;
  readonly activationId?: string;
  readonly eventOrder?: number;
  readonly causalOrder?: number;
  readonly weaponStrengthProfileId?: string;
  readonly weaponStrength?: number;
  readonly cooldownReduction?: number;
  readonly audience?: EffectAudience;
  readonly resolvedAudience?: ResolvedEffectAudience;
  readonly metadata?: EffectMetadata;
  readonly [field: string]: unknown;
}

export interface ScheduledEventStream {
  readonly kind: 'gw2.simulation.events';
  readonly version: 1;
  readonly eventSchemaVersion: 1;
  readonly source: string;
  readonly rotationEndTime: number;
  readonly resolutionEndTime?: number;
  readonly events: readonly SimulationEvent[];
  readonly resolverHandoff: Readonly<Record<string, unknown>>;
}
