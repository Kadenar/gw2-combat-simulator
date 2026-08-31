/**
 * Relic trigger rules: strike/condition multipliers, active effects, and
 * passive timelines. Each simulation selects exactly one rule set and creates
 * only the mutable state required by that relic.
 */

import { EPSILON, isInternalCooldownReady } from '#kernel/core/clock.js';
import { enqueueOrdered } from '#kernel/events/queue.js';
import {
  GW2_EVENT_ACTOR_TYPES,
  gw2EventActorType,
  isGw2PlayerActorEvent,
  isGw2PlayerModifierOwnedEvent
} from '#gw2/platform/combat/state/event-ownership.js';
import { combinedTargetDamage } from '#gw2/platform/combat/state/target-health.js';

import type { SimulationEvent, Skill } from '#gw2/platform/engine/types.js';
import type {
  Gw2ApplyCondition,
  Gw2ConditionHelpers,
  Gw2RelicContext,
  Gw2RelicMaterializerContext,
  Gw2RelicRule,
  Gw2RelicRuntime,
  Gw2RelicRuntimeContext,
  Gw2RelicState
} from '#gw2/platform/equipment/relics/types.js';

interface TimedBuffProcOptions {
  readonly duration: number;
  readonly name: string;
  readonly detail?: string | null;
}

function isBloodstoneOwnerStrike(event: SimulationEvent): boolean {
  // Fervor follows modifier ownership, while its delayed relic explosion remains eligible explicitly.
  return isGw2PlayerModifierOwnedEvent(event) || event.sourceId === 'relic.bloodstone';
}

const STATELESS_RELIC: Readonly<Gw2RelicRule> = Object.freeze({});

const ARISTOCRACY_BONUS_PER_STACK = 0.03;
const ARISTOCRACY_DURATION = 8;
const ARISTOCRACY_INTERNAL_COOLDOWN = 1;
const ARISTOCRACY_MAX_STACKS = 5;
const NOURYS_STACK_INTERVAL = 3;
const NOURYS_STACKS_NEEDED = 10;
const NOURYS_BUFF_DURATION = 5;
const NOURYS_DAMAGE_BONUS = 0.25;
const NOURYS_CYCLE_DURATION = NOURYS_STACK_INTERVAL * NOURYS_STACKS_NEEDED + NOURYS_BUFF_DURATION;

const THORNS_CONDITION_DAMAGE_PER_STACK = 30;
const THORNS_MAX_STACKS = 10;
const THORNS_FIRST_STACK_AT = 3;
const THORNS_STACK_INTERVAL = 5;

/**
 * Thorns grants a stack of Condition Damage on the first incoming hit and one
 * more every 5s thereafter, capped at 10. Golem-benchmark rotations are struck
 * continuously, so stacks ramp monotonically and hold at cap — the same model
 * the display timeline uses, keeping the reported stack count and the applied
 * condition damage in lockstep.
 */
function thornsStacksAt(at: number): number {
  if (at < THORNS_FIRST_STACK_AT - EPSILON) return 0;
  const stacks = 1 + Math.floor((at - THORNS_FIRST_STACK_AT + EPSILON) / THORNS_STACK_INTERVAL);
  return Math.min(THORNS_MAX_STACKS, Math.max(0, stacks));
}

interface AristocracyActivation {
  readonly at: number;
  readonly expiresAt: number;
  readonly stacks: number;
  readonly event: SimulationEvent;
}

interface AristocracyState extends Gw2RelicState {
  readyAt: number;
  stacks: number;
  expiresAt: number;
  activations: AristocracyActivation[];
  timelineEvents?: readonly SimulationEvent[];
  timelineLength?: number;
}

function createAristocracyState(): AristocracyState {
  return {
    readyAt: 0,
    stacks: 0,
    expiresAt: 0,
    activations: []
  };
}

function compareTimelineEvents(left: SimulationEvent, right: SimulationEvent): number {
  return (
    left.at - right.at ||
    Number(left.causalOrder ?? left.eventOrder ?? 0) - Number(right.causalOrder ?? right.eventOrder ?? 0)
  );
}

function applyAristocracyTrigger(state: AristocracyState, event: SimulationEvent): AristocracyActivation | null {
  if (event.type !== 'weakness_vulnerability' || !isInternalCooldownReady(event.at, state.readyAt)) {
    return null;
  }

  if (event.at >= state.expiresAt - EPSILON) state.stacks = 0;
  state.stacks = Math.min(ARISTOCRACY_MAX_STACKS, state.stacks + 1);
  state.expiresAt = event.at + ARISTOCRACY_DURATION;
  state.readyAt = event.at + ARISTOCRACY_INTERNAL_COOLDOWN;
  const activation = {
    at: event.at,
    expiresAt: state.expiresAt,
    stacks: state.stacks,
    event
  };
  state.activations.push(activation);
  return activation;
}

function replayAristocracyTimeline(events: readonly SimulationEvent[], combatStartTime: number): AristocracyState {
  const state = createAristocracyState();
  const ordered = [...events]
    .filter((event) => event.type === 'weakness_vulnerability' && event.at >= combatStartTime - EPSILON)
    .sort(compareTimelineEvents);
  for (const event of ordered) applyAristocracyTrigger(state, event);
  return state;
}

function explicitCombatStartTime(events: readonly SimulationEvent[]): number {
  let combatStartTime = Infinity;
  for (const event of events) {
    if (event.type === 'combat_start') {
      combatStartTime = Math.min(combatStartTime, event.at);
    }
  }

  return combatStartTime === Infinity ? -Infinity : combatStartTime;
}

function nourysCombatStart(context: Gw2RelicRuntimeContext, state: Gw2RelicState): number {
  const runtimeStart = Number(context.combatStartTime);
  if (Number.isFinite(runtimeStart)) return runtimeStart;
  const stateStart = Number(state.combatStartTime);
  if (Number.isFinite(stateStart)) return stateStart;
  const timelineStart = explicitCombatStartTime((state.timelineEvents as readonly SimulationEvent[] | undefined) || []);
  return Number.isFinite(timelineStart) ? timelineStart : 0;
}

function nourysActiveAt(context: Gw2RelicRuntimeContext, state: Gw2RelicState, at: number): boolean {
  const firstActivation = nourysCombatStart(context, state) + NOURYS_STACK_INTERVAL * NOURYS_STACKS_NEEDED;
  if (at < firstActivation - EPSILON) return false;
  const phase = (at - firstActivation) % NOURYS_CYCLE_DURATION;
  return phase >= -EPSILON && phase < NOURYS_BUFF_DURATION - EPSILON;
}

function syncAristocracyTimeline(state: AristocracyState): void {
  const events = state.timelineEvents;
  if (!events || state.timelineLength === events.length) return;
  const replay = replayAristocracyTimeline(events, explicitCombatStartTime(events));
  state.readyAt = replay.readyAt;
  state.stacks = replay.stacks;
  state.expiresAt = replay.expiresAt;
  state.activations = replay.activations;
  state.timelineLength = events.length;
}

// syncAristocracyTimeline replays only when the event array has grown since the
// last call — this lazily keeps historical query state in sync with new events.
function aristocracyActivationAt(state: AristocracyState, at: number): AristocracyActivation | null {
  syncAristocracyTimeline(state);
  for (let index = state.activations.length - 1; index >= 0; index -= 1) {
    const activation = state.activations[index];
    // A triggering application cannot benefit from its own same-time stack.
    if (activation.at >= at - EPSILON) continue;
    return at < activation.expiresAt - EPSILON ? activation : null;
  }

  return null;
}

/**
 * @param {Gw2RelicRule} rules
 * @returns {Readonly<Gw2RelicRule>}
 */
function defineRelic(rules: Gw2RelicRule): Readonly<Gw2RelicRule> {
  return Object.freeze(rules);
}

function recordTimedBuffProc(
  ctx: Gw2RelicContext,
  state: Gw2RelicState,
  event: SimulationEvent,
  { duration, name, detail = null }: TimedBuffProcOptions
): void {
  const wasActive = Number(state.buffUntil || 0) > event.at;
  state.buffUntil = Math.max(Number(state.buffUntil || 0), event.at + duration);
  // Preserve the authoritative effect deadline so the timeline can distinguish
  // a true expiry from a refresh that keeps the same relic window active.
  ctx.recordProc(
    'relic',
    name,
    event.at,
    event.skillName,
    detail ?? (wasActive ? 'refreshed' : 'activated'),
    '',
    null,
    Number(state.buffUntil)
  );
}

/**
 * Builds a strikeMultiplier hook returning `multiplier` while the relic's timed
 * buff window is open and 1 otherwise. An optional predicate further gates the
 * bonus (e.g. player-only strikes).
 */
function timedStrikeBuff(
  multiplier: number,
  predicate?: (event: SimulationEvent) => boolean
): NonNullable<Gw2RelicRule['strikeMultiplier']> {
  return (_ctx, state, event) =>
    Number(state.buffFrom ?? -Infinity) <= event.at &&
    Number(state.buffUntil || 0) > event.at &&
    (predicate ? predicate(event) : true)
      ? multiplier
      : 1;
}

const RELIC_RULES: Readonly<Record<string, Readonly<Gw2RelicRule>>> = Object.freeze({
  Akeem: defineRelic({
    createState: () => ({ readyAt: 0 }),
    control(ctx, state, event, { activeConditionStackCount, applyCondition }) {
      if (!isInternalCooldownReady(event.at, state.readyAt)) return;
      if (
        activeConditionStackCount(ctx, 'Confusion', event.at) < 5 &&
        activeConditionStackCount(ctx, 'Torment', event.at) < 5
      ) {
        return;
      }

      state.readyAt = event.at + 10;
      ctx.recordProc('relic', 'Relic of Akeem', event.at, event.skillName);
      applyCondition(ctx, {
        type: 'condition',
        at: event.at,
        name: 'Relic of Akeem — Confusion',
        skillName: 'Relic of Akeem',
        condition: 'Confusion',
        duration: 10,
        stacks: 2,
        source: 'Relic'
      });
      applyCondition(ctx, {
        type: 'condition',
        at: event.at,
        name: 'Relic of Akeem — Torment',
        skillName: 'Relic of Akeem',
        condition: 'Torment',
        duration: 10,
        stacks: 2,
        source: 'Relic'
      });
    }
  }),

  Aristocracy: defineRelic({
    createState: createAristocracyState,
    weaknessVulnerability(ctx, state, event) {
      if (ctx.combatStartTime != null && event.at < ctx.combatStartTime - EPSILON) {
        return;
      }

      applyAristocracyTrigger(state as AristocracyState, event);
    },
    timeline(ctx, _state, events) {
      const replay = replayAristocracyTimeline(events, ctx.combatStartTime ?? -Infinity);
      for (const activation of replay.activations) {
        ctx.recordProc(
          'relic',
          'Relic of Aristocracy',
          activation.at,
          activation.event.skillName,
          `${activation.stacks}/${ARISTOCRACY_MAX_STACKS} stacks`,
          '',
          null,
          activation.expiresAt
        );
      }
    },
    conditionDurationBonus(_ctx, state, at) {
      const activation = aristocracyActivationAt(state as AristocracyState, at);
      return activation ? activation.stacks * ARISTOCRACY_BONUS_PER_STACK : 0;
    }
  }),

  Blightbringer: defineRelic({
    createState: () => ({
      readyAt: 0,
      count: 0,
      trackedActivations: new Set<string>()
    }),
    condition(ctx, state, application, { applyCondition }) {
      if (application?.condition !== 'Poisoned' || !isGw2PlayerActorEvent(application)) {
        return;
      }

      // Deduplicate by activationId (or a synthesized key) so a single skill
      // application that produces multiple poison stacks only increments the
      // Blightbringer counter once.
      const tracked = state.trackedActivations as Set<string> | undefined;
      const key = String(
        application.activationId || `${application.skillId || application.skillName}:${application.at}`
      );
      if (tracked?.has(key)) return;
      tracked?.add(key);
      state.count = Math.min(6, Number(state.count || 0) + 1);
      if (Number(state.count) < 6 || !isInternalCooldownReady(application.at, state.readyAt)) {
        return;
      }

      state.count = 0;
      state.readyAt = application.at + 8;
      ctx.recordProc('relic', 'Relic of Blightbringer', application.at, application.skillName);
      for (const [condition, stacks, duration] of [
        ['Poisoned', 3, 10],
        ['Crippled', 1, 5],
        ['Weakness', 1, 5]
      ] as const) {
        applyCondition(ctx, {
          type: 'condition',
          at: application.at,
          name: `Relic of Blightbringer - ${condition}`,
          skillName: 'Relic of Blightbringer',
          condition,
          duration,
          stacks,
          source: 'Relic',
          sourceId: 'relic.blightbringer',
          actorType: 'effect'
        });
      }
    }
  }),

  Bloodstone: defineRelic({
    createState: () => ({
      stacks: 0,
      expiresAt: 0,
      buffUntil: 0
    }),
    combo(ctx, state, event) {
      // The shared combo reaction now reaches leap finishers for Steamshrieker; Bloodstone remains blast-only.
      if (event.finisherType !== 'Blast') return;
      // Volatility cannot accumulate while Fervor is active.
      if (Number(state.buffUntil || 0) > event.at) return;
      if (Number(state.expiresAt || 0) <= event.at) state.stacks = 0;

      const currentStacks = Number(state.stacks || 0);
      if (currentStacks < 3) {
        state.stacks = currentStacks + 1;
        state.expiresAt = event.at + 10;
        ctx.recordProc('relic', 'Bloodstone Volatility', event.at, event.skillName, `${state.stacks}/3 stacks`);
        return;
      }

      // The fourth qualifying blast consumes three Volatility stacks and activates Fervor.
      state.stacks = 0;
      state.expiresAt = 0;
      state.buffUntil = event.at + 8;
      ctx.recordProc(
        'relic',
        'Relic of Bloodstone',
        event.at,
        event.skillName,
        'Bloodstone Fervor',
        '',
        null,
        Number(state.buffUntil)
      );
      const explosionAt = event.at + 0.68;
      enqueueOrdered(ctx.queue, {
        type: 'damage',
        at: explosionAt,
        name: 'Bloodstone Explosion',
        skillName: 'Bloodstone Explosion',
        coefficient: 3,
        hits: 1,
        hitIndex: 1,
        totalHits: 1,
        source: 'Relic',
        sourceId: 'relic.bloodstone',
        actorType: 'effect',
        skillWeapon: 'Unequipped',
        canCrit: true,
        triggeredBy: event.skillName
      });
      enqueueOrdered(ctx.queue, {
        type: 'condition',
        at: explosionAt,
        name: 'Bloodstone Explosion — Bleeding',
        skillName: 'Bloodstone Explosion',
        condition: 'Bleeding',
        duration: 6,
        stacks: 6,
        source: 'Relic',
        sourceId: 'relic.bloodstone',
        actorType: 'effect',
        triggeredBy: event.skillName
      });
    },
    // Fervor also affects the delayed explosion that activated it.
    strikeMultiplier: timedStrikeBuff(1.07, isBloodstoneOwnerStrike)
  }),

  Brawler: defineRelic({
    createState: () => ({ readyAt: 0, buffUntil: 0 }),
    boon(ctx, state, event) {
      const kind = String(event?.kind || '').toLowerCase();
      if (
        (kind !== 'protection' && kind !== 'resolution') ||
        !isGw2PlayerActorEvent(event) ||
        !(Number(event.duration) > 0) ||
        !(Number(event.stacks ?? 1) > 0) ||
        !isInternalCooldownReady(event.at, state.readyAt)
      ) {
        return;
      }

      state.readyAt = event.at + 8;
      state.buffUntil = event.at + 4;
      ctx.recordProc(
        'relic',
        'Relic of the Brawler',
        event.at,
        event.skillName,
        'activated',
        '',
        null,
        Number(state.buffUntil)
      );
    },
    strikeMultiplier: timedStrikeBuff(1.1)
  }),

  Claw: defineRelic({
    createState: () => ({ buffUntil: 0 }),
    control(ctx, state, event) {
      if (!isGw2PlayerActorEvent(event)) return;
      recordTimedBuffProc(ctx, state, event, {
        duration: 8,
        name: 'Relic of the Claw'
      });
    },
    strikeMultiplier: timedStrikeBuff(1.07, isGw2PlayerModifierOwnedEvent)
  }),

  Dragonhunter: defineRelic({
    createState: () => ({ buffUntil: 0 }),
    afterHit(ctx, state, event, skill) {
      if (!isGw2PlayerActorEvent(event) || !skill?.categories?.includes('Trap')) {
        return;
      }

      recordTimedBuffProc(ctx, state, event, {
        duration: 5,
        name: 'Relic of the Dragonhunter'
      });
    },
    conditionDurationBonus(_ctx, state, at) {
      return Number(state.buffUntil || 0) > at ? 0.1 : 0;
    },
    strikeMultiplier: timedStrikeBuff(1.1)
  }),

  Eagle: defineRelic({
    strikeMultiplier(ctx) {
      // Activates when cumulative damage dealt (strike + condition) reaches
      // 50% of target health — not remaining health; it's a threshold on total output.
      const targetHealth = Number(ctx.config.target?.health || 0);
      return targetHealth > 0 && combinedTargetDamage(ctx) >= targetHealth * 0.5 ? 1.1 : 1;
    }
  }),

  Fireworks: defineRelic({
    createState: () => ({ buffUntil: 0 }),
    afterHit(ctx, state, event, skill) {
      // Kit/bundle skills strike at bundle strength rather than weapon
      // strength, so they never qualify.
      const isWeaponSkill = skill?.type === 'Weapon' && !skill?.kit;
      // Profession-mechanic skills qualify when they strike at weapon strength:
      // either an equipped weapon profile or the dedicated profession-mechanic
      // profile. Bundle strength and unequipped utility strength do not count.
      const profileId = String(event.weaponStrengthProfileId || '');
      const strikesAtWeaponStrength = profileId.startsWith('weapon.') || profileId === 'nonweapon.profession-mechanic';
      const isWeaponStrengthProfessionMechanic = event.skillWeapon === 'Profession mechanic' || strikesAtWeaponStrength;
      if (
        !isGw2PlayerActorEvent(event) ||
        (!isWeaponSkill && !skill?.shroud && !isWeaponStrengthProfessionMechanic) ||
        Number(skill?.cooldown || 0) < 20
      ) {
        return;
      }

      recordTimedBuffProc(ctx, state, event, {
        duration: 6,
        name: 'Relic of Fireworks'
      });
    },
    strikeMultiplier: timedStrikeBuff(1.07)
  }),

  Fractal: defineRelic({
    createState: () => ({ readyAt: 0 }),
    condition(ctx, state, application, { activeConditionStackCount, applyCondition }) {
      if (
        application?.condition !== 'Bleeding' ||
        !isInternalCooldownReady(application.at, state.readyAt) ||
        activeConditionStackCount(ctx, 'Bleeding', application.at) - Number(application.stacks || 0) < 6
      ) {
        return;
      }

      // The condition hook fires with the new stacks already counted, so subtract
      // application.stacks to check for the required six pre-existing stacks.
      state.readyAt = application.at + 20;
      ctx.recordProc('relic', 'Relic of the Fractal', application.at, application.skillName);
      applyCondition(ctx, {
        type: 'condition',
        at: application.at,
        name: 'Relic of the Fractal — Burning',
        skillName: 'Relic of the Fractal',
        condition: 'Burning',
        duration: 8,
        stacks: 2,
        source: 'Relic',
        sourceId: 'relic.fractal'
      });
      applyCondition(ctx, {
        type: 'condition',
        at: application.at,
        name: 'Relic of the Fractal — Torment',
        skillName: 'Relic of the Fractal',
        condition: 'Torment',
        duration: 8,
        stacks: 3,
        source: 'Relic',
        sourceId: 'relic.fractal'
      });
    }
  }),

  Mistburn: defineRelic({
    createState: () => ({ readyAt: 0 }),
    materializeBoon(ctx, state, event) {
      const kind = String(event.kind || '').toLowerCase();
      if (
        kind !== 'might' ||
        !isGw2PlayerActorEvent(event) ||
        event.recipients === 'allies' ||
        !(Number(event.duration) > 0) ||
        !(Number(event.stacks ?? 1) > 0) ||
        !isInternalCooldownReady(event.at, state.readyAt)
      ) {
        return;
      }

      state.readyAt = event.at + 1;
      ctx.emitDerived(event, {
        type: 'buff',
        at: event.at,
        name: 'Relic of Mistburn - Might',
        skillName: 'Relic of Mistburn',
        kind: 'might',
        duration: 8,
        stacks: 1,
        source: 'Relic',
        sourceId: 'relic.mistburn',
        actorType: 'effect'
      });
    },
    boon(ctx, _state, event) {
      if (event.type !== 'buff' || event.sourceId !== 'relic.mistburn') {
        return;
      }

      ctx.recordProc('relic', 'Relic of Mistburn', event.at, event.triggeredBy || event.skillName);
    },
    criticalChanceBonus(_ctx, _state, event, mightStacks) {
      return isGw2PlayerActorEvent(event) && mightStacks >= 10 ? 0.1 : 0;
    }
  }),

  'Mist Stranger': defineRelic({
    damageResolved(ctx, _state, event) {
      if (!isGw2PlayerActorEvent(event)) return;
      const siphon = 105 * Number(event.hits || 1);
      ctx.totals.strike += siphon;
      ctx.addBreakdown('Relic of the Mist Stranger', siphon, 'strikeDamage', event.hits);
      ctx.resolved.push({
        type: 'damage',
        at: event.at,
        name: 'Relic of the Mist Stranger',
        skillName: 'Relic of the Mist Stranger',
        triggeredBy: event.skillName,
        coefficient: 0,
        hits: event.hits,
        source: 'Relic',
        damage: siphon
      });
      ctx.recordProc('relic', 'Relic of the Mist Stranger', event.at, event.skillName);
    }
  }),

  Nourys: defineRelic({
    timeline(ctx, state, _events, rotationEndTime) {
      const combatStart = nourysCombatStart(ctx, state);
      state.combatStartTime = combatStart;
      let stacks = 0;
      for (let at = combatStart + NOURYS_STACK_INTERVAL; at <= rotationEndTime + EPSILON;) {
        stacks += 1;
        ctx.recordProc('skill', 'Nourys', at, 'Combat duration', `${stacks}/${NOURYS_STACKS_NEEDED} stacks`);
        if (stacks >= NOURYS_STACKS_NEEDED) {
          stacks = 0;
          ctx.recordProc('relic', 'Relic of Nourys', at, 'Nourys', 'activated', '', null, at + NOURYS_BUFF_DURATION);
          at += NOURYS_BUFF_DURATION + NOURYS_STACK_INTERVAL;
        } else {
          at += NOURYS_STACK_INTERVAL;
        }
      }
    },
    outgoingDamageBonus(ctx, state, _damageType, at) {
      // nourysActiveAt uses modulo arithmetic on elapsed time from combat start
      // to determine the current phase — no event tracking needed.
      return nourysActiveAt(ctx, state, at) ? NOURYS_DAMAGE_BONUS : 0;
    }
  }),

  Peitha: defineRelic({
    createState: () => ({ readyAt: 0, buffFrom: 0, buffUntil: 0 }),
    peitha(ctx, state, event, applyCondition) {
      const triggerAt = event.at;
      if (!isInternalCooldownReady(triggerAt, state.readyAt)) return;
      state.readyAt = triggerAt + 4;
      const combatStart = Number(ctx.combatStartTime ?? -Infinity);
      // If the trigger fires before combat starts (pre-cast), clamp the impact
      // to combatStartTime so the damage and condition don't preload before combat.
      const impactAt =
        triggerAt < combatStart ? combatStart : triggerAt + Math.max(0, Number(event.projectileDelay || 0));
      state.buffFrom = impactAt;
      state.buffUntil = impactAt + 4;
      ctx.recordProc('relic', 'Relic of Peitha', impactAt, event.skillName, '', '', null, Number(state.buffUntil));
      applyCondition(ctx, {
        type: 'condition',
        at: impactAt,
        name: 'Relic of Peitha — Torment',
        skillName: 'Relic of Peitha',
        condition: 'Torment',
        duration: 7,
        stacks: 2,
        source: 'Relic'
      });
    },
    // Peitha's temporary outgoing-damage bonus belongs to the player who triggered it.
    strikeMultiplier: timedStrikeBuff(1.1, isGw2PlayerModifierOwnedEvent)
  }),

  Shackles: defineRelic({
    createState: () => ({ readyAt: 0 }),
    materializeCondition(ctx, state, application) {
      const actorType = gw2EventActorType(application);
      if (
        application?.condition !== 'Immobilized' ||
        (actorType !== GW2_EVENT_ACTOR_TYPES.PLAYER && actorType !== GW2_EVENT_ACTOR_TYPES.SUMMON) ||
        !isInternalCooldownReady(application.at, state.readyAt)
      ) {
        return;
      }

      state.readyAt = application.at + 10;
      ctx.emitDerived(application, {
        type: 'proc',
        procType: 'relic',
        at: application.at,
        name: 'Relic of the Shackles',
        sourceSkill: application.skillName,
        detail: 'tethered',
        source: 'Relic',
        sourceId: 'relic.shackles',
        actorType: 'effect'
      });
      ctx.emitDerived(application, {
        type: 'damage',
        at: application.at + 5,
        name: 'Relic of the Shackles',
        skillName: 'Relic of the Shackles',
        coefficient: 3,
        hits: 1,
        hitIndex: 1,
        totalHits: 1,
        source: 'Relic',
        sourceId: 'relic.shackles',
        actorType: 'effect',
        skillWeapon: 'Unequipped',
        canCrit: true,
        triggeredBy: application.skillName
      });
      ctx.emitDerived(application, {
        type: 'control',
        at: application.at + 5,
        name: 'Relic of the Shackles',
        skillName: 'Relic of the Shackles',
        controlKind: 'stun',
        duration: 1,
        source: 'Relic',
        sourceId: 'relic.shackles',
        actorType: 'effect',
        triggeredBy: application.skillName
      });
    },
    damageResolved(ctx, _state, event) {
      if (
        event?.type !== 'damage' ||
        event.sourceId !== 'relic.shackles' ||
        event.skillName !== 'Relic of the Shackles'
      ) {
        return;
      }

      ctx.recordProc('relic', 'Relic of the Shackles', event.at, event.triggeredBy, 'damage');
    }
  }),

  Steamshrieker: defineRelic({
    combo(ctx, _state, event) {
      if (
        !isGw2PlayerActorEvent(event) ||
        event.fieldType !== 'Water' ||
        !['Blast', 'Leap'].includes(String(event.finisherType || ''))
      ) {
        return;
      }

      // Steamshrieker is a shared relic: every profession's successful player-owned water blast or leap burns once.
      enqueueOrdered(ctx.queue, {
        type: 'condition',
        at: event.at,
        source: 'Relic',
        sourceId: 'relic.steamshrieker',
        actorType: 'effect',
        skillName: 'Relic of Steamshrieker',
        name: 'Relic of Steamshrieker — Burning',
        condition: 'Burning',
        stacks: 1,
        duration: 5,
        triggeredBy: event.skillName
      });
      ctx.recordProc('relic', 'Relic of Steamshrieker', event.at, event.skillName);
    }
  }),

  Thief: defineRelic({
    createState: () => ({ stacks: 0, expiresAt: 0 }),
    afterHit(ctx, state, event, skill) {
      if (
        !isGw2PlayerActorEvent(event) ||
        skill?.type !== 'Weapon' ||
        !(Number(skill.cooldown || 0) > 0 || skill.resource)
      ) {
        return;
      }

      if (Number(state.expiresAt || 0) <= event.at) state.stacks = 0;
      state.stacks = Math.min(5, Number(state.stacks || 0) + 1);
      state.expiresAt = event.at + 6;
      ctx.recordProc(
        'relic',
        'Relic of the Thief',
        event.at,
        event.skillName,
        `${state.stacks}/5 stacks`,
        '',
        null,
        Number(state.expiresAt)
      );
    },
    // Returns 1 (not 0) when no stacks are active — it's a multiplier, not additive.
    strikeMultiplier(_ctx, state, event) {
      return Number(state.stacks || 0) > 0 && Number(state.expiresAt || 0) > event.at
        ? 1 + Number(state.stacks || 0) * 0.01
        : 1;
    }
  }),

  Thorns: defineRelic({
    timeline(ctx, _state, _events, rotationEndTime) {
      for (
        let at = THORNS_FIRST_STACK_AT, stacks = 1;
        at <= rotationEndTime + EPSILON && stacks <= THORNS_MAX_STACKS;
        at += THORNS_STACK_INTERVAL, stacks += 1
      ) {
        ctx.recordProc('relic', 'Relic of Thorns', at, 'Incoming enemy hit', `${stacks}/${THORNS_MAX_STACKS} stacks`);
      }
    },
    // Flat +30 Condition Damage per stack, sampled at tick time so ramping
    // stacks scale live with each condition tick.
    conditionDamageBonus(_ctx, _state, at) {
      return thornsStacksAt(at) * THORNS_CONDITION_DAMAGE_PER_STACK;
    }
  })
});

/**
 * Creates the selected relic runtime. Rules are immutable and shared; mutable
 * state is created independently for each simulation.
 *
 * @param {unknown} name
 * @returns {Readonly<Gw2RelicRuntime>}
 */
export function createRelicRuntime(name: unknown): Readonly<Gw2RelicRuntime> {
  const selectedName = String(name || '');
  const rules = RELIC_RULES[selectedName] || STATELESS_RELIC;
  const state = rules.createState?.() || {};
  return Object.freeze({
    name: selectedName,
    rules,
    state
  });
}

// Sets timelineLength to -1 (not events.length) so syncAristocracyTimeline
// treats the state as dirty and replays on the first call even when the
// events array is empty.
/** Creates relic runtime state prepared to replay chronological timeline events. */
export function createRelicTimelineRuntime(
  name: unknown,
  events: readonly SimulationEvent[]
): Readonly<Gw2RelicRuntime> {
  const runtime = createRelicRuntime(name);
  runtime.state.timelineEvents = events;
  runtime.state.timelineLength = -1;
  return runtime;
}

/**
 * @param {{readonly relic?: Gw2RelicRuntime} | null | undefined} ctx
 * @param {keyof Gw2RelicRule} hook
 * @param {unknown[]} args
 */
export function invokeRelicHook(
  ctx: Gw2RelicRuntimeContext | null | undefined,
  hook: keyof Gw2RelicRule,
  ...args: unknown[]
): unknown {
  const relic = ctx?.relic;
  if (!ctx || !relic) return undefined;
  const handler = relic.rules[hook];
  if (typeof handler !== 'function') return undefined;
  const dynamicHandler = handler as unknown as (
    context: unknown,
    state: Gw2RelicState,
    ...values: unknown[]
  ) => unknown;
  return dynamicHandler(ctx, relic.state, ...args);
}
