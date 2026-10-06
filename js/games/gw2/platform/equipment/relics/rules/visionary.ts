/** Visionary relic rules. */
import { isTimeInWindow } from '#kernel/core/clock.js';
import { isInternalCooldownReady } from '#gw2/platform/combat/procs.js';
import { advanceCounter } from '#gw2/platform/combat/resources/counters.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { gw2EffectExpiresAt } from '#gw2/platform/effects/timing.js';
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
      if (!isInternalCooldownReady(event.at, state.whirlReadyAt || 0)) return;
      state.whirlReadyAt = event.at + VISIONARY_WHIRL_INTERNAL_COOLDOWN;
    }

    // Complete only accepted combos and publish the reset before opening the historical reward window.
    const progress = advanceCounter(state.stacks || 0, 1, VISIONARY_STACKS_NEEDED, 'reset');
    state.stacks = progress.value;
    // Buildup has its own track; publishing consumption closes it before the separate damage buff begins.
    ctx.effects.emit({
      kind: 'announcement',
      announcement: {
        type: 'relic',
        name: 'Relic of the Visionary',
        at: event.at,
        sourceSkill: event.skillName,
        detail: state.stacks ? `${state.stacks}/${VISIONARY_STACKS_NEEDED} stacks` : 'stacks consumed',
        icon: '',
        cooldownReduction: null,
        expiresAt: null,
        effectState: { stacks: state.stacks, maximumStacks: VISIONARY_STACKS_NEEDED }
      }
    });
    if (!progress.reached) return;

    const until = gw2EffectExpiresAt(event.at, VISIONARY_BUFF_DURATION);
    windows.push({ from: event.at, until });
    ctx.effects.emit({
      kind: 'announcement',
      announcement: {
        type: 'relic',
        name: "Vloxx's Vision",
        at: event.at,
        sourceSkill: event.skillName,
        detail: '+10% strike and condition damage',
        icon: '',
        cooldownReduction: null,
        expiresAt: until,
        // The reward window lives in this mechanic rather than generic buff storage.
        effectState: { stacks: 1, maximumStacks: 1 }
      }
    });
  },
  // Windows are retained so out-of-order condition tick queries still see the buff active at their own time.
  outgoingDamageBonus(_ctx, state, _damageType, at) {
    const windows = state.windows || [];
    return windows.some((window) => isTimeInWindow(at, window.from, window.until)) ? VISIONARY_DAMAGE_BONUS : 0;
  }
});
