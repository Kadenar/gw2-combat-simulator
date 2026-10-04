import { prepareSelectedSkillLoadout } from '#gw2/platform/builds/selected-skills.js';
import { createCombatExecution } from '#gw2/platform/simulation/combat-execution.js';
import type {
  DamageRuntimeOptions,
  DamageRuntimeResult,
  RuntimeDriverContext,
  RuntimeExecution,
  RuntimeOptions
} from '#gw2/platform/simulation/execution.js';
import type { Gw2SimulationResult, Gw2SimulationScore } from '#gw2/platform/simulation/types.js';
import { isStandardBoon, normalizeBoonDuration } from '#gw2/platform/combat/boons.js';
import { createGw2CombatQuery } from '#gw2/platform/combat/query/combat-query.js';
import { createRuntimeEndurance, createRuntimeResources } from '#gw2/platform/combat/resources/runtime-resources.js';
import { targetHealthLoss } from '#gw2/platform/combat/state/target-health.js';
import {
  canonicalTargetConditionName,
  isCombatEntryEvent,
  isHostileTargetEvent,
  isPrecombatTargetEffect,
  missesTarget
} from '#gw2/platform/combat/state/targets.js';
import { normalizeSelectedTraitIds } from '#gw2/platform/combat/state/traits.js';
import { fieldDescriptors, finisherDescriptors } from '#gw2/platform/combos/descriptors.js';
import { prepareGw2ComboEvent } from '#gw2/platform/combos/events.js';
import { permanentComboFieldAssumption } from '#gw2/platform/combos/permanent-field-assumption.js';
import { bindRuntimeCombo, produceRuntimeCombos } from '#gw2/platform/combos/runtime.js';
import { scaleCastBoundTiming } from '#gw2/platform/engine/effects/materializer.js';
import { assertSimulationEvent, type SimulationEventBase } from '#gw2/platform/engine/events/events.js';
import { readProfessionCoreState } from '#gw2/platform/engine/profession/state.js';
import { gw2BaseRecharge } from '#gw2/platform/engine/skills/recharge.js';
import {
  armSkillFlip,
  consumeSkillFlip,
  expireSkillFlip,
  type SkillFlipWindows
} from '#gw2/platform/engine/skills/skill-flips.js';
import type { Skill, SkillId } from '#gw2/platform/engine/skills/types.js';
import { normalizePrecastRelics, relicWeaponSwapRechargeReduction } from '#gw2/platform/equipment/relics/catalog.js';
import { relicStrikeMultiplier } from '#gw2/platform/equipment/relics/query.js';
import { createRelicRuntime } from '#gw2/platform/equipment/relics/runtime.js';
import { weaponStrengthProfileIdForEvent } from '#gw2/platform/equipment/weapons/strength.js';
import { createCastReservations } from '#gw2/platform/execution/cast-lifecycle.js';
import { createCooldownController } from '#gw2/platform/execution/cooldowns.js';
import {
  cancelledBeforeEffectCommit,
  cancelledBeforeInterruptCommit,
  interruptCommitCutoffs
} from '#gw2/platform/execution/effect-adapter.js';
import type { CastCommand } from '#gw2/platform/execution/types.js';
import { gw2ResolverBoonDuration } from '#gw2/platform/resolver/boons.js';
import {
  createGw2ConditionResolution,
  finalizeConditionApplications
} from '#gw2/platform/resolver/condition-resolution.js';
import { createGw2ResolverEventHandlers } from '#gw2/platform/resolver/event-handlers.js';
import { GW2_RESOLVER_PHASE, gw2ResolverPhase } from '#gw2/platform/resolver/event-loop.js';
import { HandlerRegistry } from '#gw2/platform/resolver/handler-registry.js';
import { createGw2HitResolution } from '#gw2/platform/resolver/hit-resolution.js';
import { createGw2ResolverReactionRegistry } from '#gw2/platform/resolver/reaction-registry.js';
import { createGw2ResolverRuntimeState } from '#gw2/platform/resolver/runtime-state.js';
import type { Gw2ResolverEvent, Gw2ResolverReactionRegistry } from '#gw2/platform/resolver/types.js';
import { buildCombatResult, buildSimulationScore } from '#gw2/platform/results/build-result.js';
import { planningState } from '#gw2/platform/results/end-state.js';
import { captureRuntimeEffects, observeRuntimeEffects } from '#gw2/platform/results/observe-effects.js';
import { recordProcStep } from '#gw2/platform/results/proc-steps.js';
import { rotationApm } from '#gw2/platform/results/rotation-apm.js';
import {
  createEffectEmissionService,
  type AnnouncementEmission,
  type EffectDelivery
} from '#gw2/platform/simulation/effect-emission.js';
import { createEffectReactions, type EffectReactionStage } from '#gw2/platform/simulation/effect-reactions.js';
import { selectSkillEffects } from '#gw2/platform/simulation/effect-selection.js';
import { createInternalWorkFactory, skillTaskAt } from '#gw2/platform/simulation/internal-work.js';
import type {
  FlipWindowOptions,
  Gw2Runtime,
  RuntimeCast,
  RuntimeWork
} from '#gw2/platform/simulation/runtime-state.js';
import { applySkillSideEffects } from '#gw2/platform/simulation/side-effects.js';
import { advanceAutoattackChains, resetAutoattackChains } from '#gw2/platform/skills/autoattack-chain-controller.js';
import {
  castWasInterrupted,
  retainsInterruptedCastLockout,
  summonQuicknessCastTimeMs
} from '#gw2/platform/skills/timing.js';
import { lockTransitionInput } from '#gw2/platform/skills/transition-delays.js';
import { canonicalTime, EPSILON } from '#kernel/core/clock.js';
import { StableEventQueue } from '#kernel/events/queue.js';
import { DEFAULT_EXECUTION_ITERATION_LIMIT } from '#kernel/execution/limits.js';
import { normalizeObservationPolicy, observationEndTime } from '#kernel/execution/observation.js';

/** Condition pulses are scheduled for every active stack at once, so they deliberately carry no causal identity. */
const SHARED_PULSE_TYPES = new Set(['condition_tick', 'condition_buffer']);

/** The packet fields that decide identity and causal parentage, shared by events and condition drafts. */
interface PacketIdentity {
  readonly type: string;
  readonly kind?: unknown;
  readonly eventOrder?: unknown;
  readonly causalOrder?: unknown;
  readonly parentEventOrder?: unknown;
  readonly activationId?: unknown;
  readonly actorType?: unknown;
  readonly skillId?: unknown;
  readonly sourceId?: unknown;
}

/** Derived copies cannot reuse the parent's declaration, including after serialization or deferral. */
function withoutInheritedReaction(event: SimulationEventBase, cause?: Gw2ResolverEvent | null): SimulationEventBase {
  if (
    event.effectReaction &&
    cause?.effectReaction &&
    event.effectReaction.group === cause.effectReaction.group &&
    event.effectReaction.packet === cause.effectReaction.packet
  ) {
    const { effectReaction: _inherited, ...derived } = event;
    return derived;
  }

  return event;
}

/** The combat entry point assembles gameplay producers before entering the shared runtime. */
export function runGw2Runtime<T extends object>(
  options: RuntimeOptions<T> & { readonly rotation?: readonly unknown[] }
) {
  return runRuntime({ ...options, execution: createCombatExecution(options.profession, options.rotation ?? []) });
}

export function runRuntime<T extends object>(
  options: DamageRuntimeOptions<T> & { readonly execution: RuntimeExecution<T> }
): DamageRuntimeResult;
export function runRuntime<T extends object>(
  options: RuntimeOptions<T> & { readonly execution: RuntimeExecution<T> }
): Gw2SimulationResult | Gw2SimulationScore;
/** The shared scheduler can collect a finite occurrence without constructing combat reports. */
export function runRuntime<T extends object>(
  options: (RuntimeOptions<T> | DamageRuntimeOptions<T>) & { readonly execution: RuntimeExecution<T> }
): DamageRuntimeResult | Gw2SimulationResult | Gw2SimulationScore {
  const {
    profession,
    config: inputConfig = {},
    observation,
    combatStartTime,
    output = 'detailed',
    collectChartData = true,
    damageDiagnostics = false,
    execution,
    onPhase
  } = { observation: undefined, ...options };
  let config = inputConfig;
  const ownsEffect = options.output === 'damage' ? options.ownsEffect : undefined;
  const started = onPhase ? performance.now() : 0;
  // Direct and public runtime entry points share catalog validation and detached selection snapshots.
  if ('selectedSkills' in config)
    throw new TypeError('selectedSkills is unsupported in simulation; use selectedSkillIds.');
  if (config.selectedSkillIds !== undefined)
    config = {
      ...config,
      selectedSkillIds: prepareSelectedSkillLoadout(
        config.selectedSkillIds,
        profession.skillSelectionCatalog ?? profession.catalog
      )
    };
  const policy = normalizeObservationPolicy(observation);
  const cursor = execution.driver.cursor;
  const markers = cursor.commands.filter((command) => command.type === 'combat-start');
  if (markers.length > 1 || (markers.length && combatStartTime != null))
    throw new TypeError('Combat Start must have one owner.');
  if (combatStartTime != null && (!Number.isFinite(combatStartTime) || combatStartTime < 0))
    throw new RangeError('Combat Start must be finite and non-negative.');
  const explicitCombat = markers.length > 0 || combatStartTime != null;
  const history: Gw2ResolverEvent[] = [];
  // Resolver code may enqueue directly; those packets receive the same identity and cause as emitted ones.
  const queue = new StableEventQueue<Gw2ResolverEvent>([], {
    phaseFor: gw2ResolverPhase,
    prepare: (event) => identify(event)
  });
  const query = createGw2CombatQuery({
    profession,
    config,
    // Direct modifier-history reads and indexed queries share executed facts, even without report collections.
    events: history,
    resolvedTimelineEvents: history,
    skillOnCooldown(skillId, at) {
      if (at !== runtime.time) throw new RangeError('Live cooldown queries must use the current clock.');
      // Formula queries inspect one skill; refreshing every cooldown for every condition sample repeats unrelated work.
      const skill = profession.catalog.skillsById.get(skillId);
      if (skill && runtime.ammo.has(skillId)) cooldownController.refreshAmmo(skill, at);
      const progress = runtime.rechargeProgress.get(skillId);
      const readyAt =
        skill && progress ? cooldownController.project(skill, progress) : (runtime.cooldowns.get(skillId) ?? 0);
      return readyAt > at;
    }
  });
  const reservations = createCastReservations<Omit<RuntimeCast, 'id'> & { firstStrikeAt: number }>();
  const internal = new HandlerRegistry<Gw2Runtime<T>, RuntimeWork>();
  const makeWork = createInternalWorkFactory<RuntimeWork>(internal);
  let runtime: Gw2Runtime<T>;
  let eventOrder = 0;
  // The event whose handlers or reactions are running; packets created meanwhile are its reactions.
  let currentCause: Gw2ResolverEvent | null = null;
  // Set while scheduled work runs: summon attack loops reschedule themselves and must not inherit the first cause.
  let causeIsScheduled = false;
  // Each accepted cast's action, so work done for the cast outside event handling still knows its cause.
  const castActions = new Map<string, Gw2ResolverEvent>();
  // The cause active when each piece of internal work was scheduled.
  const workCauses = new WeakMap<object, Gw2ResolverEvent>();
  let lethalActivation: string | undefined;

  /**
   * Names the event that caused a packet created while another event is being handled. Shared condition pulses have
   * no single cause; a packet of another cast (a trap released at Combat Start, mines detonated by a different hit) or
   * of the cast being handled already has its owner; and follow-up packets of the same skill are its own impacts
   * rather than reactions. None of those record a parent.
   */
  function reactionParent(event: PacketIdentity): number | undefined {
    const cause = currentCause;
    const causeOrder = cause?.eventOrder;
    if (!cause || causeOrder == null || SHARED_PULSE_TYPES.has(event.type)) return undefined;
    // Summons own their scheduled attack loops; only direct reactions (a pet hit's bleed) record a cause.
    if (causeIsScheduled && event.actorType === 'summon') return undefined;
    const activationId = typeof event.activationId === 'string' ? event.activationId : undefined;
    if (activationId != null && activationId !== cause.activationId && castActions.has(activationId)) return undefined;
    if (cause.type === 'action') return activationId === cause.activationId ? undefined : causeOrder;
    // Only a shared activation makes a same-skill packet a continuation; unattributed procs remain reactions.
    const continuesCause =
      activationId != null &&
      activationId === cause.activationId &&
      event.actorType === cause.actorType &&
      (event.skillId ?? event.sourceId) === (cause.skillId ?? cause.sourceId);
    return continuesCause ? undefined : causeOrder;
  }

  /**
   * Gives engine-owned pulse output an identity and parent consistent with service-submitted effects.
   */
  function identify<E extends PacketIdentity>(event: E): E {
    if (event.kind === 'internal' || event.eventOrder != null || SHARED_PULSE_TYPES.has(event.type)) return event;
    const order = ++eventOrder;
    const parent = event.parentEventOrder ?? reactionParent(event);
    return {
      ...event,
      eventOrder: order,
      causalOrder: event.causalOrder ?? queue.currentCausalOrder ?? order,
      ...(parent == null ? {} : { parentEventOrder: parent })
    };
  }

  /** Runs an event's handlers, reactions, or scheduled work with it as the cause of anything they create. */
  function withCause<R>(cause: Gw2ResolverEvent | null, run: () => R, scheduled = false): R {
    const previous = currentCause;
    const previousScheduled = causeIsScheduled;
    currentCause = cause;
    causeIsScheduled = scheduled;
    try {
      return run();
    } finally {
      currentCause = previous;
      causeIsScheduled = previousScheduled;
    }
  }

  const executed: Gw2ResolverEvent[] = [];
  const preparedCombos = new WeakSet<Gw2ResolverEvent>();

  // Bind hooks to the same context used by commands. No hook receives a predicted or restored state.
  const contributions = execution.contributions(() => runtime);
  const effectReactions = createEffectReactions(profession.catalog, profession.sideEffectHandlers);
  // Skill-owned actions run immediately before the composed profession reactions, through the same acceptance gates.
  function effectReactionContribution(stage: EffectReactionStage) {
    return {
      id: `skill.${stage}`,
      order: -1,
      handler: (_context: unknown, event: Gw2ResolverEvent, details: Record<string, unknown> = {}) =>
        effectReactions.dispatch(runtime, stage, event, details)
    };
  }

  const actualReactions = createGw2ResolverReactionRegistry({
    contributions: {
      ...contributions,
      // Only accepted combos carry the originating finisher's authored reaction.
      'combo.resolved': [...(contributions['combo.resolved'] ?? []), effectReactionContribution('combo.resolved')],
      'condition.applied': [
        ...(contributions['condition.applied'] ?? []),
        effectReactionContribution('condition.applied')
      ],
      'damage.resolved': [...(contributions['damage.resolved'] ?? []), effectReactionContribution('damage.resolved')],
      'control.resolved': [...(contributions['control.resolved'] ?? []), effectReactionContribution('control.resolved')]
    },
    professionReactions: Object.fromEntries(
      Object.entries(execution.professionReactions ?? {}).map(([stage, handler]) => [
        stage,
        (_context, event, details) => {
          return handler(runtime, event, details ?? {});
        }
      ])
    )
  });
  const reactions: Gw2ResolverReactionRegistry = {
    dispatch(stage, context, event, details) {
      // One gate protects both profession and equipment grants after the lethal packet has committed.
      if (runtime.deathTime != null && (isHostileTargetEvent(event) || event.comboId != null)) return;
      // Reactions run inside the resolved packet's scope, so chains through immediate conditions keep exact parents.
      return withCause(event, () => actualReactions.dispatch(stage, context, event, details));
    }
  };
  const conditions = createGw2ConditionResolution({ config, reactions });
  // Emission owns transport; profession hooks select payloads and keep their gameplay rules.
  const packetDelivery = new WeakMap<Gw2ResolverEvent, EffectDelivery>();
  const pendingPreparation = new WeakSet<Gw2ResolverEvent>();
  let announcementOrder = 0;
  let derivedActivationOrder = 0;
  const effects = createEffectEmissionService({
    now: () => runtime.time,
    registerReaction: (profile, effect) => effectReactions.register(profile, effect),
    submit: submitEffect,
    announce: announceEffect
  });

  function submitEffect(
    input: SimulationEventBase,
    delivery: EffectDelivery & { settlement?: 'reaction' }
  ): Gw2ResolverEvent {
    const cause = delivery.cause;
    let event = withoutInheritedReaction(input, cause);
    // Direct evaluation admits only the selected owner's payload and explicit environmental assumptions.
    if (!execution.acceptsEffect(event)) return identify(assertSimulationEvent(event));
    if (delivery.cast)
      event = {
        activationId:
          delivery.cast.independentSourceStrike && event.type === 'damage' && event.sourceId !== delivery.cast.skillId
            ? `${delivery.cast.activationId}:effect:${event.sourceId}`
            : delivery.cast.activationId,
        offTarget: delivery.cast.offTarget,
        ...event
      };
    const cancelledByCast =
      delivery.cast?.effectiveEnd != null &&
      event.at > delivery.cast.effectiveEnd + EPSILON &&
      event.persistsAfterInterrupt !== true;
    if (cause)
      event = {
        activationId:
          event.type === 'damage' && (event.sourceId !== cause.sourceId || event.actorType !== cause.actorType)
            ? `effect:derived:${++derivedActivationOrder}`
            : cause.activationId,
        causalOrder: cause.causalOrder ?? cause.eventOrder,
        parentEventOrder: cause.eventOrder,
        ...event
      };
    if (delivery.priority != null) event = { ...event, priority: delivery.priority };
    // Future boons and owned packets reserve identity now, then prepare from live application state.
    const owner = delivery.owner ?? profession.effectOwner?.(runtime, event);
    if (owner) {
      if (typeof owner.id !== 'string' || !owner.id || !Number.isSafeInteger(owner.generation) || owner.generation < 0)
        throw new TypeError('Effect lifetime requires an owner id and a nonnegative safe integer generation.');
      delivery = { ...delivery, owner };
    }

    const deferPreparation = (owner != null || event.type === 'buff') && canonicalTime(event.at) > runtime.time;
    const prepared =
      cancelledByCast || deferPreparation
        ? event
        : profession.prepareEvent
          ? profession.prepareEvent(runtime, event)
          : event;
    event = prepareGw2ComboEvent(prepared ?? event);
    if (event.kind === 'internal') throw new TypeError('Internal work must use the work factory.');
    const order = ++eventOrder;
    const parent = reactionParent(event);
    const equippedProfileId =
      !cancelledByCast &&
      !deferPreparation &&
      event.weaponStrengthSource === 'equipped' &&
      event.weaponStrengthProfileId == null &&
      event.weaponStrength == null
        ? weaponStrengthProfileIdForEvent(event, {
            skill: profession.catalog.skillsById.get(event.skillId ?? event.sourceId) ?? null,
            state: runtime as unknown as Record<string, unknown>,
            config
          })
        : null;
    const packet = assertSimulationEvent({
      ...event,
      ...(equippedProfileId ? { weaponStrengthProfileId: equippedProfileId } : {}),
      at: canonicalTime(event.at),
      eventOrder: order,
      causalOrder: event.causalOrder ?? queue.currentCausalOrder ?? order,
      ...(event.parentEventOrder == null && parent != null ? { parentEventOrder: parent } : {})
    });
    if (packet.at < runtime.time) throw new RangeError('Events cannot backdate the live clock.');
    if (!handlers.has(packet.type)) throw new TypeError(`No event handler registered for ${packet.type}.`);
    const cast = packet.activationId == null ? undefined : reservations.get(packet.activationId);
    if (
      !cancelledByCast &&
      prepared !== null &&
      cast &&
      packet.type === 'damage' &&
      packet.actorType === 'player' &&
      packet.skillId === cast.skill.id
    )
      cast.firstStrikeAt = Math.min(cast.firstStrikeAt, packet.at);
    if (prepared !== null && !cancelledByCast) {
      packetDelivery.set(packet, delivery);
      if (deferPreparation) pendingPreparation.add(packet);
      if (delivery.settlement === 'reaction') {
        // A reaction transaction exposes its condition before the caller's next query, while its queued children remain pending.
        if (!['condition', 'boon_extension'].includes(packet.type) || packet.at !== runtime.time)
          throw new RangeError('Reaction settlement requires a condition or boon extension at the live clock.');
        withCause(packet, () => {
          if (packet.type === 'condition') applyConditionNow(packet);
          else handlers.dispatch(packet, runtime);
        });
      } else queue.enqueue(packet);
    }

    // Callers can retain causality without mutating queued ordering or future combat state.
    return packet;
  }

  function announceEffect(request: AnnouncementEmission): Gw2ResolverEvent {
    const { announcement } = request;
    const at = canonicalTime(announcement.at);
    // Retrospective timeline annotations describe completed combat; visible activations must respect the live clock.
    if (at < runtime.time && request.log) throw new RangeError('Visible announcements cannot backdate the live clock.');
    const event = assertSimulationEvent({
      ...(request.cast ? { activationId: request.cast.activationId, offTarget: request.cast.offTarget } : {}),
      ...request.attribution,
      source: request.attribution?.source ?? announcement.type,
      sourceId: request.attribution?.sourceId ?? announcement.name,
      actorType: request.attribution?.actorType ?? 'effect',
      type: 'proc',
      procType: announcement.type,
      name: announcement.name,
      at,
      sourceSkill: announcement.sourceSkill,
      detail: announcement.detail,
      icon: announcement.icon,
      cooldownReduction: announcement.cooldownReduction ?? undefined,
      eventOrder: --announcementOrder,
      causalOrder: request.cause?.causalOrder ?? queue.currentCausalOrder ?? eventOrder,
      ...((request.cause?.eventOrder ?? reactionParent({ type: 'proc', ...request.attribution })) != null
        ? { parentEventOrder: request.cause?.eventOrder ?? reactionParent({ type: 'proc', ...request.attribution }) }
        : {})
    });
    const cancelled = request.cast?.effectiveEnd != null && at > request.cast.effectiveEnd + EPSILON;
    if (cancelled) return event;
    // An owned activation at the current instant must remain cancellable until its heap turn.
    if (at < runtime.time || (at === runtime.time && !request.owner)) publishAnnouncement(request, event);
    else
      enqueueWork(
        makeWork({
          type: 'runtime.announcement',
          at,
          priority: request.priority ?? 0,
          owner: request.owner,
          payload: { request, event }
        })
      );
    return event;
  }

  function publishAnnouncement(request: AnnouncementEmission, event: Gw2ResolverEvent): void {
    const info = request.announcement;
    recordProcStep(runtime, info);
    if (request.log && runtime.reporting) executed.push(event);
  }

  const base = createGw2ResolverRuntimeState({
    config,
    traits: normalizeSelectedTraitIds(config.selectedTraitIds),
    reporting: output !== 'score',
    recordEffectHistory: output === 'detailed' && collectChartData,
    damageDiagnostics: output === 'damage' || damageDiagnostics,
    horizon: policy.kind === 'absolute' ? canonicalTime(policy.endTimeMs / 1000) : null,
    query,
    queue,
    effects,
    professionState: profession.createState(config),
    helpers: { conditionName: canonicalTargetConditionName, ...profession.catalog },
    onFirstDamage: conditions.startDamageClock,
    reactions
  });
  function applyConditionNow(event: SimulationEventBase) {
    // Immediate derived applications obey the same live clock and target gates as queued applications.
    if (canonicalTime(event.at) !== runtime.time)
      throw new RangeError('Immediate conditions must apply at the live clock.');
    if (
      ('offTarget' in event && event.offTarget === true) ||
      runtime.deathTime != null ||
      runtime.combatStartPending ||
      (runtime.combatStartTime != null && runtime.time < runtime.combatStartTime)
    )
      return [];
    // Immediate applications never pass through the queue, so they take their identity here.
    return conditions.applyCondition(runtime, identify(event));
  }

  const clocks = { time: 0, cooldowns: new Map(), rechargeProgress: new Map(), ammo: new Map() };
  // Controller closures follow the one runtime clock; the initializer object is not retained as separate state.
  const cooldownController = createCooldownController({
    state: Object.assign(base, clocks),
    rechargeDuration: (skill, at) => rechargeWorkFor(skill) / cooldownController.rate(skill, at),
    maximumAmmo: (skill) => profession.maximumAmmo?.(runtime, skill, skill.ammo ?? 0) ?? skill.ammo ?? 0,
    rechargeIntervals: (skill, start, end) => query.timeline.rechargeIntervals(skill, start, end),
    skillFor: (id) => profession.catalog.skillsById.get(id)
  });
  runtime = Object.assign(base, {
    effectReactions,
    profession: base.profession as T,
    ...clocks,
    inputReadyAt: 0,
    combatActive: false,
    rotationEndTime: null,
    cursor,
    cooldownController,
    inFlight: new Map(),
    lockouts: new Map(),
    history,
    steps: [],
    hasExplicitCombatStart: explicitCombat,
    combatStartTime: combatStartTime == null ? null : canonicalTime(combatStartTime),
    combatStartPending: markers.length > 0 || (combatStartTime != null && combatStartTime > 0),
    armFlip(
      skillId: SkillId,
      {
        availableAt = runtime.time,
        expiresAt = Infinity,
        visibleAt,
        identity,
        expiryPriority = -20
      }: FlipWindowOptions = {}
    ) {
      const window = armSkillFlip(flipWindows(), skillId, availableAt, expiresAt, visibleAt ?? availableAt, identity);
      // The expiry only retires stale state: readiness already closes at the exclusive deadline.
      if (window.expiresAt != null)
        enqueueWork(
          makeWork({
            type: 'runtime.flip-expiry',
            at: window.expiresAt,
            priority: expiryPriority,
            payload: { skillId, identity: window.identity }
          })
        );
      return window;
    },
    consumeFlip(skillId: SkillId) {
      return consumeSkillFlip(flipWindows(), skillId);
    },
    combatStartedAt(at = runtime.time) {
      // Setup casts that complete at the marker's own instant stay precombat until the cursor consumes the marker.
      if (!runtime.hasExplicitCombatStart) return true;
      if (runtime.combatStartPending || runtime.cursor.command?.type === 'combat-start') return false;
      return runtime.combatStartTime != null && at + EPSILON >= runtime.combatStartTime;
    },
    schedule(name: string, at: number, data: unknown = null, owner?: { id: string; generation: number }, priority = 0) {
      if (!profession.tasks?.[name]) throw new TypeError(`No task handler registered for ${name}.`);
      enqueueWork(makeWork({ type: 'runtime.task', at, priority, payload: { name, data }, owner }));
    },
    scheduleForCast(
      name: string,
      at: number,
      cast: RuntimeCast,
      data: Record<string, unknown> = {},
      owner?: { id: string; generation: number },
      priority = 0
    ) {
      if (!profession.tasks?.[name]) throw new TypeError(`No task handler registered for ${name}.`);
      // Only reservation data crosses the clone boundary; callbacks stay on the catalog skill.
      const { skill, ...reservation } = cast;
      if (!profession.catalog.skillsById.has(skill.id)) throw new TypeError(`Unknown cast task skill ${skill.id}.`);
      enqueueWork(
        makeWork({
          type: 'runtime.cast-task',
          at,
          priority,
          payload: { name, cast: reservation, skillId: skill.id, data },
          owner
        })
      );
    },
    cancelOwner(owner: { id: string; generation: number }) {
      queue.cancelWhere(
        (event) =>
          (event.kind === 'internal' ? (event.owner as RuntimeWork['owner']) : packetDelivery.get(event)?.owner)?.id ===
            owner.id &&
          (event.kind === 'internal' ? (event.owner as RuntimeWork['owner']) : packetDelivery.get(event)?.owner)
            ?.generation === owner.generation
      );
    }
    // Services bind to this identity immediately below, before any initialization hook can observe it.
  }) as unknown as Gw2Runtime<T>;
  const handlers = new HandlerRegistry<Gw2Runtime<T>, Gw2ResolverEvent>()
    .registerAll(
      createGw2ResolverEventHandlers({
        hitResolution: createGw2HitResolution({ strikeMultiplier: relicStrikeMultiplier }),
        conditions: { ...conditions, applyCondition: (_context, event) => applyConditionNow(event) },
        reactions
      })
    )
    .registerAll({
      action_update(_context, update) {
        // Lifetime changes update the executed action, never a mutable reference to a pending packet.
        const action = executed.find((event) => event.type === 'action' && event.activationId === update.activationId);
        if (action) Object.assign(action, { endsAt: update.endsAt, interrupted: update.interrupted });
      },
      'relic.activate'(context, event) {
        // Delayed relic activations own their state only when this queue packet executes.
        for (const relic of [context.relic, ...(context.precastRelics ?? [])])
          if (relic.id === event.sourceId) relic.rules.activate?.(context, relic.state, event);
      }
    })
    .registerAll(profession.eventHandlers ?? {});

  /** Internal packets share queue ordering but cannot become public history or report rows. */
  function enqueueWork(work: RuntimeWork): void {
    if (work.at < runtime.time) throw new RangeError('Internal work cannot backdate the live clock.');
    const queued = queue.enqueue({ ...work, source: 'Runtime', sourceId: work.type, actorType: 'effect' });
    // Delayed work acts for whatever scheduled it, so its unattributed effects stay that event's reactions.
    if (currentCause) workCauses.set(queued, currentCause);
  }

  internal.register('runtime.announcement', (_context, work) => {
    if (work.type === 'runtime.announcement')
      publishAnnouncement(work.payload.request, assertSimulationEvent(work.payload.event));
  });

  /** Authored skill tasks become live work at their deadlines; cast-scaled offsets follow the reserved duration. */
  function scheduleSkillTasks(cast: RuntimeCast): void {
    for (const trigger of cast.skill.tasks ?? [])
      runtime.scheduleForCast(trigger.type, skillTaskAt(cast, trigger, runtime.time), cast, { trigger });
  }

  /** Every profession keeps its follow-up windows under one conventional key on its Core state. */
  function flipWindows(): SkillFlipWindows {
    const flips = readProfessionCoreState<{ availableFlips: SkillFlipWindows }>(runtime.profession).availableFlips;
    if (!flips) throw new TypeError(`${profession.id} keeps no follow-up windows on its Core state.`);
    return flips;
  }

  internal.register('runtime.cast-task', (_context, work) => {
    if (work.type !== 'runtime.cast-task') return;
    const { name, cast, skillId, data } = work.payload;
    // A cast's delayed work acts for that cast, so its unattributed effects are the cast's reactions.
    withCause(
      castActions.get(cast.id) ?? null,
      () =>
        profession.tasks![name](runtime, {
          ...data,
          cast: { ...cast, skill: profession.catalog.skillsById.get(skillId)! }
        }),
      true
    );
  });
  internal.register('runtime.flip-expiry', (_context, work) => {
    if (work.type === 'runtime.flip-expiry')
      expireSkillFlip(flipWindows(), work.payload.skillId, runtime.time, work.payload.identity);
  });
  internal.register('runtime.task', (_context, work) => {
    if (work.type === 'runtime.task') profession.tasks![work.payload.name](runtime, work.payload.data);
  });
  internal.register('runtime.complete', (_context, work) => {
    if (work.type !== 'runtime.complete') return;
    const cast = reservations.get(work.payload.reservationId);
    if (!cast) throw new Error('Cast completion lost its reservation.');
    runtime.inFlight.get(cast.skill.id)?.delete(cast.id);
    if (!runtime.inFlight.get(cast.skill.id)?.size) runtime.inFlight.delete(cast.skill.id);
    if (cast.ammo) {
      cooldownController.spendAmmo(cast.skill, cast.rechargeStart, cast.rechargeWork);
      cooldownController.setAmmoLockout(cast.skill, cast.ammoLockoutWork, cast.rechargeStart);
    } else if (cast.rechargeWork > 0)
      cooldownController.startRecharge(cast.skill, cast.rechargeStart, cast.rechargeWork);
    const cancelled = cast.cancelled;
    // Ordinary swaps commit one actual set transition before completion hooks and queued equipment reactions.
    if (cast.skill.inputCategory === 'weapon-swap' && !castWasInterrupted(cast)) {
      runtime.activeWeaponSet = runtime.activeWeaponSet === 1 ? 2 : 1;
      resetAutoattackChains(runtime);
      runtime.effects.emit({
        kind: 'packet',
        event: {
          type: 'weapon_set',
          at: runtime.time,
          source: profession.id,
          sourceId: cast.skill.id,
          actorType: 'player',
          skillId: cast.skill.id,
          skillName: cast.skill.name,
          activationId: cast.id,
          weaponSet: runtime.activeWeaponSet
        }
      });
      lockTransitionInput(runtime, 'weaponSwapMs', cast.skill);
    }

    const strikeReached = cast.firstStrikeAt <= runtime.time;
    const committed =
      !cancelled && (cast.skill.interruptMode !== 'per-packet' || !castWasInterrupted(cast) || strikeReached);
    const interrupts = !cancelled && !cast.skill.independentCast && cast.fullEnd > cast.start && strikeReached;
    const transition = advanceAutoattackChains(
      runtime,
      profession.catalog,
      cast.skill,
      committed,
      interrupts,
      profession.autoattackChainOverrides
    );
    profession.onAutoattackChainTransition?.(runtime, cast, transition);
    if (cast.skill.cost?.spendOn === 'castCommit' && !cast.cancelled) execution.spendCost?.(runtime, cast.skill);
    // One successful-cast phase owns rewards and tasks; cancelled attempts only release profession state.
    if (cast.cancelled) profession.onCastCancel?.(runtime, cast);
    else {
      applySkillSideEffects(runtime, cast, 'castCommit', profession.sideEffectHandlers);
      profession.onCastCommit?.(runtime, cast);
      scheduleSkillTasks(cast);
    }

    const completion = assertSimulationEvent({
      type: 'action',
      at: runtime.time,
      source: profession.id,
      sourceId: cast.skill.id,
      actorType: 'player',
      skillId: cast.skill.id,
      skillName: cast.skill.name,
      skillType: cast.skill.type,
      activationId: cast.id,
      offTarget: cast.command.offTarget,
      cancelled: cast.cancelled,
      // Preparation relics follow authored command order even when hostile eligibility includes the marker timestamp.
      precombat:
        runtime.combatStartPending ||
        cursor.command?.type === 'combat-start' ||
        (runtime.combatStartTime != null && runtime.time < runtime.combatStartTime)
    });
    execution.castCompleted?.(runtime, completion);
    if (
      Number(cast.skill.selfStunMs) > 0 &&
      !config.boons?.stability &&
      query.timeline.buffStacksAt('stability', runtime.time, 0, 25) === 0
    )
      cursor.selfStunUntil = Math.max(cursor.selfStunUntil, runtime.time + Number(cast.skill.selfStunMs) / 1000);
    reservations.delete(cast.id);
  });

  runtime.resourceController = createRuntimeResources(runtime, profession);
  runtime.endurance = createRuntimeEndurance(runtime, profession);
  runtime.resourceController.initialize();

  const targetHealth = Number(config.target?.health) > 0 ? Number(config.target?.health) : Infinity;
  if (targetHealthLoss(config, runtime) >= targetHealth) runtime.deathTime = 0;
  runtime.precastRelics = normalizePrecastRelics(config.precastRelics)
    .map(createRelicRuntime)
    .filter((relic) => relic.id !== runtime.relic.id);
  if (combatStartTime != null) {
    const marker = assertSimulationEvent({
      type: 'combat_start',
      at: combatStartTime,
      source: 'Runtime',
      sourceId: 'combat-start',
      actorType: 'environment',
      eventOrder: 0
    });
    for (const relic of [runtime.relic, ...runtime.precastRelics]) relic.state.combatMarker = marker;
    // An inherited marker is also an executed boundary, so timed profession producers see the same start as rotation markers.
    runtime.effects.emit({ kind: 'packet', event: marker });
  }

  conditions.initializeEnvironment(runtime);
  // A configured permanent field is an initial executed fact, available to the first eligible finisher.
  const assumedField = permanentComboFieldAssumption(config, profession.id, runtime.time);
  if (assumedField) runtime.effects.emit({ kind: 'packet', event: assumedField });
  // Preview-held buffs are executed facts from the start, so traits read them exactly like earned buffs.
  for (const buff of config.initialBuffs ?? []) {
    if (!(buff.stacks > 0) || !(buff.duration > 0)) continue;
    runtime.effects.emit({
      kind: 'packet',
      event: assertSimulationEvent({
        type: 'buff',
        at: runtime.time,
        kind: buff.kind,
        stacks: buff.stacks,
        duration: buff.duration,
        fixedDuration: true,
        source: buff.name ?? buff.kind,
        sourceId: `assumption.initial-buff.${buff.kind}`,
        skillName: buff.name ?? buff.kind,
        actorType: 'player'
      })
    });
  }

  profession.initialize?.(runtime);
  execution.initialize?.(runtime);
  captureEffects();

  function reject(reason: string): void {
    const command = cursor.command;
    const name =
      command?.type === 'cast'
        ? (profession.catalog.skillsById.get(command.skillId)?.name ?? String(command.skillId))
        : (command?.type ?? 'command');
    runtime.warnings.push(`${name}: ${reason}`);
    if (runtime.reporting)
      runtime.steps.push({
        ri: cursor.index,
        skill: name,
        ...(command?.type === 'cast' ? { skillId: command.skillId } : {}),
        start: runtime.time * 1000,
        end: runtime.time * 1000,
        invalid: true,
        invalidReason: reason
      });
    cursor.consume();
  }

  /** Swap recharge uses the actual combat state and the selected relic before work is reserved. */
  function rechargeWorkFor(skill: Skill, baseWork = gw2BaseRecharge(skill)): number {
    const work = profession.rechargeWork?.(runtime, skill, baseWork) ?? baseWork;
    return skill.inputCategory === 'weapon-swap'
      ? runtime.combatActive
        ? Math.max(0, work - relicWeaponSwapRechargeReduction(config.relic))
        : 0
      : work;
  }

  /** Enqueue basic authored packets at acceptance; only dispatch can change combat state. */
  function acceptCast(skill: Skill, command: CastCommand): void {
    const start = runtime.time;
    const baseDurationMs =
      skill.independentCast && (config.boons?.quickness || query.timeline.buffStacksAt('quickness', start, 0, 1) > 0)
        ? summonQuicknessCastTimeMs(skill)
        : (skill.castTimeMs ?? 0);
    // Capture profession timing once so completion, interruption, and cast-relative packets share the reservation.
    const durationMs = profession.castDurationMs?.(runtime, skill, baseDurationMs) ?? baseDurationMs;
    if (!Number.isFinite(durationMs) || durationMs < 0)
      throw new RangeError('Cast duration must be finite and non-negative.');
    const fullEnd = canonicalTime(start + durationMs / 1000);
    // Authored overrides replace the skill's default interruption; both occupy the same reservation and lane.
    const interruptAfterMs = command.interruptAfterMs ?? skill.defaultInterruptMs;
    const effectiveEnd =
      interruptAfterMs == null ? fullEnd : canonicalTime(Math.min(fullEnd, start + interruptAfterMs / 1000));
    const cancelled = cancelledBeforeInterruptCommit(skill, start, fullEnd, effectiveEnd);
    const interrupted = castWasInterrupted({ fullEnd, effectiveEnd });
    const laneEnd = retainsInterruptedCastLockout(skill, cancelled) ? fullEnd : effectiveEnd;
    const baseWork = rechargeWorkFor(skill);
    const rechargeWork = cancelled ? baseWork : (profession.reserveRecharge?.(runtime, skill, baseWork) ?? baseWork);
    const ammo = cooldownController.ensureAmmo(skill) != null;
    // Resolve the selected anchor once before reservation, retaining the same value through completion.
    const canonicalRechargeStart =
      start +
      (skill.rechargeAnchor === 'castStart' ? 0 : effectiveEnd - start) * (skill.rechargeProgress ?? 1) +
      (skill.rechargeOffsetMs ?? 0) / 1000;
    const rechargeStart =
      profession.rechargeStart?.(runtime, { skill, start, fullEnd, effectiveEnd, cancelled }, canonicalRechargeStart) ??
      canonicalRechargeStart;
    if (!Number.isFinite(rechargeStart)) throw new RangeError('Recharge start must be finite.');
    const cast = reservations.reserve({
      firstStrikeAt: Infinity,
      skill,
      command,
      start,
      fullEnd,
      effectiveEnd,
      rechargeStart: canonicalTime(Math.max(start, rechargeStart)),
      // Reserve one-shot recharge entitlements at acceptance, querying only the current live instant.
      rechargeWork,
      // Persistent recharge modifiers also govern the gap between charges; one-shot entitlements do not.
      ammoLockoutWork:
        ammo && Number(skill.ammoCastLockout) > 0 ? rechargeWorkFor(skill, Number(skill.ammoCastLockout)) : 0,
      ammo,
      cancelled
    });
    if (!runtime.inFlight.has(skill.id)) runtime.inFlight.set(skill.id, new Set());
    runtime.inFlight.get(skill.id)!.add(cast.id);
    for (const lockout of skill.lockouts ?? [])
      runtime.lockouts.set(
        lockout.group,
        // Lockout readiness must use the same rounded clock as the command wake.
        Math.max(runtime.lockouts.get(lockout.group) ?? 0, canonicalTime(start + lockout.durationMs / 1000))
      );
    const detail = profession.castDetail?.(runtime, cast);
    if (runtime.reporting)
      runtime.steps.push({
        ri: cursor.index,
        skill: skill.name,
        skillId: skill.id,
        start: Math.round(start * 1000),
        end: Math.round(effectiveEnd * 1000),
        activationId: cast.id,
        fullCastMs: Math.round((fullEnd - start) * 1000),
        interrupted,
        ...(laneEnd > effectiveEnd ? { castLockoutEnd: Math.round(laneEnd * 1000) } : {}),
        ...(cancelled ? { cancelledBeforeCommit: true } : {}),
        ...(interrupted && skill.interruptMode !== 'per-packet' && interruptCommitCutoffs(skill).length === 0
          ? { missingInterruptCommit: true }
          : {}),
        ...(detail == null ? {} : { detail })
      });
    cursor.acceptCast(skill, command, start, effectiveEnd, laneEnd);
    const attribution = {
      source: profession.id,
      sourceId: skill.id,
      actorType: 'player' as const,
      skillId: skill.id,
      skillName: skill.name,
      activationId: cast.id
    };
    if (!Number.isFinite(cast.rechargeWork) || cast.rechargeWork < 0)
      throw new RangeError('Reserved recharge work must be finite and non-negative.');
    // Select fields from current acceptance state once; their registrations still execute on the common queue.
    const comboFields = profession.modifyComboFields?.(runtime, cast, skill.comboFields) ?? skill.comboFields;
    const action = runtime.effects.emit({
      kind: 'packet',
      event: {
        ...attribution,
        type: 'action',
        at: start,
        name: skill.name,
        skillType: skill.type,
        offTarget: command.offTarget,
        interrupted,
        evades: skill.evades,
        fullEndsAt: fullEnd,
        endsAt: effectiveEnd,
        // Queued mechanic windows can extend through a retained animation lockout, independently of packet completion.
        castLockoutEndsAt: laneEnd,
        rechargeProgress: { startedAt: cast.rechargeStart, work: cast.rechargeWork },
        ...(detail == null ? {} : { detail }),
        ...(comboFields ? { comboFields } : {}),
        cancelled
      }
    });
    castActions.set(cast.id, action);
    // Acceptance work runs for the cast: its own packets keep their activation, other effects become its reactions.
    withCause(action, () => acceptCastWork(cast, action, attribution, interrupted));
    captureEffects();
  }

  /** Reserves completion, pays acceptance costs, and enqueues the cast's authored packets. */
  function acceptCastWork(
    cast: RuntimeCast,
    action: Gw2ResolverEvent,
    attribution: Pick<
      SimulationEventBase,
      'source' | 'sourceId' | 'actorType' | 'skillId' | 'skillName' | 'activationId'
    >,
    interrupted: boolean
  ): void {
    const { skill, command, start, fullEnd, effectiveEnd } = cast;
    enqueueWork(
      makeWork({
        type: 'runtime.complete',
        at: effectiveEnd,
        priority: -100,
        payload: { reservationId: cast.id },
        activationId: cast.id,
        causalOrder: action.eventOrder
      })
    );
    // A declared cost is paid on acceptance unless it requires successful completion.
    if (skill.cost && skill.cost.spendOn !== 'castCommit') execution.spendCost?.(runtime, skill);
    profession.onCastStart?.(runtime, cast);
    applySkillSideEffects(runtime, cast, 'castStart', profession.sideEffectHandlers);
    // Custom skill owners select their packets once; scheduled effects still apply through the common live queue.
    const selectedEffects = selectSkillEffects(runtime, cast);
    for (const effect of profession.modifyEffects?.(runtime, cast, selectedEffects) ?? selectedEffects) {
      if (effect.when && !effect.when(runtime, cast)) continue;
      const perPacket = skill.interruptMode === 'per-packet';
      if (interrupted && !perPacket && cancelledBeforeEffectCommit(skill, effect, start, fullEnd, effectiveEnd))
        continue;
      runtime.effects.emit({
        kind: 'profile',
        profile: skill,
        effects: [scaleCastBoundTiming(cast, skill, effect)],
        at: start,
        fullEnd,
        attribution: {
          ...attribution,
          source: effect.source || profession.id,
          sourceId: effect.sourceId ?? skill.id,
          actorType: effect.actorType || 'player',
          // Derived effects retain the declared gameplay owner independently of their display actor.
          ...(effect.ownerActorType ? { ownerActorType: effect.ownerActorType } : {})
        },
        skillWeaponFallback: ['Heal', 'Utility', 'Elite'].includes(skill.type ?? '') ? 'Unequipped' : '',
        transform(event) {
          // Compare on the same clock as the reservation; raw addition can place an equal-time impact just beyond it.
          if (interrupted && (perPacket || !effect.persistsAfterInterrupt) && canonicalTime(event.at) > effectiveEnd)
            return null;
          return {
            ...event,
            at: event.at + (isHostileTargetEvent(event) ? (command.impactDelayMs ?? 0) / 1000 : 0),
            offTarget: command.offTarget,
            // Authored boons settle before sibling impacts, preserving the owning activation's queue position.
            ...(event.type === 'buff' ? { causalOrder: action.eventOrder } : {})
          };
        }
      });
    }
  }

  /** Hostile rejection never stops self-state or command execution; lethal siblings settle before the combat capture. */
  function dispatch(event: Gw2ResolverEvent): void {
    if (event.kind === 'internal') {
      withCause(workCauses.get(event) ?? null, () => internal.dispatch(event as unknown as RuntimeWork, runtime), true);
      captureEffects();
      return;
    }

    // Everything the event's handlers and equipment hooks create is a reaction to it.
    withCause(event, () => dispatchEvent(event));
    captureEffects();
  }

  // Observe the existing owners after each accepted transaction, including custom tasks with no buff packet.
  function captureEffects(): void {
    if (!runtime.effectRecorder || (runtime.deathTime != null && runtime.time > runtime.deathTime)) return;
    captureRuntimeEffects(runtime, profession);
  }

  function dispatchEvent(event: Gw2ResolverEvent): void {
    if (pendingPreparation.has(event)) {
      pendingPreparation.delete(event);
      const reserved = event;
      const prepared = profession.prepareEvent ? profession.prepareEvent(runtime, event) : event;
      if (prepared === null) return;
      const equippedProfileId =
        prepared.weaponStrengthSource === 'equipped' &&
        prepared.weaponStrengthProfileId == null &&
        prepared.weaponStrength == null
          ? weaponStrengthProfileIdForEvent(prepared, {
              skill: profession.catalog.skillsById.get(prepared.skillId ?? prepared.sourceId) ?? null,
              state: runtime as unknown as Record<string, unknown>,
              config
            })
          : null;
      // Preparation cannot reserve another queue position or detach the packet from its original cause.
      event = assertSimulationEvent({
        ...prepareGw2ComboEvent(prepared),
        ...(equippedProfileId ? { weaponStrengthProfileId: equippedProfileId } : {}),
        eventOrder: reserved.eventOrder,
        causalOrder: reserved.causalOrder
      });
      const delivery = packetDelivery.get(reserved);
      if (delivery) packetDelivery.set(event, delivery);
    }

    // Every boon samples live modifiers exactly once at application, retaining its reserved queue position.
    const delivery = packetDelivery.get(event);
    if (event.type === 'buff' && isStandardBoon(event.kind ?? '')) {
      const baseDuration = event.duration ?? 0;
      const scaledDuration = gw2ResolverBoonDuration(
        runtime,
        delivery?.durationContext ? { ...delivery.durationContext, at: event.at } : event,
        event.kind ?? '',
        baseDuration,
        { fixedDuration: event.fixedDuration === true }
      );
      event = {
        ...event,
        duration:
          event.fixedDuration === true
            ? scaledDuration
            : (profession.boonDuration?.(runtime, event, baseDuration, scaledDuration) ?? scaledDuration)
      };
    }

    event = normalizeBoonDuration(event);
    // Inherited combat boundaries remain pending until their queued marker actually executes.
    if (event.type === 'combat_start') runtime.combatStartPending = false;
    // Actual finishers settle before their owning hit samples attributes and critical chance.
    // Requeue the same hit once, retaining its identity and position after the higher-priority combo chain.
    if (
      event.type === 'damage' &&
      !preparedCombos.has(event) &&
      (fieldDescriptors(profession.catalog, event).length || finisherDescriptors(profession.catalog, event).length)
    ) {
      preparedCombos.add(event);
      produceRuntimeCombos(runtime, profession.catalog, event);
      queue.enqueue(event);
      return;
    }

    const hostile = isHostileTargetEvent(event) || event.type === 'combo_finisher' || event.comboId != null;
    const precombat =
      runtime.combatStartPending || (runtime.combatStartTime != null && event.at < runtime.combatStartTime);
    if (missesTarget(event) || (precombat && isPrecombatTargetEffect(event) && event.type !== 'condition_tick')) {
      // Preserve attempted packets for targeting edits; only resolved rows contribute damage.
      if (runtime.reporting) executed.push(event);
      // A missed impact can still finish a field and grant self effects; hostile combo outcomes retain its miss.
      if (runtime.deathTime == null && !preparedCombos.has(event))
        produceRuntimeCombos(runtime, profession.catalog, event);
      return;
    }

    if (runtime.deathTime != null && hostile) {
      const lethalSibling =
        event.type === 'damage' && lethalActivation != null && event.activationId === lethalActivation;
      if (event.at !== runtime.deathTime || (!lethalSibling && event.type !== 'condition_tick')) {
        return;
      }
    }

    // Precombat control notifications remain observable without starting combat producers before the marker.
    if (!runtime.combatActive && !precombat && isCombatEntryEvent(event)) {
      runtime.combatActive = true;
      // Timed profession producers anchor once to the accepted combat-start boundary.
      execution.combatStart?.(runtime);
    }

    event = bindRuntimeCombo(runtime, event);
    handlers.dispatch(event, runtime);
    // Shared relic descriptors react to actual events and queue their effects on this clock.
    if (event.type === 'action') execution.action?.(runtime, event);
    if (event.type === 'combat_start')
      for (const relic of [runtime.relic, ...(runtime.precastRelics ?? [])]) relic.state.combatMarker = event;
    if (event.type === 'condition') execution.condition?.(runtime, event);
    // Proc rows keep recharge reductions for timeline badges and timed procs keep their deadline.
    if (event.type === 'proc')
      recordProcStep(runtime, {
        type: event.procType ?? 'skill',
        name: event.name ?? '',
        at: event.at,
        sourceSkill: event.sourceSkill,
        detail: event.detail,
        icon: event.icon,
        cooldownReduction: event.cooldownReduction,
        expiresAt: Number(event.duration) > 0 ? event.at + Number(event.duration) : null
      });
    if (event.type === 'weapon_set' || event.type === 'sigil_swap') execution.weaponSwap?.(runtime, event);
    if (['action', 'cooldown_snapshot', 'weapon_set', 'buff', 'boon_extension', 'marker'].includes(event.type))
      history.push(event);
    if (!preparedCombos.has(event)) produceRuntimeCombos(runtime, profession.catalog, event);
    if (runtime.reporting && !['condition_buffer', 'condition_tick', 'action_update'].includes(event.type))
      executed.push(event);
    if (runtime.deathTime == null && targetHealthLoss(config, runtime) >= targetHealth) {
      runtime.deathTime = event.at;
      lethalActivation = event.activationId;
    }
  }

  // Each iteration either dispatches work, consumes one command, or advances to an actual boundary.
  let finished = false;
  const driverContext: RuntimeDriverContext<T> = {
    runtime,
    cooldowns: cooldownController,
    inFlightEnd: (id) => reservations.get(id)!.effectiveEnd,
    advanceFrontier: (reason) => queue.advanceFrontier(runtime.time, GW2_RESOLVER_PHASE.Ordinary, reason),
    acceptCast,
    reject
  };
  for (let iteration = 0; iteration < DEFAULT_EXECUTION_ITERATION_LIMIT; iteration++) {
    // The next authored marker fixes a boundary, not a gameplay transition: opening packets at that instant remain eligible.
    if (runtime.combatStartPending && cursor.command?.type === 'combat-start') {
      runtime.combatStartTime = cursor.requestAt(runtime.time);
      runtime.combatStartPending = false;
    }

    const due = queue.peek();
    if (due && due.at <= runtime.time) {
      try {
        dispatch(queue.dequeue()!);
      } finally {
        queue.currentCausalOrder = null;
      }

      continue;
    }

    const commandBoundary = execution.driver.advance(driverContext);
    if (commandBoundary === 'handled') continue;
    let nextCommandAt = commandBoundary;
    if (!cursor.command && runtime.rotationEndTime == null) {
      nextCommandAt = Math.max(cursor.endTime(), runtime.inputReadyAt);
      if (nextCommandAt <= runtime.time) {
        runtime.rotationEndTime = runtime.time;
        // A fixed safety horizon keeps condition scheduling live while an occurrence finishes early below.
        runtime.horizon = canonicalTime(ownsEffect ? runtime.time + 120 : observationEndTime(policy, runtime.time));
        nextCommandAt = Infinity;
      }
    }

    const completionAt = ownsEffect && runtime.rotationEndTime != null ? damageCompletionTime() : Infinity;
    if (runtime.rotationEndTime != null && runtime.time >= completionAt) {
      runtime.horizon = runtime.time;
      finished = true;
      break;
    }

    if (runtime.horizon != null && runtime.time >= runtime.horizon) {
      if (runtime.rotationEndTime == null)
        throw new RangeError('Absolute observation endTimeMs cannot precede rotation end.');
      finished = true;
      break;
    }

    const next = Math.min(nextCommandAt, queue.peek()?.at ?? Infinity, runtime.horizon ?? Infinity, completionAt);
    if (!Number.isFinite(next) || next <= runtime.time) throw new Error('Live runtime has no advancing boundary.');
    runtime.time = canonicalTime(next);
    runtime.resourceController.advance();
    runtime.endurance.advance();
    cooldownController.refresh(runtime.time);
  }

  if (!finished || runtime.rotationEndTime == null) throw new Error('Live runtime exceeded its action safety limit.');
  const reportingStarted = onPhase ? performance.now() : 0;
  onPhase?.('execution', reportingStarted - started);
  // Finalize condition presentation once at the shared boundary for both reporting modes.
  finalizeConditionApplications(runtime, runtime.deathTime ?? runtime.horizon!);
  if (ownsEffect) {
    onPhase?.('reporting', performance.now() - reportingStarted);
    return {
      events: runtime.resolved.filter(ownsEffect),
      castSeconds: runtime.steps.length ? (runtime.steps[0].end - runtime.steps[0].start) / 1000 : 0,
      complete: damageCompletionTime() <= runtime.time + EPSILON
    };
  }

  const score = buildSimulationScore(runtime, runtime.rotationEndTime, explicitCombat);
  if (output === 'score') {
    onPhase?.('reporting', performance.now() - reportingStarted);
    return score;
  }

  execution.report?.(runtime, score.combatEndTime);
  // Queued companion commands can start later with a different speed; report the executed animation, not its reservation.
  const companionActions = new Map(
    executed
      .filter(
        (event) =>
          event.type === 'action' &&
          event.actorType === 'summon' &&
          event.activationId &&
          event.skillId != null &&
          profession.catalog.skillsById.get(event.skillId)?.independentCast
      )
      .map((event) => [event.activationId, event])
  );
  const steps = runtime.steps.map((step) => {
    const action = companionActions.get(step.activationId);
    if (step.invalid || !action || typeof action.endsAt !== 'number' || typeof action.fullEndsAt !== 'number')
      return step;
    return {
      ...step,
      start: Math.round(action.at * 1000),
      end: Math.round(action.endsAt * 1000),
      fullCastMs: Math.round((action.fullEndsAt - action.at) * 1000),
      interrupted: action.endsAt < action.fullEndsAt - EPSILON
    };
  });
  const result = {
    ...buildCombatResult(runtime, score, executed),
    output: 'detailed' as const,
    steps,
    rotationApm: rotationApm(
      {
        steps,
        events: executed,
        rotationEndTime: runtime.rotationEndTime,
        combatStartTime: explicitCombat ? (runtime.combatStartTime ?? null) : null
      },
      execution.driver.rotation,
      profession.catalog
    ),
    planningState: planningState(
      { ...runtime, catalog: profession.catalog },
      profession.projectPlanningState,
      profession.endurance?.maximum(runtime),
      (skill) => profession.availability?.(runtime, skill, { type: 'cast', skillId: skill.id }) ?? { ready: true },
      observeRuntimeEffects(runtime, profession)
    )
  };
  onPhase?.('reporting', performance.now() - reportingStarted);
  return result;

  /** Follow owned work and condition settlement in this run; unrelated background tasks cannot prolong it. */
  function damageCompletionTime(): number {
    let deadline = runtime.rotationEndTime ?? runtime.time;
    for (const pending of pendingEffects()) if (ownsEffect!(pending.cause)) deadline = Math.max(deadline, pending.at);
    for (const event of runtime.resolved)
      if (ownsEffect!(event) && event.naturalExpiresAt != null)
        // Owner condition clocks may pay their final buffered remainder after natural expiry.
        deadline = Math.max(deadline, Number(event.naturalExpiresAt) + 1.5);
    return deadline;
  }

  /** Project pending deadlines with their actual cause, excluding already identified physical summon loops. */
  function pendingEffects(): { at: number; cause: Gw2ResolverEvent }[] {
    const summonOwners = new Set(executed.flatMap((event) => (event.summonOwner == null ? [] : [event.summonOwner])));
    return queue.pending().flatMap((event) => {
      if (event.actorType === 'summon' || event.summonOwner != null || SHARED_PULSE_TYPES.has(event.type)) return [];
      if (event.kind !== 'internal') return [{ at: event.at, cause: event }];
      const work = event as unknown as RuntimeWork;
      if (
        work.type === 'runtime.flip-expiry' ||
        (work.owner && summonOwners.has(work.owner.id)) ||
        (work.type === 'runtime.task' && profession.backgroundTasks?.includes(work.payload.name))
      )
        return [];
      const cause = work.type === 'runtime.cast-task' ? castActions.get(work.payload.cast.id) : workCauses.get(event);
      return cause ? [{ at: event.at, cause }] : [];
    });
  }
}
