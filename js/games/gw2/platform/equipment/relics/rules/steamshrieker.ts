import { RELIC_IDS } from '#gw2/platform/equipment/relics/data.js';
/** Steamshrieker relic rules. */
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { defineRelic } from '#gw2/platform/equipment/relics/rules/shared.js';

export const steamshrieker = defineRelic({
  // Describe eligibility at the rule owner; discovery still executes real player actions.
  damagePreview: { comboField: 'Water', requirement: 'Requires a player blast or leap finisher in a water field.' },
  combo(ctx, _state, event) {
    if (
      !isGw2PlayerActorEvent(event) ||
      event.fieldType !== 'Water' ||
      !['Blast', 'Leap'].includes(String(event.finisherType || ''))
    ) {
      return;
    }

    // Steamshrieker is a shared relic: every profession's successful player-owned water blast or leap burns once.
    ctx.effects.emit({
      kind: 'packet',
      event: {
        type: 'condition',
        at: event.at,
        source: 'Relic',
        sourceId: `relic.${RELIC_IDS.STEAMSHRIEKER}`,
        actorType: 'effect',
        ownerActorType: 'player',
        skillName: 'Relic of Steamshrieker',
        name: 'Relic of Steamshrieker — Burning',
        condition: 'Burning',
        stacks: 1,
        duration: 5,
        triggeredBy: event.skillName
      }
    });
    ctx.effects.emit({
      kind: 'announcement',
      announcement: { type: 'relic', name: 'Relic of Steamshrieker', at: event.at, sourceSkill: event.skillName }
    });
  }
});
