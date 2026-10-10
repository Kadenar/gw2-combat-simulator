import type { ProfessionAttributePreviewContext } from '#gw2/platform/profession-presentation/attribute-preview.js';
import { createPreviewControls } from '#gw2/professions/shared/attribute-preview.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { PARAGON_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/specializations/paragon/profiles.js';
import {
  warriorAdrenalineResourceViews,
  warriorBurstPaletteOverride,
  warriorPaletteGroups,
  warriorUiState
} from '#gw2/professions/warrior/core/presentation.js';
import type { ProfessionResourceView, RotationStateSnapshotItem } from '#gw2/platform/profession-presentation/types.js';
import type { WarriorUiContext, WarriorUiSlice } from '#gw2/professions/warrior/types.js';

const CHANTS = Object.freeze([ID.CHANT_OF_ACTION, ID.CHANT_OF_RECUPERATION, ID.CHANT_OF_FREEDOM]);

function resources(context: WarriorUiContext): ProfessionResourceView[] {
  const state = warriorUiState(context);
  return [
    ...warriorAdrenalineResourceViews(context),
    {
      id: 'motivation',
      singular: 'motivation',
      plural: 'motivation',
      // Reflect the initialized pool, including patch-selected Motivation limits.
      maximum:
        state.motivation?.maximum ??
        balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.resources), 'maximumStacks'),
      value: state.motivation?.value ?? 0,
      canStart: false,
      step: 1,
      displayMode: 'counter',
      pipStyle: 'warrior-motivation',
      shortLabel: 'Mot',
      statusLabel: 'Current'
    }
  ];
}

/** Shows the refrain currently pulsing while Paragon still has motivation to sustain it. */
function paragonStateSnapshot(context: WarriorUiContext): RotationStateSnapshotItem[] {
  const state = warriorUiState(context);
  const refrain = state.activeRefrain || '';
  return refrain && (state.motivation?.value ?? 0) > 0
    ? [
        {
          id: 'paragon-active-refrain',
          label: 'Active Refrain',
          value: refrain,
          title: 'Refrain currently consuming Motivation on each pulse'
        }
      ]
    : [];
}

export const paragonUi: WarriorUiSlice = Object.freeze({
  /** Preview the held motivation tier and refrain without starting combat pulses. */
  previewControls(context: ProfessionAttributePreviewContext) {
    const preview = createPreviewControls(context);
    preview.add({
      key: 'motivation',
      label: 'Motivation',
      group: 'Mechanic',
      kind: 'special',
      scope: ['damage'],
      max: balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.resources), 'maximumStacks'),
      description: 'Current motivation'
    });
    preview.add({
      key: 'refrain',
      label: 'Active refrain',
      group: 'Mechanic',
      kind: 'special',
      scope: ['damage'],
      options: ['', ...CHANTS.map(String)],
      optionLabels: Object.fromEntries([
        ['', 'None'],
        ...CHANTS.map((id) => [String(id), context.catalog.skillsById.get(id)!.name])
      ]),
      description: 'Currently chanted refrain'
    });
    return preview.controls;
  },
  // Burst tiles are authored for a specific weapon set; inactive-set insertion needs an explicit swap.
  paletteOverride: (context, skill) => {
    return warriorBurstPaletteOverride(context, skill);
  },
  // Put chants on their own F row so Motivation can sit beside them while adrenaline stays above weapon bursts.
  paletteGroups: (context: WarriorUiContext) => {
    const [bursts, ...otherGroups] = warriorPaletteGroups(context);
    return [
      { ...bursts, stackId: 'paragon-profession', className: `${bursts.className} paragon-f-skills` },
      {
        id: 'paragon-chants',
        label: 'F',
        skillIds: CHANTS,
        color: '#d79b55',
        stackId: 'paragon-profession',
        className: 'paragon-chants'
      },
      ...otherGroups
    ];
  },
  rotationStateSnapshot: paragonStateSnapshot,
  resourceViews: resources
});
