/** Owns the builds/types.ts contracts so type dependencies follow their runtime feature boundaries. */
import type { CanonicalCatalog, Skill } from '#gw2/platform/engine/skills/types.js';
import type { ProfessionBalanceContext } from '#gw2/platform/profession-presentation/balance-context.js';

export type Gw2NumericAttributes = Record<string, number>;

/** A saved build's fields before migration and validation; every value is unverified input. */
export type UnvalidatedBuildRecord = Record<string, unknown>;

type Gw2AttributeEffectRounding = 'none' | 'round' | 'floor';

/** Build assumptions shared by profession definitions and application adapters. */
/** Custom control keys remain unverified until the registered assumption normalizers read them. */
export interface ProfessionBuildAssumptions extends UnvalidatedBuildRecord {
  procRateOverrides?: Record<string, number>;
  might?: number;
  fury?: boolean;
  quickness?: boolean;
  alacrity?: boolean;
  protection?: boolean;
  resolution?: boolean;
  regeneration?: boolean;
  swiftness?: boolean;
  vigor?: boolean;
  aegis?: boolean;
  alliedPlayerCount?: number;
  sharePlayerBoonsWithSummons?: boolean;
  targetDefiant?: boolean;
  targetMoving?: boolean;
  targetSkillActivationsPerSecond?: number;
  targetConditions?: Record<string, number | boolean>;
  timeOfDay?: 'day' | 'night';
}

export interface ProfessionAssumptionOption {
  readonly value: string;
  readonly label: string;
  readonly skillId?: number;
  readonly icon?: string;
}

export interface ProfessionAssumptionControlInput {
  readonly key?: unknown;
  readonly label?: unknown;
  readonly type?: unknown;
  readonly defaultValue?: unknown;
  readonly minimum?: unknown;
  readonly maximum?: unknown;
  readonly step?: unknown;
  readonly options?: unknown;
  readonly specializations?: unknown;
  readonly section?: unknown;
}

interface ProfessionAssumptionControlBase {
  readonly key: string;
  readonly label: string;
  readonly defaultValue: unknown;
  readonly specializations?: readonly string[];
  readonly section?: string;
}

/** Validated control metadata keeps persistence logic independent from its UI renderer. */
export type ProfessionAssumptionControl =
  | (ProfessionAssumptionControlBase & {
      readonly type: 'boolean';
    })
  | (ProfessionAssumptionControlBase & {
      readonly type: 'number';
      readonly minimum: number;
      readonly maximum: number;
      readonly step: number;
    })
  | (ProfessionAssumptionControlBase & {
      readonly type: 'select';
      readonly options: readonly ProfessionAssumptionOption[];
    });

/** Records which build-time attribute decisions are already reflected in a simulation config. */
export interface Gw2AttributeProvenance {
  readonly professionStaticRulesApplied: boolean;
  readonly calculatedWeaponSet: number;
  readonly calculatedPrimaryWeapon: string;
}

/** Controls whether an effect contributes to build totals and eligible conversion inputs. */
interface Gw2AttributeEffectBase {
  readonly enabled?: boolean;
}

interface Gw2FlatAttributeEffect extends Gw2AttributeEffectBase {
  readonly kind: 'flat';
  readonly to: string;
  readonly amount: number;
  readonly feedsConversions: boolean;
}

interface Gw2ConversionAttributeEffect extends Gw2AttributeEffectBase {
  readonly kind: 'conversion';
  readonly from: string;
  readonly to: string;
  readonly multiplier: number;
  readonly rounding: Gw2AttributeEffectRounding;
  readonly input: 'common' | 'eligible';
}

export type Gw2AttributeEffect = Gw2FlatAttributeEffect | Gw2ConversionAttributeEffect;

export interface Gw2AttributeBreakdown {
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

/** Optional starting resources shared by the build editor; professions require the fields they own. */
export interface Gw2BuildResources {
  initialResource?: number;
  initialBlight?: number;
  initialCascadingCorruptionStacks?: number;
  initialHeat?: number;
  initialAstralForce?: number;
  initialArrows?: number;
  initialShadowForce?: number;
  initialInitiative?: number;
  initialSpinningAxes?: number;
  initialEnergy?: number;
  initialCatalystEnergy?: number;
  initialEvokerCharges?: number;
  initialEvokerEmpowered?: number;
}

/** Known build fields; persisted input stays unknown until the build codec normalizes it. */
export interface Gw2Build extends Gw2BuildResources {
  schemaVersion?: number;
  profession?: string;
  /** Legacy explicit specialization used by presentation fallbacks. */
  specialization?: string;
  assumptions?: ProfessionBuildAssumptions;
  startAttunement?: string;
  secondaryAttunement?: string;
  initialUntamedState?: 'Ranger' | 'Pet';
  selectedPet?: string;
  selectedPet2?: string;
  selectedHammerSkillIds?: number[];
  selectedMorphSkillIds?: number[];
  selectedLegends?: string[];
  startingLegend?: string;
  evokerElement?: string;
  gear?: Record<string, string>;
  alternateWeaponPrefixes?: string[];
  weapons?: string[];
  alternateWeapons?: string[];
  rune?: string;
  weaponSigils?: string[][];
  relic?: string;
  food?: string;
  utility?: string;
  jadeBotCore?: boolean;
  specializations?: unknown[];
  infusions?: Array<{ stat?: string; count?: number }>;
}

export interface Gw2BuildSpecialization {
  name: string;
  traits: string;
  /** Zero-based minor tiers omitted from trait effects; absent means all are active. */
  disabledMinorTraits?: number[];
}

export interface Gw2BuildInfusion {
  stat: string;
  count: number;
}

/** Normalized build shape shared by persistence and the editor; validation remains a separate operation. */
export interface Gw2CanonicalBuild extends Gw2Build {
  precastRelics?: string[];
  schemaVersion: number;
  profession: string;
  gear: Record<string, string>;
  alternateWeaponPrefixes: string[];
  weapons: string[];
  alternateWeapons: string[];
  rune: string;
  weaponSigils: string[][];
  relic: string;
  food: string;
  utility: string;
  jadeBotCore: boolean;
  specializations: Gw2BuildSpecialization[];
  selectedSkills: Record<string, string>;
  assumptions: ProfessionBuildAssumptions;
  infusions: Gw2BuildInfusion[];
  startingWeaponSet: number;
  targetHealth: number;
  targetStartingHealthPercent: number;
  targetArmor: number;
  rotation: import('#gw2/platform/execution/types.js').RotationCommand[];
}

interface Gw2BuildCodecContext {
  readonly saved: UnvalidatedBuildRecord;
}

interface Gw2BuildExtraFieldBase {
  readonly defaultValue?: number | string;
  readonly label?: string;
  readonly validationMessage?: string;
}

interface Gw2BoundedNumberBuildField extends Gw2BuildExtraFieldBase {
  readonly type: 'number';
  readonly defaultValue?: number;
  readonly minimum: number;
  readonly maximum: number;
}

interface Gw2BoundedIntegerBuildField extends Gw2BuildExtraFieldBase {
  readonly type: 'integer';
  readonly defaultValue?: number;
  readonly minimum: number;
  readonly maximum: number;
}

interface Gw2EnumBuildField<TValue extends string = string> extends Gw2BuildExtraFieldBase {
  readonly type: 'enum';
  readonly defaultValue?: TValue;
  readonly values: readonly TValue[];
}

export type Gw2BuildExtraFieldDescriptor = Gw2BoundedNumberBuildField | Gw2BoundedIntegerBuildField | Gw2EnumBuildField;

export type Gw2BuildExtraFieldDescriptors<TBuild extends Gw2CanonicalBuild = Gw2CanonicalBuild> = Readonly<{
  [K in Extract<keyof TBuild, string>]?: NonNullable<TBuild[K]> extends number
    ? Gw2BoundedNumberBuildField | Gw2BoundedIntegerBuildField
    : NonNullable<TBuild[K]> extends string
      ? Gw2EnumBuildField<Extract<TBuild[K], string>>
      : never;
}>;

interface Gw2SlotLoadoutContext<TBuild extends Gw2CanonicalBuild = Gw2CanonicalBuild> {
  readonly build: TBuild;
  readonly specialization: string;
}

export interface Gw2SlotLoadout<TBuild extends Gw2CanonicalBuild = Gw2CanonicalBuild> {
  normalizeBuild(build: TBuild, context: Gw2SlotLoadoutContext<TBuild>): Partial<TBuild>;
  validateBuild(build: TBuild, context: Gw2SlotLoadoutContext<TBuild>): readonly unknown[];
}

export interface Gw2BuildCodecOptions<TBuild extends Gw2CanonicalBuild = Gw2CanonicalBuild> {
  readonly professionId: string;
  readonly schemaVersion: number;
  readonly catalog: CanonicalCatalog;
  readonly createDefaults: () => TBuild;
  readonly migrations?: Readonly<Record<number, (saved: UnvalidatedBuildRecord) => UnvalidatedBuildRecord>>;
  readonly extraFields?: Gw2BuildExtraFieldDescriptors<TBuild>;
  readonly normalizeExtra?: (build: TBuild, context: Gw2BuildCodecContext) => TBuild;
  readonly validateExtra?: (build: TBuild) => unknown[] | { readonly errors?: readonly unknown[] } | null | undefined;
  readonly slotLoadout?: Gw2SlotLoadout<TBuild> | null;
}

export interface Gw2BuildCodec<TBuild extends Gw2CanonicalBuild = Gw2CanonicalBuild> {
  migrateBuild(candidate: unknown): TBuild;
  validateBuild(build: unknown): BuildValidationResult;
  toApplicationBuild(candidate: unknown): TBuild;
}

export interface Gw2BuildValidationOptions {
  readonly professionId: string;
  readonly schemaVersion: number;
  readonly catalog: CanonicalCatalog;
  readonly slotLoadout?: Gw2SlotLoadout | null;
}

interface Gw2AttributeCommonContext {
  conversionPool: Gw2NumericAttributes;
  runeDurations: Gw2NumericAttributes;
  foodDurations: Gw2NumericAttributes;
  sigilDurations: Gw2NumericAttributes;
  sigilCriticalChance: number;
}

export interface Gw2CommonAttributeResult {
  attributes: Gw2AttributeMap;
  gear: Record<string, string>;
  alternateWeaponPrefixes: string[];
  weapons: string[];
  alternateWeapons: string[];
  runes: string;
  weaponSigils: string[][];
  relic: string;
  food: string;
  utility: string;
  jadeBotCore: boolean;
  specializations: unknown[];
  commonContext: Gw2AttributeCommonContext;
}

export interface Gw2FinalizedAttributeResult {
  attributes: Gw2AttributeMap;
  gear: Record<string, string>;
  alternateWeaponPrefixes: string[];
  weapons: string[];
  alternateWeapons: string[];
  runes: string;
  weaponSigils: string[][];
  relic: string;
  food: string;
  utility: string;
  jadeBotCore: boolean;
  specializations: unknown[];
  activeTraits: unknown;
}

export interface Gw2BuildAttributeRuleContext {
  /** Native trait contributions join profession effects before conversions and finalization. */
  readonly traitBuildAttributes?: Gw2TraitBuildAttributeCalculator;
  /** The selected patch's declarations; omitted only for a base-data attribute calculation. */
  readonly balanceContext?: ProfessionBalanceContext;
  readonly build: Gw2Build;
  readonly selectedSkills: readonly Skill[];
  readonly weaponSet: number;
  readonly disabledTrait: string | null;
}

export interface Gw2BuildAttributeContributions {
  readonly attributeEffects?: readonly Gw2AttributeEffect[];
  readonly traitDurations?: Readonly<Gw2NumericAttributes>;
  readonly traitCriticalChance?: number;
}

/** Active traits come from the profession's existing major/minor selection resolver. */
export type Gw2TraitBuildAttributeCalculator = (
  common: Gw2CommonAttributeResult,
  context: Gw2BuildAttributeRuleContext,
  activeTraits: readonly {
    readonly id: import('#gw2/platform/engine/skills/types.js').SkillId;
    readonly name: string;
  }[]
) => readonly Gw2BuildAttributeContributions[];

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

export interface BuildValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

/** A build as it arrives from storage or a shared link, before migration and validation. */
export type UnvalidatedBuild = unknown;

/** Carries the build shape returned by the owning codec while keeping saved input unvalidated. */
export interface ProfessionBuildDefinition<TBuild extends object = object> {
  readonly createBuildDefaults?: () => TBuild;
  readonly migrateBuild?: (saved: UnvalidatedBuild) => TBuild;
  readonly validateBuild?: (build: UnvalidatedBuild) => BuildValidationResult;
}
