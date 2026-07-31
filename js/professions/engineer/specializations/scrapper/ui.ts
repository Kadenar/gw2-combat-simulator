import {
  engineerFSkillBarGroups,
  engineerToolbeltSkillIds,
  namedSkillId,
  uniqueIdsBySkillName,
} from "../../core/ui.js";
import type {
  ProfessionUiContract,
  SchedulerRecord,
} from "../../../../platform/engine/types.js";
import type { EngineerUiContext } from "../../types.js";

function scrapperProfessionSkills(
  context: EngineerUiContext,
) {
  return [
    ...engineerToolbeltSkillIds(context).slice(0, 4),
    namedSkillId("Function Gyro"),
  ];
}

export const scrapperUi:
Partial<ProfessionUiContract> & SchedulerRecord = Object.freeze({
  skillBarGroups: (context: EngineerUiContext) =>
    engineerFSkillBarGroups(scrapperProfessionSkills(context)),
  paletteGroups: (context: EngineerUiContext) => [{
    id: "engineer-profession",
    label: "F",
    skillIds: uniqueIdsBySkillName(
      scrapperProfessionSkills(context).filter(id => id != null),
    ),
    color: "#b88a35",
    resourceAnchor: true,
    includeActionSkills: true,
  }],
});
