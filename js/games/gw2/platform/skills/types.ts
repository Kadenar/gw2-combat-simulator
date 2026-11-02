/**
 * Catalog skill, balance-profile, task, and lookup schemas so authored skill data stays independent of runtime
 * implementations.
 */
import type { ResourceKey } from '#gw2/platform/combat/resources/resource-policy.js';
import type { OwnedComboDescriptor } from '#gw2/platform/combos/types.js';
import { RECIPIENT } from '#gw2/platform/constants.js';
import type { SkillSideEffect } from '#gw2/platform/effects/actions.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicContext, MechanicQueryContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { Gw2SpecializationData } from '#gw2/platform/profession-definition/specialization-data-types.js';
import type { FieldSpecs, NumericSkillFields } from '#gw2/platform/skills/field-specs.js';
import type { SkillModifier } from '#gw2/platform/skills/modifiers.js';
import type { SHARED_SKILL_FIELDS } from '#gw2/platform/skills/shared-fields.js';
import type { SkillFlips } from '#gw2/platform/skills/skill-flip-definitions.js';

export type SkillId = string | number;

/** One authored family shared by profession mechanics, relics, and presentation. */
export type SkillFamily =
  | 'Arcane'
  | 'Attunement'
  | 'Augment'
  | 'Cantrip'
  | 'Chant'
  | 'Command'
  | 'Conjure'
  | 'Corruption'
  | 'Deception'
  | 'Dodge'
  | 'Elixir'
  | 'Familiar'
  | 'Gadget'
  | 'Glyph'
  | 'Jade Sphere'
  | 'Mantra'
  | 'Mark'
  | 'Meditation'
  | 'Physical'
  | 'Rage'
  | 'Shout'
  | 'Signet'
  | 'SpiritWeapon'
  | 'Stance'
  | 'Trait'
  | 'Trap'
  | 'Weapon skill'
  | 'Well';

/** The map, module, and explicit chain/flip declarations supply these fields during catalog assembly. */
type AssembledSkillField =
  'id' | 'specialization' | 'chainRoot' | 'chainStep' | 'nextChainId' | 'flipSkillId' | 'flipParentId';

/** Keyed owner entries carry presentation and behavior, without authoring fields supplied by assembly. */
export type SkillDefinition<TSkill extends Skill = Skill> = Partial<TSkill> &
  Required<Pick<TSkill, 'name' | 'icon'>> & {
    readonly [TField in AssembledSkillField]?: never;
  };

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

/** Canonical attribute keys, so skill grants share the attribute pipeline's vocabulary. */
export type SkillAttributeKey = keyof typeof import('#gw2/platform/attributes/inputs.js').ATTRIBUTE_NAMES;

/** Numeric skill properties come from the shared field table, so each is authored once with its bounds and patch tier. */
type SharedNumericSkillFields = NumericSkillFields<typeof SHARED_SKILL_FIELDS>;

/**
 * Platform skill vocabulary. Non-numeric fields are declared only here or on a profession's skill type; the closed
 * shape rejects unknown and misspelled fields at compile time instead of during catalog construction.
 */
export interface Skill extends CatalogEntity, SharedNumericSkillFields {
  /**
   * Flat attributes this skill grants, such as a signet passive or a wielded conjure. The owning mechanic decides
   * when the grant applies (readiness, held bundle); the amounts stay with the skill so patches edit one owner.
   */
  readonly attributeBonuses?: Readonly<Partial<Record<SkillAttributeKey, number>>>;
  /** Fixed grants while the skill's active state applies. */
  readonly activeAttributeBonuses?: Skill['attributeBonuses'];
  /** Intrinsic strike, critical-damage, and condition-base-duration rules apply only to this skill's packets. */
  readonly modifiers?: readonly SkillModifier[];
  /** Identity-only tombstones scoped to this skill in its selected catalog. */
  readonly removedEffectKeys?: readonly string[];
  /** Input classification; explicit chains supply true unless a manual sequence declares false. */
  readonly autoattack?: boolean;
  /** Explicit control for synthetic actions whose metadata has no physical bar slot. */
  readonly inputControl?: import('#gw2/platform/skills/input-controls.js').InputControlId;
  readonly inputCategory?: 'weapon-swap' | 'bar-swap';
  /** Label shown instead of the canonical name where several records share one name. */
  readonly displayName?: string;
  readonly variantBadge?: string;
  /** False keeps a slot skill out of build-template selection while it remains castable through its owner. */
  readonly slotSelectable?: boolean;
  /** Keeps a catalog record out of rotation planning and log reconstruction; only an owning mechanic invokes it. */
  readonly rotationInputExcluded?: boolean;
  /** False keeps this skill out of palette flip families, so it never shares a tile with a flip parent or child. */
  readonly paletteFlip?: boolean;
  /** Stable selectable skill resolved from a build-template palette ID. */
  readonly loadoutSkillId?: SkillId;
  /** Base identity replaced by this specialization's weapon skill, independent of its display label. */
  readonly weaponVariantRootId?: SkillId;
  /**
   * Retain the catalog record but omit it from patch authoring because no
   * simulator path consumes it. This is independent of rotationInputExcluded,
   * which also covers live indirect skills.
   */
  readonly patchAuthoringExcluded?: boolean;
  /** Named concrete choices for an input resolved by its profession before cast acceptance. */
  readonly selector?: Readonly<Record<string, SkillId>>;
  readonly type?: string;
  readonly slot?: string | number;
  readonly weapon?: string;
  readonly skillWeapon?: string;
  readonly specialization?: string;
  readonly requiredMainHand?: string;
  readonly requiredOffHand?: string | false;
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
  /** An independently scheduled actor starts its recharge when its own action executes. */
  readonly rechargeOwner?: 'actor';
  /** Which actor's active boons determine recharge-rate modifiers. */
  readonly rechargeBuffAudience?: typeof RECIPIENT.SELF | typeof RECIPIENT.SUMMONS;
  /** Recharge always runs at the base rate; Alacrity never changes it (for example, Revenant legend swap). */
  readonly rechargeIgnoresAlacrity?: boolean;
  /**
   * Allows a profession mechanic to activate this skill while its ordinary
   * recharge is still running. The profession remains responsible for
   * resolving the alternate outcome and preserving the original recharge.
   */
  readonly usableWhileRecharging?: boolean;
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
  /** Measures the Peitha impact delay from activation (default) or from the activation's cast end. */
  readonly peithaImpactAnchor?: 'castStart' | 'castEnd';
  /** Controls whether interruption preserves committed effects or only packets that have already occurred. */
  readonly interruptMode?: SkillInterruptMode;
  /** Keep the serial cast lane blocked through the original cast end after the skill commits. */
  readonly retainsCastLockoutAfterInterrupt?: boolean;
  readonly effects?: readonly SkillEffect[];
  readonly comboFields?: readonly OwnedComboDescriptor[];
  readonly comboFinishers?: readonly OwnedComboDescriptor[];
  readonly parentId?: SkillId;
  readonly flipParentId?: SkillId | null;
  readonly flipSkillId?: SkillId | null;
  readonly nextChainId?: SkillId | null;
  /** Autoattack chain identity and one-based position, supplied by catalog assembly. */
  readonly chainRoot?: SkillId | null;
  readonly chainStep?: number | null;
  /** UI-only family key for skills that occupy one live combat-bar tile. */
  readonly paletteTileId?: SkillId | string;
  /** Stable fallback order within a UI-only tile family. */
  readonly paletteTileOrder?: number;
  readonly weaponBarChainRootId?: SkillId | null;
  readonly weaponBarChainStep?: number | null;
  readonly tags?: readonly string[];
  readonly skillFamily?: SkillFamily;
  readonly resource?: unknown;
  readonly cost?: SkillCost;
  /** Named mechanic work a committed activation schedules; each task receives `{ cast, taskDefinition }`. */
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
 * Trait-owned balance data, using the same declarative effects as skills.
 */
export interface BalanceProfile extends CatalogEntity {
  readonly skillFamily?: SkillFamily;
  /** Fixed amounts keyed by canonical attribute, shared by preview, combat, and tooltips. */
  readonly attributeBonuses?: Skill['attributeBonuses'];
  /** Alternative or additional fixed grants selected by the owner's condition. */
  readonly conditionalAttributeBonuses?: Skill['attributeBonuses'];
  /** Lifetime in seconds of the state or charges owned by this profile, separate from its effects. */
  readonly duration?: number;
  /** Initial seconds before resource-scaled additions or extensions. */
  readonly baseDuration?: number;
  /** Seconds added per resource tier, such as malice, notes, or shatter sources. */
  readonly durationPerTier?: number;
  /** Flat seconds added to an existing duration. */
  readonly durationExtension?: number;
  /** Proc claims use a fixed internalCooldown unless a captured companion owns summon recharge work. */
  readonly cooldownPolicy?: 'internal' | 'summonRecharge';
  /** Keep the selected source identifiable when a runtime passes only a profile lookup callback. */
  readonly balanceDataContext?: CanonicalCatalog['balanceDataContext'];
  /** Identity-only tombstones scoped to this profile; callbacks retain removal provenance. */
  readonly removedEffectKeys?: readonly string[];
  /** Opts this profession-owned proc into shared build overrides without changing its trigger or effects. */
  readonly procRate?: {
    readonly id: string;
    readonly traitId: SkillId;
    readonly field: string;
    readonly opportunity: string;
  };
  /** Trait-owned summon inheritance fractions and attribute caps. */
  readonly inheritanceRatio?: number;
  readonly secondaryAttributeCap?: number;
  readonly powerCap?: number;
  readonly precisionCap?: number;
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
  /** The one authored price; patches edit it through the `cost.amount` field so admission and payment agree. */
  readonly amount: number;
  /** Payment defaults to cast start; commitment-paid skills keep interrupted attempts free. */
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

/** Skill identities anchor the chain and its successor; index is the zero-based position within that chain. */
export interface AutoattackChainPosition {
  readonly rootSkillId: number;
  readonly index: number;
  readonly nextSkillId: number | null;
}

export interface CanonicalCatalog<TSkill extends Skill = Skill> {
  /** Selected patch metadata used by shared validation diagnostics. */
  readonly balanceDataContext?: {
    readonly professionId: string;
    readonly patchId: string;
    readonly reworks?: readonly string[];
    /** Lines whose major-trait slots differ from Live, so Live positions would select different traits. */
    readonly relaidSpecializations?: readonly string[];
  };
  readonly skills: readonly TSkill[];
  readonly skillsById: ReadonlyMap<SkillId, TSkill>;
  /** Shared and profession-owned skill fields; validation, patching, and authoring read this one table. */
  readonly skillFields: FieldSpecs;
  /** Shared and profession-owned balance-profile field declarations. */
  readonly profileFields: FieldSpecs;
  readonly balanceProfiles: readonly BalanceProfile[];
  readonly balanceProfilesById: ReadonlyMap<SkillId, BalanceProfile>;
  readonly autoattackChains: readonly (readonly number[])[];
  readonly skillFlips: SkillFlips;
  readonly autoattackChainPositions: ReadonlyMap<number, AutoattackChainPosition>;
  readonly traits: readonly CatalogEntity[];
  readonly specializations: readonly Gw2SpecializationData[];
  readonly weapons: ReadonlySet<string>;
  readonly weaponHands: ReadonlyMap<string, string>;
  readonly [field: string]: unknown;
}

/** Identity shared by skills, profiles, and traits; owners declare every other field on their own closed types. */
export interface CatalogEntity {
  readonly id: SkillId;
  readonly name: string;
  /** Skills and traits both render an icon. */
  readonly icon?: string;
}

export interface CatalogLookup {
  /** Command validation reads skill capabilities by canonical identity. */
  readonly skillsById?: ReadonlyMap<SkillId, CatalogEntity>;
}
