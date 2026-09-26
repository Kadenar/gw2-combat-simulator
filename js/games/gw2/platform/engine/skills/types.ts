/** Defines catalog skills and declarative effects so authored data stays independent of runtime implementations. */
import type { EffectMetadata, EffectAudience, DamageEvent } from '#gw2/platform/engine/events/events.js';
import type { SimulationActorType } from '#gw2/platform/engine/events/actors.js';

export type SkillId = string | number;

export type SkillInterruptMode = 'commit' | 'per-packet';

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

/** Controls record applications for proc consumers without modeling disable windows. */
export interface ControlEffect extends SkillEffectBase {
  readonly type: 'control';
  readonly controlKind?: string;
}

/** Blind retains its status duration independently of control applications. */
export interface BlindEffect extends SkillEffectBase {
  readonly type: 'blind';
  readonly duration?: number;
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

export type SkillEffect = StrikeEffect | ConditionEffect | ControlEffect | BlindEffect | StatusEffect | CustomEffect;

/** Formatted simulator facts retain semantic icons and application counts without importing external tooltip content. */
export interface TooltipFact {
  readonly name: string;
  readonly detail: string;
  readonly icon?: string;
  readonly applications?: number;
  /** Intensity counts appear on the effect icon instead of in the detail text. */
  readonly stacks?: number;
  readonly prefix?: { readonly name: string; readonly icon: string };
}

export interface Skill extends CatalogEntity {
  /** Identity-only tombstones scoped to this skill in its selected catalog. */
  readonly removedEffectKeys?: readonly string[];
  /** Explicit classification when absent from the chain index, or when a manual follow-up reuses that index. */
  readonly autoattack?: boolean;
  /** Imported state reconstruction executes for playback but never represents a player input. */
  readonly initialStateOnly?: boolean;
  /** Explicit input that replaces a weapon or profession bar, for rotation effort summaries. */
  readonly inputCategory?: 'weapon-swap' | 'bar-swap';
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
  /** Effective player cast duration; independent summons retain their base duration. */
  readonly castTimeMs?: number;
  /** Summon-only measured duration under Quickness. Player skills use castTimeMs. */
  readonly quicknessCastTimeMs?: number;
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
  /** Which actor's active boons determine recharge-rate modifiers. */
  readonly rechargeBuffAudience?: 'self' | 'summon';
  /** Recharge always runs at the base rate; Alacrity never changes it (for example, Revenant legend swap). */
  readonly rechargeIgnoresAlacrity?: boolean;
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
  /** Activation shadowsteps its actor; shared equipment such as Relic of Peitha reacts to committed activations. */
  readonly shadowstepSkill?: boolean;
  /**
   * Fixed milliseconds from `peithaImpactAnchor` to the Relic of Peitha projectile impact, including launch latency
   * and travel. Skills without a measured value use the relic's default impact delay.
   */
  readonly peithaImpactDelayMs?: number;
  /** Measures the Peitha impact delay from activation (default) or from the activation's cast end. */
  readonly peithaImpactAnchor?: 'castStart' | 'castEnd';
  readonly ammo?: number;
  readonly ammoRecharge?: number;
  /** Minimum delay between consecutive casts of an ammo skill, in seconds. */
  readonly ammoCastLockout?: number;
  readonly defaultInterruptMs?: number;
  /** Controls whether interruption preserves committed effects or only packets that have already occurred. */
  readonly interruptMode?: SkillInterruptMode;
  readonly interruptCommitMs?: number;
  /** Keep the serial cast lane blocked through the original cast end after the skill commits. */
  readonly retainsCastLockoutAfterInterrupt?: boolean;
  readonly effects?: readonly SkillEffect[];
  readonly comboFields?: readonly Readonly<Record<string, unknown>>[];
  readonly comboFinishers?: readonly Readonly<Record<string, unknown>>[];
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
export interface BalanceProfile extends CatalogEntity {
  /** Keep the selected source identifiable when a runtime passes only a profile lookup callback. */
  readonly balanceDataContext?: CanonicalCatalog['balanceDataContext'];
  /** Identity-only tombstones scoped to this profile; callbacks retain removal provenance. */
  readonly removedEffectKeys?: readonly string[];
  readonly profileKind: 'trait' | 'mechanic' | 'skill-variant';
  /** Opts this profession-owned proc into shared build overrides without changing its trigger or effects. */
  readonly procRate?: {
    readonly id: string;
    readonly traitId: SkillId;
    readonly field: string;
    readonly opportunity: string;
  };
  /** Summon inheritance baselines, fractions, and attribute caps. */
  readonly baseAttribute?: number;
  readonly inheritanceRatio?: number;
  readonly secondaryAttributeCap?: number;
  readonly improvedSecondaryAttributeCap?: number;
  readonly improvedInheritanceRatio?: number;
  readonly powerCap?: number;
  readonly precisionCap?: number;
  readonly basePrecision?: number;
  readonly effects?: readonly SkillEffect[];
  /** Amount of the resource selected by the consuming profession mechanic. */
  readonly resourceGain?: number;
  readonly [field: string]: unknown;
}

export interface SkillLockout {
  readonly group: string;
  readonly durationMs: number;
}

/** Authored deadlines for named work owned by the selected profession's live task registry. */
export interface SkillTask {
  readonly type: string;
  readonly atMs?: number;
  readonly timingAnchor?: 'castStart' | 'castEnd';
  readonly timingScale?: 'cast' | 'fixed';
  readonly count?: number;
}

export interface AutoattackChainPosition {
  readonly root: number;
  readonly index: number;
  readonly step: number;
  readonly next: number | null;
}

export interface CanonicalCatalog<TSkill extends Skill = Skill> {
  /** Selected patch metadata used by shared validation diagnostics. */
  readonly balanceDataContext?: { readonly professionId: string; readonly patchId: string };
  readonly skills: readonly TSkill[];
  readonly skillsById: ReadonlyMap<SkillId, TSkill>;
  readonly skillsByName: ReadonlyMap<string, TSkill>;
  readonly balanceProfiles: readonly BalanceProfile[];
  readonly balanceProfilesById: ReadonlyMap<SkillId, BalanceProfile>;
  readonly balanceProfilesByName: ReadonlyMap<string, BalanceProfile>;
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
  readonly skills?: readonly CatalogEntity[];
  readonly skillsById?: ReadonlyMap<SkillId, CatalogEntity>;
  readonly skillsByName?: ReadonlyMap<string, CatalogEntity>;
}
