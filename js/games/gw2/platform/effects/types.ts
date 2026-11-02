import type { OwnedComboDescriptor } from '#gw2/platform/combos/types.js';
import type { AuraName, SimulationActorType } from '#gw2/platform/constants.js';
import type { EffectReaction } from '#gw2/platform/effects/reactions.js';
import type { DamageEvent, EffectAudience, EffectMetadata } from '#gw2/platform/events/events.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicQueryContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { SkillDamageModifier } from '#gw2/platform/skills/modifiers.js';
import type { SkillId } from '#gw2/platform/skills/types.js';

/**
 * Declarative skill-effect schemas (strike, condition, control, status, custom) so authored effects stay independent
 * of runtime implementations.
 */

/** Strike formula and ownership fields an effect declares once and an individual packet may override. */
export interface StrikePacketFields {
  /** A packet can override the enclosing effect's combo finisher metadata. */
  readonly comboFinishers?: readonly OwnedComboDescriptor[];
  readonly projectile?: boolean;
  readonly name?: string;
  /** Optional row label separates an effect's damage while preserving its source skill. */
  readonly damageBreakdownName?: string;
  readonly weaponStrength?: number;
  readonly independentSummonStrike?: boolean;
  readonly summonUsesProfessionModifiers?: boolean;
  readonly summonInheritsAttributes?: boolean;
  readonly summonInheritsCriticalAttributes?: boolean;
  readonly flatDamage?: number;
  readonly flatStrikeBase?: number;
  readonly flatStrikePowerCoeff?: number;
  readonly flatStrikeMultiplier?: number;
  readonly flatStrikeHealthThreshold?: number;
  readonly flatStrikeThresholdMultiplier?: number;
  readonly canCrit?: boolean;
  readonly forceCrit?: boolean;
  readonly damageKind?: string;
  readonly metadata?: EffectMetadata;
}

export interface StrikeTick extends StrikePacketFields {
  readonly atMs: number;
  readonly coefficient: number;
  readonly packetLabel?: string;
  /** Attributes this packet to a different source skill than its parent effect. */
  readonly sourceId?: SkillId;
}

export interface ConditionTick {
  readonly atMs: number;
  readonly comboFinishers?: readonly OwnedComboDescriptor[];
  readonly condition: string;
  readonly stacks: number;
  readonly duration: number;
  readonly damageKind?: string;
  readonly projectile?: boolean;
  readonly packetLabel?: string;
  readonly metadata?: EffectMetadata;
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
  readonly comboFields?: readonly OwnedComboDescriptor[];
  readonly comboFinishers?: readonly OwnedComboDescriptor[];
  /** Event-log label for this effect's packets, independent of the owning skill name. */
  readonly packetLabel?: string;
  /** Optional row label separates an effect's damage while preserving its source skill. */
  readonly damageBreakdownName?: string;
  /** `fixed` keeps repeated spacing on wall-clock time while the first packet follows `timingScale`. */
  readonly intervalTimingScale?: 'cast' | 'fixed';
  readonly damageKind?: string;
  readonly projectile?: boolean;
  /** Stacks granted to each ally recipient when it differs from the self grant. */
  readonly allyStacks?: number;
  /** Owner-scaled tuning read by the profession mechanic that consumes this effect. */
  readonly damageIncreasePerStack?: number;
  readonly damagePerCoefficient?: number;
  readonly durationPerAffinity?: number;
  readonly durationReductionPerAffinity?: number;
  /** Selects one phantasm entity when a skill summons several. */
  readonly phantasmEntityIndex?: number;
  readonly skillWeapon?: string;
}

export interface StrikeEffect extends SkillEffectBase, StrikePacketFields {
  readonly type: 'strike';
  /** Intrinsic bonuses apply to every strike packet from this effect, excluding sibling effects. */
  readonly modifiers?: readonly SkillDamageModifier[];
  /** Autonomous summon animation, excluding idle time, for recipient-specific attack scheduling. */
  readonly castTimeMs?: number;
  /** Aggregate coefficient; hits above one require one explicit shared atMs timestamp. */
  readonly coefficient?: number;
  readonly hits?: number;
  /** Distinct packet timestamps and formulas. Mutually exclusive with aggregate fields. */
  readonly ticks?: readonly StrikeTick[];
  /** Spacing of repeated applications; each application is one hit carrying the full coefficient. */
  readonly intervalMs?: number;
  readonly coefficientModifiers?: DamageEvent['coefficientModifiers'];
  readonly weapon?: string;
  readonly weaponStrengthProfileId?: string;
  readonly weaponStrengthSource?: 'equipped';
  /** Mechanic-owned busy window, such as a commanded summon's active attack. */
  readonly duration?: number;
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

/** Aura declarations emit the existing aura event without an untyped custom payload. */
export interface AuraEffect extends SkillEffectBase {
  readonly type: 'aura';
  readonly aura: AuraName;
  readonly duration: number;
}

export type SkillEffect = StrikeEffect | ConditionEffect | ControlEffect | StatusEffect | AuraEffect | CustomEffect;

export interface StatusEffect extends SkillEffectBase {
  readonly type: 'boon' | 'buff';
  /** Limits each grant after duration bonuses, independently of the buff pool's stacking cap. */
  readonly maximumDuration?: number;
  readonly boon?: string;
  readonly kind?: string;
  readonly duration: number;
  readonly stacks?: number;
}

/** Explicit packet timelines belong only to strike and condition effects; other effects keep aggregate timing. */
export function effectTicks(effect: SkillEffect): readonly (StrikeTick | ConditionTick)[] | undefined {
  return effect.type === 'strike' || effect.type === 'condition' ? effect.ticks : undefined;
}
