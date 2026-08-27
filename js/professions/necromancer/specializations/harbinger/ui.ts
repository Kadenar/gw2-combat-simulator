import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import { getActiveTraits } from '../../data/traits-data.js';
import {
  necromancerTransformPaletteGroups,
  necromancerSoulShardResourceViews,
  necromancerTransformSkillBarGroups,
  necromancerUiState
} from '../../core/ui.js';
import type {
  ProfessionResourceView,
  ProfessionUiContract,
  RotationStateSnapshotItem,
  SchedulerRecord
} from '../../../../platform/engine/types.js';
import type { NecromancerUiContext } from '../../types.js';

function harbingerStateSnapshot(context: NecromancerUiContext): RotationStateSnapshotItem[] {
  const state = necromancerUiState(context);
  const blight = Math.max(0, Math.min(25, Math.trunc(Number(state.blight || 0))));
  const stacks = Math.max(0, Math.min(19, Math.trunc(Number(state.cascadingCorruptionStacks || 0))));
  const hasTrait = getActiveTraits(context.build?.specializations || []).some(
    (trait) => trait.id === TRAIT.CASCADING_CORRUPTION
  );
  const items: RotationStateSnapshotItem[] = [
    {
      id: 'harbinger-blight',
      label: 'Blight',
      value: `${blight}/25`,
      title: 'Current Harbinger Blight stacks'
    }
  ];

  // Only show Cascading Corruption if the player has the trait or already has stacks (e.g. from a saved initial state).
  if (hasTrait || stacks > 0) {
    items.push({
      id: 'cascading-corruption-stacks',
      label: 'Cascading Corruption',
      value: `${stacks}/20`,
      title: 'Cascading Corruption stacks toward the next Meltdown'
    });
  }

  // Meltdown is a short post-proc damage window, so expose only its remaining active duration.
  const meltdownRemaining = Number(state.meltdownUntil || 0) - Math.max(0, Number(context.atSeconds || 0));

  if (meltdownRemaining > 0) {
    items.push({
      id: 'harbinger-meltdown',
      label: 'Meltdown',
      value: `${meltdownRemaining.toFixed(1)}s`,
      title: 'Time remaining in Meltdown'
    });
  }

  return items;
}

export const harbingerUi: Partial<ProfessionUiContract> & SchedulerRecord = Object.freeze({
  paletteGroups: (context: NecromancerUiContext) =>
    necromancerTransformPaletteGroups(context, {
      entryId: ID.HARBINGER_SHROUD,
      exitId: ID.EXIT_HARBINGER_SHROUD,
      shroud: 'harbinger',
      stackId: 'harbinger-profession'
    }),
  skillBarGroups: (context: NecromancerUiContext) =>
    necromancerTransformSkillBarGroups(context, {
      entryId: ID.HARBINGER_SHROUD,
      exitId: ID.EXIT_HARBINGER_SHROUD,
      shroud: 'harbinger'
    }),
  rotationStateSnapshot: harbingerStateSnapshot,
  resourceViews: (context: NecromancerUiContext): ProfessionResourceView[] => [
    {
      id: 'blight',
      singular: 'blight',
      plural: 'blight',
      maximum: 25,
      value: Number(necromancerUiState(context).blight ?? context.initialBlight ?? 0),
      canStart: true,
      buildKey: 'initialBlight',
      step: 1,
      displayMode: 'bar',
      shortLabel: 'Blt',
      statusLabel: 'Current',
      showInPalette: false
    },
    {
      id: 'cascading-corruption',
      singular: 'Cascading Corruption stack',
      plural: 'Cascading Corruption stacks',
      // Maximum is 19, not 20: entering a simulation with 20 stacks would immediately proc Meltdown before any action.
      maximum: 19,
      value: Number(
        necromancerUiState(context).cascadingCorruptionStacks ?? context.initialCascadingCorruptionStacks ?? 0
      ),
      canStart: true,
      buildKey: 'initialCascadingCorruptionStacks',
      step: 1,
      displayMode: 'counter',
      shortLabel: 'CC',
      statusLabel: 'Current',
      showInPalette: false
    },
    ...necromancerSoulShardResourceViews(context)
  ]
});
