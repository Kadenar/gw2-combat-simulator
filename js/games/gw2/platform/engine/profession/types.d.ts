/** Defines profession composition and presentation hooks consumed by the shared engine and app. */
import type {
  SkillId,
  Skill,
  CanonicalCatalog,
  BalanceProfile,
  CatalogEntity
} from '#gw2/platform/engine/skills/types.js';
import type {
  SchedulerRecord,
  RotationCommand,
  SchedulerConfig,
  SkillHandlerStrategy,
  CastLifecycleContext,
  ScheduledTaskHandler,
  SchedulerContext,
  SkillMechanicTriggerHandler,
  CastContext,
  AvailabilityResult
} from '#gw2/platform/engine/execution/types.js';
import type { SimulationEvent, SimulationEventInput } from '#gw2/platform/engine/events/types.js';

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
  readonly buildKey?: string;
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
  readonly placement?: 'profession' | 'weapon-set-1' | 'active-weapon';
  /** Optional row label used when placing a group beside the active weapon. */
  readonly weaponRowLabel?: string;
  readonly resourceAnchor?: boolean;
  readonly color?: string;
  readonly stackId?: string;
  readonly className?: string;
  /** Resource meters rendered in the same visual container as this group. */
  readonly resourceIds?: readonly string[];
  /** Where attached resources sit relative to the group's skills. */
  readonly resourcePlacement?: 'above' | 'beside' | 'below';
  readonly reservedSkillIds?: readonly number[];
  readonly skillEntries?: readonly SchedulerRecord[];
  readonly includeActionSkills?: boolean;
  readonly controls?: readonly ProfessionPaletteControl[];
  /** A read-only icon describing the active entity for this skill group. */
  readonly statusIcon?: ProfessionPaletteStatusIcon;
}

export interface ProfessionPaletteSkillRenderOptions {
  readonly contextAvailable?: boolean;
  readonly contextMessage?: string;
  readonly view?: SchedulerRecord;
}

export type ProfessionPaletteSkillRenderer = (skill: Skill, options?: ProfessionPaletteSkillRenderOptions) => string;

export type ProfessionWeaponPaletteRenderContext = SchedulerRecord & {
  readonly skills: readonly Skill[];
  readonly autoattackChains: SchedulerRecord;
  readonly isSkillAvailable: (skill: Skill) => boolean;
  readonly unavailableMessage: (skill: Skill) => string;
  readonly renderSkill: ProfessionPaletteSkillRenderer;
};

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

export interface ProfessionSkillBarGroup extends SchedulerRecord {
  readonly label: string;
  readonly skillIds: readonly SkillId[];
  /** Lower values render before other profession mechanic groups. */
  readonly order?: number;
  /** Presentation-only child-to-root links rendered like autoattack chains. */
  readonly inspectionChainRoots?: Readonly<Record<string, SkillId>>;
  /** Places a read-only mechanic group with the weapon previews. */
  readonly placement?: 'skill-bar' | 'weapon-bar';
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
  /** Optional slot key rendered beneath a selectable mechanic skill. */
  readonly keyLabel?: string;
  /** Optional slot type rendered beneath a selectable mechanic skill. */
  readonly typeLabel?: string;
  /** When set, render an option filter using this placeholder. */
  readonly filterPlaceholder?: string;
  /** Read-only skills previewed before this selection. */
  readonly leadingSkillIds?: readonly SkillId[];
  /** Read-only skills previewed beside this selection. */
  readonly skillIds?: readonly SkillId[];
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
}

export interface ProfessionUiContract {
  readonly assumptionControls: readonly SchedulerRecord[];
  readonly chargeReleaseProjection: (context: SchedulerRecord) => SchedulerRecord | null;
  readonly effectPresentations: (context: SchedulerRecord) => ProfessionEffectPresentation[];
  readonly eventLogRow?: (
    context: SchedulerRecord,
    event: SimulationEvent
  ) => ProfessionEventLogDescriptor | null | undefined;
  readonly isPaletteSkillInstant: (context: SchedulerRecord, skill: Skill) => boolean;
  /** Reports whether a palette skill is usable, why it is blocked, and when a temporary lockout ends. */
  readonly paletteSkillAvailability: (context: SchedulerRecord, skill: Skill) => PaletteSkillAvailability;
  readonly isSlotSkillSelectable: (context: SchedulerRecord, skill: Skill) => boolean;
  readonly paletteGroups: (context: SchedulerRecord) => ProfessionPaletteGroup[];
  /** Adds or projects profession-owned actions before the shell renders them. */
  readonly paletteActionSkills: (context: SchedulerRecord, skills: readonly Skill[]) => Skill[];
  /** Projects profession state into the weapon skills rendered by the shell. */
  readonly paletteWeaponSkills: (context: SchedulerRecord, skills: readonly Skill[]) => Skill[];
  /** Lets a specialization own an exceptional weapon layout without shell policy. */
  readonly renderWeaponPalette: (context: ProfessionWeaponPaletteRenderContext) => ProfessionWeaponPaletteView | null;
  /** Resolves a profession-owned palette action into canonical rotation items. */
  readonly resolvePaletteAction: (
    context: SchedulerRecord,
    action: ProfessionPaletteActionIdentity
  ) => RotationCommand | RotationCommand[] | null | undefined;
  /** Applies a profession-owned palette control action to mutable build state. */
  readonly updatePaletteControl: (context: SchedulerRecord, controlId: string) => boolean;
  readonly resourceViews: (context: SchedulerRecord) => ProfessionResourceView[];
  readonly skillBarGroups: (context: SchedulerRecord) => ProfessionSkillBarGroup[];
  readonly startControls: (context: SchedulerRecord) => ProfessionStartControl[];
  readonly slotLoadout: SchedulerRecord | null;
  readonly targetHealthThresholds: (context: SchedulerRecord) => number[];
  readonly rotationStateSnapshot: (context: SchedulerRecord) => RotationStateSnapshotItem[];
  readonly timelineWeaponLineTransition: (context: SchedulerRecord) => string | null | undefined;
  readonly timelineSkillIcon: (context: SchedulerRecord) => string;
  readonly updateSkillBarSelection: (context: SchedulerRecord, selection: SchedulerRecord) => boolean;
  readonly weaponSkillMatchesSet?: (skill: Skill, weapons: string[], context: SchedulerRecord) => boolean;
  readonly weaponSwapChangesSet: boolean;
}

export interface BuildValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export interface ProfessionBuildDefinition {
  readonly createBuildDefaults?: () => SchedulerRecord;
  readonly migrateBuild?: (saved: SchedulerRecord) => SchedulerRecord;
  readonly validateBuild?: (build: SchedulerRecord) => BuildValidationResult;
}

export interface ProfessionResourceDefinition<TProfessionState extends object = SchedulerRecord> {
  readonly createProfessionState?: (config: Readonly<SchedulerConfig>) => TProfessionState;
  readonly createResolverState?: (config: Readonly<SchedulerConfig>) => object;
  readonly projectEndState?: unknown;
}

export interface ProfessionSchedulerHookDefinition {
  readonly prepareEvent?: unknown;
  readonly initialize?: unknown;
  readonly availability?: unknown;
  readonly scheduleSkill?: unknown;
  readonly afterCast?: unknown;
  readonly advance?: unknown;
  readonly snapshot?: unknown;
  readonly projectEndState?: unknown;
  readonly onCastStart?: unknown;
  readonly onCastComplete?: unknown;
  readonly onCooldownReset?: unknown;
  readonly onEventScheduled?: unknown;
  readonly onWeaponSwap?: unknown;
  readonly modifyCastDuration?: unknown;
  readonly modifyRechargeDuration?: unknown;
  readonly modifyRechargeStart?: unknown;
  readonly modifyMaximumAmmo?: unknown;
  readonly taskHandlers?: Readonly<Record<string, (...args: never[]) => unknown>>;
  readonly skillMechanicHandlers?: Readonly<Record<string, (...args: never[]) => unknown>>;
}

export interface ProfessionResolverHookDefinition {
  readonly eventHandlers?: Readonly<Record<string, (...args: never[]) => unknown>>;
  readonly eventReactions?: Readonly<Record<string, unknown>>;
}

export interface ProfessionDefinition<TProfessionState extends object = SchedulerRecord> {
  readonly id: string;
  readonly name: string;
  readonly catalog?: CanonicalCatalog;
  readonly build?: ProfessionBuildDefinition;
  readonly resources?: ProfessionResourceDefinition<TProfessionState>;
  readonly attributeRules?: SchedulerRecord;
  readonly castRules?: SchedulerRecord;
  readonly schedulerHooks?: ProfessionSchedulerHookDefinition;
  readonly resolverHooks?: ProfessionResolverHookDefinition;
  readonly ui?: Partial<ProfessionUiContract> & SchedulerRecord;
  readonly simulation?: SchedulerRecord | null;
  readonly createProfessionState?: (config: Readonly<SchedulerConfig>) => TProfessionState;
  readonly createResolverState?: (config: Readonly<SchedulerConfig>) => object;
  readonly eventHandlers?: Readonly<Record<string, (...args: never[]) => unknown>>;
  readonly eventReactions?: Readonly<Record<string, unknown>>;
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

export interface ProfessionModuleDefinition<TModuleState extends object = SchedulerRecord> {
  readonly id: string;
  readonly catalog?: ProfessionModuleCatalogFragment;
  readonly resources?: ProfessionResourceDefinition<TModuleState>;
  readonly attributeRules?: SchedulerRecord;
  readonly castRules?: SchedulerRecord;
  readonly schedulerHooks?: ProfessionSchedulerHookDefinition;
  readonly resolverHooks?: ProfessionResolverHookDefinition;
  readonly ui?: Partial<ProfessionUiContract> & SchedulerRecord;
}

export interface ProfessionFamilyDefinition<TProfessionState extends object = SchedulerRecord> {
  readonly id: string;
  readonly name: string;
  readonly catalog: CanonicalCatalog;
  readonly build?: ProfessionBuildDefinition;
  readonly core: ProfessionModuleDefinition<any>;
  readonly specializations: Readonly<Record<string, ProfessionModuleDefinition<any>>>;
  /**
   * Application-only callbacks that are genuinely global to the family.
   * Runtime callbacks belong to Core or the active specialization module.
   */
  readonly ui?: Partial<ProfessionUiContract> & SchedulerRecord;
  readonly simulation?: SchedulerRecord | null;
}

/** Keeps scheduler contracts resolver-neutral while typed resolver layers supply their own registries. */
export interface NormalizedProfessionContract<
  TProfessionState extends object = SchedulerRecord,
  TEventHandlers extends object = object,
  TEventReactions extends object = object
> {
  readonly id: string;
  readonly name: string;
  readonly catalog: CanonicalCatalog;
  readonly ui: ProfessionUiContract;
  readonly simulation: SchedulerRecord | null;
  readonly skillHandlerFor: (skill: Skill) => SkillHandlerStrategy<CastLifecycleContext<TProfessionState>> | null;
  readonly createBuildDefaults: () => SchedulerRecord;
  readonly migrateBuild: (saved: SchedulerRecord) => SchedulerRecord;
  readonly validateBuild: (build: SchedulerRecord) => BuildValidationResult;
  readonly createProfessionState: (config: Readonly<SchedulerConfig>) => TProfessionState;
  readonly createResolverState: ((config: Readonly<SchedulerConfig>) => object) | null;
  readonly taskHandlers: Readonly<
    Record<string, ScheduledTaskHandler<SchedulerContext<TProfessionState>, SchedulerRecord>>
  >;
  readonly skillMechanicHandlers: Readonly<Record<string, SkillMechanicTriggerHandler<TProfessionState>>>;
  readonly eventHandlers: TEventHandlers;
  readonly eventReactions: TEventReactions;
  readonly prepareEvent: (
    context: SchedulerContext<TProfessionState>,
    event: SimulationEventInput
  ) => SimulationEventInput;
  readonly initialize: (context: SchedulerContext<TProfessionState>) => unknown;
  readonly availability: (context: CastContext<TProfessionState>, skill: Skill) => AvailabilityResult;
  readonly scheduleSkill: (context: CastLifecycleContext<TProfessionState>, skill: Skill) => boolean | void;
  readonly afterCast: (context: CastLifecycleContext<TProfessionState>, skill: Skill) => unknown;
  readonly advance: (context: SchedulerContext<TProfessionState>, at: number) => unknown;
  readonly snapshot: (context: SchedulerContext<TProfessionState>) => unknown;
  readonly projectEndState: (...args: never[]) => unknown;
  readonly onCastStart: (context: CastLifecycleContext<TProfessionState>, skill: Skill) => unknown;
  readonly onCastComplete: (context: CastLifecycleContext<TProfessionState>, skill: Skill) => unknown;
  readonly onCooldownReset: (context: SchedulerContext<TProfessionState>) => unknown;
  readonly onEventScheduled: (context: SchedulerContext<TProfessionState>, event: SimulationEvent) => unknown;
  readonly onWeaponSwap: (context: CastLifecycleContext<TProfessionState>, skill: Skill) => unknown;
  readonly modifyCastDuration: (context: CastContext<TProfessionState>, duration: number) => number;
  readonly modifyRechargeDuration: (
    context: SchedulerContext<TProfessionState> & SchedulerRecord,
    duration: number
  ) => number;
  readonly modifyRechargeStart: (context: CastContext<TProfessionState> & SchedulerRecord, start: number) => number;
  readonly modifyMaximumAmmo: (
    context: SchedulerContext<TProfessionState> & { skill: Skill },
    maximum: number
  ) => number;
  readonly modifyAttributes: (context: SchedulerRecord, attributes: SchedulerRecord) => SchedulerRecord;
  readonly modifyCriticalChance: (context: SchedulerRecord, chance: number) => number;
  readonly modifyCriticalDamage: (context: SchedulerRecord, multiplier: number) => number;
  readonly modifyStrikeDamage: (context: SchedulerRecord, multiplier: number) => number;
  readonly modifyConditionDamage: (context: SchedulerRecord, multiplier: number) => number;
  readonly modifyConditionBaseDuration: (context: SchedulerRecord, multiplier: number) => number;
  readonly modifyConditionDuration: (context: SchedulerRecord, multiplier: number) => number;
  readonly paletteGroups: (context: SchedulerRecord) => ProfessionPaletteGroup[];
  readonly resourceViews: (context: SchedulerRecord) => ProfessionResourceView[];
}

export interface ProfessionApplicationContract {
  readonly id: string;
  readonly name: string;
  readonly catalog: CanonicalCatalog;
  readonly ui: ProfessionUiContract;
  readonly simulation: SchedulerRecord | null;
  readonly createBuildDefaults: () => SchedulerRecord;
  readonly migrateBuild: (saved: SchedulerRecord) => SchedulerRecord;
  readonly validateBuild: (build: SchedulerRecord) => BuildValidationResult;
}

export interface ProfessionFamilyContract<
  TProfessionState extends object = SchedulerRecord,
  TRuntime extends NormalizedProfessionContract<TProfessionState, object, object> =
    NormalizedProfessionContract<TProfessionState>
> extends ProfessionApplicationContract {
  readonly resolveRuntime: (config: Readonly<SchedulerConfig>) => Readonly<TRuntime>;
}

export type ProfessionSource<
  TProfessionState extends object = SchedulerRecord,
  TRuntime extends NormalizedProfessionContract<TProfessionState, object, object> =
    NormalizedProfessionContract<TProfessionState>
> = TRuntime | ProfessionFamilyContract<TProfessionState, TRuntime>;
