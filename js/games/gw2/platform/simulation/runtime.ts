import { prepareSelectedSkillLoadout } from '#gw2/platform/builds/selected-skills.js';
import { createGw2CombatQuery } from '#gw2/platform/combat/query/combat-query.js';
import { createRuntimeEndurance, createRuntimeResources } from '#gw2/platform/combat/resources/runtime-resources.js';
import { targetHealthLoss } from '#gw2/platform/combat/state/target-health.js';
import { canonicalTargetConditionName } from '#gw2/platform/combat/state/targets.js';
import { normalizeSelectedTraitIds } from '#gw2/platform/combat/state/traits.js';
import { permanentComboFieldAssumption } from '#gw2/platform/combos/permanent-field-assumption.js';
import { assertSimulationEvent } from '#gw2/platform/engine/events/events.js';
import { readProfessionCoreState } from '#gw2/platform/engine/profession/state.js';
import {
  armSkillFlip,
  consumeSkillFlip,
  expireSkillFlip,
  type SkillFlipWindows
} from '#gw2/platform/engine/skills/skill-flips.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import { normalizePrecastRelics } from '#gw2/platform/equipment/relics/catalog.js';
import { createRelicRuntime } from '#gw2/platform/equipment/relics/runtime.js';
import { createCastExecution } from '#gw2/platform/execution/cast-execution.js';
import { createCooldownController } from '#gw2/platform/execution/cooldowns.js';
import { createMaximumAmmoContext } from '#gw2/platform/profession-definition/runtime-context.js';
import { createGw2ConditionResolution } from '#gw2/platform/resolver/condition-resolution.js';
import { createEffectDelivery } from '#gw2/platform/resolver/effect-delivery.js';
import { GW2_RESOLVER_PHASE } from '#gw2/platform/resolver/event-loop.js';
import { HandlerRegistry } from '#gw2/platform/resolver/handler-registry.js';
import { createGw2ResolverReactionRegistry } from '#gw2/platform/resolver/reaction-registry.js';
import { createGw2ResolverRuntimeState } from '#gw2/platform/resolver/runtime-state.js';
import type { Gw2ResolverEvent, Gw2ResolverReactionRegistry } from '#gw2/platform/resolver/types.js';
import { captureRuntimeEffects } from '#gw2/platform/results/observe-effects.js';
import { projectRuntimeResult } from '#gw2/platform/results/project-runtime.js';
import { createExecutedFacts } from '#gw2/platform/results/executed-facts.js';
import { createMechanicContext, createMechanicQueryContext } from '#gw2/platform/simulation/mechanic-context.js';
import { createCombatExecution } from '#gw2/platform/simulation/combat-execution.js';
import { createExecutionCoordinator } from '#gw2/platform/simulation/coordinator.js';
import { createEffectEmissionService } from '#gw2/platform/simulation/effect-emission.js';
import { createEffectReactions, type EffectReactionStage } from '#gw2/platform/simulation/effect-reactions.js';
import type {
  DamageRuntimeOptions,
  DamageRuntimeResult,
  RuntimeDriverContext,
  RuntimeExecution,
  RuntimeOptions
} from '#gw2/platform/simulation/execution.js';
import { createInternalWorkFactory } from '#gw2/platform/simulation/internal-work.js';
import type {
  FlipWindowOptions,
  Gw2Runtime,
  RuntimeCast,
  RuntimeWork
} from '#gw2/platform/simulation/runtime-state.js';
import type { Gw2SimulationResult, Gw2SimulationScore } from '#gw2/platform/simulation/types.js';
import { canonicalTime, EPSILON } from '#kernel/core/clock.js';
import { normalizeObservationPolicy } from '#kernel/execution/observation.js';

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
  let runtime: Gw2Runtime<T>;
  const coordinator = createExecutionCoordinator(() => runtime);
  const { queue, identify, reactionParent, withCause, enqueueWork } = coordinator;
  const history: Gw2ResolverEvent[] = [];
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
  const internal = new HandlerRegistry<Gw2Runtime<T>, RuntimeWork>();
  const makeWork = createInternalWorkFactory<RuntimeWork>(internal);
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
          return handler(runtime.mechanics, event, details ?? {});
        }
      ])
    )
  });
  const reactions: Gw2ResolverReactionRegistry = {
    dispatch(stage, context, event, details) {
      return deliveryOwner.react(stage, context, event, details, actualReactions);
    }
  };
  const conditions = createGw2ConditionResolution({ config, reactions });
  // Emission owns transport; profession hooks select payloads and keep their gameplay rules.
  const effects = createEffectEmissionService({
    now: () => runtime.time,
    registerReaction: (profile, effect) => effectReactions.register(profile, effect),
    submit: (event, delivery) => deliveryOwner.submitEffect(event, delivery),
    announce: (request) => deliveryOwner.announceEffect(request)
  });

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
  const clocks = { time: 0, cooldowns: new Map(), rechargeProgress: new Map(), ammo: new Map() };
  // Capacity queries share one selected-content capability and follow the live profession state across replacements.
  const maximumAmmoContext = createMaximumAmmoContext(() => runtime.profession, base.traits, profession.catalog);
  // Controller closures follow the one runtime clock; the initializer object is not retained as separate state.
  const cooldownController = createCooldownController({
    state: Object.assign(base, clocks),
    rechargeDuration: (skill, at) => casts.rechargeWorkFor(skill) / cooldownController.rate(skill, at),
    maximumAmmo: (skill) => profession.maximumAmmo?.(maximumAmmoContext, skill, skill.ammo ?? 0) ?? skill.ammo ?? 0,
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
    history,
    facts: createExecutedFacts(history),
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
          (event.kind === 'internal' ? (event.owner as RuntimeWork['owner']) : deliveryOwner.owner(event))?.id ===
            owner.id &&
          (event.kind === 'internal' ? (event.owner as RuntimeWork['owner']) : deliveryOwner.owner(event))
            ?.generation === owner.generation
      );
    }
    // Services bind to this identity immediately below, before any initialization hook can observe it.
  }) as unknown as Gw2Runtime<T>;
  Object.defineProperty(runtime, 'mechanics', { value: createMechanicContext(runtime), enumerable: true });
  Object.defineProperty(runtime, 'mechanicQueries', { value: createMechanicQueryContext(runtime), enumerable: true });
  internal.register('runtime.announcement', (_context, work) => {
    if (work.type === 'runtime.announcement')
      deliveryOwner.publishAnnouncement(work.payload.request, assertSimulationEvent(work.payload.event));
  });

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
      coordinator.castAction(cast.id) ?? null,
      () =>
        profession.tasks![name](runtime.mechanics, {
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
    if (work.type === 'runtime.task') profession.tasks![work.payload.name](runtime.mechanics, work.payload.data);
  });
  const casts = createCastExecution(runtime, profession, execution, {
    makeWork,
    enqueueWork,
    withCause,
    captureEffects,
    recordAction: coordinator.recordAction
  });
  Object.defineProperty(runtime, 'castController', { value: casts.control, enumerable: true });
  internal.register('runtime.complete', (_context, work) => {
    if (work.type === 'runtime.complete') casts.complete(work.payload.reservationId);
  });

  const deliveryOwner = createEffectDelivery(runtime, profession, execution, conditions, reactions, {
    makeWork,
    enqueueWork,
    identify,
    reactionParent,
    withCause,
    eventOrder: coordinator.eventOrder,
    nextEventOrder: coordinator.nextEventOrder,
    observePacket: casts.observePacket
  });
  const { executed } = deliveryOwner;

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

  profession.initialize?.(runtime.mechanics);
  execution.initialize?.(runtime);
  captureEffects();

  /** Hostile rejection never stops self-state or command execution; lethal siblings settle before the combat capture. */
  function dispatch(event: Gw2ResolverEvent): void {
    if (event.kind === 'internal') {
      withCause(
        coordinator.workCause(event) ?? null,
        () => internal.dispatch(event as unknown as RuntimeWork, runtime),
        true
      );
      captureEffects();
      return;
    }

    // Everything the event's handlers and equipment hooks create is a reaction to it.
    withCause(event, () => deliveryOwner.dispatchEvent(event));
    captureEffects();
  }

  // Observe the existing owners after each accepted transaction, including custom tasks with no buff packet.
  function captureEffects(): void {
    if (!runtime.effectRecorder || (runtime.deathTime != null && runtime.time > runtime.deathTime)) return;
    captureRuntimeEffects(runtime, profession);
  }

  const driverContext: RuntimeDriverContext<T> = {
    runtime,
    evaluateReadiness: casts.evaluateReadiness,
    resetCooldowns: casts.resetCooldowns,
    advanceFrontier: (reason) => queue.advanceFrontier(runtime.time, GW2_RESOLVER_PHASE.Ordinary, reason),
    acceptCast: casts.acceptCast,
    reject: casts.reject
  };
  coordinator.run(runtime, execution, policy, driverContext, dispatch, ownsEffect ? damageCompletionTime : undefined);
  if (runtime.rotationEndTime == null) throw new Error('Execution completed without a rotation boundary.');
  const reportingStarted = onPhase ? performance.now() : 0;
  onPhase?.('execution', reportingStarted - started);
  const result = projectRuntimeResult(runtime, profession, execution, {
    output,
    explicitCombat,
    executed,
    ownsEffect,
    damageCompletionTime
  });
  onPhase?.('reporting', performance.now() - reportingStarted);
  return result;

  /** Follow owned work and condition settlement in this run; unrelated background tasks cannot prolong it. */
  function damageCompletionTime(): number {
    let deadline = runtime.rotationEndTime ?? runtime.time;
    for (const pending of coordinator.pendingEffects(executed, profession.backgroundTasks))
      if (ownsEffect!(pending.cause)) deadline = Math.max(deadline, pending.at);
    for (const event of runtime.resolved)
      if (ownsEffect!(event) && event.naturalExpiresAt != null)
        // Owner condition clocks may pay their final buffered remainder after natural expiry.
        deadline = Math.max(deadline, Number(event.naturalExpiresAt) + 1.5);
    return deadline;
  }
}
