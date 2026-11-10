/** Player boon applications earn concentration and refresh the entire pool, without an internal cooldown. */
import { isStandardBoon } from '#gw2/platform/combat/boons.js';
import { gw2EffectExpiresAt } from '#gw2/platform/combat/effect-timing.js';
import { grantRefreshedStacks } from '#gw2/platform/combat/resources/refreshed-stacks.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { ACTOR } from '#gw2/platform/constants.js';
import { announceRelic, defineRelic } from '#gw2/platform/equipment/relics/rules/shared.js';
import { canonicalTime, isTimeInWindow } from '#kernel/core/clock.js';

const MAXIMUM_STACKS = 10;
const CONCENTRATION_PER_STACK = 25;

export const herald = defineRelic({
  createState: () => ({ refreshedStacks: { stacks: 0, expiresAt: 0 }, activations: [] }),
  boon(ctx, state, event) {
    // Ownership alone cannot qualify summons: only the player and explicitly player-owned effects grant stacks.
    if (
      event.type !== 'buff' ||
      event.cancelled ||
      !isStandardBoon(event.kind) ||
      !(isGw2PlayerActorEvent(event) || (event.actorType === ACTOR.EFFECT && event.ownerActorType === ACTOR.PLAYER)) ||
      !(event.resolvedAudience && event.resolvedAudience.recipientCount > 0) ||
      !((event.duration ?? 0) > 0) ||
      !((event.stacks ?? 1) > 0)
    )
      return;

    const buff = grantRefreshedStacks(
      state.refreshedStacks!,
      1,
      event.at,
      gw2EffectExpiresAt(event.at, 3),
      MAXIMUM_STACKS,
      'exclusive'
    );
    state.refreshedStacks = buff;
    // Keep accepted windows so reordered attribute observations cannot see future grants or lose earlier stacks.
    state.activations!.push({ at: canonicalTime(event.at), ...buff });
    announceRelic(ctx, event, 'Relic of the Herald', {
      detail: `${buff.stacks}/${MAXIMUM_STACKS} stacks`,
      icon: '',
      cooldownReduction: null,
      expiresAt: buff.expiresAt,
      effectState: { stacks: buff.stacks, maximumStacks: MAXIMUM_STACKS }
    });
  },
  concentrationBonus(state, at) {
    const time = canonicalTime(at);
    const activations = state.activations!;
    for (let index = activations.length - 1; index >= 0; index -= 1) {
      const activation = activations[index];

      if (activation.at > time) continue;

      return isTimeInWindow(time, activation.at, activation.expiresAt)
        ? activation.stacks * CONCENTRATION_PER_STACK
        : 0;
    }

    return 0;
  }
});
