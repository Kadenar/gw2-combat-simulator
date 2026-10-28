import { WEAPON } from '#gw2/platform/constants.js';
import { readProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';
import type {
  ProfessionAttributePreviewContext,
  ProfessionAttributePreviewPreparation
} from '#gw2/platform/profession-presentation/attribute-preview.js';
import type {
  ProfessionEffectPresentation,
  RotationStateSnapshotItem
} from '#gw2/platform/profession-presentation/types.js';
import { createPreviewControls } from '#gw2/professions/shared/attribute-preview.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
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
  [WEAPON.AXE]: ID.DECAPITATE,
  [WEAPON.DAGGER]: ID.SLICING_MAELSTROM,
  [WEAPON.GREATSWORD]: ID.ARC_DIVIDER,
  [WEAPON.HAMMER]: ID.RUPTURING_SMASH,
  [WEAPON.LONGBOW]: ID.SCORCHED_EARTH,
  [WEAPON.MACE]: ID.SKULL_GRINDER,
  [WEAPON.RIFLE]: ID.GUN_FLAME,
  [WEAPON.SPEAR]: ID.WILD_THROW,
  [WEAPON.STAFF]: ID.RAMPART_SPLITTER,
  [WEAPON.SWORD]: ID.FLAMING_FLURRY
});

export const berserkerUi: WarriorUiSlice = Object.freeze({
  /** Declare this module's conditional inputs without adding simulation settings. */
  previewControls(context: ProfessionAttributePreviewContext) {
    const preview = createPreviewControls(context);
    preview.add({
      key: 'berserk',
      scope: ['attributes', 'damage'],
      label: 'Berserk',
      kind: 'special',
      group: 'Other buffs',
      description: 'Power / Condition Damage and Berserk traits'
    });
    return preview.controls;
  },
  /** Seed only the detached attribute query; combat state and saved builds remain untouched. */
  prepareAttributePreview(context: ProfessionAttributePreviewPreparation) {
    readProfessionSpecializationState<BerserkerState>(context.professionState, 'Berserker')!.berserkUntil = context
      .values.berserk
      ? Infinity
      : null;
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
    const remaining = (state[STATE.BERSERK_UNTIL] ?? 0) - warriorSnapshotAt(context);

    if (state[STATE.BERSERK_UNTIL] == null || remaining <= 0) return [];

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
