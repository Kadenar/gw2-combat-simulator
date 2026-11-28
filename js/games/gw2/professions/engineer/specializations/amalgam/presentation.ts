import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { buffDeadlineActive } from '#gw2/platform/combat/buff-expiry.js';
import { readProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';
import type {
  ProfessionAttributePreviewContext,
  ProfessionAttributePreviewPreparation
} from '#gw2/platform/profession-presentation/attribute-preview.js';
import type {
  ProfessionSkillBarGroup,
  ProfessionStateSnapshotContext,
  RotationStateSnapshotItem
} from '#gw2/platform/profession-presentation/types.js';
import { planningBuffAt } from '#gw2/platform/results/result-queries.js';
import type { CanonicalCatalog, SkillId } from '#gw2/platform/skills/types.js';
import { engineerToolbeltSkillIds, engineerUiState } from '#gw2/professions/engineer/core/presentation.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import {
  amalgamProtocolControl,
  amalgamProtocolOptions,
  resolveAmalgamSkillId,
  selectAmalgamMorph
} from '#gw2/professions/engineer/specializations/amalgam/selection-policy.js';
import type { AmalgamState } from '#gw2/professions/engineer/specializations/amalgam/state.js';
import type {
  EngineerSkill,
  EngineerUiContext,
  EngineerUiSelection,
  EngineerUiSlice
} from '#gw2/professions/engineer/types.js';
import { createPreviewControls } from '#gw2/professions/shared/attribute-preview.js';
import { selectedTraits } from '#gw2/professions/shared/trait-data.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';

/** Reads the current three Morph selections, preferring the editable build over simulated state. */
function selectedMorphIds(context: EngineerUiContext): number[] {
  return [
    ...(context.build?.selectedMorphSkillIds || engineerUiState(context)[STATE.SELECTED_MORPH_SKILL_IDS] || [])
  ].map(Number);
}

/** Projects the selected protocols and trait-selected Evolve, preferring the editable build. */
function amalgamProfessionSkills(
  catalog: Readonly<CanonicalCatalog<EngineerSkill>>,
  context: EngineerUiContext
): (SkillId | null)[] {
  const traits = context.build?.specializations
    ? new Set(selectedTraits(context.catalog, context.build.specializations).map((trait) => trait.id))
    : context.config;
  const [f2, f3, f4] = selectedMorphIds(context);
  return [
    engineerToolbeltSkillIds(catalog, context)[0],
    f2 ?? null,
    f3 ?? null,
    f4 ?? null,
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
  const options = amalgamProtocolOptions(catalog);
  const protocolGroups = [2, 3, 4].flatMap((slot): ProfessionSkillBarGroup[] => {
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

/** Validates a protocol selection; choosing an equipped protocol swaps the two positions. */
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

/** Shows Evolve and each Silver Lining strain with a duration that is active at the inspected point. */
function amalgamStateSnapshot(
  context: ProfessionStateSnapshotContext<EngineerUiContext['professionState']>
): RotationStateSnapshotItem[] {
  const state = engineerUiState(context);
  const at = Math.max(0, context.atSeconds || 0);
  const items: RotationStateSnapshotItem[] = [];
  // Assumption-backed windows have no deadline, so they read as active instead of an infinite countdown.
  const remainingLabel = (remaining: number): string =>
    Number.isFinite(remaining) ? `${remaining.toFixed(1)}s` : 'Active';
  // Read the same damage windows as the graph at the inspected cursor.
  for (const [kind, label] of [
    ['plasmatic-state', 'Plasmatic State'],
    ['willing-host', 'Willing Host']
  ] as const) {
    const buff = planningBuffAt(context.planningState, kind);

    if (buff) items.push({ id: kind, label, value: remainingLabel(buff.remaining) });
  }

  // Evolve is state-backed, so its remaining duration comes directly from the specialization snapshot.
  const evolveRemaining = (state[STATE.EVOLVED_UNTIL] || 0) - at;

  if (evolveRemaining > 0) {
    items.push({
      id: 'amalgam-evolve',
      label: 'Evolve',
      value: `${evolveRemaining.toFixed(1)}s`,
      title: 'Time remaining in Evolve'
    });
  }

  const strains = [
    ['Resiliant', STATE.RESILIANT_UNTIL],
    ['Replicating', STATE.REPLICATING_UNTIL],
    ['Rapacious', STATE.RAPACIOUS_UNTIL],
    ['Predator', STATE.PREDATOR_UNTIL],
    ['Titanic', STATE.TITANIC_UNTIL],
    ['Berserker', STATE.BERSERKER_UNTIL]
  ] as const;
  const activeStrains = strains.flatMap(([name, id]) => {
    const until = state[id] ?? 0;
    // Boons and Rapacious include their final instant. Titanic's attribute bonus ends at its deadline.
    const active = id === STATE.TITANIC_UNTIL ? until > at : buffDeadlineActive(until, at);
    return active ? [`${name} ${remainingLabel(Math.max(0, until - at))}`] : [];
  });

  if (activeStrains.length) {
    items.push({
      id: 'amalgam-active-strains',
      label: 'Active Strains',
      value: activeStrains.join(' · '),
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

    rotationStateSnapshot: amalgamStateSnapshot,
    skillBarGroups: (context: EngineerUiContext) => amalgamSkillBarGroups(catalog, context),
    loadoutInputControl: ({ build }, skillId) => amalgamProtocolControl(build.selectedMorphSkillIds ?? [], skillId),
    updateSkillBarSelection: (context: EngineerUiContext, selection: EngineerUiSelection) =>
      updateAmalgamSkillBarSelection(catalog, context, selection),
    paletteGroups: (context: EngineerUiContext) => [
      {
        id: 'engineer-profession',
        label: 'F',
        skillIds: [],
        skillEntries: amalgamProfessionSkills(catalog, context).flatMap((skillId, index) =>
          skillId != null && catalog.skillsById.has(skillId) ? [{ skillId, slot: 'Profession_' + (index + 1) }] : []
        ),
        color: '#67aa87',
        className: 'engineer-profession-skills',
        resourceAnchor: true,
        includeActionSkills: true
      }
    ]
  });
}
