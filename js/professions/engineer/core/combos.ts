import { observeLegacyProfessionCombos } from "../../../platform/gw2/legacy-combo-adapter.js";
import type {
  EngineerSchedulerContext,
  EngineerSimulationEvent,
} from "../types.js";

/** Adapts Engineer-authored fields and finishers to the shared combo pipeline. */
export function observeEngineerComboFinisher(
  context: EngineerSchedulerContext,
  event: EngineerSimulationEvent,
): void {
  observeLegacyProfessionCombos(context, event, {
    ownerId: "engineer",
    ambiguousFieldSelection: "oldest",
    preferredFieldTypes: { Projectile: ["Fire"] },
    legacyInclusiveExpiry: true,
  });
}
