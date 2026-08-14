import {
  engineerFSkillBarGroups,
  engineerToolbeltSkillIds,
  namedSkillId,
  uniqueIdsBySkillName,
} from "../../core/ui.js";
import type {
  ProfessionEventLogDescriptor,
  ProfessionUiContract,
  SchedulerRecord,
} from "../../../../platform/engine/types.js";
import type { EngineerResolverEvent, EngineerUiContext } from "../../types.js";

function scrapperProfessionSkills(context: EngineerUiContext) {
  return [
    ...engineerToolbeltSkillIds(context).slice(0, 4),
    namedSkillId("Function Gyro"),
  ];
}

function scrapperEventLogRow(
  _context: EngineerUiContext,
  event: EngineerResolverEvent,
): ProfessionEventLogDescriptor | null | undefined {
  return ["engineer.mass-momentum-pulse", "engineer.state"].includes(
    event?.type,
  )
    ? null
    : undefined;
}

export const scrapperUi: Partial<ProfessionUiContract> & SchedulerRecord =
  Object.freeze({
    eventLogRow: scrapperEventLogRow,
    skillBarGroups: (context: EngineerUiContext) =>
      engineerFSkillBarGroups(scrapperProfessionSkills(context)),
    paletteGroups: (context: EngineerUiContext) => [
      {
        id: "engineer-profession",
        label: "F",
        skillIds: uniqueIdsBySkillName(
          scrapperProfessionSkills(context).filter((id) => id != null),
        ),
        color: "#b88a35",
        className: "engineer-profession-skills",
        resourceAnchor: true,
        includeActionSkills: true,
      },
    ],
  });
