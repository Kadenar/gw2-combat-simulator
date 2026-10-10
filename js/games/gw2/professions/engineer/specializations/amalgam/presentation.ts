import {
  resolveAmalgamSkillId,
  amalgamProtocolOptions,
  selectAmalgamMorph
} from '#gw2/professions/engineer/specializations/amalgam/selection-policy.js';
import type {
  ProfessionAttributePreviewContext,
  ProfessionAttributePreviewPreparation
} from '#gw2/platform/profession-presentation/attribute-preview.js';
import { createPreviewControls } from '#gw2/professions/shared/attribute-preview.js';
import { readProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';
import type { AmalgamState } from '#gw2/professions/engineer/specializations/amalgam/state.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import type { CanonicalCatalog, SkillId } from '#gw2/platform/skills/types.js';
import type {
  ProfessionSkillBarGroup,
  RotationStateSnapshotItem
} from '#gw2/platform/profession-presentation/types.js';
import { gw2EffectExpiresAt } from '#gw2/platform/effects/timing.js';
import { ENGINEER_ASSUMPTION_CONTROLS } from '#gw2/professions/engineer/build/assumptions.js';
import {
  engineerToolbeltSkillIds,
  engineerUiState,
  uniqueSkillIds
} from '#gw2/professions/engineer/core/presentation.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { getActiveTraits } from '#gw2/professions/engineer/data/traits-data.js';
import type {
  EngineerSkill,
  EngineerUiContext,
  EngineerUiSelection,
  EngineerUiSlice
} from '#gw2/professions/engineer/types.js';
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
  if (!context.build) return false;
  const next = selectAmalgamMorph(
    catalog,
    context.build.selectedMorphSkillIds ?? [],
    Number(selection.index),
    Number(selection.skillId)
  );
  if (!next) return false;
  context.build.selectedMorphSkillIds = next;
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
      // Expose held combat bonuses to isolated damage calculations.
      preview.add({
        key: 'plasmaticState',
        label: 'Plasmatic State',
        group: 'Other buffs',
        kind: 'special',
        scope: ['damage'],
        description: 'Plasmatic State damage bonus active'
      });

      // Damage-only bonuses stay out of the attribute panel; stat bonuses drive both isolated previews.
      preview.trait('Willing Host', {
        key: 'willingHost',
        kind: 'special',
        scope: ['damage'],
        description: 'Strike and condition damage bonus after using a Morph skill'
      });
      preview.add({
        key: 'evolved',
        label: 'Evolved',
        kind: 'special',
        scope: ['attributes', 'damage'],
        group: 'Other buffs',
        description: 'All attributes; includes Double Helix'
      });
      preview.add({
        key: 'titanic',
        label: 'Titanic Strain',
        kind: 'special',
        scope: ['attributes', 'damage'],
        group: 'Other buffs',
        description: 'Bonus Power / Condition Damage per selected Might stack; requires Might above 0'
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
