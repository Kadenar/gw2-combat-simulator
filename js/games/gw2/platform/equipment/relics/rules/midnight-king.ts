/** Player disables grant party Might and Fury through normal boon duration and recipient resolution. */
import { isInternalCooldownReady } from '#gw2/platform/combat/procs/registry.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { BOON, BOON_NAMES, CONDITION, RECIPIENT } from '#gw2/platform/constants.js';
import { RELIC_IDS } from '#gw2/platform/equipment/relics/data.js';
import { announceRelic, defineRelic, playerOwnedRelicSource } from '#gw2/platform/equipment/relics/rules/shared.js';
import type { Gw2RelicContext, Gw2RelicState } from '#gw2/platform/equipment/relics/types.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';

function grantBoons(ctx: Gw2RelicContext, state: Gw2RelicState, event: SimulationEvent): void {
  // Controls can be observed during preparation, but only landed combat disables grant boons.
  if (!ctx.engagement.hostileEffectsAllowed(event.at)) return;

  if (!isGw2PlayerActorEvent(event) || !isInternalCooldownReady(event.at, state.readyAt)) return;

  state.readyAt = event.at + 1;
  const name = 'Relic of the Midnight King';
  announceRelic(ctx, event, name);
  // One proc owns both boon yields; shared expansion records their applications for reports.
  ctx.effects.emit({
    kind: 'profile',
    profile: { id: `relic.${RELIC_IDS.MIDNIGHT_KING}`, name },
    at: event.at,
    attribution: {
      ...playerOwnedRelicSource(RELIC_IDS.MIDNIGHT_KING),
      skillName: name,
      triggeredBy: event.skillName,
      activationId: event.activationId
    },
    effects: [
      { boon: BOON.MIGHT, duration: 9, stacks: 3 },
      { boon: BOON.FURY, duration: 5, stacks: 1 }
    ].map((effect) => ({
      ...effect,
      name: `${name} - ${BOON_NAMES[effect.boon]}`,
      type: 'boon' as const,
      audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
    })),
    transform: (packet, effect) => ({ ...packet, name: effect.name })
  });
}

export const midnightKing = defineRelic({
  createState: () => ({ readyAt: 0 }),
  control: grantBoons,
  condition(ctx, state, event) {
    // Fear already reaches the shared control hook; condition-based Taunt needs the same cooldown claim.
    if (event.condition === CONDITION.TAUNT) grantBoons(ctx, state, event);
  }
});
