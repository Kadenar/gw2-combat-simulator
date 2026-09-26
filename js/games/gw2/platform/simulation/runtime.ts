import { gw2SigilSet } from '#gw2/platform/equipment/sigils/rules.js';
import { ACTION_SAFETY_LIMIT, canonicalTime } from '#kernel/core/clock.js';
import { StableEventQueue } from '#kernel/events/queue.js';
import {
  normalizeObservationPolicy,
  observationEndTime,
  type ObservationPolicy
} from '#kernel/execution/observation.js';
import { normalizeBoonDuration } from '#gw2/platform/combat/boons.js';
import { prepareGw2ComboEvent } from '#gw2/platform/combos/events.js';
import { finisherDescriptors, fieldDescriptors } from '#gw2/platform/combos/descriptors.js';
import { createGw2CombatQuery } from '#gw2/platform/combat/query/combat-query.js';
import { createRuntimeResources, createRuntimeEndurance } from '#gw2/platform/combat/resources/runtime-resources.js';
import { applyRuntimeSigils, consumeRuntimeDoom } from '#gw2/platform/equipment/sigils/runtime.js';
import { createGw2EquipmentReactionContributions } from '#gw2/platform/resolver/equipment-reactions.js';
import { normalizePrecastRelics, relicWeaponSwapRechargeReduction } from '#gw2/platform/equipment/relics/catalog.js';
import { isGw2WeaponSkillEquipped } from '#gw2/platform/equipment/weapons/skill-matcher.js';
import { weaponStrengthProfileIdForEvent } from '#gw2/platform/equipment/weapons/strength.js';
import { createRelicRuntime, invokeRelicHook } from '#gw2/platform/equipment/relics/runtime.js';
import { relicStrikeMultiplier } from '#gw2/platform/equipment/relics/query.js';
import { selectedGw2TraitValues } from '#gw2/platform/combat/state/traits.js';
import { gw2ResolverBoonDuration } from '#gw2/platform/resolver/boons.js';
import { bindRuntimeCombo, produceRuntimeCombos } from '#gw2/platform/combos/runtime.js';
import { permanentComboFieldAssumption } from '#gw2/platform/combos/permanent-field-assumption.js';
import {
  canonicalTargetConditionName,
  isHostileTargetEvent,
  isCombatEntryEvent,
  isPrecombatTargetEffect,
  missesTarget
} from '#gw2/platform/combat/state/targets.js';
import { targetHealthLoss } from '#gw2/platform/combat/state/target-health.js';
import { assertSimulationEvent, type SimulationEventBase } from '#gw2/platform/engine/events/events.js';
import { materializeSkillEffectApplications, scaleCastBoundTiming } from '#gw2/platform/engine/effects/materializer.js';
import { gw2BaseRecharge, gw2RechargeRate } from '#gw2/platform/engine/skills/recharge.js';
import {
  autoattackChainAvailability,
  advanceAutoattackChains,
  resetAutoattackChains
} from '#gw2/platform/skills/autoattack-chain-controller.js';
import { lockTransitionInput } from '#gw2/platform/skills/transition-delays.js';
import { createCastReservations } from '#gw2/platform/execution/cast-lifecycle.js';
import { createCooldownController } from '#gw2/platform/execution/cooldowns.js';
import {
  cancelledBeforeEffectCommit,
  cancelledBeforeInterruptCommit,
  interruptCommitCutoffs
} from '#gw2/platform/execution/effect-adapter.js';
import { normalizeRotation } from '#gw2/platform/execution/rotation.js';
import { RotationCursor } from '#gw2/platform/execution/rotation-cursor.js';
import {
  createGw2ConditionResolution,
  finalizeConditionApplications
} from '#gw2/platform/resolver/condition-resolution.js';
import { GW2_RESOLVER_PHASE, gw2ResolverPhase } from '#gw2/platform/resolver/event-loop.js';
import { createGw2ResolverEventHandlers } from '#gw2/platform/resolver/event-handlers.js';
import { HandlerRegistry } from '#gw2/platform/resolver/handler-registry.js';
import { createGw2HitResolution } from '#gw2/platform/resolver/hit-resolution.js';
import { createGw2ResolverReactionRegistry } from '#gw2/platform/resolver/reaction-registry.js';
import { createGw2ResolverRuntimeState } from '#gw2/platform/resolver/runtime-state.js';
import { buildSimulationScore, buildCombatResult } from '#gw2/platform/results/build-result.js';
import { planningState } from '#gw2/platform/results/end-state.js';
import { rotationApm } from '#gw2/platform/results/rotation-apm.js';
import { flattenProfessionState } from '#gw2/platform/engine/profession/state.js';
import { createCriticalSigilDiagnostics } from '#gw2/platform/equipment/sigils/diagnostics.js';
import type { Gw2SimulationOptions } from '#gw2/platform/simulation/types.js';
import {
  castWasInterrupted,
  gw2CooldownReadyAt,
  retainsInterruptedCastLockout,
  summonQuicknessCastTimeMs
} from '#gw2/platform/skills/timing.js';
import { createInternalWorkFactory } from '#gw2/platform/simulation/internal-work.js';
import type {
  Gw2ResolverEvent,
  Gw2ResolverReactions,
  Gw2ResolverReactionRegistry
} from '#gw2/platform/resolver/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type {
  Gw2Runtime,
  RuntimeCast,
  RuntimeProfession,
  RuntimeWork
} from '#gw2/platform/simulation/runtime-state.js';
import type { CastCommand } from '#gw2/platform/execution/types.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type { Gw2EventDraft } from '#gw2/platform/equipment/relics/types.js';

/** One cursor, queue, profession instance and RNG own gameplay in both reporting modes. */
export function runGw2Runtime<T extends object>({
  profession,
  config = {},
  rotation = [],
  observation,
  combatStartTime,
  output = 'detailed',
  damageDiagnostics = false,
  onPhase
}: {
  profession: RuntimeProfession<T>;
  config?: Gw2Config;
  rotation?: readonly unknown[];
  observation?: ObservationPolicy;
  combatStartTime?: number;
  output?: 'detailed' | 'score';
  damageDiagnostics?: boolean;
  onPhase?: Gw2SimulationOptions['onPhase'];
}) {
  const started = onPhase ? performance.now() : 0;
  const sigilDiagnostics = damageDiagnostics && output === 'detailed' ? createCriticalSigilDiagnostics() : undefined;
  const policy = normalizeObservationPolicy(observation);
  const cursor = new RotationCursor(normalizeRotation(rotation, profession.catalog, { strict: true }));
  const markers = cursor.commands.filter((command) => command.type === 'combat-start');
  if (markers.length > 1 || (markers.length && combatStartTime != null))
    throw new TypeError('Combat Start must have one owner.');
  if (combatStartTime != null && (!Number.isFinite(combatStartTime) || combatStartTime < 0))
    throw new RangeError('Combat Start must be finite and non-negative.');
  const explicitCombat = markers.length > 0 || combatStartTime != null;
  const history: Gw2ResolverEvent[] = [];
  const queue = new StableEventQueue<Gw2ResolverEvent>([], { phaseFor: gw2ResolverPhase });
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
  let lethalActivation: string | undefined;
  let combatState: ReturnType<typeof snapshot> | undefined;
  const executed: Gw2ResolverEvent[] = [];
  const preparedCombos = new WeakSet<Gw2ResolverEvent>();

  // Bind hooks to the same context used by commands. No hook receives a predicted or restored state.
  const contributions = createGw2EquipmentReactionContributions();
  const actualReactions = createGw2ResolverReactionRegistry({
    contributions: {
      ...contributions,
      'damage.resolved': [
        ...(contributions['damage.resolved'] ?? []),
        {
          id: 'sigil.actual-strike',
          order: -300,
          handler(_context, event) {
            consumeRuntimeDoom(runtime, event);
            applyRuntimeSigils(runtime, 'strike', event);
          }
        }
      ],
      'control.resolved': [
        ...(contributions['control.resolved'] ?? []),
        {
          id: 'sigil.actual-control',
          order: -300,
          handler(_context, event) {
            applyRuntimeSigils(runtime, 'control', event);
          }
        }
      ]
    },
    professionReactions: Object.fromEntries(
      Object.entries(profession.reactions ?? {}).map(([stage, handler]) => [
        stage,
        (_context, event, details) => {
          return handler(runtime, event, details ?? {});
        }
      ])
    ) as Gw2ResolverReactions
  });
  const reactions: Gw2ResolverReactionRegistry = {
    dispatch(stage, context, event, details) {
      // One gate protects both profession and equipment grants after the lethal packet has committed.
      if (runtime.deathTime != null && (isHostileTargetEvent(event) || event.comboId != null)) return;
      return actualReactions.dispatch(stage, context, event, details);
    }
  };
  const conditions = createGw2ConditionResolution({ config, reactions });
  const base = createGw2ResolverRuntimeState({
    config,
    traits: selectedGw2TraitValues(config, profession.catalog),
    reporting: output === 'detailed',
    damageDiagnostics,
    sigilDiagnostics,
    horizon: policy.kind === 'absolute' ? canonicalTime(policy.endTimeMs / 1000) : null,
    query,
    queue,
    professionState: profession.createState(config),
    helpers: { conditionName: canonicalTargetConditionName, ...profession.catalog },
    applyCondition: conditions.applyCondition,
    onFirstDamage: conditions.startDamageClock,
    reactions
  });
  const clocks = { time: 0, cooldowns: new Map(), rechargeProgress: new Map(), ammo: new Map() };
  // Controller closures follow the one runtime clock; the initializer object is not retained as separate state.
  const cooldownController = createCooldownController({
    state: Object.assign(base, clocks),
    rechargeDuration: (skill) => rechargeWorkFor(skill) / cooldownController.rate(skill),
    maximumAmmo: (skill) =>
      profession.maximumAmmo?.(runtime, skill, Number(skill.ammo ?? 0)) ?? Number(skill.ammo ?? 0),
    rate: (skill) => gw2RechargeRate(config, skill),
    skillFor: (id) => profession.catalog.skillsById.get(id)
  });
  runtime = Object.assign(base, {
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
    applyCondition(event: Gw2EventDraft) {
      // Immediate derived applications obey the same live clock and target gates as queued applications.
      if (canonicalTime(Number(event.at)) !== runtime.time)
        throw new RangeError('Immediate conditions must apply at the live clock.');
      if (
        ('offTarget' in event && event.offTarget === true) ||
        runtime.deathTime != null ||
        runtime.combatStartPending ||
        (runtime.combatStartTime != null && runtime.time < runtime.combatStartTime)
      )
        return null;
      return conditions.applyCondition(runtime, event);
    },
    emitDerived(cause: Gw2ResolverEvent, event: SimulationEventBase) {
      return runtime.emit({
        // Causality orders a proc beside its trigger; its independent activation owns a separate weapon-strength roll.
        activationId:
          event.type === 'damage' && (event.sourceId !== cause.sourceId || event.actorType !== cause.actorType)
            ? `effect:derived:${eventOrder + 1}`
            : cause.activationId,
        causalOrder: cause.causalOrder ?? cause.eventOrder,
        parentEventOrder: cause.eventOrder,
        ...event
      });
    },
    emit(event: SimulationEventBase) {
      const prepared = profession.prepareEvent ? profession.prepareEvent(runtime, event) : event;
      event = prepareGw2ComboEvent(prepared ?? event);
      if (event.kind === 'internal') throw new TypeError('Internal work must use the work factory.');
      const order = ++eventOrder;
      // An equipped-weapon strike scales from the weapon wielded when it is emitted, so a delayed packet cannot
      // observe a later swap and the resolver never falls back to the skill's nonweapon profile.
      const equippedProfileId =
        event.weaponStrengthSource === 'equipped' &&
        event.weaponStrengthProfileId == null &&
        event.weaponStrength == null
          ? weaponStrengthProfileIdForEvent(event, {
              skill: profession.catalog.skillsById.get(event.skillId ?? event.sourceId) ?? null,
              state: runtime as unknown as Record<string, unknown>,
              config
            })
          : null;
      const packet = normalizeBoonDuration(
        assertSimulationEvent({
          ...event,
          ...(equippedProfileId ? { weaponStrengthProfileId: equippedProfileId } : {}),
          at: canonicalTime(event.at),
          eventOrder: order,
          causalOrder: event.causalOrder ?? queue.currentCausalOrder ?? order
        })
      );
      if (packet.at < runtime.time) throw new RangeError('Events cannot backdate the live clock.');
      if (!handlers.has(packet.type)) throw new TypeError(`No event handler registered for ${packet.type}.`);
      // Retain only the earliest owned packet boundary for cast commitment; target acceptance does not control chain progression.
      const cast = packet.activationId == null ? undefined : reservations.get(packet.activationId);
      if (cast && packet.type === 'damage' && packet.actorType === 'player' && packet.skillId === cast.skill.id)
        cast.firstStrikeAt = Math.min(cast.firstStrikeAt, packet.at);
      // Deferred actor actions retain their causal identity without publishing a future activation that may be canceled.
      return prepared === null ? packet : queue.enqueue(packet);
    },
    schedule(name: string, at: number, data: unknown = null, owner?: { id: string; generation: number }, priority = 0) {
      if (!profession.tasks?.[name]) throw new TypeError(`No task handler registered for ${name}.`);
      return enqueueWork(makeWork({ type: 'runtime.task', at, priority, payload: { name, data }, owner })).id;
    },
    cancelOwner(owner: { id: string; generation: number }) {
      queue.cancelWhere(
        (event) =>
          event.kind === 'internal' &&
          (event.owner as RuntimeWork['owner'])?.id === owner.id &&
          (event.owner as RuntimeWork['owner'])?.generation === owner.generation
      );
    }
    // Services bind to this identity immediately below, before any initialization hook can observe it.
  }) as unknown as Gw2Runtime<T>;
  const handlers = new HandlerRegistry<Gw2Runtime<T>, Gw2ResolverEvent>()
    .registerAll(
      createGw2ResolverEventHandlers({
        hitResolution: createGw2HitResolution({ strikeMultiplier: relicStrikeMultiplier }),
        conditions,
        reactions
      })
    )
    .registerAll({
      'relic.activate'(context, event) {
        // Delayed relic activations own their state only when this queue packet executes.
        for (const relic of [context.relic, ...(context.precastRelics ?? [])])
          if (relic?.name === event.sourceId) relic.rules.activate?.(context, relic.state, event);
      }
    })
    .registerAll(profession.eventHandlers ?? {});

  /** Internal packets share queue ordering but cannot become public history or report rows. */
  function enqueueWork(work: RuntimeWork): RuntimeWork {
    if (work.at < runtime.time) throw new RangeError('Internal work cannot backdate the live clock.');
    queue.enqueue({ ...work, source: 'Runtime', sourceId: work.type, actorType: 'effect' });
    return work;
  }

  internal.register('runtime.effect', (_context, work) => {
    if (work.type !== 'runtime.effect') return;
    const event = assertSimulationEvent(work.payload.event);
    // Duration snapshots belong to application time, after earlier same-time state changes.
    runtime.emit({
      ...event,
      duration: gw2ResolverBoonDuration(runtime, event, String(event.kind), Number(event.duration ?? 0))
    });
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
    const cancelled = cancelledBeforeInterruptCommit(cast.skill, cast.start, cast.fullEnd, cast.effectiveEnd);
    // Ordinary swaps commit one actual set transition before completion hooks and queued equipment reactions.
    if (cast.skill.inputCategory === 'weapon-swap' && !castWasInterrupted(cast)) {
      runtime.activeWeaponSet = runtime.activeWeaponSet === 1 ? 2 : 1;
      resetAutoattackChains(runtime);
      runtime.emit({
        type: 'weapon_set',
        at: runtime.time,
        source: profession.id,
        sourceId: cast.skill.id,
        actorType: 'player',
        skillId: cast.skill.id,
        skillName: cast.skill.name,
        activationId: cast.id,
        weaponSet: runtime.activeWeaponSet
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
    profession.onCastComplete?.(runtime, cast);
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
      cancelled: cancelledBeforeInterruptCommit(cast.skill, cast.start, cast.fullEnd, cast.effectiveEnd),
      // Preparation relics follow authored command order even when hostile eligibility includes the marker timestamp.
      precombat:
        runtime.combatStartPending ||
        cursor.command?.type === 'combat-start' ||
        (runtime.combatStartTime != null && runtime.time < runtime.combatStartTime)
    });
    for (const relic of [runtime.relic, ...(runtime.precastRelics ?? [])])
      relic?.rules.completed?.(runtime, relic.state, completion);
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
    .filter((name) => name !== runtime.relic.name)
    .map(createRelicRuntime);
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
    runtime.emit(marker);
  }

  conditions.initializeEnvironment(runtime);
  // A configured permanent field is an initial executed fact, available to the first eligible finisher.
  const assumedField = permanentComboFieldAssumption(config, profession.id, runtime.time);
  if (assumedField) runtime.emit(assumedField);
  profession.initialize?.(runtime);

  /** Capture only detached authoring data, never a context containing mutable queues or closures. */
  function snapshot() {
    return structuredClone({
      atSeconds: runtime.time,
      profession: flattenProfessionState(runtime.profession)
    });
  }

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
        : Number(skill.castTimeMs ?? 0);
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
      (skill.rechargeAnchor === 'castStart' ? start : effectiveEnd) + Number(skill.rechargeOffsetMs ?? 0) / 1000;
    const rechargeStart =
      profession.rechargeStart?.(runtime, { skill, start, fullEnd, effectiveEnd }, canonicalRechargeStart) ??
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
      ammo
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
    const action = runtime.emit({
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
    });
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
    profession.onCastStart?.(runtime, cast);
    // Custom skill owners select their packets once; scheduled effects still apply through the common live queue.
    for (const effect of profession.modifyEffects?.(runtime, cast, skill.effects ?? []) ?? skill.effects ?? []) {
      const perPacket = skill.interruptMode === 'per-packet';
      if (interrupted && !perPacket && cancelledBeforeEffectCommit(skill, effect, start, fullEnd, effectiveEnd))
        continue;
      for (const application of materializeSkillEffectApplications({
        skill,
        effect: scaleCastBoundTiming(cast, skill, effect),
        start,
        fullEnd,
        baseEvent: {
          ...attribution,
          source: effect.source || profession.id,
          sourceId: effect.sourceId ?? skill.id,
          actorType: effect.actorType || 'player',
          // Derived effects retain the declared gameplay owner independently of their display actor.
          ...(effect.ownerActorType ? { ownerActorType: effect.ownerActorType } : {})
        },
        skillWeaponFallback: ['Heal', 'Utility', 'Elite'].includes(skill.type ?? '') ? 'Unequipped' : ''
      })) {
        // Compare on the same clock as the reservation; raw addition can place an equal-time impact just beyond it.
        if (
          interrupted &&
          (perPacket || !effect.persistsAfterInterrupt) &&
          canonicalTime(application.at) > effectiveEnd
        )
          continue;
        const event = application.event;
        const packet = {
          ...event,
          at: event.at + (isHostileTargetEvent(event) ? Number(command.impactDelayMs ?? 0) / 1000 : 0),
          offTarget: command.offTarget
        };
        if (event.type === 'buff' && effect.fixedDuration !== true)
          enqueueWork(
            makeWork({
              type: 'runtime.effect',
              at: packet.at,
              priority: 0,
              payload: { event: packet },
              activationId: cast.id,
              causalOrder: action.eventOrder
            })
          );
        else runtime.emit(packet);
      }
    }
  }

  /** Hostile rejection never stops self-state or command execution; lethal siblings settle before the combat capture. */
  function dispatch(event: Gw2ResolverEvent): void {
    if (event.kind === 'internal') {
      internal.dispatch(event as unknown as RuntimeWork, runtime);
      return;
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
      sigilDiagnostics?.suppress(
        event,
        missesTarget(event) ? 'miss' : 'precombat',
        gw2SigilSet(config, runtime.activeWeaponSet).names ?? []
      );
      // A missed impact can still finish a field and grant self effects; hostile combo outcomes retain its miss.
      if (runtime.deathTime == null && !preparedCombos.has(event))
        produceRuntimeCombos(runtime, profession.catalog, event);
      return;
    }

    if (runtime.deathTime != null && hostile) {
      const lethalSibling =
        event.type === 'damage' && lethalActivation != null && event.activationId === lethalActivation;
      if (event.at !== runtime.deathTime || (!lethalSibling && event.type !== 'condition_tick')) {
        sigilDiagnostics?.suppress(event, 'target-death', gw2SigilSet(config, runtime.activeWeaponSet).names ?? []);
        return;
      }
    }

    // Precombat control notifications remain observable without starting combat producers before the marker.
    if (!runtime.combatActive && !precombat && isCombatEntryEvent(event)) {
      runtime.combatActive = true;
      // Timed profession producers anchor once to the accepted combat-start boundary.
      profession.onCombatStart?.(runtime);
    }

    event = bindRuntimeCombo(runtime, event);
    handlers.dispatch(event, runtime);
    // Shared relic descriptors react to actual events and queue their effects on this clock.
    if (event.type === 'action' && !event.cancelled)
      invokeRelicHook(
        runtime,
        'emitActionEffects',
        event,
        profession.catalog.skillsById.get(event.skillId ?? event.sourceId)
      );
    if (event.type === 'action') invokeRelicHook(runtime, 'action', event);
    if (event.type === 'combat_start')
      for (const relic of [runtime.relic, ...(runtime.precastRelics ?? [])]) relic.state.combatMarker = event;
    if (event.type === 'condition' && runtime.relic.name === 'Shackles')
      invokeRelicHook(runtime, 'emitConditionEffects', event);
    // Proc rows keep recharge reductions for timeline badges and timed procs keep their deadline.
    if (event.type === 'proc')
      runtime.recordProc(
        String(event.procType ?? 'skill'),
        String(event.name ?? ''),
        event.at,
        event.sourceSkill,
        event.detail,
        event.icon,
        event.cooldownReduction,
        Number(event.duration) > 0 ? event.at + Number(event.duration) : null
      );
    if (event.type === 'weapon_set' || event.type === 'sigil_swap') applyRuntimeSigils(runtime, 'swap', event);
    if (['action', 'cooldown_snapshot', 'weapon_set', 'buff', 'boon_extension', 'marker'].includes(event.type))
      history.push(event);
    if (!preparedCombos.has(event)) produceRuntimeCombos(runtime, profession.catalog, event);
    if (runtime.reporting && !['condition_buffer', 'condition_tick'].includes(event.type)) executed.push(event);
    if (runtime.deathTime == null && targetHealthLoss(config, runtime) >= targetHealth) {
      runtime.deathTime = event.at;
      lethalActivation = event.activationId;
    }
  }

  // Each iteration either dispatches work, consumes one command, or advances to an actual boundary.
  let finished = false;
  for (let iteration = 0; iteration < ACTION_SAFETY_LIMIT; iteration++) {
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

    if (runtime.deathTime != null && !combatState && runtime.reporting) combatState = snapshot();
    const command = cursor.command;
    let nextCommandAt = Infinity;
    if (command) {
      // Reevaluate transformed actions after every actual boundary, before accepting their reservation.
      const skill =
        command.type === 'cast'
          ? profession.catalog.skillsById.get(profession.modifySkillId?.(runtime, command.skillId) ?? command.skillId)
          : undefined;
      // A forbidden overlap is permanently invalid, so it cannot reserve a lane or wait for cooldown readiness.
      if (command.type === 'cast' && command.concurrentOffsetMs != null && skill?.canCastConcurrently === false) {
        queue.advanceFrontier(runtime.time, GW2_RESOLVER_PHASE.Ordinary, 'command rejection');
        reject(`${skill.name} cannot be cast concurrently.`);
        continue;
      }

      const requested = cursor.requestAt(runtime.time, skill);
      if (requested < runtime.time || (command.type === 'cast' && !skill)) {
        queue.advanceFrontier(runtime.time, GW2_RESOLVER_PHASE.Ordinary, 'command rejection');
        reject(skill ? 'Concurrent command cannot backdate the clock.' : 'Unknown skill.');
        continue;
      }

      nextCommandAt = Math.max(
        requested,
        command.type === 'cast' ? runtime.inputReadyAt : 0,
        skill && !skill.independentCast && Number(skill.castTimeMs) > 0 && !skill.stunbreak ? cursor.selfStunUntil : 0
      );
      if (nextCommandAt <= runtime.time) {
        queue.advanceFrontier(runtime.time, GW2_RESOLVER_PHASE.Ordinary, 'command');
        if (command.type === 'wait') {
          const end = canonicalTime(runtime.time + command.durationMs / 1000);
          // Every authored command retains its timeline row, including waits and environment controls.
          if (runtime.reporting)
            runtime.steps.push({
              ri: cursor.index,
              skill: 'Wait',
              start: Math.round(runtime.time * 1000),
              end: Math.round(end * 1000)
            });
          cursor.acceptWait(end);
          continue;
        }

        if (command.type === 'combat-start') {
          if (runtime.reporting)
            runtime.steps.push({
              ri: cursor.index,
              skill: 'Combat Start',
              start: Math.round(runtime.time * 1000),
              end: Math.round(runtime.time * 1000)
            });
          runtime.combatStartPending = false;
          runtime.combatStartTime = runtime.time;
          runtime.emit({
            type: 'combat_start',
            at: runtime.time,
            source: 'Runtime',
            sourceId: 'combat-start',
            actorType: 'environment'
          });
          cursor.consume();
          continue;
        }

        if (command.type === 'cooldown-reset') {
          if (runtime.reporting)
            runtime.steps.push({
              ri: cursor.index,
              skill: 'Cooldown Reset',
              start: Math.round(runtime.time * 1000),
              end: Math.round(runtime.time * 1000)
            });
          runtime.cooldowns.clear();
          runtime.rechargeProgress.clear();
          runtime.ammo.clear();
          runtime.lockouts.clear();
          profession.onCooldownReset?.(runtime);
          // Publish the accepted reset after its resource and recharge transitions.
          runtime.emit({
            type: 'marker',
            at: runtime.time,
            source: 'platform',
            sourceId: 'cooldown-reset',
            actorType: 'environment',
            action: 'cooldown-reset',
            name: 'Cooldown Reset'
          });
          cursor.consume();
          continue;
        }

        if (!skill) throw new Error('Cast has no skill.');
        if (
          !isGw2WeaponSkillEquipped(
            { config, weaponSet: runtime.activeWeaponSet, state: runtime, catalog: profession.catalog },
            skill,
            profession.weaponSkillMatchesSet
          )
        ) {
          reject(`${skill.name} is unavailable — its required weapon is not equipped.`);
          continue;
        }

        // A wrong chain command is invalid now; waiting for recharge must not let its flip expire into validity.
        const chainAvailability = autoattackChainAvailability(runtime, profession.catalog, skill);
        if (!chainAvailability.ready) {
          reject(chainAvailability.reason);
          continue;
        }

        cooldownController.refresh(runtime.time);
        const ammo = cooldownController.refreshAmmo(skill, runtime.time);
        nextCommandAt = Math.max(
          runtime.time,
          skill.usableWhileRecharging && !(ammo && ammo.charges <= 0)
            ? 0
            : gw2CooldownReadyAt(runtime.cooldowns.get(skill.id) ?? 0),
          ...[...(skill.independentCastCanOverlap ? [] : (runtime.inFlight.get(skill.id) ?? []))].map(
            (id) => reservations.get(id)!.effectiveEnd
          ),
          ...(skill.lockouts ?? []).map((lockout) => runtime.lockouts.get(lockout.group) ?? 0)
        );
        // Cooldown, lane, and lockout waits settle first: intervening actual hits may change resource or form legality.
        if (nextCommandAt <= runtime.time) {
          const availability = profession.availability?.(runtime, skill, command) ?? { ready: true };
          if (!availability.ready && availability.retryAt == null) {
            reject(availability.reason);
            continue;
          }

          if (!availability.ready) {
            if (!Number.isFinite(availability.retryAt) || canonicalTime(availability.retryAt) <= runtime.time) {
              reject(`${availability.reason} (no future retry boundary).`);
              continue;
            }

            nextCommandAt = canonicalTime(availability.retryAt);
          } else {
            acceptCast(skill, command);
            continue;
          }
        }
      }
    } else if (runtime.rotationEndTime == null) {
      nextCommandAt = Math.max(cursor.endTime(), runtime.inputReadyAt);
      if (nextCommandAt <= runtime.time) {
        runtime.rotationEndTime = runtime.time;
        runtime.horizon = canonicalTime(observationEndTime(policy, runtime.time));
        nextCommandAt = Infinity;
      }
    }

    if (runtime.horizon != null && runtime.time >= runtime.horizon) {
      if (runtime.rotationEndTime == null)
        throw new RangeError('Absolute observation endTimeMs cannot precede rotation end.');
      finished = true;
      break;
    }

    const next = Math.min(nextCommandAt, queue.peek()?.at ?? Infinity, runtime.horizon ?? Infinity);
    if (!Number.isFinite(next) || next <= runtime.time) throw new Error('Live runtime has no advancing boundary.');
    runtime.time = canonicalTime(next);
    runtime.resourceController.advance();
    runtime.endurance.advance();
    cooldownController.refresh(runtime.time);
  }

  if (!finished || runtime.rotationEndTime == null) throw new Error('Live runtime exceeded its action safety limit.');
  // Pending impacts beyond the horizon receive a diagnostic reason without executing or sampling them.
  if (sigilDiagnostics) {
    const names = gw2SigilSet(config, runtime.activeWeaponSet).names ?? [];
    while (queue.peek()) {
      const pending = queue.dequeue()!;
      if (pending.kind !== 'internal') sigilDiagnostics.suppress(pending, 'observation-end', names);
    }
  }

  const reportingStarted = onPhase ? performance.now() : 0;
  onPhase?.('execution', reportingStarted - started);
  finalizeConditionApplications(runtime, runtime.deathTime ?? runtime.horizon!);
  const score = buildSimulationScore(runtime, runtime.rotationEndTime, explicitCombat);
  if (output === 'score') {
    onPhase?.('reporting', performance.now() - reportingStarted);
    return score;
  }

  invokeRelicHook(runtime, 'passiveTimeline', score.combatEndTime);
  const result = {
    ...buildCombatResult(runtime, score, executed, combatState ?? snapshot()),
    output: 'detailed' as const,
    steps: runtime.steps,
    rotationApm: rotationApm(
      {
        steps: runtime.steps,
        events: executed,
        rotationEndTime: runtime.rotationEndTime,
        combatStartTime: explicitCombat ? (runtime.combatStartTime ?? null) : null
      },
      rotation,
      profession.catalog
    ),
    ...(sigilDiagnostics ? { criticalSigilDiagnostics: sigilDiagnostics.results() } : {}),
    planningState: planningState(
      { ...runtime, catalog: profession.catalog },
      profession.projectPlanningState,
      profession.endurance?.maximum(runtime)
    )
  };
  onPhase?.('reporting', performance.now() - reportingStarted);
  return result;
}
