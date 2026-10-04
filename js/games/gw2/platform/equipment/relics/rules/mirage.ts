import { RELIC_IDS } from '#gw2/platform/equipment/relics/data.js';
/** Mirage relic rules. */
import { isInternalCooldownReady } from '#gw2/platform/combat/procs.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { defineRelic } from '#gw2/platform/equipment/relics/rules/shared.js';

export const mirage = defineRelic({
  // Describe eligibility at the rule owner; discovery still executes real player actions.
  damagePreview: { requirement: 'Requires an accepted player evade in combat.' },
  createState: () => ({ readyAt: -Infinity }),
  action(ctx, state, dodge) {
    // A successful player evade claims the same ICD once, at its actual activation.
    if (
      !isGw2PlayerActorEvent(dodge) ||
      dodge.cancelled ||
      dodge.at < (ctx.combatStartTime ?? 0) ||
      !(dodge.evades === true || ['Dodge', 'Dodge / Mirage Cloak', 'Dodge Jump'].includes(String(dodge.skillName))) ||
      !isInternalCooldownReady(dodge.at, state.readyAt)
    )
      return;
    state.readyAt = dodge.at + 1;
    ctx.effects.emit({
      kind: 'packet',
      event: {
        type: 'condition',
        at: dodge.at,
        source: 'Relic',
        sourceId: `relic.${RELIC_IDS.MIRAGE}`,
        actorType: 'effect',
        ownerActorType: 'player',
        triggeredBy: dodge.skillName,
        skillName: 'Relic of the Mirage',
        name: 'Relic of the Mirage ? Torment',
        condition: 'Torment',
        stacks: 2,
        duration: 6
      }
    });
  },
  condition(ctx, _state, application) {
    if (application.sourceId === `relic.${RELIC_IDS.MIRAGE}`) {
      ctx.effects.emit({
        kind: 'announcement',
        announcement: {
          type: 'relic',
          name: 'Relic of the Mirage',
          at: application.at,
          sourceSkill: application.triggeredBy,
          detail: '2 Torment for 6s'
        }
      });
    }
  }
});
