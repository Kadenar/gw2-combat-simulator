import { AMALGAM_MORPH_KIND_BY_SKILL_ID } from '#gw2/professions/engineer/specializations/amalgam/skills/protocol-skills.js';
import type {
  ProfessionAttributePreviewContext,
  ProfessionAttributePreviewPreparation
} from '#gw2/platform/profession-presentation/attribute-preview.js';
import { createPreviewControls } from '#gw2/professions/shared/attribute-preview.js';
import { readProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import type { AmalgamState } from '#gw2/professions/engineer/specializations/amalgam/state.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { CanonicalCatalog, SkillId } from '#gw2/platform/engine/skills/types.js';
import type {
  ProfessionSkillBarGroup,
  RotationStateSnapshotItem
} from '#gw2/platform/profession-presentation/types.js';
import { gw2EffectExpiresAt } from '#gw2/platform/skills/timing.js';
import { ENGINEER_ASSUMPTION_CONTROLS } from '#gw2/professions/engineer/build/assumptions.js';
import {
  engineerToolbeltSkillIds,
  engineerUiState,
  uniqueSkillIds
} from '#gw2/professions/engineer/core/presentation.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { getActiveTraits } from '#gw2/professions/engineer/data/traits-data.js';
import { resolveAmalgamSkillId } from '#gw2/professions/engineer/specializations/amalgam/traits/behavior.js';
import type {
  EngineerSkill,
  EngineerUiContext,
  EngineerUiSelection,
  EngineerUiSlice
} from '#gw2/professions/engineer/types.js';
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
function amalgamProtocolOptions(catalog: Readonly<CanonicalCatalog<EngineerSkill>>, slot: number): EngineerSkill[] {
  return catalog.skills
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

/** Projects the selected protocols and trait-selected Evolve, preferring the editable build. */
function amalgamProfessionSkills(
  catalog: Readonly<CanonicalCatalog<EngineerSkill>>,
  context: EngineerUiContext
): (SkillId | null)[] {
  const traits = context.build?.specializations
    ? new Set(getActiveTraits(context.build.specializations).map((trait) => trait.id))
    : context.config;
  return [
    engineerToolbeltSkillIds(catalog, context)[0],
    ...selectedMorphIds(context).slice(0, 3),
    resolveAmalgamSkillId(hasTrait(traits, TRAIT.DOUBLE_HELIX), ID.EVOLVE_BASE)
  ];
}

/** Builds only editable protocol selectors; fixed F1 and F5 skills stay in the palette. */
function amalgamSkillBarGroups(
  catalog: Readonly<CanonicalCatalog<EngineerSkill>>,
  context: EngineerUiContext
): ProfessionSkillBarGroup[] {
  const skillIds = amalgamProfessionSkills(catalog, context);
  // Match pet selectors with concise selected-name headers while dropdowns retain the full protocol names.
  const protocolGroups = [2, 3, 4].flatMap((slot): ProfessionSkillBarGroup[] => {
    const options = amalgamProtocolOptions(catalog, slot);
    const selected = selectedMorphIds(context)[slot - 2];
    if (options.some((skill) => skill.id === selected)) skillIds[slot - 1] = selected;
    const skillId = skillIds[slot - 1];
    if (skillId == null || !options.length) return [];
    return [
      {
        id: `engineer-amalgam-protocol-${slot}-selection`,
        label: catalog.skillsById.get(skillId)?.name.replace(/^(?:Offensive|Defensive) Protocol: /, '') || 'Protocol',
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
  return protocolGroups;
}

/** Validates a protocol selection and swaps duplicate protocol kinds across mechanic slots. */
function updateAmalgamSkillBarSelection(
  catalog: Readonly<CanonicalCatalog<EngineerSkill>>,
  context: EngineerUiContext,
  selection: EngineerUiSelection
): boolean {
  if (selection.key !== 'selectedMorphSkillIds') return false;
  const index = Number(selection.index);
  const slot = index + 2;
  const nextSkill = catalog.skillsById.get(Number(selection.skillId));
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
  const previousSkill = catalog.skillsById.get(current[index]);
  // Detect if the chosen protocol kind is already selected in a different slot.
  // If so, swap: move the previously-selected protocol into the conflicting slot
  // (using the slot-appropriate skill ID), preventing duplicate protocol kinds.
  const conflictIndex = current.findIndex(
    (skillId, candidateIndex) =>
      candidateIndex !== index &&
      AMALGAM_MORPH_KIND_BY_SKILL_ID.get(skillId) === AMALGAM_MORPH_KIND_BY_SKILL_ID.get(nextSkill.id)
  );
  if (conflictIndex >= 0 && previousSkill) {
    const replacement = amalgamProtocolOptions(catalog, conflictIndex + 2).find(
      (skill) => AMALGAM_MORPH_KIND_BY_SKILL_ID.get(skill.id) === AMALGAM_MORPH_KIND_BY_SKILL_ID.get(previousSkill.id)
    );
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
    if ((event.at || 0) > at) break;
    if (event.type !== 'buff' || event.sourceId !== sourceId) continue;
    remaining = Math.max(remaining, gw2EffectExpiresAt(event.at || 0, event.duration || 0) - at);
  }

  return Math.max(0, remaining);
}

/** Surfaces Evolve and every duration-bearing Silver Lining strain active at the inspected point. */
function amalgamStateSnapshot(context: EngineerUiContext): RotationStateSnapshotItem[] {
  const state = engineerUiState(context);
  const at = Math.max(0, context.atSeconds || 0);
  const items: RotationStateSnapshotItem[] = [];
  // Evolve is state-backed, so its remaining duration comes directly from the specialization snapshot.
  const evolveRemaining = (state.evolvedUntil || 0) - at;
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
    ['Rapacious', (state.rapaciousUntil || 0) - at],
    ['Predator', (state.predatorUntil || 0) - at],
    ['Titanic', (state.titanicUntil || 0) - at],
    ['Berserker', (state.berserkerUntil || 0) - at]
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

/** Captures this UI's catalog so other profession instances cannot change its projections. */
export function bindAmalgamUi(catalog: Readonly<CanonicalCatalog<EngineerSkill>>): EngineerUiSlice {
  return Object.freeze({
    /** Declare this module's conditional inputs without adding simulation settings. */
    previewControls(context: ProfessionAttributePreviewContext) {
      const preview = createPreviewControls(context);

      preview.add({
        key: 'evolved',
        label: 'Evolved',
        kind: 'special',
        group: 'Other buffs',
        description: 'All attributes; includes Double Helix'
      });
      preview.add({
        key: 'titanic',
        label: 'Titanic Strain',
        kind: 'special',
        group: 'Other buffs',
        description: 'Additional attributes from Might'
      });
      return preview.controls;
    },
    /** Seed only the detached attribute query; combat state and saved builds remain untouched. */
    prepareAttributePreview(context: ProfessionAttributePreviewPreparation) {
      const state = readProfessionSpecializationState<AmalgamState>(context.professionState, 'Amalgam')!;
      state.evolvedUntil = context.values.evolved ? 60 : 0;
      state.titanicUntil = context.values.titanic ? 60 : 0;
    },

    assumptionControls: ENGINEER_ASSUMPTION_CONTROLS,
    rotationStateSnapshot: amalgamStateSnapshot,
    skillBarGroups: (context: EngineerUiContext) => amalgamSkillBarGroups(catalog, context),
    updateSkillBarSelection: (context: EngineerUiContext, selection: EngineerUiSelection) =>
      updateAmalgamSkillBarSelection(catalog, context, selection),
    paletteGroups: (context: EngineerUiContext) => [
      {
        id: 'engineer-profession',
        label: 'F',
        skillIds: uniqueSkillIds(
          catalog,
          amalgamProfessionSkills(catalog, context).filter((id) => id != null)
        ),
        color: '#67aa87',
        className: 'engineer-profession-skills',
        resourceAnchor: true,
        includeActionSkills: true
      }
    ]
  });
}
