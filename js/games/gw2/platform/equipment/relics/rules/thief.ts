/** Thief relic rules. */
import { gw2EffectExpiresAt } from '#gw2/platform/combat/effect-timing.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { announceRelic, defineRelic } from '#gw2/platform/equipment/relics/rules/shared.js';
import { activeBatchCount, refreshBatch } from '#kernel/resources/batch.js';

const MAXIMUM_STACKS = 5;

export const thief = defineRelic({
  damagePreview: {
    maximumStacks: MAXIMUM_STACKS,
    prepare(state, stacks) {
      state.refreshedStacks = { count: stacks, expiresAt: Infinity };
    }
  },
  createState: () => ({ refreshedStacks: { count: 0, expiresAt: 0 } }),
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
    const buff = refreshBatch(state.refreshedStacks, 1, {
      at: event.at,
      expiresAt: gw2EffectExpiresAt(event.at, 6),
      maximum: MAXIMUM_STACKS
    }).batch;
    state.refreshedStacks = buff;
    announceRelic(ctx, event, 'Relic of the Thief', {
      detail: `${buff.count}/${MAXIMUM_STACKS} stacks`,
      icon: '',
      cooldownReduction: null,
      expiresAt: buff.expiresAt,
      effectState: { stacks: buff.count, maximumStacks: MAXIMUM_STACKS }
    });
  },
  // Return 1 when no stacks are active because the result is a multiplier.
  strikeMultiplier(_ctx, state, event) {
    return 1 + activeBatchCount(state.refreshedStacks, event.at) * 0.01;
  }
});
