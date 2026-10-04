import { readProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import type {
  ProfessionAttributePreviewContext,
  ProfessionAttributePreviewPreparation
} from '#gw2/platform/profession-presentation/attribute-preview.js';
import type {
  ProfessionEffectPresentation,
  RotationStateSnapshotItem
} from '#gw2/platform/profession-presentation/types.js';
import { createPreviewControls } from '#gw2/professions/shared/attribute-preview.js';
import {
  formatSecondsRemaining,
  warriorAdrenalineResourceViews,
  warriorBurstPaletteOverride,
  warriorPaletteGroups,
  warriorSnapshotAt,
  warriorUiState
} from '#gw2/professions/warrior/core/presentation.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import type { BerserkerState } from '#gw2/professions/warrior/specializations/berserker/state.js';
import type { WarriorUiContext, WarriorUiSlice } from '#gw2/professions/warrior/types.js';

const SKILLS = Object.freeze([ID.BERSERK]);
const BERSERKER_EFFECT_PRESENTATIONS: readonly ProfessionEffectPresentation[] = Object.freeze([
  { id: 'warrior-berserk', kind: 'berserk', name: 'Berserk' }
]);
const PRIMAL_BURSTS_BY_WEAPON: Readonly<Record<string, number>> = Object.freeze({
  Axe: ID.DECAPITATE,
  Dagger: ID.SLICING_MAELSTROM,
  Greatsword: ID.ARC_DIVIDER,
  Hammer: ID.RUPTURING_SMASH,
  Longbow: ID.SCORCHED_EARTH,
  Mace: ID.SKULL_GRINDER,
  Rifle: ID.GUN_FLAME,
  Spear: ID.WILD_THROW,
  Staff: ID.RAMPART_SPLITTER,
  Sword: ID.FLAMING_FLURRY
});

export const berserkerUi: WarriorUiSlice = Object.freeze({
  /** Declare this module's conditional inputs without adding simulation settings. */
  previewControls(context: ProfessionAttributePreviewContext) {
    const preview = createPreviewControls(context);
    preview.add({
      key: 'berserk',
      label: 'Berserk',
      kind: 'special',
      group: 'Other buffs',
      description: 'Power / Condition Damage and Berserk traits'
    });
    return preview.controls;
  },
  /** Seed only the detached attribute query; combat state and saved builds remain untouched. */
  prepareAttributePreview(context: ProfessionAttributePreviewPreparation) {
    readProfessionSpecializationState<BerserkerState>(context.professionState, 'Berserker')!.berserkActive = Boolean(
      context.values.berserk
    );
  },

  // Only this specialization offers its trait-proc overlay; storage remains a browser concern.
  timelineOverlays: () => [
    {
      id: 'king-of-fires',
      storageKey: 'gw2-rotation-overlay-king-of-fires-procs',
      label: 'Overlay King of Fires',
      title: 'Show King of Fires detonations at their simulated positions in the rotation',
      matchesProc: (proc) => proc.type === 'trait_proc' && proc.skill === 'King of Fires'
    }
  ],

  // Burst tiles are authored for a specific weapon set; inactive-set insertion needs an explicit swap.
  paletteOverride: (context, skill) => {
    return warriorBurstPaletteOverride(context, skill, PRIMAL_BURSTS_BY_WEAPON);
  },
  // Berserk is a mode window, so overlapping activation records remain binary in result charts.
  effectPresentations: () => [...BERSERKER_EFFECT_PRESENTATIONS],
  paletteGroups: (context: WarriorUiContext) => warriorPaletteGroups(context, SKILLS, PRIMAL_BURSTS_BY_WEAPON),
  resourceViews: warriorAdrenalineResourceViews,
  rotationStateSnapshot: (context: WarriorUiContext) => {
    const state = warriorUiState(context);
    const remaining = (state.berserkUntil || 0) - warriorSnapshotAt(context);
    if (!state.berserkActive || remaining <= 0) return [];
    const items: RotationStateSnapshotItem[] = [
      {
        id: 'berserk',
        label: 'Berserk',
        value: formatSecondsRemaining(remaining),
        title: 'Time remaining in Berserk mode'
      }
    ];
    return items;
  }
});
