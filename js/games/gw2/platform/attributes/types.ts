import type { Gw2Build, ProfessionBuildAssumptions } from '#gw2/platform/builds/types.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import type { Gw2Stats } from '#gw2/platform/attributes/stats.js';
import type { ProfessionBalanceContext } from '#gw2/platform/profession-definition/balance-context.js';
import type { Skill, SkillId } from '#gw2/platform/skills/types.js';

/** Attribute seeds, contributions, breakdowns, and calculation contracts shared by builds, previews, and the runtime. */

export type Gw2NumericAttributes = Record<string, number>;

type Gw2AttributeEffectRounding = 'none' | 'round' | 'floor';

/** Equipment conversions travel with their immutable source pool, never as a second utility selection. */
export interface Gw2SeedAttributeConversion {
  readonly source: 'utility' | 'reinforcedArmor';
  readonly from: string;
  readonly to: string;
  readonly multiplier: number;
  readonly rounding: Gw2AttributeEffectRounding;
}

export interface Gw2AttributeConversionInputs {
  readonly conversionPool: Readonly<Gw2NumericAttributes>;
  readonly conversions: readonly Gw2SeedAttributeConversion[];
}

/** Unprocessed, serializable equipment sources; profession effects never enter these immutable seeds. */
export interface Gw2AttributeSeed extends Gw2AttributeConversionInputs {
  readonly commonTotals: Readonly<Gw2Stats>;
  readonly sources: Readonly<Gw2AttributeMap>;
}

export interface Gw2AttributeInputs {
  readonly weaponSets: readonly [Gw2AttributeSeed, Gw2AttributeSeed];
}

/** Attribute declarations read normalized loadout facts, never a browser build or a partially modified stat record. */
export interface Gw2AttributeLoadout {
  readonly weapons: readonly (string | undefined)[];
  readonly alternateWeapons: readonly (string | undefined)[];
  readonly assumptions: Readonly<ProfessionBuildAssumptions>;
  readonly selectedLegends: readonly string[];
  readonly merged: boolean;
}

export interface Gw2AttributeContext extends Gw2ModifierContext {
  readonly loadout: Gw2AttributeLoadout;
  readonly weaponSet: number;
  readonly balanceContext: ProfessionBalanceContext;
}

/** Controls whether an effect contributes to build totals and eligible conversion inputs. */
interface Gw2AttributeEffectBase {
  readonly enabled?: boolean;
}

interface Gw2FlatAttributeEffect extends Gw2AttributeEffectBase {
  readonly kind: 'flat';
  /** Identifies the equipped skill so contribution analysis can discover attribute-granting skills. */
  readonly passiveSkillId?: SkillId;
  readonly to: string;
  readonly amount: number;
  /**
   * Include this flat bonus in the source pool for conversions with `input: 'eligible'`.
   * 'all' also feeds utility consumables and Reinforced Armor; 'profession-only' preserves explicit trait conversions
   * such as Furious Demise into Target the Weak without admitting that bonus to utilities.
   * 'none' contributes to final attributes only.
   */
  readonly feedsConversions: 'all' | 'profession-only' | 'none';
}

interface Gw2ConversionAttributeEffect extends Gw2AttributeEffectBase {
  readonly kind: 'conversion';
  readonly from: string;
  readonly to: string;
  readonly multiplier: number;
  /**
   * Conversions with the same source, destination, and rounding policy combine before rounding.
   * `none` retains fractions, `floor` rounds down, and `round` uses the nearest integer
   * (Math.round, with ties toward positive infinity). For 15.75, results are 15.75, 15, and 16.
   */
  readonly rounding: Gw2AttributeEffectRounding;
  /**
   * Choose the source attribute pool: `common` uses the shared pool before profession and
   * trait attribute effects; `eligible` also includes flat bonuses with `feedsConversions: 'all'`
   * or `feedsConversions: 'profession-only'`.
   * Neither pool includes conversion results, so conversions cannot feed one another.
   */
  readonly input: 'common' | 'eligible';
}

export type Gw2AttributeEffect = Gw2FlatAttributeEffect | Gw2ConversionAttributeEffect;

export interface Gw2AttributeBreakdown {
  /** Fractal potion bonuses stay separate from equipment and do not feed further attribute conversions. */
  fractalPotions?: number;
  /** Permanent armor reinforcement is applied after conversions, separately from equipment and trait grants. */
  reinforcedArmor?: number;
  final: number;
  base: number;
  gear: number;
  runes: number;
  food: number;
  utility: number;
  jbc: number;
  traits: number;
  sigils: number;
  infusions: number;
}

export type Gw2AttributeMap = Record<string, Gw2AttributeBreakdown>;

interface Gw2AttributeCommonContext {
  conversionPool: Gw2NumericAttributes;
  conversions: readonly Gw2SeedAttributeConversion[];
  runeDurations: Gw2NumericAttributes;
  foodDurations: Gw2NumericAttributes;
  sigilDurations: Gw2NumericAttributes;
  sigilCriticalChance: number;
}

export interface Gw2CommonAttributeResult {
  attributes: Gw2AttributeMap;
  commonContext: Gw2AttributeCommonContext;
}

export interface Gw2FinalizedAttributeResult {
  readonly attributeSeed: Gw2AttributeSeed;
  attributes: Gw2AttributeMap;
  activeTraits: unknown;
}

export interface Gw2BuildAttributeRuleContext {
  /** Native trait contributions join profession effects before conversions and finalization. */
  readonly attributeContributions?: Gw2AttributeContributionCalculator;
  /** The selected patch's declarations; omitted only for a base-data attribute calculation. */
  readonly balanceContext?: ProfessionBalanceContext;
  readonly build: Gw2Build;
  readonly selectedSkills: readonly Skill[];
  readonly weaponSet: number;
  readonly disabledTrait: string | null;
}

export type Gw2PrimaryAttribute =
  | 'power'
  | 'precision'
  | 'toughness'
  | 'vitality'
  | 'ferocity'
  | 'conditionDamage'
  | 'expertise'
  | 'concentration'
  | 'healingPower';

// Ordered policies describe operands; the shared evaluator owns their application boundary.
export type Gw2AttributeTransform =
  | {
      readonly kind: 'convert-current';
      readonly from: Gw2PrimaryAttribute;
      readonly to: Gw2PrimaryAttribute;
      readonly multiplier: number;
    }
  | { readonly kind: 'project'; readonly attributes: Gw2Stats; readonly replace: boolean };

export interface Gw2FinalConditionAttribute {
  readonly condition: string;
  readonly powerMultiplier: number;
}

export interface Gw2AttributeContributions {
  /** Might adjustments run with baseline Might, outside equipment and conversion pools. */
  readonly mightPerStack?: { readonly power?: number; readonly conditionDamage?: number };
  readonly uncappedBoonDuration?: number;
  readonly transforms?: readonly Gw2AttributeTransform[];
  readonly finalCondition?: Gw2FinalConditionAttribute;
  readonly attributeEffects?: readonly Gw2AttributeEffect[];
  readonly traitDurations?: Readonly<Gw2NumericAttributes>;
  readonly traitCriticalChance?: number;
}

/** Active traits come from the profession's existing major/minor selection resolver. */
export type Gw2AttributeContributionCalculator = (context: Gw2AttributeContext) => readonly Gw2AttributeContributions[];

export type Gw2ApplyBuildAttributeRules = (
  common: Gw2CommonAttributeResult,
  context: Gw2BuildAttributeRuleContext
) => Gw2FinalizedAttributeResult;

export type Gw2CalculateAttributes = (
  build: Gw2Build,
  selectedSkills?: readonly Skill[],
  weaponSet?: number,
  disabledTrait?: string | null,
  disabledSigil?: string | null,
  balanceContext?: ProfessionBalanceContext
) => Gw2FinalizedAttributeResult;
