import type {
  ProfessionAttributePreviewContext,
  ProfessionAttributePreviewPreparation
} from '#gw2/platform/profession-presentation/attribute-preview.js';
import { createAttributePreviewControls } from '#gw2/professions/shared/attribute-preview.js';
import { readProfessionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { NecromancerCoreState } from '#gw2/professions/necromancer/core/state.js';
import type { CanonicalCatalog } from '#gw2/platform/engine/skills/types.js';
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
import type { NecromancerSkill, NecromancerUiContext, NecromancerUiSlice } from '#gw2/professions/necromancer/types.js';
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
  const meltdownRemaining = (state.meltdownUntil || 0) - Math.max(0, context.atSeconds || 0);
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

/** Executed transitions and buffs supply shroud, Blight, and Meltdown windows. */
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
      event.type === 'weapon_set' && event.shroudSwap
        ? { stacks: Number(event.sourceId === 'necromancer.shroud-enter') }
        : null
  },
  {
    id: 'meltdown',
    kind: 'meltdown',
    name: 'Meltdown',
    replacementGroup: 'meltdown'
  }
]);

/** Captures this UI's catalog so other profession instances cannot change its projections. */
export function bindHarbingerUi(catalog: Readonly<CanonicalCatalog<NecromancerSkill>>): NecromancerUiSlice {
  return Object.freeze({
    /** Declare this module's conditional inputs without adding simulation settings. */
    attributePreviewControls(context: ProfessionAttributePreviewContext) {
      const preview = createAttributePreviewControls(context);
      preview.condition('Torment', 'Wicked Corruption');
      return preview.controls;
    },
    /** Seed only the detached attribute query; combat state and saved builds remain untouched. */
    prepareAttributePreview(context: ProfessionAttributePreviewPreparation) {
      if (context.values.shroud)
        readProfessionCoreState<NecromancerCoreState>(context.professionState).activeShroud = 'harbinger';
    },

    // Show when Cascading Corruption triggers Meltdown using the existing simulated trait procs.
    timelineOverlays: () => [
      {
        id: 'meltdown',
        storageKey: 'gw2-rotation-overlay-meltdown-procs',
        label: 'Overlay Meltdown',
        title: 'Show Meltdown activations at their simulated positions in the rotation',
        matchesProc: (proc) => proc.type === 'trait_proc' && proc.skill === 'Meltdown'
      }
    ],

    // Refresh the weapon row at this profession's transformation boundary.
    timelineWeaponLineTransition: (context: NecromancerUiContext) =>
      context.skill && [ID.HARBINGER_SHROUD, ID.EXIT_HARBINGER_SHROUD].some((id) => id === context.skill!.id)
        ? (context.weaponLine ?? null)
        : undefined,

    effectPresentations: () => [...HARBINGER_EFFECT_PRESENTATIONS],
    paletteGroups: (context: NecromancerUiContext) =>
      necromancerTransformPaletteGroups(catalog, context, {
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
}
