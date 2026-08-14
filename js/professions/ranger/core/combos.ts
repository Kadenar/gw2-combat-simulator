import { observeLegacyProfessionCombos } from "../../../platform/gw2/legacy-combo-adapter.js";
import type { SimulationEvent } from "../../../platform/engine/types.js";
import type { RangerSchedulerContext } from "../types.js";

/** Adapts Ranger-authored fields and finishers to the shared combo pipeline. */
export function observeRangerComboFinisher(
  context: RangerSchedulerContext,
  event: SimulationEvent,
): void {
  observeLegacyProfessionCombos(context, event, {
    ownerId: "ranger",
    ambiguousFieldSelection: "oldest",
  });
}
