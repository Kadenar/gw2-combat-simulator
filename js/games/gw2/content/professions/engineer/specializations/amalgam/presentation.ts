import { ENGINEER_ASSUMPTION_CONTROLS } from '#gw2/content/professions/engineer/build/assumptions.js';
import {
  engineerToolbeltSkillIds,
  engineerUiState,
  namedSkillId,
  uniqueIdsBySkillName
} from '#gw2/content/professions/engineer/core/presentation.js';
import type {
  CanonicalCatalog,
  ProfessionSkillBarGroup,
  ProfessionUiContract,
  RotationStateSnapshotItem,
  SchedulerRecord,
  SimulationEvent,
  SkillId
} from '#gw2/platform/engine/types.js';
import type {
  EngineerResolverEvent,
  EngineerSkill,
  EngineerUiContext,
  EngineerUiSelection
} from '#gw2/content/professions/engineer/types.js';

let engineerSkills: readonly EngineerSkill[] = [];
let engineerSkillsById: ReadonlyMap<SkillId, EngineerSkill> = new Map();
// Canonical display order for protocol dropdowns; skills absent from this map
// sort after all listed entries, then by numeric ID as a tiebreaker.
const AMALGAM_PROTOCOL_ORDER = new Map<string, number>([
  ['Offensive Protocol: Shred', 0],
  ['Offensive Protocol: Demolish', 1],
  ['Offensive Protocol: Obliterate', 2],
  ['Offensive Protocol: Pierce', 3],
  ['Defensive Protocol: Thorns', 4],
  ['Defensive Protocol: Cleanse', 5],
  ['Defensive Protocol: Protect', 6]
]);

/** Returns the catalog-backed Morph choices for a mechanic slot in stable UI order. */
function amalgamProtocolOptions(slot: number): EngineerSkill[] {
  return engineerSkills
    .filter(
      (skill) =>
        skill.specialization === 'Amalgam' && skill.categories?.includes('Morph') && Number(skill.mechanicSlot) === slot
    )
    .sort(
      (left, right) =>
        (AMALGAM_PROTOCOL_ORDER.get(left.name) ?? Number.MAX_SAFE_INTEGER) -
          (AMALGAM_PROTOCOL_ORDER.get(right.name) ?? Number.MAX_SAFE_INTEGER) || Number(left.id) - Number(right.id)
    );
}

/** Reads the current three Morph selections, preferring the editable build over simulated state. */
function selectedMorphIds(context: EngineerUiContext): number[] {
  return [...(context.build?.selectedMorphSkillIds || engineerUiState(context).selectedMorphSkillIds || [])].map(
    Number
  );
}

/** Projects the selected protocols between Amalgam's fixed F1 and F5 skills. */
function amalgamProfessionSkills(context: EngineerUiContext): (SkillId | null)[] {
  return [engineerToolbeltSkillIds(context)[0], ...selectedMorphIds(context).slice(0, 3), namedSkillId('Evolve')];
}

/** Builds one named selector per configurable protocol while leaving F1 and F5 fixed. */
function amalgamSkillBarGroups(context: EngineerUiContext): ProfessionSkillBarGroup[] {
  const skillIds = amalgamProfessionSkills(context);
  // Match pet selectors with concise selected-name headers while dropdowns retain the full protocol names.
  const protocolGroups = [2, 3, 4].flatMap((slot): ProfessionSkillBarGroup[] => {
    const options = amalgamProtocolOptions(slot);
    const selected = Number(selectedMorphIds(context)[slot - 2]);
    if (options.some((skill) => skill.id === selected)) skillIds[slot - 1] = selected;
    const skillId = skillIds[slot - 1];
    if (skillId == null || !options.length) return [];
    return [
      {
        id: `engineer-amalgam-protocol-${slot}-selection`,
        label: engineerSkillsById.get(skillId)?.name.replace(/^(?:Offensive|Defensive) Protocol: /, '') || 'Protocol',
        skillIds: [],
        color: '#67aa87',
        className: 'engineer-amalgam-protocol',
        layout: 'engineer-amalgam-protocols',
        selections: [
          {
            skillId,
            optionSkillIds: options.map((skill) => skill.id),
            selectionKey: 'selectedMorphSkillIds',
            selectionIndex: slot - 2
          }
        ]
      }
    ];
  });
  // Project fixed F1/F5 skills separately so the UI can render them apart from protocol selectors.
  const fixedSkillIds = skillIds.filter(
    (skillId, index): skillId is SkillId => skillId != null && ![1, 2, 3].includes(index)
  );
  return [
    ...(fixedSkillIds.length
      ? [
          {
            id: 'engineer-skill-bar-f-skills',
            label: 'F Skills',
            skillIds: fixedSkillIds,
            color: '#b88a35'
          }
        ]
      : []),
    ...protocolGroups
  ];
}

/** Validates a protocol selection and swaps duplicate protocol names across mechanic slots. */
function updateAmalgamSkillBarSelection(context: EngineerUiContext, selection: EngineerUiSelection): boolean {
  if (selection.key !== 'selectedMorphSkillIds') return false;
  const index = Number(selection.index);
  const slot = index + 2;
  const nextSkill = engineerSkillsById.get(Number(selection.skillId));
  if (
    !context.build ||
    ![0, 1, 2].includes(index) ||
    nextSkill?.specialization !== 'Amalgam' ||
    !nextSkill.categories?.includes('Morph') ||
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
    (skillId, candidateIndex) => candidateIndex !== index && engineerSkillsById.get(skillId)?.name === nextSkill.name
  );
  if (conflictIndex >= 0 && previousSkill) {
    const replacement = amalgamProtocolOptions(conflictIndex + 2).find((skill) => skill.name === previousSkill.name);
    if (!replacement) return false;
    current[conflictIndex] = Number(replacement.id);
  }

  current[index] = Number(nextSkill.id);
  context.build.selectedMorphSkillIds = current;
  return true;
}

/** Reconstructs a source buff's remaining duration from events at the inspected timestamp. */
function activeBuffRemaining(context: EngineerUiContext, sourceId: string, at: number): number {
  let remaining = 0;
  for (const event of (context.result as { events?: readonly SimulationEvent[] } | undefined)?.events || []) {
    if (Number(event.at || 0) > at) break;
    if (event.type !== 'buff' || event.sourceId !== sourceId) continue;
    remaining = Math.max(remaining, Number(event.at || 0) + Number(event.duration || 0) - at);
  }

  return Math.max(0, remaining);
}

/** Surfaces Evolve and every duration-bearing Silver Lining strain active at the inspected point. */
function amalgamStateSnapshot(context: EngineerUiContext): RotationStateSnapshotItem[] {
  const state = engineerUiState(context);
  const at = Math.max(0, Number(context.atSeconds || 0));
  const items: RotationStateSnapshotItem[] = [];
  // Evolve is state-backed, so its remaining duration comes directly from the specialization snapshot.
  const evolveRemaining = Number(state.evolvedUntil || 0) - at;
  if (evolveRemaining > 0) {
    items.push({
      id: 'amalgam-evolve',
      label: 'Evolve',
      value: `${evolveRemaining.toFixed(1)}s`,
      title: 'Time remaining in Evolve'
    });
  }

  // Merge event-backed emitted buffs with timestamp-backed strains before presenting one active summary.
  const strains: [string, number][] = [
    ['Resiliant', activeBuffRemaining(context, 'engineer.resiliant-strain', at)],
    ['Replicating', activeBuffRemaining(context, 'engineer.replicating-strain', at)],
    ['Rapacious', Number(state.rapaciousUntil || 0) - at],
    ['Predator', Number(state.predatorUntil || 0) - at],
    ['Titanic', Number(state.titanicUntil || 0) - at],
    ['Berserker', Number(state.berserkerUntil || 0) - at]
  ];
  const activeStrains = strains.filter(([, remaining]) => remaining > 0);
  if (activeStrains.length) {
    items.push({
      id: 'amalgam-active-strains',
      label: 'Active Strains',
      value: activeStrains.map(([name, remaining]) => `${name} ${remaining.toFixed(1)}s`).join(' · '),
      title: 'Duration-bearing strains currently granted by Evolve or Silver Lining'
    });
  }

  return items;
}

/** Supplies Amalgam-specific skill-bar, palette, snapshot, and event-log presentation behavior. */
export const amalgamUi: Partial<ProfessionUiContract> & SchedulerRecord = Object.freeze({
  eventLogRow: (_context: EngineerUiContext, event: EngineerResolverEvent) =>
    event?.type === 'engineer.state' ? null : undefined,
  assumptionControls: ENGINEER_ASSUMPTION_CONTROLS,
  rotationStateSnapshot: amalgamStateSnapshot,
  skillBarGroups: amalgamSkillBarGroups,
  updateSkillBarSelection: updateAmalgamSkillBarSelection,
  paletteGroups: (context: EngineerUiContext) => [
    {
      id: 'engineer-profession',
      label: 'F',
      skillIds: uniqueIdsBySkillName(amalgamProfessionSkills(context).filter((id) => id != null)),
      color: '#67aa87',
      className: 'engineer-profession-skills',
      resourceAnchor: true,
      includeActionSkills: true
    }
  ]
});

/** Binds canonical skills used by Amalgam UI projections and returns the shared UI contract. */
export function bindAmalgamUi(catalog: Readonly<CanonicalCatalog>): typeof amalgamUi {
  engineerSkills = catalog.skills as readonly EngineerSkill[];
  engineerSkillsById = catalog.skillsById as ReadonlyMap<SkillId, EngineerSkill>;
  return amalgamUi;
}
