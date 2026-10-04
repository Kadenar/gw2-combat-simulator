import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import { isHostileTargetEvent } from '#gw2/platform/combat/state/targets.js';
import { scaleCastBoundTiming } from '#gw2/platform/engine/effects/materializer.js';
import { assertSimulationEvent, type SimulationEventBase } from '#gw2/platform/engine/events/events.js';
import { gw2BaseRecharge } from '#gw2/platform/engine/skills/recharge.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import { relicWeaponSwapRechargeReduction } from '#gw2/platform/equipment/relics/catalog.js';
import { createCastReservations } from '#gw2/platform/execution/cast-lifecycle.js';
import {
  cancelledBeforeEffectCommit,
  cancelledBeforeInterruptCommit,
  interruptCommitCutoffs
} from '#gw2/platform/execution/effect-adapter.js';
import type { CastCommand, ChargeReleaseIntent } from '#gw2/platform/execution/types.js';
import {
  createCastDetailContext,
  createRechargeStartContext
} from '#gw2/platform/profession-definition/runtime-context.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import { selectSkillEffects } from '#gw2/platform/simulation/effect-selection.js';
import type { RuntimeExecution } from '#gw2/platform/simulation/execution.js';
import { createInternalWorkFactory, skillTaskAt } from '#gw2/platform/simulation/internal-work.js';
import type { Gw2Runtime, RuntimeCast, RuntimeWork } from '#gw2/platform/simulation/runtime-state.js';
import { applySkillSideEffects } from '#gw2/platform/simulation/side-effects.js';
import { advanceAutoattackChains, resetAutoattackChains } from '#gw2/platform/skills/autoattack-chain-controller.js';
import {
  castWasInterrupted,
  retainsInterruptedCastLockout,
  summonQuicknessCastTimeMs
} from '#gw2/platform/skills/timing.js';
import { lockTransitionInput } from '#gw2/platform/skills/transition-delays.js';
import { canonicalTime } from '#kernel/core/clock.js';

import { isGw2WeaponSkillEquipped } from '#gw2/platform/equipment/weapons/skill-matcher.js';
import type { AvailabilityResult } from '#gw2/platform/execution/types.js';
import type { RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import { autoattackChainAvailability } from '#gw2/platform/skills/autoattack-chain-controller.js';
import { gw2CooldownReadyAt } from '#gw2/platform/skills/timing.js';

/** Profession transitions query accepted casts and request lockouts without obtaining reservation stores. */
export interface CastControl {
  /** Resource recovery and form entry inspect lane facts without acquiring command traversal. */
  currentLaneEnd(): number;
  pendingCombatStart(): boolean;
  lockInputUntil(at: number): void;
  pendingChargeRelease(): ChargeReleaseIntent | undefined;
  hasInFlight(skillId: SkillId): boolean;
  inFlightSkillIds(): IterableIterator<SkillId>;
  setLockout(group: string, at: number): void;
  clearLockout(group: string): void;
}

interface CastExecutionHost {
  readonly makeWork: ReturnType<typeof createInternalWorkFactory<RuntimeWork>>;
  enqueueWork(work: RuntimeWork): void;
  recordAction(id: string, event: SimulationEvent): void;
  withCause<R>(cause: SimulationEvent | null, run: () => R): R;
  captureEffects(): void;
}

/** One owner reserves, admits, and completes casts; isolated evaluation deliberately enters below readiness. */
export function createCastExecution<T extends object>(
  runtime: Gw2Runtime<T>,
  profession: RuntimeProfession<T>,
  execution: RuntimeExecution<T>,
  host: CastExecutionHost
) {
  const { config, query, cursor, cooldownController } = runtime;
  const castDetailContext = createCastDetailContext(() => runtime.profession);
  const rechargeStartContext = createRechargeStartContext(() => runtime.time, profession.catalog);
  const inFlight = new Map<SkillId, Set<string>>();
  const lockouts = new Map<string, number>();
  const reservations = createCastReservations<Omit<RuntimeCast, 'id'> & { firstStrikeAt: number }>();
  /** Authored skill tasks become live work at their deadlines; cast-scaled offsets follow the reserved duration. */
  function scheduleSkillTasks(cast: RuntimeCast): void {
    for (const trigger of cast.skill.tasks ?? [])
      runtime.scheduleForCast(trigger.type, skillTaskAt(cast, trigger, runtime.time), cast, { trigger });
  }

  /** Settle the accepted reservation once, preserving commitment before completion observers. */
  function complete(reservationId: string): void {
    const cast = reservations.get(reservationId);
    if (!cast) throw new Error('Cast completion lost its reservation.');
    inFlight.get(cast.skill.id)?.delete(cast.id);
    if (!inFlight.get(cast.skill.id)?.size) inFlight.delete(cast.skill.id);
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
    profession.onAutoattackChainTransition?.(runtime.mechanics, cast, transition);
    if (cast.skill.cost?.spendOn === 'castCommit' && !cast.cancelled) execution.spendCost?.(runtime, cast.skill);
    // One successful-cast phase owns rewards and tasks; cancelled attempts only release profession state.
    if (cast.cancelled) profession.onCastCancel?.(runtime.mechanics, cast);
    else {
      applySkillSideEffects(runtime.mechanics, cast, 'castCommit', profession.sideEffectHandlers);
      profession.onCastCommit?.(runtime.mechanics, cast);
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
    const work = profession.rechargeWork?.(runtime.mechanicQueries, skill, baseWork) ?? baseWork;
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
    const durationMs = profession.castDurationMs?.(runtime.mechanicQueries, skill, baseDurationMs) ?? baseDurationMs;
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
    const rechargeWork = cancelled
      ? baseWork
      : (profession.reserveRecharge?.(runtime.mechanics, skill, baseWork) ?? baseWork);
    const ammo = cooldownController.ensureAmmo(skill) != null;
    // Resolve the selected anchor once before reservation, retaining the same value through completion.
    const canonicalRechargeStart =
      start +
      (skill.rechargeAnchor === 'castStart' ? 0 : effectiveEnd - start) * (skill.rechargeProgress ?? 1) +
      (skill.rechargeOffsetMs ?? 0) / 1000;
    const rechargeStart =
      profession.rechargeStart?.(
        rechargeStartContext,
        { skill, start, fullEnd, effectiveEnd, cancelled },
        canonicalRechargeStart
      ) ?? canonicalRechargeStart;
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
    if (!inFlight.has(skill.id)) inFlight.set(skill.id, new Set());
    inFlight.get(skill.id)!.add(cast.id);
    for (const lockout of skill.lockouts ?? [])
      lockouts.set(
        lockout.group,
        // Lockout readiness must use the same rounded clock as the command wake.
        Math.max(lockouts.get(lockout.group) ?? 0, canonicalTime(start + lockout.durationMs / 1000))
      );
    const detail = profession.castDetail?.(castDetailContext, cast);
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
    const comboFields =
      profession.modifyComboFields?.(runtime.mechanicQueries, cast, skill.comboFields) ?? skill.comboFields;
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
    host.recordAction(cast.id, action);
    // Acceptance work runs for the cast: its own packets keep their activation, other effects become its reactions.
    host.withCause(action, () => acceptCastWork(cast, action, attribution, interrupted));
    host.captureEffects();
  }

  /** Reserves completion, pays acceptance costs, and enqueues the cast's authored packets. */
  function acceptCastWork(
    cast: RuntimeCast,
    action: SimulationEvent,
    attribution: Pick<
      SimulationEventBase,
      'source' | 'sourceId' | 'actorType' | 'skillId' | 'skillName' | 'activationId'
    >,
    interrupted: boolean
  ): void {
    const { skill, command, start, fullEnd, effectiveEnd } = cast;
    host.enqueueWork(
      host.makeWork({
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
    profession.onCastStart?.(runtime.mechanics, cast);
    applySkillSideEffects(runtime.mechanics, cast, 'castStart', profession.sideEffectHandlers);
    // Custom skill owners select their packets once; scheduled effects still apply through the common live queue.
    const selectedEffects = selectSkillEffects(runtime.mechanics, cast);
    for (const effect of profession.modifyEffects?.(runtime.mechanics, cast, selectedEffects) ?? selectedEffects) {
      if (effect.when && !effect.when(runtime.mechanicQueries, cast)) continue;
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

  function evaluateReadiness(skill: Skill, command: CastCommand): AvailabilityResult {
    if (
      !isGw2WeaponSkillEquipped(
        { config, weaponSet: runtime.activeWeaponSet, state: runtime, catalog: profession.catalog },
        skill,
        profession.weaponSkillMatchesSet
      )
    ) {
      return {
        ready: false,
        retryAt: null,
        code: 'equipment',
        reason: `${skill.name} is unavailable — its required weapon is not equipped.`
      };
    }

    // A wrong chain command is invalid now; waiting for recharge must not let its flip expire into validity.
    const chainAvailability = autoattackChainAvailability(runtime, profession.catalog, skill);
    if (!chainAvailability.ready) {
      return chainAvailability;
    }

    cooldownController.refresh(runtime.time);
    const ammo = cooldownController.refreshAmmo(skill, runtime.time);
    const nextCommandAt = Math.max(
      runtime.time,
      skill.usableWhileRecharging && !(ammo && ammo.charges <= 0)
        ? 0
        : gw2CooldownReadyAt(runtime.cooldowns.get(skill.id) ?? 0),
      ...[...(skill.independentCastCanOverlap ? [] : (inFlight.get(skill.id) ?? []))].map(
        (id) => reservations.get(id)!.effectiveEnd
      ),
      ...(skill.lockouts ?? []).map((lockout) => lockouts.get(lockout.group) ?? 0)
    );

    if (nextCommandAt > runtime.time)
      return { ready: false, retryAt: nextCommandAt, code: 'recharge', reason: 'Waiting for cast readiness.' };
    return profession.availability?.(runtime.mechanicQueries, skill, command) ?? { ready: true };
  }

  return {
    acceptCast,
    complete,
    reject,
    rechargeWorkFor,
    evaluateReadiness,
    control: Object.freeze({
      currentLaneEnd: () => cursor.endTime(),
      lockInputUntil: (at: number) => {
        runtime.inputReadyAt = Math.max(runtime.inputReadyAt, at);
      },
      pendingCombatStart: () => cursor.command?.type === 'combat-start',
      pendingChargeRelease: () => cursor.pendingChargeRelease(),
      hasInFlight: (skillId: SkillId) => Boolean(inFlight.get(skillId)?.size),
      inFlightSkillIds: () => inFlight.keys(),
      setLockout: (group: string, at: number) => {
        lockouts.set(group, canonicalTime(at));
      },
      clearLockout: (group: string) => {
        lockouts.delete(group);
      }
    }) satisfies CastControl,
    /** Only accepted player impacts inform per-packet cast commitment. */
    observePacket(packet: SimulationEvent) {
      const cast = packet.activationId == null ? undefined : reservations.get(packet.activationId);
      if (cast && packet.type === 'damage' && packet.actorType === 'player' && packet.skillId === cast.skill.id)
        cast.firstStrikeAt = Math.min(cast.firstStrikeAt, packet.at);
    },
    resetCooldowns() {
      cooldownController.resetAll();
      lockouts.clear();
    }
  };
}
