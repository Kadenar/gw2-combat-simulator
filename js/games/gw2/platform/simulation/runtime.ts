/** Composition binds domain owners in dependency order before any policy can request runtime work. */
import { prepareSelectedSkillLoadout } from '#gw2/platform/builds/selected-skills.js';
import { normalizeSelectedTraitIds } from '#gw2/platform/builds/selected-traits.js';
import { createGw2CombatQuery } from '#gw2/platform/combat-calculation/combat-query.js';
import { createCombatEngagement } from '#gw2/platform/combat/engagement.js';
import { createExecutedFacts } from '#gw2/platform/combat/history/executed-facts.js';
import { createEnduranceController } from '#gw2/platform/combat/resources/endurance-controller.js';
import { createVigorWindowReader, vigorEnduranceIntervals } from '#gw2/platform/combat/resources/endurance.js';
import { createResourceController } from '#gw2/platform/combat/resources/resource-controller.js';
import {
  RESOURCE_KEYS,
  validateResourcePolicies,
  type ResourceKey
} from '#gw2/platform/combat/resources/resource-policy.js';
import { createAlliedStrikeController } from '#gw2/platform/combat/state/allied-strikes.js';
import { createEncounter, initialEncounterTarget } from '#gw2/platform/combat/state/encounter.js';
import { targetHealthLoss } from '#gw2/platform/combat/state/target-health.js';
import { canonicalTargetConditionName } from '#gw2/platform/combat/state/targets.js';
import { permanentComboFieldAssumption } from '#gw2/platform/combos/permanent-field-assumption.js';
import { ACTOR } from '#gw2/platform/constants.js';
import { validateCatalogResourceGrants } from '#gw2/platform/effects/action-declarations.js';
import { applySideEffect } from '#gw2/platform/effects/action-dispatch.js';
import { validateResourceGrantSupport } from '#gw2/platform/effects/action-validation.js';
import { createEffectEmissionService } from '#gw2/platform/effects/emission.js';
import { createEffectExpansionBudget } from '#gw2/platform/effects/expansion-budget.js';
import { type EffectReactionStage } from '#gw2/platform/effects/reactions.js';
import { sigilBuffPolicies } from '#gw2/platform/equipment/sigils/runtime.js';
import { assertSimulationEvent } from '#gw2/platform/events/events.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import { createAutoattackChainController } from '#gw2/platform/execution/autoattack-chains.js';
import { createCastExecution } from '#gw2/platform/execution/cast-execution.js';
import { createCooldownController } from '#gw2/platform/execution/cooldowns.js';
import type { RuntimeDriverContext } from '#gw2/platform/execution/driver-contract.js';
import { createSkillFlipController } from '#gw2/platform/execution/skill-flip-controller.js';
import { normalizeTransitionDelays } from '#gw2/platform/execution/transition-lockouts.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { createMaximumAmmoContext } from '#gw2/platform/profession-definition/runtime-context.js';
import type { TriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import { createGw2ConditionResolution } from '#gw2/platform/resolver/condition-resolution.js';
import { createEffectDelivery } from '#gw2/platform/resolver/effect-delivery.js';
import { createEffectReactions } from '#gw2/platform/resolver/effect-reactions.js';
import { GW2_RESOLVER_PHASE } from '#gw2/platform/resolver/event-phase.js';
import { HandlerRegistry } from '#gw2/platform/resolver/handler-registry.js';
import { createGw2ResolverReactionRegistry, mapGw2Reactions } from '#gw2/platform/resolver/reaction-registry.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';
import { createGw2ResolverRuntimeState } from '#gw2/platform/resolver/runtime-state.js';
import type {
  Gw2ResolverReactionArgs,
  Gw2ResolverReactionRegistry,
  Gw2ResolverStageDetails
} from '#gw2/platform/resolver/types.js';
import { createBoonGenerationCollector } from '#gw2/platform/results/boon-generation.js';
import { createDamageReportRecorder } from '#gw2/platform/results/damage-report.js';
import { EffectRecorder } from '#gw2/platform/results/effect-report.js';
import { captureRuntimeEffects } from '#gw2/platform/results/observe-effects.js';
import { ProcStepRecorder } from '#gw2/platform/results/proc-steps.js';
import { projectRuntimeResult } from '#gw2/platform/results/project-runtime.js';
import type {
  Gw2SimulationObservations,
  Gw2SimulationResult,
  Gw2SimulationScore
} from '#gw2/platform/results/types.js';
import { createMechanicContext, createMechanicQueryContext } from '#gw2/platform/simulation/bind-mechanic-context.js';
import { createCombatExecution } from '#gw2/platform/simulation/combat-execution.js';
import type { Gw2RuntimeConfig } from '#gw2/platform/simulation/config.js';
import { createExecutionCoordinator } from '#gw2/platform/simulation/coordinator.js';
import { createInternalWorkFactory } from '#gw2/platform/simulation/internal-work.js';
import { createOccurrenceCompletion } from '#gw2/platform/simulation/occurrence-completion.js';
import type {
  DamageRuntimeOptions,
  DamageRuntimeResult,
  RuntimeExecution,
  RuntimeOptions
} from '#gw2/platform/simulation/run-contract.js';
import type { Gw2Runtime } from '#gw2/platform/simulation/runtime-state.js';
import { createResourceDepletionWake, createRuntimeTaskScheduler } from '#gw2/platform/simulation/task-scheduler.js';
import {
  FLIP_EXPIRY_PRIORITY,
  isRuntimeWork,
  type RuntimeQueueEntry,
  type RuntimeWork
} from '#gw2/platform/simulation/work-contract.js';
import { canonicalTime } from '#kernel/core/clock.js';
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
): Gw2SimulationResult | Gw2SimulationScore | Gw2SimulationObservations;

/** The shared scheduler can collect a finite occurrence without constructing combat reports. */
export function runRuntime<T extends object>(
  options: (RuntimeOptions<T> | DamageRuntimeOptions<T>) & { readonly execution: RuntimeExecution<T> }
): DamageRuntimeResult | Gw2SimulationResult | Gw2SimulationScore | Gw2SimulationObservations {
  // Phase 1: normalize and validate the invocation before constructing live owners.
  const {
    profession,
    config: inputConfig = {},
    observation,
    combatStartTime,
    output = 'detailed',
    collectChartData = true,
    collectBoonCoverage = false,
    damageDiagnostics = false,
    execution,
    onPhase
  } = { observation: undefined, ...options };
  // Encounter health overrides the golem's finite-target assumptions for this run only.
  const initialTarget = inputConfig.encounter ? initialEncounterTarget(inputConfig.encounter) : null;
  // All entry points capture complete transition settings once, preserving partial inputs and zero defaults.
  let config: Gw2RuntimeConfig = {
    ...inputConfig,
    transitionDelays: Object.freeze(normalizeTransitionDelays(inputConfig.transitionDelays)),
    ...(initialTarget
      ? {
          target: {
            ...inputConfig.target,
            health: initialTarget.maximumHealth,
            armor: initialTarget.armor,
            startingHealthFraction: 1,
            fixedHealthFraction: undefined
          }
        }
      : {})
  };
  const ownsEffect = options.output === 'damage' ? options.ownsEffect : undefined;
  let effectsCapturePending = false;
  const started = onPhase ? performance.now() : 0;
  // Direct runtime callers can override composed policies; reject malformed inputs before state creation.
  validateResourcePolicies(profession.resources, profession.endurance);
  // Validate the invocation's selected catalog, including patches, before initializing or mutating live state.
  const supportedResources = new Set<ResourceKey | 'endurance'>(
    RESOURCE_KEYS.filter((key) => profession.resources?.[key] != null)
  );

  if (profession.endurance) supportedResources.add('endurance');

  validateCatalogResourceGrants(profession.catalog, supportedResources);

  // Direct and public runtime entry points share catalog validation and detached selection snapshots.
  if ('selectedSkills' in config)
    throw new TypeError('selectedSkills is unsupported in simulation; use selectedSkillIds.');

  if (config.selectedSkillIds !== undefined)
    config = {
      ...config,
      selectedSkillIds: prepareSelectedSkillLoadout(config.selectedSkillIds, profession.skillSelectionCatalog)
    };

  const policy = normalizeObservationPolicy(observation);
  const cursor = execution.driver.cursor;
  const markers = cursor.commands.filter((command) => command.type === 'combat-start');

  // Phase 2: construct deferred producers, queue authority, facts, and output observers.
  let runtime: Gw2Runtime<T>;
  const engagementController = createCombatEngagement(
    { authoredMarkers: markers.length, inheritedStartTime: combatStartTime },
    () => runtime.time
  );
  const coordinator = createExecutionCoordinator(() => runtime);
  const { queue, identify, reactionParent, withCause, enqueueWork } = coordinator;
  const history: Gw2ResolverEvent[] = [];
  const facts = createExecutedFacts(history);
  const query = createGw2CombatQuery({
    profession,
    config,
    // Direct modifier-history reads and indexed queries share executed facts, even without report collections.
    events: history,
    resolvedTimelineEvents: history,
    skillOnCooldown: (skillId, at) => cooldownController.isOnCooldown(skillId, at)
  });
  const internal = new HandlerRegistry<Gw2Runtime<T>, RuntimeWork>();
  const makeWork = createInternalWorkFactory<RuntimeWork>(internal);
  // Bind hooks to the same context used by commands. No hook receives a predicted or restored state.
  const producers = execution.bindProducers(() => runtime);
  const { contributions } = producers;
  const effectReactions = createEffectReactions<T>(profession.catalog, {
    hasHandler: (type) => typeof profession.sideEffectHandlers?.[type] === 'function',
    validate: (skill, action) =>
      validateResourceGrantSupport(action, supportedResources, `${skill.name} (${skill.id})`),
    apply: (context, trigger, action) => applySideEffect(context, trigger, action, profession.sideEffectHandlers)
  });
  // Skill-owned actions run immediately before the composed profession reactions, through the same acceptance gates.
  function effectReactionContribution<Stage extends EffectReactionStage>(stage: Stage) {
    return {
      id: `skill.${stage}`,
      order: -1,
      handler: (_context: unknown, event: Gw2ResolverEvent, details: Gw2ResolverStageDetails[Stage]) =>
        // This contribution captures one stage; its handler supplies that same stage's details.
        effectReactions.dispatch(runtime, ...([stage, event, details] as Gw2ResolverReactionArgs<EffectReactionStage>))
    };
  }

  const actualReactions = createGw2ResolverReactionRegistry({
    contributions: {
      ...contributions,
      // Accepted status applications can arm skill-owned follow-ups under their actual recipient and actor.
      'buff.applied': [...(contributions['buff.applied'] ?? []), effectReactionContribution('buff.applied')],
      // Only accepted combos carry the originating finisher's authored reaction.
      'combo.resolved': [...(contributions['combo.resolved'] ?? []), effectReactionContribution('combo.resolved')],
      'condition.applied': [
        ...(contributions['condition.applied'] ?? []),
        effectReactionContribution('condition.applied')
      ],
      'damage.resolved': [...(contributions['damage.resolved'] ?? []), effectReactionContribution('damage.resolved')],
      'control.resolved': [...(contributions['control.resolved'] ?? []), effectReactionContribution('control.resolved')]
    },
    professionReactions: mapGw2Reactions<MechanicContext<T>, Gw2ResolverRuntime>(
      execution.professionReactions ?? {},
      (_stage, handler) => (_context, event, details) => handler(runtime.mechanics, event, details)
    )
  });
  const reactions: Gw2ResolverReactionRegistry = {
    dispatch(...args) {
      return deliveryOwner.react(actualReactions, ...args);
    }
  };
  // Packet creation and condition-stack expansion share a run budget independent of scheduler iteration limits.
  const expansionBudget = createEffectExpansionBudget();
  const conditions = createGw2ConditionResolution({ config, reactions, expansionBudget });
  // Emission owns transport; profession hooks select payloads and keep their gameplay rules.
  const effects = createEffectEmissionService({
    // Sustained reports need lineage; ordinary score coverage uses only resolved boon durations.
    collectBoonLineage: output === 'detailed' && collectChartData,
    // The retained action supplies one anchor for start, completion, and delayed cast grants.
    castStartedAt: (activationId) => coordinator.castAction(activationId)?.at,
    expansionBudget,
    now: () => runtime.time,
    registerReaction: (profile, effect) => effectReactions.register(profile, effect),
    submit: (event, delivery) => deliveryOwner.submitEffect(event, delivery),
    announce: (request) => deliveryOwner.announceEffect(request)
  });

  // Reporting observers are composed here; resolution never constructs result services.
  const effectRecorder = output === 'detailed' && collectChartData ? new EffectRecorder() : null;
  const damageReport = output === 'detailed' ? createDamageReportRecorder() : null;
  // Phase 3: resolver state and execution owners share one live clock.
  const base = createGw2ResolverRuntimeState({
    engagement: engagementController.query,
    config,
    traits: normalizeSelectedTraitIds(config.selectedTraitIds),
    output,
    ownsEffect,
    effectRecorder,
    boonGeneration: collectBoonCoverage
      ? createBoonGenerationCollector(false, () => ({
          start: runtime.engagement.explicit ? runtime.engagement.startTime : runtime.firstHitTime,
          end: runtime.deathTime ?? runtime.horizon ?? Infinity
        }))
      : null,
    damageRecorder: damageReport?.observer ?? null,
    // Batch explanations retain proc observations without enabling damage breakdowns or chart histories.
    procRecorder: output === 'detailed' || output === 'observations' ? new ProcStepRecorder(effectRecorder) : null,
    damageDiagnostics: output === 'damage' || damageDiagnostics,
    horizon: policy.kind === 'absolute' ? canonicalTime(policy.endTimeMs / 1000) : null,
    query,
    queue: coordinator.packets,
    effects,
    professionState: profession.createState(config),
    helpers: { conditionName: canonicalTargetConditionName, ...profession.catalog },
    conditions,
    random: execution.random
  });
  const clock = {
    get time() {
      return runtime.time;
    }
  };
  const flipController = createSkillFlipController({
    clock,
    scheduleExpiry(skillId, identity, at) {
      enqueueWork(
        makeWork({ type: 'runtime.flip-expiry', at, priority: FLIP_EXPIRY_PRIORITY, payload: { skillId, identity } })
      );
    }
  });
  const maximumAmmoContext = createMaximumAmmoContext(
    () => runtime.profession,
    base.traits,
    profession.catalog,
    flipController.flips
  );
  // The recharge owner keeps its stores private and reads the single live runtime clock.
  const cooldownController = createCooldownController({
    clock,
    // Default work calculation must use the same captured summon owner as projection and reduction.
    rechargeDuration: (skill, at, companionId) =>
      casts.rechargeWorkFor(skill) / cooldownController.rate(skill, at, companionId),
    maximumAmmo: (skill) => profession.maximumAmmo?.(maximumAmmoContext, skill, skill.ammo ?? 0) ?? skill.ammo ?? 0,
    rechargeIntervals: (skill, start, end, companionId) =>
      query.timeline.rechargeIntervals(skill, start, end, companionId),
    skillFor: (id) => profession.catalog.skillsById.get(id)
  });
  const tasks = createRuntimeTaskScheduler({
    tasks: profession.tasks,
    skillsById: profession.catalog.skillsById,
    context: () => runtime.mechanics,
    makeWork,
    enqueueWork,
    cancelOwned: (owner) => coordinator.cancelOwner(owner, deliveryOwner.owner, deliveryOwner.rejectPacket),
    castAction: coordinator.castAction,
    withCause
  });
  // Phase 4: publish one runtime identity and bind capabilities without invoking authored callbacks.
  runtime = Object.assign(base, {
    config,
    alliedStrikeController: createAlliedStrikeController(() => runtime, {
      captureCause: coordinator.currentCause,
      withCause,
      schedule(at, sequence) {
        // A shared clock has no parent; individual grants supply causality when they trigger.
        enqueueWork(makeWork({ type: 'runtime.allied-strike', at, priority: -200, payload: { sequence } }), true);
      }
    }),
    equipmentBuffPolicies: [...sigilBuffPolicies(config), ...base.relic.buffPolicies],
    effectReactions,
    profession: base.profession as T,
    time: 0,
    inputReadyAt: 0,
    engagementController,
    rotationEndTime: null,
    cursor,
    cooldownController,
    // Chain progress survives profession-state replacement and remains local to this execution.
    autoattackController: createAutoattackChainController(profession.catalog),
    history,
    facts: facts.reader,
    observations: facts.writer,
    steps: [],
    inputActions: [],
    ...flipController,
    ...tasks.commands,
    fireTrigger(point: TriggerPoint, input: object = {}) {
      // Payload-free boundaries still give listeners an object; typed callers must supply all other payloads.
      // Listeners settle before the firing mechanic continues; isolated payload runtimes compile none.
      const listeners = profession.triggerListeners.get(point.id);

      // An isolated execution can hold listeners while its setup and assumptions settle.
      if (listeners && execution.admitsTriggers?.() !== false)
        for (const listener of listeners) listener(runtime.mechanics, input);
    }
    // Services bind to this identity immediately below, before any initialization hook can observe it.
  }) as unknown as Gw2Runtime<T>;
  Object.defineProperty(runtime, 'mechanics', { value: createMechanicContext(runtime), enumerable: true });
  Object.defineProperty(runtime, 'mechanicQueries', { value: createMechanicQueryContext(runtime), enumerable: true });
  // Phase 5: all work handlers and cast/delivery owners bind before resource policies can issue host requests.
  internal.register('runtime.allied-strike', (_context, work) => {
    if (work.type === 'runtime.allied-strike') runtime.alliedStrikeController.strike(work.payload.sequence);
  });
  internal.register('runtime.announcement', (_context, work) => {
    if (work.type === 'runtime.announcement')
      deliveryOwner.publishAnnouncement(work.payload.request, assertSimulationEvent(work.payload.event));
  });

  internal.register('runtime.cast-task', (_context, work) => {
    if (work.type === 'runtime.cast-task') tasks.dispatch(work);
  });
  internal.register('runtime.flip-expiry', (_context, work) => {
    if (work.type === 'runtime.flip-expiry') runtime.expireFlip(work.payload.skillId, work.payload.identity);
  });
  internal.register('runtime.task', (_context, work) => {
    if (work.type === 'runtime.task') tasks.dispatch(work);
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

  if (config.encounter) {
    runtime.encounter = createEncounter(config.encounter, (at, generation) =>
      enqueueWork(makeWork({ type: 'runtime.encounter', at, priority: -150, payload: { generation } }), true)
    );
    internal.register('runtime.encounter', (_context, work) => {
      if (work.type !== 'runtime.encounter') return;

      runtime.environmentDamage += runtime.encounter!.wake(runtime.time, work.payload.generation);
      runtime.deathTime = runtime.encounter!.deathTime;
    });
  }

  const deliveryOwner = createEffectDelivery(runtime, profession, execution, conditions, reactions, {
    makeWork,
    enqueueWork,
    identify,
    reactionParent,
    withCause,
    eventOrder: coordinator.eventOrder,
    allocateIdentity: coordinator.allocateIdentity,
    observePacket: casts.observePacket,
    weaponSwap: producers.weaponSwap
  });
  const { executed } = deliveryOwner;

  // Phase 6: install resources, initialize endurance, then initialize ordinary pools in the established order.
  runtime.resourceController = createResourceController({
    clock,
    context: () => runtime.mechanics,
    policies: profession.resources ?? {},
    depletion: createResourceDepletionWake(tasks.commands)
  });
  const vigor = { config, vigorWindows: createVigorWindowReader(history) };
  const endurancePolicy = profession.endurance;
  runtime.endurance = createEnduranceController({
    clock,
    context: () => runtime.mechanics,
    policy: endurancePolicy,
    intervals: (start, end) =>
      vigorEnduranceIntervals(
        vigor,
        start,
        end,
        (hasVigor, at) => endurancePolicy!.regenerationRate(runtime.mechanics, hasVigor, at),
        endurancePolicy?.regenerationBoundaries?.(runtime.mechanics)
      )
  });
  runtime.resourceController.initialize();

  // Phase 7: initial combat boundaries and facts precede profession and execution initialization.
  const targetHealth = Number(config.target?.health) > 0 ? Number(config.target?.health) : Infinity;

  if (!runtime.encounter && targetHealthLoss(config, runtime) >= targetHealth) runtime.deathTime = 0;

  if (combatStartTime != null) {
    const marker = assertSimulationEvent({
      type: 'combat_start',
      at: combatStartTime,
      source: 'Runtime',
      sourceId: 'combat-start',
      actorType: ACTOR.ENVIRONMENT,
      eventOrder: 0
    });
    runtime.relic.setCombatMarker(marker);
    // An inherited marker is also an executed boundary, so timed profession producers see the same start as rotation markers.
    runtime.effects.emit({ kind: 'packet', event: marker });
  }

  if (!markers.length && combatStartTime == null && config.encounter) {
    runtime.effects.emit({
      kind: 'packet',
      event: assertSimulationEvent({
        type: 'combat_start',
        at: 0,
        source: 'Encounter',
        sourceId: 'encounter-start',
        actorType: ACTOR.ENVIRONMENT
      })
    });
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
        actorType: ACTOR.PLAYER
      })
    });
  }

  profession.initialize?.(runtime.mechanics);
  execution.initialize?.(runtime);
  captureEffects();

  /** Hostile rejection never stops self-state or command execution; lethal siblings settle before the combat capture. */
  function dispatch(event: RuntimeQueueEntry): void {
    if (isRuntimeWork(event)) {
      withCause(coordinator.workCause(event) ?? null, () => internal.dispatch(event, runtime), true);
      captureEffects();
      return;
    }

    // Everything the event's handlers and equipment hooks create is a reaction to it.
    withCause(event, () => deliveryOwner.dispatchEvent(event));
    captureEffects();
  }

  // Every accepted transaction dirties chart state, including custom tasks with no buff packet.
  function captureEffects(): void {
    if (!runtime.effectRecorder || (runtime.deathTime != null && runtime.time > runtime.deathTime)) return;

    effectsCapturePending = true;
  }

  // Same-timestamp transactions have no visible duration between them; record only their settled state.
  function flushEffects(): void {
    if (!effectsCapturePending) return;

    effectsCapturePending = false;
    captureRuntimeEffects(runtime, profession);
  }

  const driverContext: RuntimeDriverContext<T> = {
    runtime,
    evaluateReadiness: casts.evaluateReadiness,
    resetCooldowns: casts.resetCooldowns,
    advanceFrontier: (reason) => queue.advanceFrontier(runtime.time, GW2_RESOLVER_PHASE.Ordinary, reason),
    acceptCast: casts.acceptCast,
    acceptBuffCast(skill, command) {
      const strike = queue.peek();

      if (strike?.type !== 'damage' || strike.at !== runtime.time)
        throw new Error('A concurrent grant requires a queued same-time strike.');

      // Earlier completions may already have entered Ordinary. Insert only this grant ahead of the pending strike,
      // retaining the live phase and leaving its completion hooks, conditions, and tasks in ordinary causal order.
      const priority = Number(strike.priority ?? 0) - 1;
      const phase =
        queue.currentTime === runtime.time
          ? Math.max(queue.currentPhase, GW2_RESOLVER_PHASE.Buffs)
          : GW2_RESOLVER_PHASE.Buffs;
      queue.advanceFrontier(runtime.time, phase, 'concurrent buff grant', priority);
      casts.acceptCast(skill, command, priority);
    },
    reject: casts.reject
  };
  // Phase 8: one occurrence policy governs both execution termination and result observation.
  const damageCompletionTime = ownsEffect
    ? createOccurrenceCompletion({
        clock,
        rotationEndTime: () => runtime.rotationEndTime,
        horizon: () => runtime.horizon,
        ownsEffect,
        pendingEffects: () => coordinator.pendingEffects(executed, profession.backgroundTasks),
        pendingAlliedEffects: () => runtime.alliedStrikeController.pendingEffects(),
        resolved: () => runtime.resolved
      })
    : undefined;
  coordinator.run(runtime, execution, policy, driverContext, dispatch, flushEffects, damageCompletionTime);

  if (runtime.rotationEndTime == null) throw new Error('Execution completed without a rotation boundary.');

  const reportingStarted = onPhase ? performance.now() : 0;
  onPhase?.('execution', reportingStarted - started);
  const result = projectRuntimeResult(runtime, profession, execution, {
    output,
    executed,
    scheduledBoons: deliveryOwner.scheduledBoons,
    projectDamageReport: damageReport?.project,
    damageCompletionTime
  });
  onPhase?.('reporting', performance.now() - reportingStarted);
  return result;
}
