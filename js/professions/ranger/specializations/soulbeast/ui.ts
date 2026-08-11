import { RANGER_SKILL_IDS as ID } from "../../data/ids.js";
import {
  rangerPetPaletteGroup,
  rangerUiState,
  selectedRangerUiPet,
} from "../../core/ui.js";
import type {
  CanonicalCatalog,
  PaletteSkillAvailability,
  ProfessionPaletteGroup,
  ProfessionUiContract,
  SchedulerRecord,
  SkillId,
} from "../../../../platform/engine/types.js";
import type { RangerSkill, RangerUiContext } from "../../types.js";

let beastmodeSkillIds = new Set<SkillId>();
const BEASTMODE_TOGGLE_IDS = new Set<SkillId>([
  ID.BEASTMODE,
  ID.LEAVE_BEASTMODE,
]);
const SOULBEAST_HIDDEN_EVENT_TYPES = new Set([
  "ranger.beastmode",
  "ranger.boon-extension",
]);

function beastmodeActive(context: RangerUiContext): boolean {
  return rangerUiState(context).beastmodeActive !== false;
}

function availability(
  context: RangerUiContext,
  skill: RangerSkill,
): PaletteSkillAvailability {
  const active = beastmodeActive(context);
  const selectedSkillIds =
    selectedRangerUiPet(context)?.beastmodeSkillIds || [];
  if (
    beastmodeSkillIds.has(skill.id) &&
    !BEASTMODE_TOGGLE_IDS.has(skill.id) &&
    !selectedSkillIds.includes(skill.id)
  ) {
    return {
      available: false,
      message: "Select the pet that grants this merged Beast skill",
    };
  }
  if (skill.beastmodeSkill && !active && skill.id !== ID.BEASTMODE) {
    return { available: false, message: "Enter Beastmode first" };
  }
  if (skill.id === ID.BEASTMODE && active) {
    return { available: false, message: "Beastmode is already active" };
  }
  if (skill.id === ID.LEAVE_BEASTMODE && !active) {
    return { available: false, message: "Beastmode is not active" };
  }
  return { available: true, message: "" };
}

function paletteGroups(context: RangerUiContext): ProfessionPaletteGroup[] {
  const active = beastmodeActive(context);
  const groups: ProfessionPaletteGroup[] = [
    {
      id: "ranger-soulbeast-profession",
      label: "Beastmode",
      skillIds: active
        ? [
            ID.LEAVE_BEASTMODE,
            ...(selectedRangerUiPet(context)?.beastmodeSkillIds || []),
          ]
        : [ID.BEASTMODE],
      color: "#b78b42",
      resourceAnchor: true,
    },
  ];
  if (!active) groups.push(rangerPetPaletteGroup(context));
  return groups;
}

const soulbeastUi: Partial<ProfessionUiContract> & SchedulerRecord =
  Object.freeze({
    skillBarGroups: (context: RangerUiContext) => [
      {
        id: "ranger-soulbeast-f5",
        label: "Beastmode",
        skillIds: [
          beastmodeActive(context) ? ID.LEAVE_BEASTMODE : ID.BEASTMODE,
        ],
        color: "#b78b42",
        className: "ranger-soulbeast-beastmode",
      },
    ],
    paletteGroups,
    paletteSkillAvailability: availability,
    eventLogRow: (_context: RangerUiContext, event: SchedulerRecord) =>
      SOULBEAST_HIDDEN_EVENT_TYPES.has(String(event.type)) ? null : undefined,
  });

export function bindSoulbeastUi(catalog: Readonly<CanonicalCatalog>) {
  beastmodeSkillIds = new Set(
    catalog.skills
      .filter((skill) => skill.beastmodeSkill)
      .map((skill) => skill.id),
  );
  return soulbeastUi;
}
