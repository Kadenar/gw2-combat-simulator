import {
  engineerFSkillBarGroups,
  engineerUiState,
  namedSkillId,
  uniqueIdsBySkillName,
} from "../../core/ui.js";
import { getActiveTraits } from "../../data/traits-data.js";
import { selectedMechCommands } from "./state.js";
import type {
  ProfessionUiContract,
  SchedulerRecord,
} from "../../../../platform/engine/types.js";
import type { EngineerUiContext } from "../../types.js";

function mechanistProfessionSkills(
  context: EngineerUiContext,
) {
  const activeTraits = getActiveTraits(context.build?.specializations || []);
  const commands = activeTraits.length
    ? selectedMechCommands(
        new Set(activeTraits.flatMap(trait => [trait.id, trait.name])),
      )
    : [...(engineerUiState(context).mech?.commandSkillIds || [])];
  const mechActive = engineerUiState(context).mech?.active !== false;
  return [
    ...commands,
    namedSkillId(mechActive ? "Recall Mech" : "Crash Down"),
  ];
}

export const mechanistUi:
Partial<ProfessionUiContract> & SchedulerRecord = Object.freeze({
  skillBarGroups: (context: EngineerUiContext) =>
    engineerFSkillBarGroups(mechanistProfessionSkills(context)),
  paletteGroups: (context: EngineerUiContext) => [{
    id: "engineer-profession",
    label: "F",
    skillIds: uniqueIdsBySkillName(
      mechanistProfessionSkills(context).filter(id => id != null),
    ),
    color: "#b88a35",
    resourceAnchor: true,
    includeActionSkills: true,
  }],
});
