import { NECROMANCER_SKILL_IDS as ID } from "../../data/ids.js";
import {
  necromancerTransformPaletteGroups,
  necromancerTransformSkillBarGroups,
  necromancerUiState,
} from "../../core/ui.js";
import type {
  PaletteSkillAvailability,
  ProfessionEventLogDescriptor,
  ProfessionUiContract,
  SchedulerRecord,
  SkillId,
} from "../../../../platform/engine/types.js";
import type {
  NecromancerSimulationEvent,
  NecromancerSkill,
  NecromancerUiContext,
} from "../../types.js";

const RITUALIST_PACKET_EVENTS = new Set<string>([
  "necromancer.painful-bond",
  "necromancer.weapon-spell",
  "necromancer.weapon-spell-ally-trigger",
]);

function ritualistEventLogRow(
  _context: NecromancerUiContext,
  event: NecromancerSimulationEvent,
): ProfessionEventLogDescriptor | null | undefined {
  return RITUALIST_PACKET_EVENTS.has(event?.type) ? null : undefined;
}

const INNERVATE_BY_SPIRIT: Readonly<Record<string, SkillId>> = Object.freeze({
  anguish: ID.INNERVATE_ANGUISH,
  wanderlust: ID.INNERVATE_WANDERLUST,
  preservation: ID.INNERVATE_PRESERVATION,
});

function ritualistPaletteAvailability(
  context: NecromancerUiContext,
  skill: NecromancerSkill,
): PaletteSkillAvailability {
  const spirit = Object.entries(INNERVATE_BY_SPIRIT)
    .find(([, id]) => id === skill.id)?.[0];
  if (!spirit) return { available: true, message: "" };
  const available = Boolean(necromancerUiState(context).activeSpirits?.[spirit]);
  return {
    available,
    message: available ? "" : `Requires the active ${spirit} spirit`,
  };
}

export const ritualistUi:
  Partial<ProfessionUiContract> & SchedulerRecord = Object.freeze({
    eventLogRow: ritualistEventLogRow,
    paletteGroups: (context: NecromancerUiContext) =>
      necromancerTransformPaletteGroups(context, {
        entryId: ID.RITUALISTS_SHROUD,
        shroud: "ritualist",
        professionSkillIds: Object.values(INNERVATE_BY_SPIRIT),
        stackId: "ritualist-profession",
      }),
    skillBarGroups: (context: NecromancerUiContext) =>
      necromancerTransformSkillBarGroups(context, {
        entryId: ID.RITUALISTS_SHROUD,
        shroud: "ritualist",
        professionSkillIds: Object.values(INNERVATE_BY_SPIRIT),
      }),
    paletteSkillAvailability: ritualistPaletteAvailability,
  });
