import { observeLegacyProfessionCombos } from "../../../platform/gw2/legacy-combo-adapter.js";
import { NECROMANCER_SKILL_IDS as ID } from "../data/ids.js";
import type {
  NecromancerSchedulerContext,
  NecromancerSimulationEvent,
} from "../types.js";

/** Adapts Necromancer-authored fields and finishers to the shared pipeline. */
export function darkFieldComboFinishers(
  context: NecromancerSchedulerContext,
  event: NecromancerSimulationEvent,
): void {
  if (event.actorType === "summon") return;
  observeLegacyProfessionCombos(context, event, {
    ownerId: "necromancer",
    // Extirpate's existing Necromancer implementation was specifically a Dark
    // finisher. Keep that producer choice while other mixed Reaper fields stay
    // explicitly ambiguous.
    ...(Number(event.skillId) === ID.EXTIRPATE
      ? { preferredFieldTypes: { Whirl: ["Dark"] as const } }
      : {}),
  });
}
