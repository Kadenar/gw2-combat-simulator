import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { triggerRapaciousStrain } from '#gw2/professions/engineer/specializations/amalgam/mechanics/strains.js';
import type { EngineerResolverEvent, EngineerRuntime } from '#gw2/professions/engineer/types.js';

/** A positive strike resolved while Amalgam is selected; the cause is the resolved hit. */
export interface AmalgamStrike {
  readonly cause: EngineerResolverEvent;
}

/** Trait-owned Poison lands on an eligible hit before Rapacious Strain checks its own proc. */
export const amalgamStruck = defineTriggerPoint<AmalgamStrike>('engineer.amalgam-struck', [TRAIT.CARBOLIC_COMPOSITION]);

/** Applies damage-triggered trait rewards, then the Rapacious Strain reaction. */
function reactToAmalgamDamage(context: EngineerRuntime, event: EngineerResolverEvent): void {
  if (!(Number(event.coefficient) > 0)) return;

  context.fireTrigger(amalgamStruck, { cause: event });
  triggerRapaciousStrain(context, event);
}

/** Exposes Amalgam's resolver reactions keyed by the canonical event hook name. */
export const amalgamResolverEventReactions = Object.freeze({
  damage: reactToAmalgamDamage
});
