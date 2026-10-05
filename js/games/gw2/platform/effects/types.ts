import type { EffectReaction } from '#gw2/platform/effects/reactions.js';
import type { SimulationActorType } from '#gw2/platform/events/actors.js';
import type { DamageEvent, EffectAudience, EffectMetadata } from '#gw2/platform/events/events.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicQueryContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { SkillId } from '#gw2/platform/skills/types.js';

/** Defines catalog skills and declarative effects so authored data stays independent of runtime implementations. */

export interface StrikeTick {
  readonly atMs: number;
  /** A packet can override the enclosing effect's combo finisher metadata. */
  readonly comboFinishers?: readonly Readonly<Record<string, unknown>>[];
  readonly projectile?: boolean;
  readonly coefficient: number;
  readonly name?: string;
  readonly weaponStrength?: number;
  readonly independentSummonStrike?: boolean;
  readonly summonUsesProfessionModifiers?: boolean;
  readonly summonInheritsAttributes?: boolean;
  readonly summonInheritsCriticalAttributes?: boolean;
  readonly metadata?: EffectMetadata;
  readonly [field: string]: unknown;
}

export interface ConditionTick {
  readonly atMs: number;
  readonly comboFinishers?: readonly Readonly<Record<string, unknown>>[];
  readonly condition: string;
  readonly stacks: number;
  readonly duration: number;
  readonly damageKind?: string;
  readonly projectile?: boolean;
  readonly metadata?: EffectMetadata;
  readonly [field: string]: unknown;
}

/** Catalog effects are shared read-only declarations; runtime changes belong in derived packets. */
export interface SkillEffectBase {
  /** Accepted applications invoke only the reactions authored on this particular effect. */
  readonly reactions?: readonly EffectReaction[];
  readonly type: string;
  /** Capture acceptance-time eligibility once; impact-time state remains a resolver responsibility. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Catalogs combine callbacks authored against different profession runtimes; dispatch preserves the owning runtime.
  readonly when?: (runtime: MechanicQueryContext<any>, cast: RuntimeCast) => boolean;
  readonly atMs?: number;
  readonly intervalMs?: number;
  readonly timingAnchor?: 'castStart' | 'castEnd';
  /** `cast` values are authored on the Quickness timeline and expand for slower casts. */
  readonly timingScale?: 'cast' | 'fixed';
  readonly applications?: number;
  readonly persistsAfterInterrupt?: boolean;
  /** Effect-specific launch cutoff; falls back to the parent skill cutoff. */
  readonly interruptCommitMs?: number;
  readonly source?: string;
  readonly sourceId?: SkillId;
  readonly actorType?: SimulationActorType;
  readonly ownerActorType?: SimulationActorType;
  readonly summonKind?: string;
  readonly summonOwner?: string;
  readonly name?: string;
  readonly skillName?: string;
  readonly parentSkillName?: string;
  readonly icon?: string;
  readonly audience?: EffectAudience;
  readonly metadata?: EffectMetadata;
  readonly comboFields?: readonly Readonly<Record<string, unknown>>[];
  readonly comboFinishers?: readonly Readonly<Record<string, unknown>>[];
  readonly [field: string]: unknown;
}

export interface StrikeEffect extends SkillEffectBase {
  readonly type: 'strike';
  /** Autonomous summon animation, excluding idle time, for recipient-specific attack scheduling. */
  readonly castTimeMs?: number;
  /** Optional row label separates an effect's damage while preserving its source skill. */
  readonly damageBreakdownName?: string;
  /** Aggregate coefficient; hits above one require one explicit shared atMs timestamp. */
  readonly coefficient?: number;
  readonly hits?: number;
  /** Distinct packet timestamps and formulas. Mutually exclusive with aggregate fields. */
  readonly ticks?: readonly StrikeTick[];
  /** Strike intervals are invalid; distinct timestamps belong in ticks. */
  readonly intervalMs?: never;
  readonly coefficientModifiers?: DamageEvent['coefficientModifiers'];
  readonly weapon?: string;
  readonly weaponStrength?: number;
  readonly weaponStrengthProfileId?: string;
  readonly weaponStrengthSource?: 'equipped';
  readonly flatDamage?: number;
  readonly flatStrikeBase?: number;
  readonly flatStrikePowerCoeff?: number;
  readonly flatStrikeMultiplier?: number;
  readonly flatStrikeHealthThreshold?: number;
  readonly flatStrikeThresholdMultiplier?: number;
  readonly canCrit?: boolean;
  readonly forceCrit?: boolean;
  readonly damageKind?: string;
  readonly projectile?: boolean;
}

export interface ConditionEffect extends SkillEffectBase {
  readonly type: 'condition';
  readonly condition?: string;
  readonly stacks?: number;
  readonly duration?: number;
  readonly ticks?: readonly ConditionTick[];
  readonly target?: string;
}

/** Controls record applications for proc consumers without modeling disable windows. */
export interface ControlEffect extends SkillEffectBase {
  readonly type: 'control';
  readonly controlKind?: string;
}

export interface CustomEffect extends SkillEffectBase {
  readonly type: 'custom';
  readonly eventType: string;
  readonly event: Readonly<Record<string, unknown>>;
}

export type SkillEffect = StrikeEffect | ConditionEffect | ControlEffect | StatusEffect | CustomEffect;

export interface StatusEffect extends SkillEffectBase {
  readonly type: 'boon' | 'buff';
  /** Limits each grant after duration bonuses, independently of the buff pool's stacking cap. */
  readonly maximumDuration?: number;
  readonly boon?: string;
  readonly kind?: string;
  readonly duration: number;
  readonly stacks?: number;
}
