/** Defines profession composition and presentation hooks consumed by the shared engine and app. */
import type {
  SkillId,
  Skill,
  CanonicalCatalog,
  BalanceProfile,
  CatalogEntity
} from '#gw2/platform/engine/skills/types.js';
import type {
  RotationCommand,
  SchedulerConfig,
  SkillHandlerStrategy,
  CastLifecycleContext,
  RegisteredTaskHandler,
  SchedulerContext,
  SkillMechanicTriggerHandler,
  CastContext,
  AvailabilityResult,
  RechargeContext,
  RechargeQueryDetails
} from '#gw2/platform/engine/execution/types.js';
import type { SimulationEvent, SimulationEventInput } from '#gw2/platform/engine/events/events.js';
import type {
  Gw2ApplicationBuild,
  Gw2BuildResources,
  ProfessionAssumptionControl
} from '#gw2/platform/builds/types.js';
import type { Gw2SimulationPlanningState, Gw2SimulationResult } from '#gw2/platform/simulation/types.js';
import type { Gw2WeaponSkillMatcher } from '#gw2/platform/equipment/weapons/types.js';
import type { Gw2Stats } from '#gw2/platform/combat/types.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';

export interface ProfessionEventLogDescriptor {
  readonly type: string;
  readonly description: string;
  readonly className?: string;
  readonly order?: number;
  readonly flags?: readonly string[];
}

export interface ProfessionResourceStatusItem {
  readonly id: string;
  readonly label: string;
  readonly valueLabel?: string;
  readonly title?: string;
}

export interface ProfessionResourceView {
  readonly id: string;
  readonly singular: string;
  readonly plural: string;
  readonly maximum: number;
  readonly value: number;
  readonly canStart: boolean;
  readonly shortLabel: string;
  readonly statusLabel: string;
  readonly startMaximum?: number;
  readonly buildKey?: keyof Gw2BuildResources;
  readonly step?: number;
  readonly displayMode?: string;
  readonly barSegments?: number;
  readonly pipStyle?: string;
  readonly pipRows?: number;
  readonly statusItemsLabel?: string;
  readonly statusItems?: readonly ProfessionResourceStatusItem[];
  /** Whether to render this resource in the rotation palette. Defaults to true. */
  readonly showInPalette?: boolean;
  /** Whether to show the numeric count and include it in the tooltip. Defaults to true. */
  readonly showValue?: boolean;
  /** Render this resource beneath the matching rotation-palette skill. */
  readonly paletteSkillId?: SkillId;
}

export interface ProfessionPaletteStatusIcon {
  readonly icon: string;
  readonly label: string;
  readonly title?: string;
}

export interface ProfessionPaletteControl {
  readonly id: string;
  readonly label: string;
  readonly icon?: string;
  readonly title?: string;
  readonly color?: string;
  readonly className?: string;
  readonly active?: boolean;
  readonly pressed?: boolean;
  readonly muted?: boolean;
  readonly badge?: string;
}

export interface ProfessionPaletteGroup {
  readonly id: string;
  readonly label: string;
  readonly skillIds: readonly SkillId[];
  /** Lower values render before other profession palette groups. */
  readonly order?: number;
  /** Moves a profession group beside the indicated palette surface. */
  readonly placement?: 'profession' | 'weapon-set-1' | 'active-weapon' | 'utility';
  /** Optional row label used when placing a group beside the active weapon. */
  readonly weaponRowLabel?: string;
  readonly resourceAnchor?: boolean;
  readonly color?: string;
  readonly stackId?: string;
  readonly className?: string;
  /** Resource meters rendered in the same visual container as this group. */
  readonly resourceIds?: readonly string[];
  /** Where attached resources sit relative to the group's skills. */
  readonly resourcePlacement?: 'above' | 'beside';
  /** Catalog skills rendered with profession-owned display overrides, such as a variant badge or legend label. */
  readonly skillEntries?: readonly ProfessionPaletteSkillEntry[];
  readonly includeActionSkills?: boolean;
  readonly controls?: readonly ProfessionPaletteControl[];
  /** A read-only icon describing the active entity for this skill group. */
  readonly statusIcon?: ProfessionPaletteStatusIcon;
}

export interface ProfessionPaletteSkillRenderOptions {
  readonly contextAvailable?: boolean;
  readonly contextMessage?: string;
  /** Palette tile fields a custom layout overrides after the shell projects the skill. */
  readonly view?: {
    readonly draggable?: boolean;
    readonly hotkeyAction?: string;
  };
}

/** One catalog skill placed in a profession palette group with display overrides. */
export type ProfessionPaletteSkillEntry = Partial<Skill> & { readonly skillId: SkillId };

export type ProfessionPaletteSkillRenderer = (skill: Skill, options?: ProfessionPaletteSkillRenderOptions) => string;

export interface ProfessionWeaponPaletteRenderContext<
  TProfessionState = unknown
> extends ProfessionPaletteContext<TProfessionState> {
  readonly skills: readonly Skill[];
  /** Active autoattack chain step by chain root id or name. */
  readonly autoattackChains: Readonly<Record<string, unknown>>;
  readonly isSkillAvailable: (skill: Skill) => boolean;
  readonly unavailableMessage: (skill: Skill) => string;
  readonly renderSkill: ProfessionPaletteSkillRenderer;
}

export interface ProfessionWeaponPaletteView {
  readonly weaponGroupsHtml: readonly string[];
  readonly activeWeaponHtml?: string;
  readonly primaryClassName?: string;
  readonly primaryRole?: string;
  readonly placeUtilityInPrimary?: boolean;
  readonly placeActionsInPrimary?: boolean;
}

export interface ProfessionPaletteActionIdentity {
  readonly name: string;
  readonly skillId?: SkillId | null;
}

export interface ProfessionSkillBarGroup {
  readonly id?: string;
  readonly label: string;
  readonly skillIds: readonly SkillId[];
  /** Lower values render before other build-selection groups. */
  readonly order?: number;
  readonly selections?: readonly ProfessionSkillBarSelection[];
  readonly optionSkillIds?: readonly SkillId[];
  readonly optionEntries?: readonly ProfessionSkillBarSelectionOption[];
  readonly selectionValue?: string;
  readonly selectionKey?: string;
  readonly selectionIndex?: number;
  readonly color?: string;
  readonly className?: string;
  readonly layout?: string;
}

export interface ProfessionSkillBarSelection {
  readonly skillId?: SkillId;
  /** When set, render an option filter using this placeholder. */
  readonly filterPlaceholder?: string;
  readonly optionSkillIds?: readonly SkillId[];
  readonly optionEntries?: readonly ProfessionSkillBarSelectionOption[];
  readonly selectionValue?: string;
  readonly selectionKey: string;
  readonly selectionIndex: number;
}

export interface ProfessionSkillBarSelectionOption {
  readonly value: string;
  readonly label: string;
  readonly icon?: string;
  readonly description?: string;
  readonly skillId?: SkillId;
}

export interface ProfessionStartControlOption {
  readonly value: string;
  readonly label: string;
  readonly icon?: string;
  readonly description?: string;
}

export interface ProfessionStartControl {
  readonly id: string;
  readonly label: string;
  readonly buildKey: string;
  readonly value: string;
  readonly options: readonly ProfessionStartControlOption[];
  readonly color?: string;
}

export interface PaletteSkillAvailability {
  readonly available: boolean;
  readonly message: string;
  /** Absolute simulator time in seconds when a temporary context lockout ends. */
  readonly retryAt?: number | null;
}

/**
 * One inspectable value in the rotation "active state" bar (crit chance, a
 * profession timer such as Berserk, a target debuff, etc.). Rendered as text at
 * the current point in the rotation, or at the insertion cursor when one is set.
 * Professions contribute cherry-picked items; each `id` must be unique across
 * the merged set for the active specialization.
 */
export interface RotationStateSnapshotItem {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  /** When `false`, the item is omitted from the bar. Defaults to shown. */
  readonly active?: boolean;
  readonly title?: string;
}

/** Describes one profession-owned timed effect without coupling shared result code to that profession. */
export interface ProfessionEffectPresentation {
  readonly id: string;
  readonly kind: string;
  readonly name: string | ((event: SimulationEvent) => string);
  readonly color?: string;
  readonly maximumStacks?: number;
  /** Effects that publish complete state snapshots replace earlier applications in this group. */
  readonly replacementGroup?: string;
  /** Projects recorded state into a buff window; zero stacks close the previous window. Expiry is in seconds. */
  readonly stateFromEvent?: (event: SimulationEvent) => { readonly stacks: number; readonly expiresAt?: number } | null;
}

/**
 * Build selection every application UI callback receives. Composition reads the specialization to choose Core or the
 * active elite; `professionState` is the end-state projection of the profession that owns the callback.
 */
export interface ProfessionUiContext<TProfessionState = unknown> {
  readonly specialization?: string;
  /** Simulation config selection, used when a resolved runtime's UI is queried outside the application. */
  readonly config?: SchedulerConfig;
  readonly build?: Gw2ApplicationBuild | null;
  readonly catalog?: CanonicalCatalog | null;
  readonly professionState?: TProfessionState;
}

/** Live palette projection at the rotation insertion point. */
export interface ProfessionPaletteContext<TProfessionState = unknown> extends ProfessionUiContext<TProfessionState> {
  readonly cooldowns?: Gw2SimulationPlanningState['cooldowns'];
  readonly activeWeaponSet?: number;
  /** Scheduler clock in seconds. */
  readonly time?: number;
  readonly activeAutoattack?: Skill | null;
  /** Active trait ids and names, so trait-gated replacements appear only when selected. */
  readonly traits?: ReadonlySet<SkillId | string>;
  readonly weaponSet?: number;
  /** The rendered weapon row when projecting one row's skills. */
  readonly weaponRow?: {
    readonly id: string;
    readonly label: string;
    readonly weaponSet: number;
    readonly active: boolean;
    readonly skills: readonly Skill[];
  };
}

/** Resource meters and their starting-value controls. */
export interface ProfessionResourceViewContext<
  TProfessionState = unknown
> extends ProfessionUiContext<TProfessionState> {
  /** Scheduler clock in seconds for live cooldown labels. */
  readonly simulationTime?: number;
  readonly value?: unknown;
  readonly initialResource?: unknown;
  readonly initialBlight?: unknown;
  readonly initialCascadingCorruptionStacks?: unknown;
}

/** Result-view callbacks that describe a completed simulation. */
export interface ProfessionResultUiContext<TProfessionState = unknown> extends ProfessionUiContext<TProfessionState> {
  readonly result?: Gw2SimulationResult | null;
  readonly profession?: object | null;
}

/** Event-log rows; `eventLogState` is scratch state the owning presenter keeps for one log render. */
export interface ProfessionEventLogContext<
  TProfessionState = unknown
> extends ProfessionResultUiContext<TProfessionState> {
  readonly displayReferenceSeconds?: number;
  readonly maximumResource?: number;
  readonly eventLogState?: Map<string, unknown>;
}

/** Rotation state snapshot at the inspected point. */
export interface ProfessionStateSnapshotContext<
  TProfessionState = unknown
> extends ProfessionResultUiContext<TProfessionState> {
  /** Simulation time in seconds of the rotation point being inspected. */
  readonly atSeconds?: number;
}

/** Charge-release choices for one skill inserted at a rotation index. */
export interface ProfessionChargeReleaseContext {
  readonly events?: readonly SimulationEvent[];
  readonly insertionIndex?: number;
  readonly skill?: Skill;
}

/** Timeline weapon-line tracking: the initial line, or the transition caused by one rotation entry. */
export interface ProfessionWeaponLineContext<TProfessionState = unknown> extends ProfessionUiContext<TProfessionState> {
  readonly initial?: boolean;
  readonly entry?: RotationCommand;
  readonly skill?: Skill;
  readonly weaponSet?: number;
  readonly weaponLine?: string | null;
}

/** Timeline icon for one rotation entry. */
export interface ProfessionTimelineIconContext<
  TProfessionState = unknown
> extends ProfessionUiContext<TProfessionState> {
  readonly entry?: RotationCommand;
  readonly index?: number;
  readonly rotation?: readonly RotationCommand[];
  readonly skill?: Skill;
  readonly defaultIcon?: string;
}

/** One build-selection edit emitted by a skill-bar selector. */
export interface ProfessionSkillBarSelectionChange {
  readonly key: string;
  readonly index: number;
  readonly skillId?: SkillId;
  readonly value?: string;
}

/**
 * Every field an application UI callback context can carry. Profession presenters that share one helper across
 * several callbacks read from this; each field is present only for the callbacks that supply it.
 */
export type ProfessionUiCallbackContext<TProfessionState = unknown> = ProfessionPaletteContext<TProfessionState> &
  ProfessionResourceViewContext<TProfessionState> &
  ProfessionEventLogContext<TProfessionState> &
  ProfessionStateSnapshotContext<TProfessionState> &
  ProfessionChargeReleaseContext &
  ProfessionWeaponLineContext<TProfessionState> &
  ProfessionTimelineIconContext<TProfessionState>;

export interface ProfessionUiContract<TProfessionState = unknown> {
  readonly assumptionControls: readonly ProfessionAssumptionControl[];
  /** Returns charge-release rows for the application editor to validate, or null when the skill has none. */
  readonly chargeReleaseProjection: (context: ProfessionChargeReleaseContext) => object | null;
  readonly effectPresentations: (
    context: ProfessionResultUiContext<TProfessionState>
  ) => ProfessionEffectPresentation[];
  readonly eventLogRow?: (
    context: ProfessionEventLogContext<TProfessionState>,
    event: SimulationEvent
  ) => ProfessionEventLogDescriptor | null | undefined;
  readonly isPaletteSkillInstant: (context: ProfessionPaletteContext<TProfessionState>, skill: Skill) => boolean;
  /** Reports whether a palette skill is usable, why it is blocked, and when a temporary lockout ends. */
  readonly paletteSkillAvailability: (
    context: ProfessionPaletteContext<TProfessionState>,
    skill: Skill
  ) => PaletteSkillAvailability;
  readonly isSlotSkillSelectable: (context: ProfessionUiContext<TProfessionState>, skill: Skill) => boolean;
  readonly paletteGroups: (context: ProfessionPaletteContext<TProfessionState>) => ProfessionPaletteGroup[];
  /** Adds or projects profession-owned actions before the shell renders them. */
  readonly paletteActionSkills: (
    context: ProfessionPaletteContext<TProfessionState>,
    skills: readonly Skill[]
  ) => Skill[];
  /** Projects profession state into the weapon skills rendered by the shell. */
  readonly paletteWeaponSkills: (
    context: ProfessionPaletteContext<TProfessionState>,
    skills: readonly Skill[]
  ) => Skill[];
  /** Lets a specialization own an exceptional weapon layout without shell policy. */
  readonly renderWeaponPalette: (
    context: ProfessionWeaponPaletteRenderContext<TProfessionState>
  ) => ProfessionWeaponPaletteView | null;
  /** Resolves a profession-owned palette action into canonical rotation items. */
  readonly resolvePaletteAction: (
    context: ProfessionPaletteContext<TProfessionState>,
    action: ProfessionPaletteActionIdentity
  ) => RotationCommand | RotationCommand[] | null | undefined;
  /** Applies a profession-owned palette control action to mutable build state. */
  readonly updatePaletteControl: (context: ProfessionPaletteContext<TProfessionState>, controlId: string) => boolean;
  readonly resourceViews: (context: ProfessionResourceViewContext<TProfessionState>) => ProfessionResourceView[];
  readonly skillBarGroups: (context: ProfessionPaletteContext<TProfessionState>) => ProfessionSkillBarGroup[];
  readonly startControls: (context: ProfessionUiContext<TProfessionState>) => ProfessionStartControl[];
  /** Application-owned loadout controller; the engine only carries it to the application adapter. */
  readonly slotLoadout: object | null;
  readonly targetHealthThresholds: (context: ProfessionUiContext<TProfessionState>) => number[];
  readonly rotationStateSnapshot: (
    context: ProfessionStateSnapshotContext<TProfessionState>
  ) => RotationStateSnapshotItem[];
  readonly timelineWeaponLineTransition: (
    context: ProfessionWeaponLineContext<TProfessionState>
  ) => string | null | undefined;
  readonly timelineSkillIcon: (context: ProfessionTimelineIconContext<TProfessionState>) => string;
  readonly updateSkillBarSelection: (
    context: ProfessionUiContext<TProfessionState>,
    selection: ProfessionSkillBarSelectionChange
  ) => boolean;
  readonly weaponSwapChangesSet: boolean;
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

export interface ProfessionResourceDefinition<TProfessionState extends object = object> {
  readonly createProfessionState?: (config: Readonly<SchedulerConfig>) => TProfessionState;
  readonly createResolverState?: (config: Readonly<SchedulerConfig>) => object;
  readonly projectPlanningState?: unknown;
}

/** One composable hook: a bare function, or a function with ordering metadata. */
export type ProfessionHook =
  | ((...args: never[]) => unknown)
  | {
      readonly id?: string;
      readonly order?: number;
      readonly handler: (...args: never[]) => unknown;
    };

/** A hook slot accepts one hook or an ordered list of them. */
export type ProfessionHookEntry = ProfessionHook | readonly ProfessionHook[];

/** Cast-phase rules a module contributes; composition folds each slot across modules. */
export interface ProfessionCastRuleDefinition {
  readonly availability?: ProfessionHookEntry;
  readonly modifySkillId?: ProfessionHookEntry;
  readonly modifyCastDuration?: ProfessionHookEntry;
  readonly modifyRechargeDuration?: ProfessionHookEntry;
  readonly commitRechargeDuration?: ProfessionHookEntry;
  readonly modifyRechargeStart?: ProfessionHookEntry;
  readonly modifyMaximumAmmo?: ProfessionHookEntry;
}

/** Attribute-phase rules a module contributes, plus its declarative modifier fragments. */
export interface ProfessionAttributeRuleDefinition {
  readonly modifyAttributes?: ProfessionHookEntry;
  readonly modifyCriticalChance?: ProfessionHookEntry;
  readonly modifyCriticalDamage?: ProfessionHookEntry;
  readonly modifyStrikeDamage?: ProfessionHookEntry;
  readonly modifyConditionDamage?: ProfessionHookEntry;
  readonly modifyConditionBaseDuration?: ProfessionHookEntry;
  readonly modifyConditionDuration?: ProfessionHookEntry;
  /** Declarative modifier fragments compiled once per family by the single owning compiler. */
  readonly modifierRules?: readonly Gw2ModifierRule[];
  readonly compileModifierRules?: (declarations: readonly Gw2ModifierRule[]) => {
    readonly [
      K in Exclude<keyof ProfessionAttributeRuleDefinition, 'modifierRules' | 'compileModifierRules'>
    ]?: ProfessionHook;
  };
}

/**
 * Simulation policy a profession declares for the application pipeline. Game layers narrow
 * `refineSchedulerConfig` to their own config and result types.
 */
export interface ProfessionSimulationDefinition {
  readonly refineSchedulerConfig?: (...args: never[]) => object | null | undefined;
}

export interface ProfessionSchedulerHookDefinition {
  readonly prepareEvent?: unknown;
  readonly initialize?: unknown;
  readonly afterCast?: unknown;
  readonly advance?: unknown;
  readonly snapshot?: unknown;
  readonly onCastStart?: unknown;
  readonly onCastComplete?: unknown;
  readonly onCooldownReset?: unknown;
  readonly onEventScheduled?: unknown;
  readonly onWeaponSwap?: unknown;
  readonly taskHandlers?: Readonly<Record<string, (...args: never[]) => unknown>>;
  readonly skillMechanicHandlers?: Readonly<Record<string, (...args: never[]) => unknown>>;
}

export interface ProfessionResolverHookDefinition {
  readonly eventHandlers?: Readonly<Record<string, (...args: never[]) => unknown>>;
  readonly eventReactions?: Readonly<Record<string, unknown>>;
}

export interface ProfessionDefinition<TProfessionState extends object = object, TBuild extends object = object> {
  /** One equipment eligibility policy used by simulation and application consumers. */
  readonly weaponSkillMatchesSet?: Gw2WeaponSkillMatcher;
  readonly id: string;
  readonly name: string;
  readonly catalog?: CanonicalCatalog;
  readonly build?: ProfessionBuildDefinition<TBuild>;
  readonly resources?: ProfessionResourceDefinition<TProfessionState>;
  readonly attributeRules?: ProfessionAttributeRuleDefinition;
  readonly castRules?: ProfessionCastRuleDefinition;
  readonly schedulerHooks?: ProfessionSchedulerHookDefinition;
  readonly resolverHooks?: ProfessionResolverHookDefinition;
  readonly ui?: Partial<ProfessionUiContract>;
  readonly simulation?: ProfessionSimulationDefinition | null;
}

export interface ProfessionModuleCatalogFragment {
  readonly skills?: readonly Skill[];
  readonly balanceProfiles?: readonly BalanceProfile[];
  readonly skillHandlers?: ReadonlyMap<string, unknown> | Readonly<Record<string, unknown>>;
  readonly traits?: readonly CatalogEntity[];
  readonly specializations?: readonly CatalogEntity[];
  readonly weapons?: readonly string[];
  readonly weaponHands?: ReadonlyMap<string, string> | Readonly<Record<string, string>>;
  readonly autoattackChains?: {
    readonly additional?: readonly (readonly SkillId[])[];
    readonly excludeSkillIds?: readonly SkillId[];
  };
  readonly skillNameCollision?: 'first' | 'last';
  readonly skillNameOverrides?: Readonly<Record<string, SkillId>>;
}

export interface ProfessionModuleDefinition<TModuleState extends object = object> {
  readonly id: string;
  readonly catalog?: ProfessionModuleCatalogFragment;
  readonly resources?: ProfessionResourceDefinition<TModuleState>;
  readonly attributeRules?: ProfessionAttributeRuleDefinition;
  readonly castRules?: ProfessionCastRuleDefinition;
  readonly schedulerHooks?: ProfessionSchedulerHookDefinition;
  readonly resolverHooks?: ProfessionResolverHookDefinition;
  readonly ui?: Partial<ProfessionUiContract>;
}

export interface ProfessionFamilyDefinition<_TProfessionState extends object = object, TBuild extends object = object> {
  /** One equipment eligibility policy used by simulation and application consumers. */
  readonly weaponSkillMatchesSet?: Gw2WeaponSkillMatcher;
  readonly id: string;
  readonly name: string;
  readonly catalog: CanonicalCatalog;
  readonly build?: ProfessionBuildDefinition<TBuild>;
  readonly core: ProfessionModuleDefinition<any>;
  readonly specializations: Readonly<Record<string, ProfessionModuleDefinition<any>>>;
  /**
   * Application-only callbacks that are genuinely global to the family.
   * Runtime callbacks belong to Core or the active specialization module.
   */
  readonly ui?: Partial<ProfessionUiContract>;
  readonly simulation?: ProfessionSimulationDefinition | null;
}

/** Keeps scheduler contracts resolver-neutral while typed resolver layers supply their own registries. */
export interface NormalizedProfessionContract<
  TProfessionState extends object = object,
  TEventHandlers extends object = object,
  TEventReactions extends object = object,
  TBuild extends object = object
> {
  /** One equipment eligibility policy used by simulation and application consumers. */
  readonly weaponSkillMatchesSet?: Gw2WeaponSkillMatcher;
  readonly id: string;
  readonly name: string;
  readonly catalog: CanonicalCatalog;
  readonly ui: ProfessionUiContract;
  readonly simulation: ProfessionSimulationDefinition | null;
  readonly skillHandlerFor: (skill: Skill) => SkillHandlerStrategy<CastLifecycleContext<TProfessionState>> | null;
  readonly createBuildDefaults: () => TBuild;
  readonly migrateBuild: (saved: UnvalidatedBuild) => TBuild;
  readonly validateBuild: (build: UnvalidatedBuild) => BuildValidationResult;
  readonly createProfessionState: (config: Readonly<SchedulerConfig>) => TProfessionState;
  readonly createResolverState: ((config: Readonly<SchedulerConfig>) => object) | null;
  readonly taskHandlers: Readonly<Record<string, RegisteredTaskHandler<SchedulerContext<TProfessionState>>>>;
  readonly skillMechanicHandlers: Readonly<Record<string, SkillMechanicTriggerHandler<TProfessionState>>>;
  readonly eventHandlers: TEventHandlers;
  readonly eventReactions: TEventReactions;
  readonly prepareEvent: (
    context: SchedulerContext<TProfessionState>,
    event: SimulationEventInput
  ) => SimulationEventInput;
  readonly initialize: (context: SchedulerContext<TProfessionState>) => unknown;
  readonly availability: (context: CastContext<TProfessionState>, skill: Skill) => AvailabilityResult;
  readonly afterCast: (context: CastLifecycleContext<TProfessionState>, skill: Skill) => unknown;
  readonly advance: (context: SchedulerContext<TProfessionState>, at: number) => unknown;
  readonly snapshot: (context: SchedulerContext<TProfessionState>) => unknown;
  readonly projectPlanningState: (...args: never[]) => unknown;
  readonly onCastStart: (context: CastLifecycleContext<TProfessionState>, skill: Skill) => unknown;
  readonly onCastComplete: (context: CastLifecycleContext<TProfessionState>, skill: Skill) => unknown;
  readonly onCooldownReset: (context: SchedulerContext<TProfessionState>) => unknown;
  readonly onEventScheduled: (context: SchedulerContext<TProfessionState>, event: SimulationEvent) => unknown;
  readonly onWeaponSwap: (context: CastLifecycleContext<TProfessionState>, skill: Skill) => unknown;
  /** Resolves build-selected skill variants before availability and resource bookkeeping. */
  readonly modifySkillId: (context: SchedulerContext<TProfessionState>, skillId: SkillId) => SkillId;
  readonly modifyCastDuration: (context: CastContext<TProfessionState>, duration: number) => number;
  /** Pure persistent recharge calculation; querying must not consume profession state. */
  readonly modifyRechargeDuration: (context: RechargeContext<TProfessionState>, duration: number) => number;
  /** Consumes cast-only modifiers once at reservation acceptance, before overlapping casts can claim them. */
  readonly commitRechargeDuration: (
    context: CastContext<TProfessionState> & RechargeQueryDetails,
    duration: number
  ) => number;
  readonly modifyRechargeStart: (
    context: CastContext<TProfessionState> & RechargeQueryDetails,
    start: number
  ) => number;
  readonly modifyMaximumAmmo: (
    context: SchedulerContext<TProfessionState> & { skill: Skill },
    maximum: number
  ) => number;
  readonly modifyAttributes: (context: Gw2ModifierContext, attributes: Gw2Stats) => Gw2Stats;
  readonly modifyCriticalChance: (context: Gw2ModifierContext, chance: number) => number;
  readonly modifyCriticalDamage: (context: Gw2ModifierContext, multiplier: number) => number;
  readonly modifyStrikeDamage: (context: Gw2ModifierContext, multiplier: number) => number;
  readonly modifyConditionDamage: (context: Gw2ModifierContext, multiplier: number) => number;
  readonly modifyConditionBaseDuration: (context: Gw2ModifierContext, multiplier: number) => number;
  readonly modifyConditionDuration: (context: Gw2ModifierContext, multiplier: number) => number;
  readonly paletteGroups: (context: ProfessionPaletteContext) => ProfessionPaletteGroup[];
  readonly resourceViews: (context: ProfessionResourceViewContext) => ProfessionResourceView[];
}

export interface ProfessionApplicationContract<
  TSimulation extends ProfessionSimulationDefinition = ProfessionSimulationDefinition,
  TBuild extends object = object
> {
  /** One equipment eligibility policy used by simulation and application consumers. */
  readonly weaponSkillMatchesSet?: Gw2WeaponSkillMatcher;
  readonly id: string;
  readonly name: string;
  readonly catalog: CanonicalCatalog;
  readonly ui: ProfessionUiContract;
  readonly simulation: TSimulation | null;
  readonly createBuildDefaults: () => TBuild;
  readonly migrateBuild: (saved: UnvalidatedBuild) => TBuild;
  readonly validateBuild: (build: UnvalidatedBuild) => BuildValidationResult;
}

export interface ProfessionFamilyContract<
  TProfessionState extends object = object,
  TRuntime extends NormalizedProfessionContract<TProfessionState, object, object> =
    NormalizedProfessionContract<TProfessionState>,
  TSimulation extends ProfessionSimulationDefinition = ProfessionSimulationDefinition,
  TBuild extends object = object
> extends ProfessionApplicationContract<TSimulation, TBuild> {
  readonly resolveRuntime: (config: Readonly<SchedulerConfig>) => Readonly<TRuntime>;
}

export type ProfessionSource<
  TProfessionState extends object = object,
  TRuntime extends NormalizedProfessionContract<TProfessionState, object, object> =
    NormalizedProfessionContract<TProfessionState>,
  TSimulation extends ProfessionSimulationDefinition = ProfessionSimulationDefinition,
  TBuild extends object = object
> = TRuntime | ProfessionFamilyContract<TProfessionState, TRuntime, TSimulation, TBuild>;
