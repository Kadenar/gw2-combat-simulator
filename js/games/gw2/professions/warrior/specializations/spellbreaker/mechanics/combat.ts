import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';

/** Resolve this accepted event at the specialization hook position. */
export const spellbreakerControlAccepted = defineTriggerPoint<{ readonly event: Gw2ResolverEvent }>(
  'warrior.spellbreaker-control-accepted',
  [TRAIT.ATTACKERS_INSIGHT]
);

/** Resolve this accepted event at the specialization hook position. */
export const spellbreakerStrike = defineTriggerPoint<{ readonly event: Gw2ResolverEvent }>(
  'warrior.spellbreaker-strike',
  [TRAIT.MAGEBANE_TETHER]
);

/** Dispatch accepted control and strikes at the specialization boundary before their selected trait reactions. */
export const spellbreakerReactions: NonNullable<RuntimeHooks<WarriorRuntimeState, WarriorSkill>['reactions']> = {
  // Queue No Escape from accepted player control; Insight still updates before the condition resolves.
  'control.resolved'(runtime, event) {
    runtime.fireTrigger(spellbreakerControlAccepted, { event });
  },
  // The resolver checks committed recharge before admitting each tether opportunity.
  'damage.resolved'(runtime, event) {
    runtime.fireTrigger(spellbreakerStrike, { event });
  }
};
