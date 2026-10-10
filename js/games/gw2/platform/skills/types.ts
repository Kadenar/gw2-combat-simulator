import type { OwnedComboDescriptor } from '#gw2/platform/combos/types.js';
import type { ResourceKey } from '#gw2/platform/combat/resources/resource-policy.js';
import type { SkillSideEffect } from '#gw2/platform/effects/actions.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { SkillDamageModifier } from '#gw2/platform/skills/modifiers.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicContext, MechanicQueryContext } from '#gw2/platform/profession-definition/mechanic-context.js';

/**
 * Catalog skill, balance-profile, task, and lookup schemas so authored skill data stays independent of runtime
 * implementations.
 */

export type SkillId = string | number;

type SkillInterruptMode = 'commit' | 'per-packet';

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
  /** Intrinsic strike modifiers apply only to damage attributed to this skill. */
  readonly modifiers?: readonly SkillDamageModifier[];
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
  /** Stable selectable skill resolved from a build-template palette ID. */
  readonly loadoutSkillId?: SkillId;
  /** Base identity replaced by this specialization's weapon skill, independent of its display label. */
  readonly weaponVariantRootId?: SkillId;
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
  /** Fraction of the accepted interval to the recharge anchor, before any fixed offset. */
  readonly rechargeProgress?: number;
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
  readonly comboFields?: readonly OwnedComboDescriptor[];
  readonly comboFinishers?: readonly OwnedComboDescriptor[];
  readonly parentId?: SkillId;
  readonly flipParentId?: SkillId | null;
  readonly flipSkillId?: SkillId | null;
  /** Seconds a completed parent keeps its follow-up window open; professions supply their default when absent. */
  readonly flipDuration?: number;
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
  /** Patchable amount a declared cost pays when it names no balance-profile field. */
  readonly resourceCost?: number;
  readonly cost?: SkillCost;
  /** Named mechanic work a committed activation schedules; each task receives `{ cast, trigger }`. */
  readonly tasks?: readonly SkillTask[];
  /** Ordered mutations executed by the platform at the declared activation phase. */
  readonly sideEffects?: readonly SkillSideEffect[];
  /** First matching variant transforms the skill's own effects or selects a separate profile before profession modifiers. */
  readonly effectVariants?: readonly {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Catalogs combine callbacks authored against different profession runtimes; dispatch preserves the owning runtime.
    readonly when: (runtime: MechanicQueryContext<any>, cast: RuntimeCast) => boolean;
    /** Omission transforms this skill's selected, patchable effects in place. */
    readonly profileId?: SkillId;
    readonly transform?: (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Catalogs combine callbacks authored against different profession runtimes; dispatch preserves the owning runtime.
      runtime: MechanicContext<any>,
      cast: RuntimeCast,
      effects: readonly SkillEffect[]
    ) => readonly SkillEffect[];
  }[];
}

/**
 * Patchable balance data that is not itself a castable skill. Profiles keep
 * trait effects, mechanic limits, and skill-state variants out of the skill
 * catalog while retaining the same declarative effect vocabulary.
 */
export interface BalanceProfile extends CatalogEntity {
  /** Proc claims default to a fixed internalCooldown; skill policies recharge cooldown work for the named owner. */
  readonly cooldownPolicy?: 'internal' | 'playerRecharge' | 'summonRecharge';
  /** Augmentations retain their skill/summon/shared owner instead of promising a separate trait proc row. */
  readonly damagePreviewAttribution?: 'skill' | 'summon' | 'shared';
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
  readonly powerCap?: number;
  readonly precisionCap?: number;
  readonly basePrecision?: number;
  readonly effects?: readonly SkillEffect[];
  /** Amount of the resource selected by the consuming profession mechanic. */
  readonly resourceGain?: number;
  readonly [field: string]: unknown;
}

/**
 * What an activation pays. Permanent cost failures reject before profession gates; retryable costs combine with
 * those gates. Accepted casts spend on acceptance or successful completion according to the declared phase.
 */
interface SkillCost {
  readonly resource: 'endurance' | ResourceKey;
  /** A balance-profile field that one patch retunes everywhere; mutually exclusive with skillAmount. */
  readonly profileAmount?: { readonly profileId: SkillId; readonly field: string };
  /** Read an authored numeric skill field live; without either selector, pay resourceCost. */
  readonly skillAmount?: string;
  readonly spendOn?: 'castStart' | 'castCommit';
}

export interface SkillLockout {
  readonly group: string;
  readonly durationMs: number;
}

/**
 * Authored deadlines for named work owned by the selected profession's live task registry. A committed activation
 * schedules each one after its completion owners run. `castEnd` is the reserved full end and `castCommit` the
 * instant the activation actually ended, which differs only when a committed cast is interrupted.
 */
export interface SkillTask {
  readonly type: string;
  readonly atMs?: number;
  readonly timingAnchor?: 'castStart' | 'castEnd' | 'castCommit';
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
  readonly skillsByName?: ReadonlyMap<string, CatalogEntity>;
  /** Command validation reads skill capabilities by canonical identity. */
  readonly skillsById?: ReadonlyMap<SkillId, CatalogEntity>;
}
