/** Helpers shared by more than one relic rule module. */
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { isGw2PlayerActorEvent, isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { targetHasCondition } from '#gw2/platform/combat/state/targets.js';
import { gw2EffectExpiresAt } from '#gw2/platform/skills/timing.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { Gw2RelicState, Gw2RelicContext, Gw2RelicRule } from '#gw2/platform/equipment/relics/types.js';

interface TimedBuffProcOptions {
  readonly duration: number;
  readonly name: string;
  readonly detail?: string | null;
}

export function compareTimelineEvents(left: SimulationEvent, right: SimulationEvent): number {
  return (
    left.at - right.at ||
    Number(left.causalOrder ?? left.eventOrder ?? 0) - Number(right.causalOrder ?? right.eventOrder ?? 0)
  );
}

export function explicitCombatStartTime(events: readonly SimulationEvent[]): number {
  let combatStartTime = Infinity;
  for (const event of events) {
    if (event.type === 'combat_start') {
      combatStartTime = Math.min(combatStartTime, event.at);
    }
  }

  return combatStartTime === Infinity ? -Infinity : combatStartTime;
}

export function defineRelic(rules: Gw2RelicRule): Readonly<Gw2RelicRule> {
  return Object.freeze(rules);
}

export function recordTimedBuffProc(
  ctx: Gw2RelicContext,
  state: Gw2RelicState,
  event: SimulationEvent,
  { duration, name, detail = null }: TimedBuffProcOptions
): void {
  const wasActive = Number(state.buffUntil || 0) > event.at;
  state.buffUntil = Math.max(Number(state.buffUntil || 0), gw2EffectExpiresAt(event.at, duration));
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
export function timedStrikeBuff(
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

/** Activates buffs from live completed slot skills, retaining precombat elapsed time and each relic's own cooldown. */
export function skillUseStrikeRelic(skillType: 'Heal' | 'Elite'): Readonly<Gw2RelicRule> {
  const director = skillType === 'Heal';
  const relicName = director ? 'Director' : 'Mount Balrior';
  const name = director ? 'Relic of the Director' : 'Relic of Mount Balrior';
  function activate(ctx: Gw2RelicContext, state: Gw2RelicState, event: SimulationEvent) {
    const at = event.at;
    (state.activationTimes as number[]).push(at);
    ctx.recordProc('relic', name, at, event.skillName, 'activated', '', null, at + 6);
    if (director) {
      ctx.queue.enqueue({
        type: 'condition',
        at,
        source: 'Relic',
        sourceId: 'relic.director',
        actorType: 'effect',
        ownerActorType: 'player',
        skillName: name,
        name,
        triggeredBy: event.skillName,
        offTarget: Boolean(event.offTarget),
        condition: 'Vulnerability',
        stacks: 8,
        duration: 8
      });
    }
  }

  return defineRelic({
    createState: () => ({ activationTimes: [], readyAt: -Infinity }),
    activate,
    completed(ctx, state, event) {
      if (event.skillType !== skillType || event.cancelled || !isGw2PlayerActorEvent(event)) return;
      // The runtime supplies completion time and whether the marker has executed; pending casts cannot activate buffs.
      const precombat = event.precombat === true;
      if (precombat ? !ctx.config.precastRelics?.includes(relicName) : ctx.config.relic !== relicName) return;
      if (!isInternalCooldownReady(event.at, state.readyAt)) return;
      state.readyAt = event.at + (director ? 15 : 30);
      ctx.queue.enqueue({ ...event, type: 'relic.activate', sourceId: relicName, at: event.at + (director ? 0 : 1) });
    },
    strikeMultiplier(ctx, state, event) {
      const active = (state.activationTimes as number[]).some((at) => at <= event.at && event.at < at + 6);
      return active &&
        isGw2PlayerModifierOwnedEvent(event) &&
        (!director || targetHasCondition(ctx.config, 'Vulnerability', event.at, ctx))
        ? director
          ? 1.1
          : 1.15
        : 1;
    }
  });
}
