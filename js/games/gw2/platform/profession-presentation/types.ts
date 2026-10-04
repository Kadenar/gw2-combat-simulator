import type { FixedSlotLoadout } from '#gw2/platform/builds/slot-loadout.js';
import type { ResourceKey } from '#gw2/platform/combat/resources/resource-policy.js';
import type {
  PreviewControl,
  ProfessionAttributePreviewContext,
  ProfessionAttributePreviewInput,
  ProfessionAttributePreviewPreparation
} from '#gw2/platform/profession-presentation/attribute-preview.js';
import type { ProfessionBalanceContext } from '#gw2/platform/profession-presentation/balance-context.js';
import type {
  SkillDamageConfigPatch,
  SkillDamageGroup,
  SkillDamagePreviewContext,
  SkillDamagePreviewPreparation,
  SkillDamageState
} from '#gw2/platform/profession-presentation/skill-damage.js';
/** Defines application presentation callbacks independently of the executable profession runtime. */
import type { Gw2BuildResources, Gw2CanonicalBuild, ProfessionAssumptionControl } from '#gw2/platform/builds/types.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { CanonicalCatalog, Skill, SkillId } from '#gw2/platform/engine/skills/types.js';
import type { CastCommand, ProfessionConfig, RotationCommand } from '#gw2/platform/execution/types.js';
import type { Gw2ProcStep } from '#gw2/platform/resolver/types.js';
import type { Gw2SimulationPlanningState, Gw2SimulationResult } from '#gw2/platform/simulation/types.js';

/** Profession-owned application identity; shared charts align and clip its simulation timestamp. */
export interface ProfessionChartApplication {
  readonly series: string;
  readonly at: number;
  readonly label: string;
  readonly empowered: boolean;
}

/** A projected automatic event; the timeline owns insertion placement and clock formatting. */
export interface ProfessionTimelineMarker {
  readonly at: number;
  readonly icon: string;
  readonly color: string;
  readonly badge: string;
  readonly title: (time: string) => string;
}

/** Declares an opt-in overlay without coupling browser preference storage to profession names. */
export interface ProfessionTimelineOverlay {
  readonly id: string;
  readonly storageKey: string;
  readonly label: string;
  readonly title: string;
  readonly matchesProc: (proc: Gw2ProcStep) => boolean;
}

/** Executed mechanic spends are matched to activations by the shared timeline. */
export interface MechanicResourceSpend {
  readonly count: number;
  readonly resource: string;
  readonly sourceSkill: string;
  readonly requestedCharges?: number;
  readonly maximumCharges?: number;
  readonly chargesReached?: number;
  readonly chargingSeconds?: number;
  readonly maximumChargingSeconds?: number;
  readonly flowSpent?: number;
}

/** Supplies mechanic wording and badges while leaving HTML and editing interactions to the timeline. */
export interface ProfessionTimelineAnnotation {
  readonly resourceLabel?: string;
  readonly resourceShortLabel?: string;
  readonly details?: readonly string[];
  readonly outcomeMismatch?: boolean;
  readonly releaseBadge?: { readonly label: string; readonly title: string };
  readonly editLabel?: string;
}

/** Groups weapon variants without exposing profession-specific grouping rules to the palette. */
export interface ProfessionWeaponSkillGroup {
  readonly id: string;
  readonly label: string;
  readonly skills: readonly Skill[];
}

export interface ProfessionEventLogDescriptor {
  readonly type: string;
  readonly description: string;
  readonly className?: string;
  readonly order?: number;
}

interface ProfessionResourceStatusItem {
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

interface ProfessionSkillBarSelection {
  readonly skillId?: SkillId;
  /** When set, render an option filter using this placeholder. */
  readonly filterPlaceholder?: string;
  readonly optionSkillIds?: readonly SkillId[];
  readonly optionEntries?: readonly ProfessionSkillBarSelectionOption[];
  readonly selectionValue?: string;
  readonly selectionKey: string;
  readonly selectionIndex: number;
}

interface ProfessionSkillBarSelectionOption {
  readonly value: string;
  readonly label: string;
  readonly icon?: string;
  readonly description?: string;
  readonly skillId?: SkillId;
}

interface ProfessionStartControlOption {
  readonly value: string;
  readonly label: string;
  readonly icon?: string;
  readonly description?: string;
}

export interface ProfessionStartControl {
  readonly label: string;
  readonly buildKey: string;
  readonly value: string;
  readonly options: readonly ProfessionStartControlOption[];
  readonly color?: string;
}

export interface PaletteOverride {
  /** Selects a shared tile independently of cast readiness and affordability. */
  readonly tileActive?: boolean;
  /** Explicit authoring exceptions affect insertion only, never runtime legality. */
  readonly available?: boolean;
  readonly message?: string;
  /** Opens a command-specific editor even when the default command is denied. */
  readonly editorAccess?: boolean;
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
}

/**
 * Build selection every application UI callback receives. Composition reads the specialization to choose Core or the
 * active elite; `professionState` is the end-state projection of the profession that owns the callback.
 */
interface ProfessionUiContext<TProfessionState = unknown> {
  /** Policy-derived limits supplied by family composition for resource presentation. */
  readonly resources?: Readonly<Partial<Record<ResourceKey | 'endurance', { readonly maximum: number }>>>;
  readonly specialization?: string;
  /** Simulation config selection, used when a resolved runtime's UI is queried outside the application. */
  readonly config?: ProfessionConfig;
  readonly build?: Gw2CanonicalBuild | null;
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
interface ProfessionResultUiContext<TProfessionState = unknown> extends ProfessionUiContext<TProfessionState> {
  readonly result?: Gw2SimulationResult | null;
  readonly profession?: object | null;
}

/** Event-log rows; the caller owns time and resource formatting. */
export type ProfessionEventLogContext<TProfessionState = unknown> = ProfessionResultUiContext<TProfessionState>;

/** Rotation state snapshot at the inspected point. */
export interface ProfessionStateSnapshotContext<TProfessionState = unknown> extends Omit<
  ProfessionResultUiContext<TProfessionState>,
  'catalog'
> {
  /** Simulation time in seconds of the rotation point being inspected. */
  readonly atSeconds?: number;
  /** Exact engine observation at the cursor; state displays do not depend on chart collection. */
  readonly planningState?: Gw2SimulationPlanningState | null;
  /** One selected balance source keeps snapshot profiles and modifiers on the same patch. */
  readonly balanceContext: ProfessionBalanceContext;
}

/** Charge-release choices for one skill inserted at a rotation index. */
export interface ProfessionChargeReleaseContext {
  readonly skill?: Skill;
  /** Each request executes a fresh prefix, optionally followed by one candidate release. */
  readonly preview?: (command?: CastCommand) => Pick<Gw2SimulationResult, 'events' | 'steps' | 'planningState'>;
}

/** Timeline weapon-line tracking: the initial line, or the transition caused by one rotation entry. */
interface ProfessionWeaponLineContext<TProfessionState = unknown> extends ProfessionUiContext<TProfessionState> {
  readonly initial?: boolean;
  readonly entry?: RotationCommand;
  readonly skill?: Skill;
  readonly weaponSet?: number;
  readonly weaponLine?: string | null;
}

/** Profession icon override for one rotation entry; the timeline owns the fallback icon. */
interface ProfessionTimelineIconContext<TProfessionState = unknown> extends ProfessionUiContext<TProfessionState> {
  readonly entry?: RotationCommand;
  readonly index?: number;
  readonly rotation?: readonly RotationCommand[];
  readonly skill?: Skill;
}

export interface ProfessionTimelineAnnotationContext<
  TProfessionState = unknown
> extends ProfessionTimelineIconContext<TProfessionState> {
  readonly spend?: MechanicResourceSpend;
  readonly formattedTime: string;
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
  Partial<ProfessionStateSnapshotContext<TProfessionState>> &
  ProfessionChargeReleaseContext &
  ProfessionWeaponLineContext<TProfessionState> &
  ProfessionTimelineIconContext<TProfessionState> &
  Partial<ProfessionTimelineAnnotationContext<TProfessionState>>;

export interface ProfessionUiContract<TProfessionState = unknown> {
  /** Conditional inputs for both isolated previews; each control's scope selects its panels. */
  readonly previewControls: (context: ProfessionAttributePreviewContext) => PreviewControl[];
  readonly attributePreviewDisabledTrait: (context: ProfessionAttributePreviewInput) => string | null;
  readonly prepareAttributePreview: (context: ProfessionAttributePreviewPreparation) => void;
  /** Mechanic groups for the skill damage preview; weapons and slot skills are grouped by the platform. */
  readonly skillDamageGroups: (context: SkillDamagePreviewContext) => SkillDamageGroup[];
  /** State a skill needs before it can be measured, or null when the generic setup is enough. */
  readonly skillDamageState: (context: SkillDamagePreviewPreparation, skill: Skill) => SkillDamageState | null;
  /** Profession runtime fields that apply the skill damage preview's values to every probe. */
  readonly prepareSkillDamagePreview: (context: SkillDamagePreviewPreparation) => SkillDamageConfigPatch;
  readonly chartApplications: (context: ProfessionResultUiContext<TProfessionState>) => ProfessionChartApplication[];
  readonly timelineMarkers: (context: ProfessionResultUiContext<TProfessionState>) => ProfessionTimelineMarker[];
  readonly timelineOverlays: (context: ProfessionUiContext<TProfessionState>) => ProfessionTimelineOverlay[];
  readonly timelineAnnotation: (
    context: ProfessionTimelineAnnotationContext<TProfessionState>
  ) => ProfessionTimelineAnnotation | null;
  readonly paletteWeaponGroups: (
    context: ProfessionPaletteContext<TProfessionState>,
    skills: readonly Skill[]
  ) => ProfessionWeaponSkillGroup[] | null;
  readonly paletteSelectedSlotSkills: (
    context: ProfessionPaletteContext<TProfessionState>,
    skills: readonly Skill[]
  ) => Skill[];
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
  /** Narrow authoring and tile-identity exceptions; ordinary gates come from the planning observation. */
  readonly paletteOverride?: (
    context: ProfessionPaletteContext<TProfessionState>,
    skill: Skill
  ) => PaletteOverride | undefined;
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
  /** Shared loadout contract for build selections, skill bars, and palette projections. */
  readonly slotLoadout: FixedSlotLoadout<Gw2CanonicalBuild> | null;
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
