import { skillForEvent } from '#gw2/platform/combat/query/runtime-query.js';
import { isStandardBoon, normalizeBoonDuration } from '#gw2/platform/combat/boons.js';
import { targetHealthLoss } from '#gw2/platform/combat/state/target-health.js';
import {
  isCombatEntryEvent,
  isHostileTargetEvent,
  isPrecombatTargetEffect,
  missesTarget
} from '#gw2/platform/combat/state/targets.js';
import { fieldDescriptors, finisherDescriptors } from '#gw2/platform/combos/descriptors.js';
import { prepareGw2ComboEvent } from '#gw2/platform/combos/validation.js';
import { bindRuntimeCombo, produceRuntimeCombos } from '#gw2/platform/combos/runtime.js';
import { type AnnouncementEmission, type EffectDelivery } from '#gw2/platform/effects/emission.js';
import { relicStrikeMultiplier } from '#gw2/platform/equipment/relics/query.js';
import { weaponStrengthProfileIdForEvent } from '#gw2/platform/resolver/weapon-strength-resolution.js';
import { assertSimulationEvent, type SimulationEventBase } from '#gw2/platform/events/events.js';
import type { PacketIdentity } from '#gw2/platform/events/identity.js';
import {
  createEffectOwnershipContext,
  createSelectedContentContext
} from '#gw2/platform/profession-definition/runtime-context.js';
import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';
import { gw2ResolverBoonDuration } from '#gw2/platform/resolver/boon-duration.js';
import type { Gw2ConditionResolution } from '#gw2/platform/resolver/condition-resolution.js';
import { createGw2ResolverEventHandlers } from '#gw2/platform/resolver/event-handlers.js';
import { HandlerRegistry, OBSERVABLE_EVENT_HANDLER } from '#gw2/platform/resolver/handler-registry.js';
import { createGw2HitResolution } from '#gw2/platform/resolver/hit-resolution.js';
import type { Gw2ResolverEvent, Gw2ResolverReactionRegistry } from '#gw2/platform/resolver/types.js';
import { recordProcStep } from '#gw2/platform/results/proc-steps.js';
import type { RuntimeExecution } from '#gw2/platform/simulation/run-contract.js';
import type { Gw2Runtime } from '#gw2/platform/simulation/runtime-state.js';
import type { RuntimeWork, WorkInput } from '#gw2/platform/simulation/work-contract.js';
import { canonicalTime } from '#kernel/core/clock.js';

/** Derived copies cannot reuse the parent's declaration, including after serialization or deferral. */
function withoutInheritedReaction(event: SimulationEventBase, cause?: EffectDelivery['cause']): SimulationEventBase {
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

interface DeliveryHost {
  readonly makeWork: (input: WorkInput<RuntimeWork>) => RuntimeWork;
  enqueueWork(work: RuntimeWork): void;
  identify<E extends PacketIdentity>(event: E): E;
  reactionParent(event: PacketIdentity): number | undefined;
  eventOrder(): number;
  nextEventOrder(): number;
  withCause<R>(cause: Gw2ResolverEvent | null, run: () => R): R;
  observePacket(event: Gw2ResolverEvent): void;
  weaponSwap?(event: Gw2ResolverEvent): void;
}
/** Admission and resolution share packet metadata, preparation timing, and lethal-target settlement. */
export function createEffectDelivery<T extends object>(
  runtime: Gw2Runtime<T>,
  profession: RuntimeProfession<T>,
  execution: RuntimeExecution<T>,
  conditions: Readonly<Gw2ConditionResolution>,
  reactions: Gw2ResolverReactionRegistry,
  host: DeliveryHost
) {
  const { config, queue } = runtime;
  const ownershipContext = createEffectOwnershipContext(profession.catalog);
  // Duration policy is sampled at application through selected-content queries, never a mutable resolver context.
  const boonDurationContext = createSelectedContentContext(runtime.traits, profession.catalog);
  const { makeWork, enqueueWork, identify, reactionParent, withCause } = host;
  const targetHealth = Number(config.target?.health) > 0 ? Number(config.target?.health) : Infinity;
  const executed: Gw2ResolverEvent[] = [];
  const preparedCombos = new WeakSet<Gw2ResolverEvent>();
  const packetDelivery = new WeakMap<Gw2ResolverEvent, EffectDelivery>();
  const pendingPreparation = new WeakSet<Gw2ResolverEvent>();
  let announcementOrder = 0;
  let derivedActivationOrder = 0;
  let lethalActivation: string | undefined;
  const handlers = new HandlerRegistry<Gw2Runtime<T>, Gw2ResolverEvent>()
    .registerAll(
      createGw2ResolverEventHandlers({
        hitResolution: createGw2HitResolution({ strikeMultiplier: relicStrikeMultiplier }),
        conditions: { ...conditions, applyCondition: (_context, event) => applyConditionNow(event) },
        reactions
      })
    )
    .registerAll({
      action_update(context, update) {
        // Gameplay history owns lifecycle updates in every output mode; reporting only observes the same fact.
        context.observations.updateAction(update.activationId, {
          endsAt: update.endsAt,
          interrupted: update.interrupted
        });
      },
      'relic.activate'(context, event) {
        // Delayed relic activations own their state only when this queue packet executes.
        for (const relic of [context.relic, ...(context.precastRelics ?? [])])
          if (relic.id === event.sourceId) relic.rules.activate?.(context, relic.state, event);
      }
    })
    .registerAll(
      Object.fromEntries(
        Object.entries(profession.eventHandlers ?? {}).map(([type, handler]) => [
          type,
          // Preserve marker identity while binding stateful handlers to the same per-run author capability.
          handler === OBSERVABLE_EVENT_HANDLER
            ? OBSERVABLE_EVENT_HANDLER
            : (_context: Gw2Runtime<T>, event: Gw2ResolverEvent) => handler(runtime.mechanics, event)
        ])
      )
    );

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
      // Committed actor lifetimes explicitly use Infinity to allow their independent follow-up work.
      delivery.cast.effectiveEnd !== Infinity &&
      canonicalTime(event.at) > canonicalTime(delivery.cast.effectiveEnd) &&
      event.persistsAfterInterrupt !== true;
    if (cause)
      event = {
        activationId:
          event.type === 'damage' && (event.sourceId !== cause.sourceId || event.actorType !== cause.actorType)
            ? `effect:derived:${++derivedActivationOrder}`
            : cause.activationId,
        // Authored fields, including explicit undefined, retain precedence over inherited identity.
        causalOrder: cause.causalOrder ?? cause.eventOrder,
        parentEventOrder: cause.eventOrder,
        ...event
      };
    if (delivery.priority != null) event = { ...event, priority: delivery.priority };
    // Future boons and owned packets reserve identity now, then prepare from live application state.
    const owner = delivery.owner ?? profession.effectOwner?.(ownershipContext, event);
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
          ? profession.prepareEvent(runtime.mechanics, event)
          : event;
    event = prepareGw2ComboEvent(prepared ?? event);
    if (event.kind === 'internal') throw new TypeError('Internal work must use the work factory.');
    const order = host.nextEventOrder();
    const parent = reactionParent(event);
    const equippedProfileId =
      !cancelledByCast &&
      !deferPreparation &&
      event.weaponStrengthSource === 'equipped' &&
      event.weaponStrengthProfileId == null &&
      event.weaponStrength == null
        ? weaponStrengthProfileIdForEvent(event, {
            skill: skillForEvent(profession.catalog, event) ?? null,
            activeWeaponSet: runtime.activeWeaponSet,
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
    if (!cancelledByCast && prepared !== null) host.observePacket(packet);
    if (prepared !== null && !cancelledByCast) {
      packetDelivery.set(packet, delivery);
      if (deferPreparation) pendingPreparation.add(packet);
      if (delivery.settlement === 'reaction') {
        // A reaction transaction exposes its accepted application before the caller's next query, while its queued children remain pending.
        if (!['condition', 'buff', 'boon_extension'].includes(packet.type) || packet.at !== runtime.time)
          throw new RangeError('Reaction settlement requires a condition, buff, or boon extension at the live clock.');
        withCause(packet, () => {
          if (packet.type === 'condition') applyConditionNow(packet);
          // Buffs and extensions settle immediately through the shared path so history records each application once.
          else dispatchEvent(packet);
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
      causalOrder: request.cause?.causalOrder ?? queue.currentCausalOrder ?? host.eventOrder(),
      ...((request.cause?.eventOrder ?? reactionParent({ type: 'proc', ...request.attribution })) != null
        ? { parentEventOrder: request.cause?.eventOrder ?? reactionParent({ type: 'proc', ...request.attribution }) }
        : {})
    });
    const cancelled =
      request.cast?.effectiveEnd != null &&
      request.cast.effectiveEnd !== Infinity &&
      canonicalTime(at) > canonicalTime(request.cast.effectiveEnd);
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

  function dispatchEvent(event: Gw2ResolverEvent): void {
    if (pendingPreparation.has(event)) {
      pendingPreparation.delete(event);
      const reserved = event;
      const prepared = profession.prepareEvent ? profession.prepareEvent(runtime.mechanics, event) : event;
      if (prepared === null) return;
      const equippedProfileId =
        prepared.weaponStrengthSource === 'equipped' &&
        prepared.weaponStrengthProfileId == null &&
        prepared.weaponStrength == null
          ? weaponStrengthProfileIdForEvent(prepared, {
              skill: skillForEvent(profession.catalog, prepared) ?? null,
              activeWeaponSet: runtime.activeWeaponSet,
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
            : (profession.boonDuration?.(boonDurationContext, event, baseDuration, scaledDuration) ?? scaledDuration)
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
      if (!runtime.hasExplicitCombatStart) execution.combatStart?.(runtime);
    }

    // Same-time opening hits may mark combat active, but only the consumed marker releases explicit setup producers.
    if (event.type === 'combat_start' && runtime.hasExplicitCombatStart) execution.combatStart?.(runtime);

    event = bindRuntimeCombo(runtime, event);
    // A grant precedes its synchronous buff reactions in gameplay; record that order before nested delivery runs.
    if (event.type === 'buff') runtime.observations.record(event);
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
    if (event.type === 'weapon_set' || event.type === 'sigil_swap') host.weaponSwap?.(event);
    if (['action', 'weapon_set', 'boon_extension', 'marker'].includes(event.type)) runtime.observations.record(event);
    if (!preparedCombos.has(event)) produceRuntimeCombos(runtime, profession.catalog, event);
    if (runtime.reporting && !['condition_buffer', 'condition_tick', 'action_update'].includes(event.type))
      executed.push(event);
    if (runtime.deathTime == null && targetHealthLoss(config, runtime) >= targetHealth) {
      runtime.deathTime = event.at;
      lethalActivation = event.activationId;
    }
  }

  return {
    submitEffect,
    announceEffect,
    publishAnnouncement,
    dispatchEvent,
    executed,
    owner: (event: Gw2ResolverEvent) => packetDelivery.get(event)?.owner,
    /** Both equipment and profession reactions stop granting hostile rewards after the lethal packet. */
    react(
      stage: Parameters<Gw2ResolverReactionRegistry['dispatch']>[0],
      context: Parameters<Gw2ResolverReactionRegistry['dispatch']>[1],
      event: Gw2ResolverEvent,
      details: Parameters<Gw2ResolverReactionRegistry['dispatch']>[3],
      registry: Gw2ResolverReactionRegistry
    ) {
      if (runtime.deathTime != null && (isHostileTargetEvent(event) || event.comboId != null)) return;
      return withCause(event, () => registry.dispatch(stage, context, event, details));
    }
  };
}
