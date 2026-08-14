import { observeLegacyProfessionCombos } from "../../../platform/gw2/legacy-combo-adapter.js";
import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS } from "../data/ids.js";
import { hasGuardianTrait } from "./traits.js";
import type { SimulationEvent } from "../../../platform/engine/types.js";
import type { GuardianSchedulerContext } from "../types.js";

/** Adapts Guardian-authored fields and finishers to the shared combo pipeline. */
export function observeGuardianComboFinisher(
  context: GuardianSchedulerContext,
  event: SimulationEvent,
): void {
  observeLegacyProfessionCombos(context, event, {
    ownerId: "guardian",
    ambiguousFieldSelection: "oldest",
    preferredFieldTypes: { Whirl: ["Fire"] },
    fieldDuration(_fieldContext, _fieldEvent, skill, duration) {
      return skill.id === GUARDIAN_SKILL_IDS.PURGING_FLAMES &&
        hasGuardianTrait(context, GUARDIAN_TRAIT_IDS.MASTER_OF_CONSECRATIONS)
        ? 7
        : duration;
    },
  });
}
