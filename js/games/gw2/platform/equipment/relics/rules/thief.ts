/** Thief relic rules. */
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { gw2EffectExpiresAt } from '#gw2/platform/skills/timing.js';
import { defineRelic } from '#gw2/platform/equipment/relics/rules/shared.js';

export const thief = defineRelic({
  createState: () => ({ stacks: 0, expiresAt: 0 }),
  afterHit(ctx, state, event, skill) {
    if (!isGw2PlayerActorEvent(event) || skill?.type !== 'Weapon' || !((skill.cooldown || 0) > 0 || skill.resource)) {
      return;
    }

    if ((state.expiresAt || 0) <= event.at) state.stacks = 0;
    state.stacks = Math.min(5, (state.stacks || 0) + 1);
    state.expiresAt = gw2EffectExpiresAt(event.at, 6);
    ctx.effects.emit({
      kind: 'announcement',
      announcement: {
        type: 'relic',
        name: 'Relic of the Thief',
        at: event.at,
        sourceSkill: event.skillName,
        detail: `${state.stacks}/5 stacks`,
        icon: '',
        cooldownReduction: null,
        expiresAt: state.expiresAt,
        effectState: { stacks: state.stacks, maximumStacks: 5 }
      }
    });
  },
  // Returns 1 (not 0) when no stacks are active — it's a multiplier, not additive.
  strikeMultiplier(_ctx, state, event) {
    return (state.stacks || 0) > 0 && (state.expiresAt || 0) > event.at ? 1 + (state.stacks || 0) * 0.01 : 1;
  }
});
