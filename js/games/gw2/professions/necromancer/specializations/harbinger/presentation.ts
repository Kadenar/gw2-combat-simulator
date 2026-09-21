import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { getActiveTraits } from '#gw2/professions/necromancer/data/traits-data.js';
import {
  necromancerTransformPaletteGroups,
  necromancerSoulShardResourceViews,
  necromancerUiState
} from '#gw2/professions/necromancer/core/presentation.js';
import type {
  ProfessionEffectPresentation,
  ProfessionResourceView,
  RotationStateSnapshotItem
} from '#gw2/platform/profession-presentation/types.js';
import type { NecromancerUiContext, NecromancerUiSlice } from '#gw2/professions/necromancer/types.js';
import { boundedInteger } from '#kernel/core/numeric.js';

/** Builds compact Blight, Cascading Corruption, and active Meltdown rotation-state rows. */
function harbingerStateSnapshot(context: NecromancerUiContext): RotationStateSnapshotItem[] {
  const state = necromancerUiState(context);
  const blight = boundedInteger(state.blight || 0, 0, 0, 25);
  const stacks = boundedInteger(state.cascadingCorruptionStacks || 0, 0, 0, 19);
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

/** Recorded state supplies exact shroud and Meltdown windows; Blight grants replace their previous count. */
const HARBINGER_EFFECT_PRESENTATIONS: readonly ProfessionEffectPresentation[] = Object.freeze([
  {
    id: 'harbinger-blight',
    kind: 'harbinger-blight',
    name: 'Blight',
    maximumStacks: 25,
    replacementGroup: 'harbinger-blight'
  },
  {
    id: 'harbinger-shroud',
    kind: 'harbinger-shroud',
    name: 'Harbinger Shroud',
    stateFromEvent: (event) =>
      event.type === 'necromancer.state'
        ? { stacks: Number((event.state as { activeShroud?: string })?.activeShroud === 'harbinger') }
        : null
  },
  {
    id: 'meltdown',
    kind: 'meltdown',
    name: 'Meltdown',
    stateFromEvent: (event) => {
      if (event.type !== 'necromancer.state') return null;
      const expiresAt = Number((event.state as { meltdownUntil?: number })?.meltdownUntil || 0);
      return { stacks: Number(expiresAt > event.at), expiresAt };
    }
  }
]);

export const harbingerUi: NecromancerUiSlice = Object.freeze({
  effectPresentations: () => [...HARBINGER_EFFECT_PRESENTATIONS],
  paletteGroups: (context: NecromancerUiContext) =>
    necromancerTransformPaletteGroups(context, {
      entryId: ID.HARBINGER_SHROUD,
      exitId: ID.EXIT_HARBINGER_SHROUD,
      shroud: 'harbinger',
      stackId: 'harbinger-profession'
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
