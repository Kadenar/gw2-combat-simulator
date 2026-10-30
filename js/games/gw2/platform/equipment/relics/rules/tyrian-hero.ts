/** Completed shouts and commands grant personal Superspeed and party boons through normal effect resolution. */
import { boonKey } from '#gw2/platform/combat/boons.js';
import { skillForEvent } from '#gw2/platform/combat/query/runtime-query.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { ACTOR, BOON, RECIPIENT, STATUS } from '#gw2/platform/constants.js';
import { RELIC_IDS } from '#gw2/platform/equipment/relics/data.js';
import { defineRelic } from '#gw2/platform/equipment/relics/rules/shared.js';

export const tyrianHero = defineRelic({
  completed(ctx, _state, event) {
    if (event.cancelled || !isGw2PlayerActorEvent(event)) return;

    const skill = skillForEvent(ctx.helpers, event);

    if (!skill?.categories?.some((category) => category === 'Shout' || category === 'Command')) return;

    const name = 'Relic of the Tyrian Hero';
    ctx.effects.emit({
      kind: 'announcement',
      announcement: { type: 'relic', name, at: event.at, sourceSkill: event.skillName }
    });
    // PvE values: https://wiki.guildwars2.com/wiki/Relic_of_the_Tyrian_Hero
    // Superspeed is a status, so only Might and Swiftness receive boon-duration scaling.
    for (const { kind, duration, stacks, audience } of [
      { kind: STATUS.SUPERSPEED, duration: 3, stacks: 1, audience: { recipients: RECIPIENT.SELF } },
      {
        kind: boonKey(BOON.MIGHT),
        duration: 10,
        stacks: 2,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      },
      {
        kind: boonKey(BOON.SWIFTNESS),
        duration: 10,
        stacks: 1,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      }
    ]) {
      ctx.effects.emit({
        kind: 'packet',
        event: {
          type: 'buff',
          at: event.at,
          kind,
          duration,
          stacks,
          source: 'Relic',
          sourceId: `relic.${RELIC_IDS.TYRIAN_HERO}`,
          actorType: ACTOR.EFFECT,
          ownerActorType: ACTOR.PLAYER,
          name: `${name} - ${kind}`,
          skillName: name,
          triggeredBy: event.skillName,
          activationId: event.activationId,
          audience
        }
      });
    }
  }
});
