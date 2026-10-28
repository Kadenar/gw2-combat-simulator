import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { readProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';
import type { ProfessionAttributePreviewPreparation } from '#gw2/platform/profession-presentation/attribute-preview.js';
import type { SpellbreakerState } from '#gw2/professions/warrior/specializations/spellbreaker/state.js';
import { createPreviewControls } from '#gw2/professions/shared/attribute-preview.js';
import { balanceNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
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
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';

const SKILLS = Object.freeze([ID.FULL_COUNTER]);

export const spellbreakerUi: WarriorUiSlice = Object.freeze({
  /** Spellbreaker's starting cap belongs to its intrinsic Conviction trait; Core applies the shared configuration field. */
  previewControls(context) {
    const preview = createPreviewControls(context);
    // Insight uses native timed stacks in both isolated previews, separate from combat-earned stacks.
    preview.trait("Attacker's Insight", {
      key: 'attackersInsight',
      kind: 'special',
      scope: ['attributes', 'damage'],
      max: preview.maximumStacks("Attacker's Insight"),
      description: 'Power / Precision / Ferocity per active stack'
    });
    // Expose held combat bonuses to isolated damage calculations.
    preview.trait('Magebane Tether', {
      key: 'magebaneTether',
      kind: 'special',
      scope: ['damage'],
      description: 'Tether damage bonus active'
    });
    preview.add({
      key: 'adrenaline',
      label: 'Starting adrenaline',
      group: 'Mechanic',
      kind: 'special',
      scope: ['damage'],
      max: balanceNumberFromContext(context, TRAIT.SPELLBREAKERS_CONVICTION, 'maximumStacks'),
      initial: Number(context.build.initialResource) || 0,
      description: 'Adrenaline before setup; bursts use the Spellbreaker tier'
    });
    return preview.controls;
  },
  /** Seed only the detached attribute state so preview stacks never enter saved assumptions. */
  prepareAttributePreview(context: ProfessionAttributePreviewPreparation) {
    readProfessionSpecializationState<SpellbreakerState>(
      context.professionState,
      'Spellbreaker'
    )!.attackerInsightExpiries = Array.from({ length: Number(context.values.attackersInsight) || 0 }, () => Infinity);
  },
  // Burst tiles are authored for a specific weapon set; inactive-set insertion needs an explicit swap.
  paletteOverride: (context, skill) => {
    return warriorBurstPaletteOverride(context, skill);
  },
  paletteGroups: (context: WarriorUiContext) => warriorPaletteGroups(context, SKILLS),
  resourceViews: (context: WarriorUiContext) =>
    warriorAdrenalineResourceViews(
      context,
      balanceNumberFromContext(context, TRAIT.SPELLBREAKERS_CONVICTION, 'maximumStacks')
    ),
  rotationStateSnapshot: (context: WarriorUiContext) => {
    const state = warriorUiState(context);
    const at = warriorSnapshotAt(context);
    const items: RotationStateSnapshotItem[] = [];
    const insight = activeStackCount(state[STATE.ATTACKER_INSIGHT_EXPIRIES] || [], at);

    if (insight > 0) {
      items.push({
        id: 'attackers-insight',
        label: "Attacker's Insight",
        value: `${insight}`,
        title: "Attacker's Insight stacks currently active"
      });
    }

    const tether = (state[STATE.MAGEBANE_TETHER_UNTIL] || 0) - at;

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
