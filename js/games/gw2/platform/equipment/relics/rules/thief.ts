/** Thief relic rules. */
import { gw2EffectExpiresAt } from '#gw2/platform/combat/effect-timing.js';
import { activeRefreshedStacks, grantRefreshedStacks } from '#gw2/platform/combat/resources/refreshed-stacks.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { announceRelic, defineRelic } from '#gw2/platform/equipment/relics/rules/shared.js';

export const thief = defineRelic({
  createState: () => ({ refreshedStacks: { stacks: 0, expiresAt: 0 } }),
  afterHit(ctx, state, event, skill) {
    // A missing cost contributes no resource price to the weapon trigger.
    if (
      !isGw2PlayerActorEvent(event) ||
      skill?.type !== 'Weapon' ||
      !((skill.cooldown || 0) > 0 || (skill.cost?.amount ?? 0) > 0 || skill.resource)
    ) {
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
    announceRelic(ctx, event, 'Relic of the Thief', {
      detail: `${buff.stacks}/5 stacks`,
      icon: '',
      cooldownReduction: null,
      expiresAt: buff.expiresAt,
      effectState: { stacks: buff.stacks, maximumStacks: 5 }
    });
  },
  // Return 1 when no stacks are active because the result is a multiplier.
  strikeMultiplier(_ctx, state, event) {
    return 1 + activeRefreshedStacks(state.refreshedStacks, event.at, 'exclusive') * 0.01;
  }
});
