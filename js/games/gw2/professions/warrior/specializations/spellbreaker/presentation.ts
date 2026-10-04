import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import { createPreviewControls } from '#gw2/professions/shared/attribute-preview.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { SPELLBREAKER_BALANCE_PROFILE_IDS } from '#gw2/professions/warrior/specializations/spellbreaker/profiles.js';
import { activeStackCount } from '#gw2/platform/combat/resources/timed-stacks.js';
import {
  formatSecondsRemaining,
  warriorAdrenalineResourceViews,
  warriorBurstPaletteOverride,
  warriorPaletteGroups,
  warriorSnapshotAt,
  warriorUiState
} from '#gw2/professions/warrior/core/presentation.js';
import type { RotationStateSnapshotItem } from '#gw2/platform/profession-presentation/types.js';
import type { WarriorUiContext, WarriorUiSlice } from '#gw2/professions/warrior/types.js';

const SKILLS = Object.freeze([ID.FULL_COUNTER]);
export const spellbreakerUi: WarriorUiSlice = Object.freeze({
  /** Spellbreaker's starting cap belongs to its own resource profile; Core applies the shared configuration field. */
  previewControls(context) {
    const preview = createPreviewControls(context);
    preview.add({
      key: 'adrenaline',
      label: 'Starting adrenaline',
      group: 'Mechanic',
      kind: 'special',
      scope: ['damage'],
      max: balanceProfileNumber(
        requireBalanceProfileFromContext(context, SPELLBREAKER_BALANCE_PROFILE_IDS.resources),
        'maximumStacks'
      ),
      initial: Number(context.build.initialResource) || 0,
      description: 'Adrenaline before setup; bursts use the Spellbreaker tier'
    });
    return preview.controls;
  },
  // Burst tiles are authored for a specific weapon set; inactive-set insertion needs an explicit swap.
  paletteOverride: (context, skill) => {
    return warriorBurstPaletteOverride(context, skill);
  },
  paletteGroups: (context: WarriorUiContext) => warriorPaletteGroups(context, SKILLS),
  resourceViews: (context: WarriorUiContext) => warriorAdrenalineResourceViews(context, 20),
  rotationStateSnapshot: (context: WarriorUiContext) => {
    const state = warriorUiState(context);
    const at = warriorSnapshotAt(context);
    const items: RotationStateSnapshotItem[] = [];
    const insight = activeStackCount(state.attackerInsightExpiries || [], at);
    if (insight > 0) {
      items.push({
        id: 'attackers-insight',
        label: "Attacker's Insight",
        value: `${insight}`,
        title: "Attacker's Insight stacks currently active"
      });
    }

    const tether = (state.magebaneTetherUntil || 0) - at;
    if (tether > 0) {
      items.push({
        id: 'magebane-tether',
        label: 'Magebane Tether',
        value: formatSecondsRemaining(tether),
        title: 'Magebane Tether remaining on the target'
      });
    }

    return items;
  }
});
