export type SkillId = string | number;

export type ObservationPolicy =
  | { readonly kind: "rotation" }
  | { readonly kind: "tail"; readonly durationMs: number }
  | { readonly kind: "absolute"; readonly endTimeMs: number };

export type NormalizedObservationPolicy = ObservationPolicy;

export type SimulationActorType =
  | "player"
  | "summon"
  | "effect"
  | "unknown"
  /**
   * Legacy Mesmer scheduler detail. Resolver ownership classifies this as a
   * summon; future event normalization should remove it from the public union.
   */
  | "phantasm";

export type CommonSimulationEventType =
  | "action"
  | "aura"
  | "combo"
  | "combo_field"
  | "combo_finisher"
  | "combat_start"
  | "condition_tick"
  | "control"
  | "blind"
  | "weapon_set"
  | "sigil_swap"
  | "proc"
  | "marker"
  | "resource"
  | "buff"
  | "weakness_vulnerability"
  | "peitha";

export type CustomSimulationEventType = `${string}.${string}`;

export type LegacySimulationEventType =
  "boon" | "cooldown_snapshot" | "self_condition";

export interface SimulationEventBase<TType extends string = string> {
  readonly schemaVersion?: 1;
  readonly type: TType;
  readonly at: number;
  readonly source: string;
  readonly sourceId: SkillId;
  readonly actorType?: SimulationActorType;
  readonly ownerActorType?: SimulationActorType;
  readonly name?: string;
  readonly skillName?: string;
  readonly parentSkillName?: string;
  readonly skillId?: SkillId | null;
  readonly icon?: string;
  readonly kind?: string;
  readonly duration?: number;
  readonly stacks?: number;
  readonly affectsSelf?: boolean;
  readonly weaponSet?: number;
  readonly procType?: string;
  readonly sourceSkill?: string;
  readonly detail?: string;
  readonly triggeredBy?: string;
  readonly activationId?: string;
  readonly weaponStrengthProfileId?: string;
  readonly weaponStrength?: number;
  readonly cooldownReduction?: number;
  readonly [field: string]: unknown;
}

export type DamageEvent = SimulationEventBase<"damage"> &
  (
    | {
        readonly coefficient: number;
      }
    | {
        readonly coefficient?: number;
        readonly flatDamage: number;
      }
    | {
        readonly coefficient?: number;
        readonly flatStrikeBase: number;
      }
    | {
        readonly coefficient?: number;
        readonly flatStrikePowerCoeff: number;
      }
  ) & {
    readonly coefficientModifiers?: ReadonlyArray<{
      readonly kind: "target-health-below";
      readonly threshold: number;
      readonly multiplier: number;
    }>;
    readonly hits?: number;
    readonly canCrit?: boolean;
    readonly forceCrit?: boolean;
    readonly canTriggerCriticalSigils?: boolean;
    readonly canTriggerCriticalTraits?: boolean;
    readonly didCrit?: boolean;
  };

export interface ConditionEvent extends SimulationEventBase<"condition"> {
  readonly condition: string;
  readonly stacks: number;
  readonly duration: number;
}

export type CommonSimulationEvent =
  SimulationEventBase<CommonSimulationEventType>;

export type CustomSimulationEvent =
  SimulationEventBase<CustomSimulationEventType>;

export type LegacySimulationEvent =
  SimulationEventBase<LegacySimulationEventType>;

export type SimulationEvent =
  | DamageEvent
  | ConditionEvent
  | CommonSimulationEvent
  | CustomSimulationEvent
  | LegacySimulationEvent;

export interface SimulationEventInput {
  readonly type: string;
  readonly at: number;
  readonly source: string;
  readonly sourceId: SkillId;
  readonly actorType?: SimulationActorType;
  readonly ownerActorType?: SimulationActorType;
  readonly name?: string;
  readonly skillName?: string;
  readonly parentSkillName?: string;
  readonly skillId?: SkillId | null;
  readonly icon?: string;
  readonly kind?: string;
  readonly duration?: number;
  readonly stacks?: number;
  readonly weaponSet?: number;
  readonly procType?: string;
  readonly sourceSkill?: string;
  readonly detail?: string;
  readonly triggeredBy?: string;
  readonly activationId?: string;
  readonly weaponStrengthProfileId?: string;
  readonly weaponStrength?: number;
  readonly cooldownReduction?: number;
  readonly [field: string]: unknown;
}

export interface ScheduledEventStream {
  readonly kind: "gw2.simulation.events";
  readonly version: 1;
  readonly eventSchemaVersion: 1;
  readonly source: string;
  readonly rotationEndTime: number;
  readonly resolutionEndTime?: number;
  readonly events: readonly SimulationEvent[];
  readonly resolverHandoff: Readonly<Record<string, unknown>>;
}

export interface CatalogSkill {
  readonly id: SkillId;
  readonly name: string;
  readonly [field: string]: unknown;
}

export type SkillHandlerMode = "augment" | "replace";

export interface StrikeTick {
  readonly atMs: number;
  readonly coefficient: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly [field: string]: unknown;
}

export interface ConditionTick {
  readonly atMs: number;
  readonly condition: string;
  readonly stacks: number;
  readonly duration: number;
  readonly [field: string]: unknown;
}

export interface SkillEffectBase {
  readonly type: string;
  readonly atMs?: number;
  readonly intervalMs?: number;
  readonly timingAnchor?: "castStart" | "castEnd";
  readonly timingScale?: "cast" | "fixed";
  readonly durationScale?: "boon" | "fixed";
  readonly applications?: number;
  readonly persistsAfterInterrupt?: boolean;
  readonly source?: string;
  readonly sourceId?: SkillId;
  readonly actorType?: SimulationActorType;
  readonly ownerActorType?: SimulationActorType;
  readonly name?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly comboFields?: readonly Readonly<Record<string, unknown>>[];
  readonly comboFinishers?: readonly Readonly<Record<string, unknown>>[];
  readonly [field: string]: unknown;
}

export interface StrikeEffect extends SkillEffectBase {
  readonly type: "strike";
  readonly coefficient?: number;
  readonly hits?: number;
  readonly ticks?: readonly StrikeTick[];
  readonly canCrit?: boolean;
  readonly coefficientModifiers?: DamageEvent["coefficientModifiers"];
  readonly weapon?: string;
  readonly weaponStrength?: number;
  readonly weaponStrengthProfileId?: string;
  readonly weaponStrengthSource?: "equipped";
}

export interface ConditionEffect extends SkillEffectBase {
  readonly type: "condition";
  readonly condition?: string;
  readonly stacks?: number;
  readonly duration?: number;
  readonly ticks?: readonly ConditionTick[];
}

export interface ControlEffect extends SkillEffectBase {
  readonly type: "control" | "blind";
}

export interface StatusEffect extends SkillEffectBase {
  readonly type: "boon" | "buff";
  readonly boon?: string;
  readonly kind?: string;
  readonly duration: number;
  readonly stacks?: number;
}

export interface CustomEffect extends SkillEffectBase {
  readonly type: "custom";
  readonly eventType: string;
  readonly event: Readonly<Record<string, unknown>>;
}

export type SkillEffect =
  StrikeEffect | ConditionEffect | ControlEffect | StatusEffect | CustomEffect;

export interface Skill extends CatalogSkill {
  readonly description?: string;
  readonly icon?: string;
  readonly variantBadge?: string;
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
  /** Whether an instant skill may be scheduled during another cast. */
  readonly canCastConcurrently?: boolean;
  readonly lockouts?: readonly SkillLockout[];
  readonly rechargeAnchor?: "castStart" | "castEnd";
  readonly rechargeOffsetMs?: number;
  readonly cooldown?: number;
  readonly recharge?: number;
  /** Which actor's active boons determine recharge-rate modifiers. */
  readonly rechargeBuffAudience?: "self" | "summon";
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
  readonly ammo?: number;
  readonly ammoRecharge?: number;
  /** Minimum delay between consecutive casts of an ammo skill, in seconds. */
  readonly ammoCastLockout?: number;
  readonly defaultInterruptMs?: number;
  readonly paletteInterruptMs?: number;
  readonly interruptCommitMs?: number;
  /** Keep the serial cast lane blocked through the original cast end. */
  readonly retainsCastLockoutAfterInterrupt?: boolean;
  readonly effects?: readonly SkillEffect[];
  readonly comboFields?: readonly Readonly<Record<string, unknown>>[];
  readonly comboFinishers?: readonly Readonly<Record<string, unknown>>[];
  readonly handlerId?: string;
  readonly parentId?: SkillId;
  readonly flipParentId?: SkillId | null;
  readonly flipSkillId?: SkillId | null;
  readonly nextChainId?: SkillId | null;
  readonly weaponBarChainRootId?: SkillId | null;
  readonly weaponBarChainStep?: number | null;
  readonly tags?: readonly string[];
  readonly categories?: readonly string[];
  readonly resource?: unknown;
  readonly implemented?: boolean;
}

export type SkillFragment = Partial<Skill> & SchedulerRecord;

export interface SkillLockout {
  readonly group: string;
  readonly durationMs: number;
}

export interface AutoattackChainPosition {
  readonly root: number;
  readonly index: number;
  readonly step: number;
  readonly next: number | null;
}

export type SchedulerRecord = Record<string, unknown>;

export interface SimulationRandomnessConfig {
  readonly mode?: "deterministic" | "stochastic";
  readonly seed?: number;
}

export interface SimulationRandom {
  readonly mode: "deterministic" | "stochastic";
  readonly seed: number;
  readonly stochastic: boolean;
  next(stream?: string): number;
  roll(probability: number, stream?: string): boolean;
}

export type SkillHandlerPhase<TContext extends object = SchedulerRecord> = (
  context: TContext,
  skill: Skill,
) => unknown;

export interface SkillHandlerStrategy<
  TContext extends object = SchedulerRecord,
> {
  readonly mode: SkillHandlerMode;
  readonly resolveMode?: (context: TContext, skill: Skill) => SkillHandlerMode;
  readonly beforeEffects?: SkillHandlerPhase<TContext>;
  readonly afterEffect?: (
    context: TContext,
    skill: Skill,
    event: SimulationEvent,
    handlerState: unknown,
    details: {
      readonly effect: SkillEffect;
      readonly effectIndex: number;
    },
  ) => unknown;
  readonly afterEffects?: (
    context: TContext,
    skill: Skill,
    handlerState: unknown,
  ) => unknown;
}

export interface CanonicalCatalog<
  TSkill extends Skill = Skill,
  TContext extends object = SchedulerRecord,
> {
  readonly skills: readonly TSkill[];
  readonly skillsById: ReadonlyMap<SkillId, TSkill>;
  readonly skillsByName: ReadonlyMap<string, TSkill>;
  readonly skillHandlers: ReadonlyMap<string, SkillHandlerStrategy<TContext>>;
  readonly autoattackChains: readonly (readonly number[])[];
  readonly autoattackChainPositions: ReadonlyMap<
    number,
    AutoattackChainPosition
  >;
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

export interface AmmoState {
  charges: number;
  maximum: number;
  rechargeDuration: number;
  nextRechargeAt: number | null;
}

export interface SchedulerState<TProfessionState = SchedulerRecord> {
  time: number;
  cooldowns: Map<SkillId, number>;
  ammo: Map<SkillId, AmmoState>;
  lockouts: Map<string, number>;
  activeWeaponSet: number;
  skillUses: Map<SkillId, number>;
  pendingEvents: SimulationEvent[];
  profession: TProfessionState;
}

export interface ScheduledTask<TPayload = unknown> {
  readonly id: string;
  readonly type: string;
  readonly at: number;
  readonly priority: number;
  readonly ownerId: string | null;
  readonly payload: TPayload | null;
  readonly order: number;
}

export interface ScheduledTaskInput<TPayload = unknown> {
  readonly id?: string;
  readonly type: string;
  readonly at: number;
  readonly priority?: number;
  readonly ownerId?: string | number | null;
  readonly payload?: TPayload;
  readonly required?: boolean;
}

export type ScheduledTaskHandler<TContext = unknown, TPayload = unknown> = (
  context: TContext,
  task: ScheduledTask<TPayload>,
) => unknown;

export interface TaskQueue<TContext = unknown, TPayload = unknown> {
  schedule(task: ScheduledTaskInput<TPayload>): string;
  cancel(id: string | number): void;
  cancelOwner(ownerId: string | number): void;
  nextAt(): number;
  drainThrough(target: number, context: TContext): void;
  has(id: string | number): boolean;
}

export interface AvailabilityResult {
  readonly ready: boolean;
  readonly retryAt?: number | null;
  readonly reason?: string;
  readonly code?: string;
}

export interface SchedulerConfig extends SchedulerRecord {
  readonly boons?: Readonly<Record<string, boolean | number>>;
}

export interface CooldownController {
  ammoMaximum(skill: Skill): number;
  ensureAmmo(skill: Skill, at?: number): AmmoState | null;
  reduceAmmoRecharge(
    skill: Skill,
    reduction: number,
    at?: number,
  ): { ammo: AmmoState | null; reducedBy: number };
  refreshAmmo(skill: Skill, at: number): AmmoState | null;
  setAmmoLockout(skill: Skill, readyAt: number, at?: number): AmmoState | null;
  spendAmmo(skill: Skill, at: number): AmmoState | false;
}

export interface SchedulerTaskAccess {
  schedule(task: ScheduledTaskInput<SchedulerRecord>): string;
  cancel(id: string | number): void;
  cancelOwner(ownerId: string | number): void;
  nextAt(): number;
}

export interface SchedulerPolicy<
  TProfessionState extends object = SchedulerRecord,
> {
  readonly initialWeaponSet?: (input: {
    profession: NormalizedProfessionContract<TProfessionState>;
    config: SchedulerConfig;
  }) => number;
  readonly prepareEvent?: (
    context: SchedulerContext<TProfessionState>,
    event: SimulationEventInput,
  ) => SimulationEventInput | undefined;
  readonly initialize?: (
    context: SchedulerContext<TProfessionState>,
  ) => unknown;
  readonly availability?: (
    context: CastContext<TProfessionState>,
    skill: Skill,
  ) => AvailabilityResult | boolean | null | undefined;
  readonly validateCast?: (
    context: CastContext<TProfessionState>,
    skill: Skill,
  ) => boolean | void;
  readonly castDuration?: (
    context: CastContext<TProfessionState>,
    skill: Skill,
    duration: number,
  ) => number | undefined;
  readonly rechargeDuration?: (
    context: SchedulerContext<TProfessionState> & SchedulerRecord,
    skill: Skill,
    duration: number,
  ) => number | undefined;
  readonly maximumAmmo?: (
    context: SchedulerContext<TProfessionState> & { skill: Skill },
    skill: Skill,
    maximum: number,
  ) => number | undefined;
  readonly effectTiming?: (
    context: SchedulerContext<TProfessionState> &
      SchedulerRecord & {
        skill: Skill;
        start: number;
        fullEnd: number;
        effectiveEnd: number;
      },
    skill: Skill,
    effect: SkillEffect,
  ) => SkillEffect | undefined;
  readonly effectDuration?: (
    context: SchedulerContext<TProfessionState>,
    skill: Skill,
    effect: SkillEffect,
    duration: number,
  ) => number | undefined;
  readonly onEventScheduled?: (
    context: SchedulerContext<TProfessionState>,
    event: SimulationEvent,
  ) => unknown;
  readonly advance?: (
    context: SchedulerContext<TProfessionState>,
    at: number,
  ) => unknown;
  readonly taskHandlers?: Readonly<
    Record<
      string,
      ScheduledTaskHandler<SchedulerContext<TProfessionState>, SchedulerRecord>
    >
  >;
}

export interface SchedulerContext<
  TProfessionState extends object = SchedulerRecord,
> {
  readonly profession: NormalizedProfessionContract<TProfessionState>;
  readonly config: SchedulerConfig;
  readonly catalog: CanonicalCatalog;
  readonly state: SchedulerState<TProfessionState>;
  readonly events: SimulationEvent[];
  readonly warnings: string[];
  readonly epsilon: number;
  readonly schedulerPolicy: SchedulerPolicy<TProfessionState>;
  readonly observationPolicy: NormalizedObservationPolicy;
  observationEndTime: number | null;
  readonly inFlight: Map<SkillId, Set<string>>;
  hasExplicitCombatStart: boolean;
  combatStartTime: number | null;
  tasks: SchedulerTaskAccess;
  cooldownController: CooldownController;
  castDurationFor(context: CastContext<TProfessionState>, skill: Skill): number;
  rechargeDurationFor(
    skill: Skill,
    at?: number,
    details?: SchedulerRecord,
  ): number;
  maximumAmmoFor(skill: Skill): number;
  createActivationId(kind?: "effect" | "summon-attack" | string): string;
  advanceTo(at: number): void;
  emit(event: SimulationEventInput): SimulationEvent;
  replaceEvent(
    event: SimulationEvent,
    updates: SchedulerRecord,
  ): SimulationEvent;
  emitDerived(
    cause: SimulationEvent,
    event: SimulationEventInput,
  ): SimulationEvent;
  buffStacks(kind: string, at?: number): number;
  hasBuff(kind: string, at?: number): boolean;
}

export type CastContext<TProfessionState extends object = SchedulerRecord> =
  SchedulerContext<TProfessionState> &
    SchedulerRecord & {
      readonly command: CastCommand;
      readonly commandIndex: number;
      readonly skill: Skill;
      readonly start: number;
      readonly ammo: AmmoState | null;
    };

export type CastLifecycleContext<
  TProfessionState extends object = SchedulerRecord,
> = CastContext<TProfessionState> & {
  readonly action: SimulationEvent;
  readonly fullEnd: number;
  readonly effectiveEnd: number;
  readonly rechargeDuration: number;
  readonly ammoLockoutDuration: number;
  readonly rechargeStart: number;
  readonly rechargeReadyAt: number | null;
  readonly reservationId: string;
};

export interface SchedulerStep {
  readonly ri: number;
  readonly skill: string;
  readonly start: number;
  readonly end: number;
  readonly actualStart?: number;
  readonly fullCastMs?: number;
  readonly interrupted?: boolean;
  readonly invalid?: boolean;
  readonly invalidReason?: string;
}

export interface SchedulerRunResult<
  TProfessionState extends object = SchedulerRecord,
> {
  readonly context: SchedulerContext<TProfessionState>;
  readonly state: SchedulerState<TProfessionState>;
  readonly events: readonly SimulationEvent[];
  readonly steps: readonly SchedulerStep[];
  readonly warnings: readonly string[];
  readonly snapshot: unknown;
  readonly stream: ScheduledEventStream;
}

export interface Scheduler<TProfessionState extends object = SchedulerRecord> {
  readonly state: SchedulerState<TProfessionState>;
  readonly events: SimulationEvent[];
  readonly warnings: string[];
  readonly context: SchedulerContext<TProfessionState>;
  cast(command: CastCommand, commandIndex?: number): boolean;
  advanceTo(at: number): void;
  run(rotation: readonly unknown[]): SchedulerRunResult<TProfessionState>;
}

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
  readonly startValue?: number;
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
  /** Whether to print the numeric value beside the visual meter. Defaults to true. */
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
  /** Moves a profession group beside the indicated palette surface. */
  readonly placement?: "profession" | "weapon-set-1" | "active-weapon";
  /** Optional row label used when placing a group beside the active weapon. */
  readonly weaponRowLabel?: string;
  readonly resourceAnchor?: boolean;
  readonly color?: string;
  readonly stackId?: string;
  readonly className?: string;
  /** Resource meters rendered in the same visual container as this group. */
  readonly resourceIds?: readonly string[];
  /** Where attached resources sit relative to the group's skills. */
  readonly resourcePlacement?: "above" | "beside" | "below";
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

export type ProfessionPaletteSkillRenderer = (
  skill: Skill,
  options?: ProfessionPaletteSkillRenderOptions,
) => string;

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
  /** Places a read-only mechanic group with the weapon previews. */
  readonly placement?: "skill-bar" | "weapon-bar";
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

export interface ProfessionUiContract {
  readonly assumptionControls: readonly SchedulerRecord[];
  readonly chargeReleaseProjection: (
    context: SchedulerRecord,
  ) => SchedulerRecord | null;
  readonly eventLogRow?: (
    context: SchedulerRecord,
    event: SimulationEvent,
  ) => ProfessionEventLogDescriptor | null | undefined;
  readonly isPaletteSkillInstant: (
    context: SchedulerRecord,
    skill: Skill,
  ) => boolean;
  readonly paletteSkillAvailability: (
    context: SchedulerRecord,
    skill: Skill,
  ) => PaletteSkillAvailability;
  readonly isPaletteSkillAvailable: (
    context: SchedulerRecord,
    skill: Skill,
  ) => boolean;
  readonly isSlotSkillSelectable: (
    context: SchedulerRecord,
    skill: Skill,
  ) => boolean;
  readonly paletteSkillUnavailableMessage: (
    context: SchedulerRecord,
    skill: Skill,
  ) => string;
  readonly paletteGroups: (
    context: SchedulerRecord,
  ) => ProfessionPaletteGroup[];
  /** Adds or projects profession-owned actions before the shell renders them. */
  readonly paletteActionSkills: (
    context: SchedulerRecord,
    skills: readonly Skill[],
  ) => Skill[];
  /** Projects profession state into the weapon skills rendered by the shell. */
  readonly paletteWeaponSkills: (
    context: SchedulerRecord,
    skills: readonly Skill[],
  ) => Skill[];
  /** Lets a specialization own an exceptional weapon layout without shell policy. */
  readonly renderWeaponPalette: (
    context: ProfessionWeaponPaletteRenderContext,
  ) => ProfessionWeaponPaletteView | null;
  /** Resolves a profession-owned palette action into canonical rotation items. */
  readonly resolvePaletteAction: (
    context: SchedulerRecord,
    action: ProfessionPaletteActionIdentity,
  ) => LegacyRotationItem | LegacyRotationItem[] | null | undefined;
  /** Applies a profession-owned palette control action to mutable build state. */
  readonly updatePaletteControl: (
    context: SchedulerRecord,
    controlId: string,
  ) => boolean;
  readonly resourceView: (
    context: SchedulerRecord,
  ) => ProfessionResourceView | null;
  readonly resourceViews: (
    context: SchedulerRecord,
  ) => ProfessionResourceView[];
  readonly skillBarGroups: (
    context: SchedulerRecord,
  ) => ProfessionSkillBarGroup[];
  readonly startControls: (
    context: SchedulerRecord,
  ) => ProfessionStartControl[];
  readonly slotLoadout: SchedulerRecord | null;
  readonly targetHealthThresholds: (context: SchedulerRecord) => number[];
  readonly rotationStateSnapshot: (
    context: SchedulerRecord,
  ) => RotationStateSnapshotItem[];
  readonly timelineWeaponLineTransition: (
    context: SchedulerRecord,
  ) => string | null | undefined;
  readonly timelineSkillIcon: (context: SchedulerRecord) => string;
  readonly updateSkillBarSelection: (
    context: SchedulerRecord,
    selection: SchedulerRecord,
  ) => boolean;
  readonly weaponSkillMatchesSet?: (
    skill: Skill,
    weapons: string[],
    context: SchedulerRecord,
  ) => boolean;
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

export interface ProfessionResourceDefinition<
  TProfessionState extends object = SchedulerRecord,
> {
  readonly createProfessionState?: (
    config: Readonly<SchedulerConfig>,
  ) => TProfessionState;
  readonly createResolverState?: (config: Readonly<SchedulerConfig>) => object;
  readonly projectEndState?: unknown;
}

export interface ProfessionSchedulerHookDefinition {
  readonly prepareEvent?: unknown;
  readonly initialize?: unknown;
  readonly availability?: unknown;
  readonly validateCast?: unknown;
  readonly scheduleSkill?: unknown;
  readonly afterCast?: unknown;
  readonly advance?: unknown;
  readonly snapshot?: unknown;
  readonly projectEndState?: unknown;
  readonly onCastStart?: unknown;
  readonly onCastComplete?: unknown;
  readonly onCooldownReset?: unknown;
  readonly onEventScheduled?: unknown;
  readonly modifyCastDuration?: unknown;
  readonly modifyRechargeDuration?: unknown;
  readonly modifyRechargeStart?: unknown;
  readonly modifyMaximumAmmo?: unknown;
  readonly taskHandlers?: Readonly<
    Record<string, (...args: never[]) => unknown>
  >;
}

export interface ProfessionResolverHookDefinition {
  readonly eventHandlers?: Readonly<
    Record<string, (...args: never[]) => unknown>
  >;
  readonly eventReactions?: Readonly<Record<string, unknown>>;
}

export interface ProfessionDefinition<
  TProfessionState extends object = SchedulerRecord,
> {
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
  readonly createProfessionState?: (
    config: Readonly<SchedulerConfig>,
  ) => TProfessionState;
  readonly createResolverState?: (config: Readonly<SchedulerConfig>) => object;
  readonly eventHandlers?: Readonly<
    Record<string, (...args: never[]) => unknown>
  >;
  readonly eventReactions?: Readonly<Record<string, unknown>>;
}

export interface ProfessionModuleCatalogFragment {
  readonly skills?: readonly Skill[];
  readonly skillHandlers?:
    ReadonlyMap<string, unknown> | Readonly<Record<string, unknown>>;
  readonly traits?: readonly CatalogEntity[];
  readonly specializations?: readonly CatalogEntity[];
  readonly weapons?: readonly string[];
  readonly weaponHands?:
    ReadonlyMap<string, string> | Readonly<Record<string, string>>;
  readonly autoattackChains?: {
    readonly additional?: readonly (readonly SkillId[])[];
    readonly excludeSkillIds?: readonly SkillId[];
  };
  readonly skillNameCollision?: "first" | "last";
  readonly skillNameOverrides?: Readonly<Record<string, SkillId>>;
}

export interface ProfessionModuleDefinition<
  TModuleState extends object = SchedulerRecord,
> {
  readonly id: string;
  readonly catalog?: ProfessionModuleCatalogFragment;
  readonly resources?: ProfessionResourceDefinition<TModuleState>;
  readonly attributeRules?: SchedulerRecord;
  readonly castRules?: SchedulerRecord;
  readonly schedulerHooks?: ProfessionSchedulerHookDefinition;
  readonly resolverHooks?: ProfessionResolverHookDefinition;
  readonly ui?: Partial<ProfessionUiContract> & SchedulerRecord;
}

export interface ComposedProfessionState<
  TCoreState extends object = SchedulerRecord,
  TSpecializationState extends object = SchedulerRecord,
> {
  readonly core: TCoreState;
  readonly specialization: {
    readonly kind: string;
    readonly state: TSpecializationState;
  };
}

export interface ProfessionFamilyDefinition<
  TProfessionState extends object = SchedulerRecord,
> {
  readonly id: string;
  readonly name: string;
  readonly catalog: CanonicalCatalog;
  readonly build?: ProfessionBuildDefinition;
  readonly core: ProfessionModuleDefinition<any>;
  readonly specializations: Readonly<
    Record<string, ProfessionModuleDefinition<any>>
  >;
  /**
   * Application-only callbacks that are genuinely global to the family.
   * Runtime callbacks belong to Core or the active specialization module.
   */
  readonly ui?: Partial<ProfessionUiContract> & SchedulerRecord;
  readonly simulation?: SchedulerRecord | null;
}

export interface NormalizedProfessionContract<
  TProfessionState extends object = SchedulerRecord,
> {
  readonly id: string;
  readonly name: string;
  readonly catalog: CanonicalCatalog;
  readonly ui: ProfessionUiContract;
  readonly simulation: SchedulerRecord | null;
  readonly skillHandlerFor: (
    skill: Skill,
  ) => SkillHandlerStrategy<CastLifecycleContext<TProfessionState>> | null;
  readonly createBuildDefaults: () => SchedulerRecord;
  readonly migrateBuild: (saved: SchedulerRecord) => SchedulerRecord;
  readonly validateBuild: (build: SchedulerRecord) => BuildValidationResult;
  readonly createProfessionState: (
    config: Readonly<SchedulerConfig>,
  ) => TProfessionState;
  readonly createResolverState:
    ((config: Readonly<SchedulerConfig>) => object) | null;
  readonly taskHandlers: Readonly<
    Record<
      string,
      ScheduledTaskHandler<SchedulerContext<TProfessionState>, SchedulerRecord>
    >
  >;
  readonly eventHandlers: Readonly<
    Record<string, (...args: never[]) => unknown>
  >;
  readonly eventReactions: Readonly<
    Record<string, (...args: never[]) => unknown>
  >;
  readonly prepareEvent: (
    context: SchedulerContext<TProfessionState>,
    event: SimulationEventInput,
  ) => SimulationEventInput;
  readonly initialize: (context: SchedulerContext<TProfessionState>) => unknown;
  readonly availability: (
    context: CastContext<TProfessionState>,
    skill: Skill,
  ) => AvailabilityResult;
  readonly validateCast: (
    context: CastContext<TProfessionState>,
    skill: Skill,
  ) => boolean;
  readonly scheduleSkill: (
    context: CastLifecycleContext<TProfessionState>,
    skill: Skill,
  ) => boolean | void;
  readonly afterCast: (
    context: CastLifecycleContext<TProfessionState>,
    skill: Skill,
  ) => unknown;
  readonly advance: (
    context: SchedulerContext<TProfessionState>,
    at: number,
  ) => unknown;
  readonly snapshot: (context: SchedulerContext<TProfessionState>) => unknown;
  readonly projectEndState: (...args: never[]) => unknown;
  readonly onCastStart: (
    context: CastLifecycleContext<TProfessionState>,
    skill: Skill,
  ) => unknown;
  readonly onCastComplete: (
    context: CastLifecycleContext<TProfessionState>,
    skill: Skill,
  ) => unknown;
  readonly onCooldownReset: (
    context: SchedulerContext<TProfessionState>,
  ) => unknown;
  readonly onEventScheduled: (
    context: SchedulerContext<TProfessionState>,
    event: SimulationEvent,
  ) => unknown;
  readonly modifyCastDuration: (
    context: CastContext<TProfessionState>,
    duration: number,
  ) => number;
  readonly modifyRechargeDuration: (
    context: SchedulerContext<TProfessionState> & SchedulerRecord,
    duration: number,
  ) => number;
  readonly modifyRechargeStart: (
    context: CastContext<TProfessionState> & SchedulerRecord,
    start: number,
  ) => number;
  readonly modifyMaximumAmmo: (
    context: SchedulerContext<TProfessionState> & { skill: Skill },
    maximum: number,
  ) => number;
  readonly modifyAttributes: (
    context: SchedulerRecord,
    attributes: SchedulerRecord,
  ) => SchedulerRecord;
  readonly modifyCriticalChance: (
    context: SchedulerRecord,
    chance: number,
  ) => number;
  readonly modifyCriticalDamage: (
    context: SchedulerRecord,
    multiplier: number,
  ) => number;
  readonly modifyStrikeDamage: (
    context: SchedulerRecord,
    multiplier: number,
  ) => number;
  readonly modifyConditionDamage: (
    context: SchedulerRecord,
    multiplier: number,
  ) => number;
  readonly modifyConditionBaseDuration: (
    context: SchedulerRecord,
    multiplier: number,
  ) => number;
  readonly modifyConditionDuration: (
    context: SchedulerRecord,
    multiplier: number,
  ) => number;
  readonly paletteGroups: (
    context: SchedulerRecord,
  ) => ProfessionPaletteGroup[];
  readonly resourceView: (
    context: SchedulerRecord,
  ) => ProfessionResourceView | null;
  readonly resourceViews: (
    context: SchedulerRecord,
  ) => ProfessionResourceView[];
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
> extends ProfessionApplicationContract {
  readonly resolveRuntime: (
    config: Readonly<SchedulerConfig>,
  ) => Readonly<NormalizedProfessionContract<TProfessionState>>;
}

export type ProfessionSource<
  TProfessionState extends object = SchedulerRecord,
> = NormalizedProfessionContract<TProfessionState> | ProfessionFamilyContract;

export interface CastCommand {
  readonly type: "cast";
  readonly skillId: SkillId;
  readonly concurrentOffsetMs?: number;
  readonly interruptAfterMs?: number;
  readonly releaseAtCharges?: number;
  readonly doubleEdgeOutcome?: "success" | "backfire";
}

export interface WaitCommand {
  readonly type: "wait";
  readonly durationMs: number;
}

export interface CombatStartCommand {
  readonly type: "combat-start";
  readonly concurrentOffsetMs?: number;
}

export interface CooldownResetCommand {
  readonly type: "cooldown-reset";
}

export type RotationCommand =
  CastCommand | WaitCommand | CombatStartCommand | CooldownResetCommand;

export interface LegacyRotationEntry {
  name: SkillId;
  skillId?: SkillId | null;
  offset?: number;
  interruptMs?: number | null;
  releaseAtCharges?: number | null;
  doubleEdgeOutcome?: "success" | "backfire" | null;
  waitMs?: number;
}

export type LegacyRotationItem = SkillId | LegacyRotationEntry;

export interface QueuedEvent {
  readonly at?: number;
  readonly time?: number;
  readonly priority?: number;
  readonly causalOrder?: number;
  readonly __order?: number;
  readonly [field: string]: unknown;
}
