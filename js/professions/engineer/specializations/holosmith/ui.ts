import { ENGINEER_SKILL_IDS as ID } from "../../data/ids.js";
import {
  engineerFSkillBarGroups,
  engineerToolbeltSkillIds,
  engineerUiSpecialization,
  engineerUiState,
  hasActiveTrait,
  namedSkillId,
  uniqueIdsBySkillName,
} from "../../core/ui.js";
import type {
  CanonicalCatalog,
  PaletteSkillAvailability,
  ProfessionEventLogDescriptor,
  ProfessionResourceView,
  ProfessionUiContract,
  SchedulerRecord,
  SkillId,
} from "../../../../platform/engine/types.js";
import type {
  EngineerResolverEvent,
  EngineerSkill,
  EngineerUiContext,
} from "../../types.js";

const HEAT_STATE_REASONS = new Set<string>([
  "enter-forge",
  "exit-forge",
  "heat",
  "overheat",
  "passive-heat",
  "thermal-release-valve",
]);

const HOLOSMITH_PACKET_EVENTS = new Set<string>([
  "engineer.prime-light-beam-field",
  "engineer.laser-disk",
  "engineer.launch-wall",
]);

let engineerSkills: readonly EngineerSkill[] = [];
let engineerSkillsById: ReadonlyMap<SkillId, EngineerSkill> = new Map();

function holosmithForgeSkillIds(
  context: EngineerUiContext,
): number[] {
  const storm = hasActiveTrait(context, "Crystal Configuration: Storm");
  return [
    storm ? ID.LIGHT_STRIKE_STORM : ID.LIGHT_STRIKE,
    ID.HOLO_LEAP,
    ID.CORONA_BURST,
    ID.PHOTON_BLITZ,
    ID.HOLOGRAPHIC_SHOCKWAVE,
  ].filter((skillId) => engineerSkillsById.has(skillId));
}

function holosmithProfessionSkills(
  context: EngineerUiContext,
) {
  const state = engineerUiState(context);
  return [
    ...engineerToolbeltSkillIds(context).slice(0, 4),
    namedSkillId(
      state.photonForgeActive
        ? "Deactivate Photon Forge"
        : "Engage Photon Forge",
    ),
  ];
}

function holosmithPaletteAvailability(
  context: EngineerUiContext,
  skill: EngineerSkill,
): PaletteSkillAvailability {
  const state = engineerUiState(context);
  if (
    skill.type === "Weapon"
    && skill.weapon
    && state.photonForgeActive
  ) {
    return {
      available: false,
      message: "Photon Forge replaces equipped weapon skills",
    };
  }
  if (skill.forgeSkill && !state.photonForgeActive) {
    return { available: false, message: "Enter Photon Forge first" };
  }
  return { available: true, message: "" };
}

function holosmithEventLogRow(
  context: EngineerUiContext,
  event: EngineerResolverEvent,
): ProfessionEventLogDescriptor | null | undefined {
  if (engineerUiSpecialization(context) !== "Holosmith") return undefined;
  if (HOLOSMITH_PACKET_EVENTS.has(event?.type)) return null;
  if (
    event?.type !== "engineer.state"
    || !HEAT_STATE_REASONS.has(String(event.reason || ""))
  ) return undefined;
  return {
    type: event.type,
    description:
      `${event.reason || "State"} - ` +
      `Heat ${Number(event.state?.heat || 0).toFixed(1)}`,
    className: "resource",
    order: 30,
    flags: [],
  };
}

export const holosmithUi:
Partial<ProfessionUiContract> & SchedulerRecord = Object.freeze({
  eventLogRow: holosmithEventLogRow,
  skillBarGroups: (context: EngineerUiContext) => [
    ...engineerFSkillBarGroups(holosmithProfessionSkills(context)),
    {
      id: "engineer-photon-forge",
      label: "Photon Forge",
      skillIds: holosmithForgeSkillIds(context),
      color: "#e5a72d",
    },
  ],
  paletteGroups: (context: EngineerUiContext) => {
    const storm = hasActiveTrait(context, "Crystal Configuration: Storm");
    return [
      {
        id: "engineer-profession",
        label: "F",
        skillIds: uniqueIdsBySkillName(
          holosmithProfessionSkills(context).filter(id => id != null),
        ),
        color: "#b88a35",
        resourceAnchor: true,
        includeActionSkills: true,
      },
      {
        id: "engineer-forge",
        label: "Forge",
        skillIds: engineerSkills
          .filter((skill) => {
            if (!skill.forgeSkill) return false;
            if (skill.slot !== "Weapon_1") return true;
            return skill.name.endsWith("—Storm") === storm;
          })
          .map((skill) => skill.id),
        color: "#e5a72d",
      },
    ];
  },
  resourceViews: (
    context: EngineerUiContext,
  ): ProfessionResourceView[] => {
    const state = engineerUiState(context);
    const maximum = Number(state.maximumHeat || 100);
    return [{
      id: "heat",
      singular: "heat",
      plural: "heat",
      maximum,
      value: Number(state.heat ?? context.initialHeat ?? 0),
      startMaximum: maximum,
      startValue: Number(context.initialHeat ?? 0),
      canStart: true,
      buildKey: "initialHeat",
      step: 1,
      displayMode: "bar",
      shortLabel: "Heat",
      statusLabel: state.overheated ? "Overheated" : "Current",
    }];
  },
  paletteSkillAvailability: holosmithPaletteAvailability,
});

export function bindHolosmithUi(
  catalog: Readonly<CanonicalCatalog>,
): typeof holosmithUi {
  engineerSkills = catalog.skills as readonly EngineerSkill[];
  engineerSkillsById =
    catalog.skillsById as ReadonlyMap<SkillId, EngineerSkill>;
  return holosmithUi;
}
