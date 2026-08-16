import { createProfessionAssumptionControls } from "../../../../app/profession/assumptions.js";
import {
  engineerFSkillBarGroups,
  engineerToolbeltSkillIds,
  engineerUiState,
  namedSkillId,
  uniqueIdsBySkillName,
} from "../../core/ui.js";
import type {
  CanonicalCatalog,
  ProfessionUiContract,
  SchedulerRecord,
  SkillId,
} from "../../../../platform/engine/types.js";
import type {
  EngineerResolverEvent,
  EngineerSkill,
  EngineerUiContext,
  EngineerUiSelection,
} from "../../types.js";

let engineerSkills: readonly EngineerSkill[] = [];
let engineerSkillsById: ReadonlyMap<SkillId, EngineerSkill> = new Map();
// Canonical display order for protocol dropdowns; skills absent from this map
// sort after all listed entries, then by numeric ID as a tiebreaker.
const AMALGAM_PROTOCOL_ORDER = new Map<string, number>([
  ["Offensive Protocol: Shred", 0],
  ["Offensive Protocol: Demolish", 1],
  ["Offensive Protocol: Obliterate", 2],
  ["Offensive Protocol: Pierce", 3],
  ["Defensive Protocol: Thorns", 4],
  ["Defensive Protocol: Cleanse", 5],
  ["Defensive Protocol: Protect", 6],
]);

const AMALGAM_ASSUMPTION_CONTROLS = createProfessionAssumptionControls([
  {
    key: "inDamagingField",
    label: "In damaging field",
    type: "boolean",
    defaultValue: false,
    specializations: ["Amalgam"],
  },
]);

function amalgamProtocolOptions(slot: number): EngineerSkill[] {
  return engineerSkills
    .filter(
      (skill) =>
        skill.specialization === "Amalgam" &&
        skill.categories?.includes("Morph") &&
        Number(skill.mechanicSlot) === slot,
    )
    .sort(
      (left, right) =>
        (AMALGAM_PROTOCOL_ORDER.get(left.name) ?? Number.MAX_SAFE_INTEGER) -
          (AMALGAM_PROTOCOL_ORDER.get(right.name) ?? Number.MAX_SAFE_INTEGER) ||
        Number(left.id) - Number(right.id),
    );
}

function selectedMorphIds(context: EngineerUiContext): number[] {
  return [
    ...(context.build?.selectedMorphSkillIds ||
      engineerUiState(context).selectedMorphSkillIds ||
      []),
  ].map(Number);
}

function amalgamProfessionSkills(
  context: EngineerUiContext,
): (SkillId | null)[] {
  return [
    engineerToolbeltSkillIds(context)[0],
    ...selectedMorphIds(context).slice(0, 3),
    namedSkillId("Evolve"),
  ];
}

function amalgamSkillBarGroups(context: EngineerUiContext) {
  const skillIds = amalgamProfessionSkills(context);
  const optionsBySlot = Object.fromEntries(
    [2, 3, 4].map((slot) => {
      const options = amalgamProtocolOptions(slot);
      const selected = Number(selectedMorphIds(context)[slot - 2]);
      if (options.some((skill) => skill.id === selected)) {
        skillIds[slot - 1] = selected;
      }
      return [
        slot,
        {
          label: `F${slot} Protocol`,
          optionSkillIds: options.map((skill) => skill.id),
          selectionKey: "selectedMorphSkillIds",
          selectionIndex: slot - 2,
          color: "#67aa87",
        },
      ];
    }),
  );
  return engineerFSkillBarGroups(skillIds, optionsBySlot);
}

function updateAmalgamSkillBarSelection(
  context: EngineerUiContext,
  selection: EngineerUiSelection,
): boolean {
  if (selection.key !== "selectedMorphSkillIds") return false;
  const index = Number(selection.index);
  const slot = index + 2;
  const nextSkill = engineerSkillsById.get(Number(selection.skillId));
  if (
    !context.build ||
    ![0, 1, 2].includes(index) ||
    nextSkill?.specialization !== "Amalgam" ||
    !nextSkill.categories?.includes("Morph") ||
    Number(nextSkill.mechanicSlot) !== slot
  ) {
    return false;
  }

  const current = Array.isArray(context.build.selectedMorphSkillIds)
    ? [...context.build.selectedMorphSkillIds].map(Number)
    : [];
  const previousSkill = engineerSkillsById.get(current[index]);
  // Detect if the chosen protocol name is already selected in a different slot.
  // If so, swap: move the previously-selected protocol into the conflicting slot
  // (using the slot-appropriate skill ID), preventing duplicate protocol names.
  const conflictIndex = current.findIndex(
    (skillId, candidateIndex) =>
      candidateIndex !== index &&
      engineerSkillsById.get(skillId)?.name === nextSkill.name,
  );
  if (conflictIndex >= 0 && previousSkill) {
    const replacement = amalgamProtocolOptions(conflictIndex + 2).find(
      (skill) => skill.name === previousSkill.name,
    );
    if (!replacement) return false;
    current[conflictIndex] = Number(replacement.id);
  }
  current[index] = Number(nextSkill.id);
  context.build.selectedMorphSkillIds = current;
  return true;
}

export const amalgamUi: Partial<ProfessionUiContract> & SchedulerRecord =
  Object.freeze({
    eventLogRow: (_context: EngineerUiContext, event: EngineerResolverEvent) =>
      event?.type === "engineer.state" ? null : undefined,
    assumptionControls: AMALGAM_ASSUMPTION_CONTROLS,
    skillBarGroups: amalgamSkillBarGroups,
    updateSkillBarSelection: updateAmalgamSkillBarSelection,
    paletteGroups: (context: EngineerUiContext) => [
      {
        id: "engineer-profession",
        label: "F",
        skillIds: uniqueIdsBySkillName(
          amalgamProfessionSkills(context).filter((id) => id != null),
        ),
        color: "#67aa87",
        className: "engineer-profession-skills",
        resourceAnchor: true,
        includeActionSkills: true,
      },
    ],
  });

export function bindAmalgamUi(
  catalog: Readonly<CanonicalCatalog>,
): typeof amalgamUi {
  engineerSkills = catalog.skills as readonly EngineerSkill[];
  engineerSkillsById = catalog.skillsById as ReadonlyMap<
    SkillId,
    EngineerSkill
  >;
  return amalgamUi;
}
