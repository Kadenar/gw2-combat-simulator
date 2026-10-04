import { RELIC_IDS } from '#gw2/platform/equipment/relics/data.js';
/** Blightbringer relic rules. */
import { isInternalCooldownReady } from '#gw2/platform/combat/procs.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { defineRelic } from '#gw2/platform/equipment/relics/rules/shared.js';

// Discovery and runtime share the required number of distinct poison activations.
const REQUIRED_ACTIVATIONS = 6;
export const blightbringer = defineRelic({
  damagePreview: {
    repetitions: REQUIRED_ACTIVATIONS,
    repeatCondition: 'Poisoned',
    requirement: 'Requires distinct player activations that apply Poison.'
  },
  createState: () => ({
    readyAt: 0,
    count: 0,
    trackedActivations: new Set<string>()
  }),
  condition(ctx, state, application, _helpers) {
    if (application.condition !== 'Poisoned' || !isGw2PlayerActorEvent(application)) {
      return;
    }

    // Deduplicate by activationId (or a synthesized key) so a single skill
    // application that produces multiple poison stacks only increments the
    // Blightbringer counter once.
    const tracked = state.trackedActivations;
    const key = application.activationId || `${application.skillId || application.skillName}:${application.at}`;
    if (tracked?.has(key)) return;
    tracked?.add(key);
    state.count = Math.min(REQUIRED_ACTIVATIONS, (state.count || 0) + 1);
    if (state.count < REQUIRED_ACTIVATIONS || !isInternalCooldownReady(application.at, state.readyAt)) {
      return;
    }

    state.count = 0;
    state.readyAt = application.at + 8;
    ctx.effects.emit({
      kind: 'announcement',
      announcement: {
        type: 'relic',
        name: 'Relic of Blightbringer',
        at: application.at,
        sourceSkill: application.skillName
      }
    });
    for (const [condition, stacks, duration] of [
      ['Poisoned', 3, 10],
      ['Crippled', 1, 5],
      ['Weakness', 1, 5]
    ] as const) {
      ctx.effects.emit({
        kind: 'packet',
        settlement: 'reaction',
        event: {
          type: 'condition',
          at: application.at,
          name: `Relic of Blightbringer - ${condition}`,
          skillName: 'Relic of Blightbringer',
          condition,
          duration,
          stacks,
          source: 'Relic',
          sourceId: `relic.${RELIC_IDS.BLIGHTBRINGER}`,
          actorType: 'effect',
          ownerActorType: 'player'
        }
      });
    }
  }
});
