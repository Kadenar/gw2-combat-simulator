/** Thief relic rules. */
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { gw2EffectExpiresAt } from '#gw2/platform/effects/timing.js';
import { defineRelic } from '#gw2/platform/equipment/relics/rules/shared.js';
import { activeRefreshedStacks, grantRefreshedStacks } from '#gw2/platform/combat/resources/refreshed-stacks.js';

export const thief = defineRelic({
  createState: () => ({ refreshedStacks: { stacks: 0, expiresAt: 0 } }),
  afterHit(ctx, state, event, skill) {
    if (!isGw2PlayerActorEvent(event) || skill?.type !== 'Weapon' || !((skill.cooldown || 0) > 0 || skill.resource)) {
      return;
    }

    // Every qualifying hit refreshes the entire pool, including grants made at the cap.
    const buff = grantRefreshedStacks(
      state.refreshedStacks!,
      1,
      event.at,
      gw2EffectExpiresAt(event.at, 6),
      5,
      'exclusive'
    );
    state.refreshedStacks = buff;
    ctx.effects.emit({
      kind: 'announcement',
      announcement: {
        type: 'relic',
        name: 'Relic of the Thief',
        at: event.at,
        sourceSkill: event.skillName,
        detail: `${buff.stacks}/5 stacks`,
        icon: '',
        cooldownReduction: null,
        expiresAt: buff.expiresAt,
        effectState: { stacks: buff.stacks, maximumStacks: 5 }
      }
    });
  },
  // Returns 1 (not 0) when no stacks are active — it's a multiplier, not additive.
  strikeMultiplier(_ctx, state, event) {
    return 1 + activeRefreshedStacks(state.refreshedStacks, event.at, 'exclusive') * 0.01;
  }
});
