import { guardianUiSkillIdsByName } from "../../core/ui.js";
import type {
  ProfessionEventLogDescriptor,
  SchedulerRecord,
} from "../../../../platform/engine/types.js";
import type { GuardianResolverEvent, GuardianUiContext } from "../../types.js";

function dragonhunterEventLogRow(
  _context: SchedulerRecord,
  event: GuardianResolverEvent,
): ProfessionEventLogDescriptor | null | undefined {
  // null = explicit suppression (hide from log); undefined = no opinion (let platform decide)
  if (event.type.startsWith("guardian.dragonhunter-")) return null;
  return undefined;
}

const VIRTUE_NAMES = Object.freeze([
  "Spear of Justice",
  "Wings of Resolve",
  "Shield of Courage",
]);

export const dragonhunterUi = Object.freeze({
  eventLogRow: dragonhunterEventLogRow,
  skillBarGroups: (context: GuardianUiContext) => [
    {
      id: "guardian-f-keys",
      label: "F Keys",
      skillIds: guardianUiSkillIdsByName(VIRTUE_NAMES, context),
      color: "#2f7eb8",
    },
  ],
  paletteGroups: (context: GuardianUiContext) => [
    {
      id: "profession",
      label: "F",
      skillIds: guardianUiSkillIdsByName(VIRTUE_NAMES, context),
      color: "#2f7eb8",
      resourceAnchor: true, // anchors the virtue tether/resource bar to this palette group
    },
  ],
});
