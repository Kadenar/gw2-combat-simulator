import { guardianUiSkillIdsByName } from "../../core/ui.js";
import type {
  ProfessionEventLogDescriptor,
  SchedulerRecord,
} from "../../../../platform/engine/types.js";
import type { GuardianResolverEvent, GuardianUiContext } from "../../types.js";

function willbenderEventLogRow(
  _context: SchedulerRecord,
  event: GuardianResolverEvent,
): ProfessionEventLogDescriptor | null | undefined {
  if (event.type.startsWith("guardian.willbender-")) return null; // null = explicitly suppress; internal scheduler events should not appear in the log
  return undefined; // undefined = defer to the default renderer for all other event types
}

const VIRTUE_NAMES = Object.freeze([
  "Rushing Justice",
  "Flowing Resolve",
  "Crashing Courage",
]);

export const willbenderUi = Object.freeze({
  eventLogRow: willbenderEventLogRow,
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
      resourceAnchor: true,
    },
  ],
});
