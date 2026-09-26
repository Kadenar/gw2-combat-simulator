import { EPSILON, timeKey } from '#kernel/core/clock.js';
import { gw2EffectExpiresAt } from '#gw2/platform/skills/timing.js';
/** Nourys relic rules. */
import { defineRelic, explicitCombatStartTime } from '#gw2/platform/equipment/relics/rules/shared.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { Gw2RelicState, Gw2RelicRuntimeContext } from '#gw2/platform/equipment/relics/types.js';

const NOURYS_STACK_INTERVAL = 3;
const NOURYS_STACKS_NEEDED = 10;
const NOURYS_BUFF_DURATION = 5;
const NOURYS_DAMAGE_BONUS = 0.25;
const NOURYS_CYCLE_DURATION = NOURYS_STACK_INTERVAL * NOURYS_STACKS_NEEDED + NOURYS_BUFF_DURATION;

function nourysCombatStart(context: Gw2RelicRuntimeContext, state: Gw2RelicState): number {
  const runtimeStart = Number(context.combatStartTime);
  if (Number.isFinite(runtimeStart)) return runtimeStart;
  const stateStart = Number(state.combatStartTime);
  if (Number.isFinite(stateStart)) return stateStart;
  const timelineStart = explicitCombatStartTime((state.timelineEvents as readonly SimulationEvent[] | undefined) || []);
  return Number.isFinite(timelineStart) ? timelineStart : 0;
}

function nourysActiveAt(context: Gw2RelicRuntimeContext, state: Gw2RelicState, at: number): boolean {
  // Integer clock keys avoid floating-point modulo drift at each recurring activation.
  const firstActivation = timeKey(nourysCombatStart(context, state) + NOURYS_STACK_INTERVAL * NOURYS_STACKS_NEEDED);
  const elapsed = timeKey(at) - firstActivation;
  if (elapsed < 0) return false;
  const cycle = Math.floor(elapsed / timeKey(NOURYS_CYCLE_DURATION));
  const activation = (firstActivation + cycle * timeKey(NOURYS_CYCLE_DURATION)) / 1_000_000;
  return timeKey(at) < timeKey(gw2EffectExpiresAt(activation, NOURYS_BUFF_DURATION));
}

export const nourys = defineRelic({
  passiveTimeline(ctx, state, rotationEndTime) {
    const combatStart = nourysCombatStart(ctx, state);
    let stacks = 0;
    for (let at = combatStart + NOURYS_STACK_INTERVAL; at <= rotationEndTime + EPSILON;) {
      stacks += 1;
      ctx.recordProc('skill', 'Nourys', at, 'Combat duration', `${stacks}/${NOURYS_STACKS_NEEDED} stacks`);
      if (stacks >= NOURYS_STACKS_NEEDED) {
        stacks = 0;
        ctx.recordProc(
          'relic',
          'Relic of Nourys',
          at,
          'Nourys',
          'activated',
          '',
          null,
          gw2EffectExpiresAt(at, NOURYS_BUFF_DURATION)
        );
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
});
