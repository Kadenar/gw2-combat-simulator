/** Visionary relic rules. */
import { isInternalCooldownReady, isTimeInWindow } from '#kernel/core/clock.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { gw2EffectExpiresAt } from '#gw2/platform/skills/timing.js';
import { defineRelic } from '#gw2/platform/equipment/relics/rules/shared.js';

const VISIONARY_STACKS_NEEDED = 8;
const VISIONARY_BUFF_DURATION = 8;
const VISIONARY_DAMAGE_BONUS = 0.1;
const VISIONARY_WHIRL_INTERNAL_COOLDOWN = 3;

export const visionary = defineRelic({
  createState: () => ({ stacks: 0, whirlReadyAt: 0, windows: [] }),
  combo(ctx, state, event) {
    if (!isGw2PlayerActorEvent(event)) return;
    const windows = state.windows as { from: number; until: number }[];
    // Like Bloodstone, stacks cannot accumulate while Vloxx's Vision is active.
    if (windows.some((window) => isTimeInWindow(event.at, window.from, window.until))) return;
    if (event.finisherType === 'Whirl') {
      if (!isInternalCooldownReady(event.at, Number(state.whirlReadyAt || 0))) return;
      state.whirlReadyAt = event.at + VISIONARY_WHIRL_INTERNAL_COOLDOWN;
    }

    const stacks = Number(state.stacks || 0) + 1;
    if (stacks < VISIONARY_STACKS_NEEDED) {
      state.stacks = stacks;
      ctx.recordProc(
        'relic',
        'Relic of the Visionary',
        event.at,
        event.skillName,
        `${stacks}/${VISIONARY_STACKS_NEEDED} stacks`,
        '',
        null,
        null,
        { stacks, maximumStacks: VISIONARY_STACKS_NEEDED }
      );
      return;
    }

    state.stacks = 0;
    const until = gw2EffectExpiresAt(event.at, VISIONARY_BUFF_DURATION);
    windows.push({ from: event.at, until });
    ctx.recordProc('relic', 'Relic of the Visionary', event.at, event.skillName, "Vloxx's Vision", '', null, until);
  },
  // Windows are retained so out-of-order condition tick queries still see the buff active at their own time.
  outgoingDamageBonus(_ctx, state, _damageType, at) {
    const windows = (state.windows as { from: number; until: number }[] | undefined) || [];
    return windows.some((window) => isTimeInWindow(at, window.from, window.until)) ? VISIONARY_DAMAGE_BONUS : 0;
  }
});
