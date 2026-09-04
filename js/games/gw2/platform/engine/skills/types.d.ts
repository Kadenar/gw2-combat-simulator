/** Defines catalog skills and declarative effects so authored data stays independent of runtime implementations. */
import type {
  EffectMetadata,
  SimulationActorType,
  EffectAudience,
  DamageEvent
} from '#gw2/platform/engine/events/types.js';
import type { SchedulerRecord, SkillHandlerStrategy } from '#gw2/platform/engine/execution/types.js';

export type SkillId = string | number;

export interface CatalogSkill {
  readonly id: SkillId;
  readonly name: string;
  readonly [field: string]: unknown;
}

export type SkillHandlerMode = 'augment' | 'replace';

export type SkillInterruptMode = 'commit' | 'per-packet';

export interface StrikeTick {
  readonly atMs: number;
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
  readonly condition: string;
  readonly stacks: number;
  readonly duration: number;
  readonly damageKind?: string;
  readonly projectile?: boolean;
  readonly metadata?: EffectMetadata;
  readonly [field: string]: unknown;
}

export interface SkillEffectBase {
  readonly type: string;
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
  /** Aggregate coefficient; hits above one require one explicit shared atMs timestamp. */
  readonly coefficient?: number;
  readonly hits?: number;
  /** Distinct packet timestamps and formulas. Mutually exclusive with aggregate fields. */
  readonly ticks?: readonly StrikeTick[];
  /** Strike intervals are invalid; distinct timestamps belong in ticks. */
  readonly intervalMs?: never;
  readonly canCrit?: boolean;
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
  readonly noCrit?: boolean;
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

export interface ControlEffect extends SkillEffectBase {
  readonly type: 'control' | 'blind';
  readonly controlKind?: string;
  readonly duration?: number;
  readonly breakbar?: number;
  readonly bonusDefianceBreak?: number;
}

export interface StatusEffect extends SkillEffectBase {
  readonly type: 'boon' | 'buff';
  readonly boon?: string;
  readonly kind?: string;
  readonly duration: number;
  readonly stacks?: number;
}

export interface CustomEffect extends SkillEffectBase {
  readonly type: 'custom';
  readonly eventType: string;
  readonly event: Readonly<Record<string, unknown>>;
}

export type SkillEffect = StrikeEffect | ConditionEffect | ControlEffect | StatusEffect | CustomEffect;

export interface Skill extends CatalogSkill {
  readonly description?: string;
  readonly icon?: string;
  readonly variantBadge?: string;
  /** Stable API skill used to enrich an internal simulator-only projection. */
  readonly apiSkillId?: SkillId;
  /** Stable selectable skill resolved from a build-template palette ID. */
  readonly loadoutSkillId?: SkillId;
  /**
   * Retain the catalog record but omit it from patch authoring because no
   * simulator path consumes it. This is independent of simulatorExcluded,
   * which also covers live indirect skills.
   */
  readonly patchAuthoringExcluded?: boolean;
  readonly type?: string;
  readonly slot?: string | number;
  readonly weapon?: string;
  readonly skillWeapon?: string;
  readonly specialization?: string;
  readonly requiredMainHand?: string;
  readonly requiredOffHand?: string | false;
  readonly requiresEmptyOffhand?: boolean;
  readonly weaponSet?: {
    readonly mainHand?: string;
    readonly offHand?: string | false;
  };
  readonly castTimeMs?: number;
  readonly quicknessCastTimeMs?: number;
  /** The cast duration and cast-bound effect timing ignore Quickness. */
  readonly unaffectedByQuickness?: boolean;
  /**
   * Casts on a separate actor lane. Independent casts remain serial with one
   * another but do not reserve or delay the player's ordinary cast lane.
   */
  readonly independentCast?: boolean;
  /** Independent commands may overlap engine reservations and queue externally. */
  readonly independentCastCanOverlap?: boolean;
  /** Whether an instant skill may be scheduled during another cast. */
  readonly canCastConcurrently?: boolean;
  readonly lockouts?: readonly SkillLockout[];
  readonly rechargeAnchor?: 'castStart' | 'castEnd';
  readonly rechargeOffsetMs?: number;
  readonly cooldown?: number;
  readonly recharge?: number;
  /** Which actor's active boons determine recharge-rate modifiers. */
  readonly rechargeBuffAudience?: 'self' | 'summon';
  /**
   * Allows a profession mechanic to activate this skill while its ordinary
   * recharge is still running. The profession remains responsible for
   * resolving the alternate outcome and preserving the original recharge.
   */
  readonly usableWhileRecharging?: boolean;
  /**
   * Self-inflicted stun applied to the player when this serial cast completes
   * (e.g. Berserker Head Butt). The player's cast lane is blocked for this many
   * milliseconds after the cast unless the next serial skill is a `stunbreak`,
   * or the player has stability when the cast ends.
   */
  readonly selfStunMs?: number;
  /**
   * Marks this skill as a stunbreak. A stunbreak may be cast during an active
   * self-stun (see `selfStunMs`) and clears it, letting the player act again
   * immediately instead of waiting out the stun.
   */
  readonly stunbreak?: boolean;
  /** The skill itself grants an evade window to its actor. */
  readonly evades?: boolean;
  readonly ammo?: number;
  readonly ammoRecharge?: number;
  /** Minimum delay between consecutive casts of an ammo skill, in seconds. */
  readonly ammoCastLockout?: number;
  readonly defaultInterruptMs?: number;
  /** Controls whether interruption preserves committed effects or only packets that have already occurred. */
  readonly interruptMode?: SkillInterruptMode;
  readonly interruptCommitMs?: number;
  /** Keep the serial cast lane blocked through the original cast end. */
  readonly retainsCastLockoutAfterInterrupt?: boolean;
  readonly effects?: readonly SkillEffect[];
  readonly mechanicTriggers?: readonly SkillMechanicTrigger[];
  readonly comboFields?: readonly Readonly<Record<string, unknown>>[];
  readonly comboFinishers?: readonly Readonly<Record<string, unknown>>[];
  /** Dispatches stateful or phase-specific behavior to the matching entry in the active module's `mechanics.execution.skillHandlers`. */
  readonly handlerId?: string;
  readonly parentId?: SkillId;
  readonly flipParentId?: SkillId | null;
  readonly flipSkillId?: SkillId | null;
  readonly nextChainId?: SkillId | null;
  /** UI-only family key for skills that occupy one live combat-bar tile. */
  readonly paletteTileId?: SkillId | string;
  /** Stable fallback order within a UI-only tile family. */
  readonly paletteTileOrder?: number;
  readonly weaponBarChainRootId?: SkillId | null;
  readonly weaponBarChainStep?: number | null;
  readonly tags?: readonly string[];
  readonly categories?: readonly string[];
  readonly resource?: unknown;
  /** Amount of the resource selected by the consuming profession mechanic. */
  readonly resourceGain?: number;
}

/**
 * Patchable balance data that is not itself a castable skill. Profiles keep
 * trait effects, mechanic limits, and skill-state variants out of the skill
 * catalog while retaining the same declarative effect vocabulary.
 */
export interface BalanceProfile extends CatalogSkill {
  readonly profileKind: 'trait' | 'mechanic' | 'skill-variant';
  readonly effects?: readonly SkillEffect[];
  /** Amount of the resource selected by the consuming profession mechanic. */
  readonly resourceGain?: number;
  readonly [field: string]: unknown;
}

export type SkillFragment = Partial<Skill> & SchedulerRecord;

export interface SkillLockout {
  readonly group: string;
  readonly durationMs: number;
}

/** Declarative profession-mechanic callback scheduled relative to a skill cast. */
export interface SkillMechanicTrigger {
  readonly type: string;
  readonly atMs?: number;
  readonly timingAnchor?: 'castStart' | 'castEnd';
  /** Mechanic triggers retain their base-cast-relative timing contract. */
  readonly timingScale?: 'cast' | 'fixed';
  readonly count?: number;
}

export interface AutoattackChainPosition {
  readonly root: number;
  readonly index: number;
  readonly step: number;
  readonly next: number | null;
}

export interface CanonicalCatalog<TSkill extends Skill = Skill, TContext extends object = SchedulerRecord> {
  readonly skills: readonly TSkill[];
  readonly skillsById: ReadonlyMap<SkillId, TSkill>;
  readonly skillsByName: ReadonlyMap<string, TSkill>;
  readonly balanceProfiles: readonly BalanceProfile[];
  readonly balanceProfilesById: ReadonlyMap<SkillId, BalanceProfile>;
  readonly balanceProfilesByName: ReadonlyMap<string, BalanceProfile>;
  readonly skillHandlers: ReadonlyMap<string, SkillHandlerStrategy<TContext>>;
  readonly autoattackChains: readonly (readonly number[])[];
  readonly autoattackChainPositions: ReadonlyMap<number, AutoattackChainPosition>;
  readonly traits: readonly CatalogEntity[];
  readonly specializations: readonly CatalogEntity[];
  readonly weapons: ReadonlySet<string>;
  readonly weaponHands: ReadonlyMap<string, string>;
  readonly [field: string]: unknown;
}

export interface CatalogEntity {
  readonly id: SkillId;
  readonly name: string;
  readonly [field: string]: unknown;
}

export interface CatalogLookup {
  readonly skills?: readonly CatalogSkill[];
  readonly skillsById?: ReadonlyMap<SkillId, CatalogSkill>;
  readonly skillsByName?: ReadonlyMap<string, CatalogSkill>;
}
