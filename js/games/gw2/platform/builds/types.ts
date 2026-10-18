import type { CanonicalCatalog, SkillId } from '#gw2/platform/skills/types.js';

/** Saved-build schemas, assumption controls, and codec contracts shared by the app and runtime. */

/** A saved build's fields before migration and validation; every value is unverified input. */
export type UnvalidatedBuildRecord = Record<string, unknown>;

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
  initialPreSteal?: number;
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
  selectedSkillIds: Record<string, SkillId | null>;
  assumptions: ProfessionBuildAssumptions;
  infusions: Gw2BuildInfusion[];
  startingWeaponSet: number;
  targetHealth: number;
  targetStartingHealthPercent: number;
  targetArmor: number;
  rotation: import('#gw2/platform/builds/rotation.js').RotationCommand[];
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
