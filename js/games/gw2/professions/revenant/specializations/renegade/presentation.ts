import { REVENANT_SKILL_IDS as SKILL } from '#gw2/professions/revenant/data/ids.js';
import { RENEGADE_ENHANCED_SKILL_BY_ID } from '#gw2/professions/revenant/data/renegade-enhanced-skills.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { revenantUiState } from '#gw2/professions/revenant/core/presentation.js';
import { isBandTogetherReady } from '#gw2/professions/revenant/specializations/renegade/mechanics/kalla-and-band-together.js';
import { RENEGADE_PROFILE_IDS as PROFILE } from '#gw2/professions/revenant/specializations/renegade/profiles.js';
import type {
  ProfessionEffectPresentation,
  RotationStateSnapshotItem
} from '#gw2/platform/profession-presentation/types.js';
import type { RevenantSkill, RevenantUiContext, RevenantUiSlice } from '#gw2/professions/revenant/types.js';

/** Shows Kalla's Fervor stacks and the one-use Band Together enhancement window. */
function renegadeStateSnapshot(context: RevenantUiContext): RotationStateSnapshotItem[] {
  const state = revenantUiState(context);
  const at = Math.max(0, Number(context.atSeconds || 0));
  const items: RotationStateSnapshotItem[] = [];
  const fervor = (state.kallasFervor || []).filter(
    (stack) => Number(stack.at || 0) <= at && Number(stack.expiresAt || 0) > at
  );
  if (fervor.length) {
    const remaining = Math.min(...fervor.map((stack) => Number(stack.expiresAt))) - at;
    items.push({
      id: 'renegade-kallas-fervor',
      label: "Kalla's Fervor",
      value: `${Math.min(5, fervor.length)}/5 · ${remaining.toFixed(1)}s`,
      title: "Active Kalla's Fervor stacks and time until the next stack expires"
    });
  }

  const bandRemaining = Number(state.bandTogetherExpiresAt || 0) - at;
  if (state.bandTogetherReady && bandRemaining > 0) {
    items.push({
      id: 'renegade-band-together',
      label: 'Band Together',
      value: `${bandRemaining.toFixed(1)}s`,
      title: 'Time remaining to empower the next Renegade summon'
    });
  }

  return items;
}

/** Publishes Renegade effect presentation from the same patchable cap used by its mechanics. */
function renegadeEffectPresentations(context: RevenantUiContext): ProfessionEffectPresentation[] {
  return [
    {
      id: 'revenant-kallas-fervor',
      kind: 'kallas-fervor',
      name: "Kalla's Fervor",
      maximumStacks: balanceProfileNumber(
        requireBalanceProfileFromContext(context, PROFILE.kallasFervor),
        'maximumStacks'
      )
    }
  ];
}

export const renegadeUi: RevenantUiSlice = Object.freeze({
  effectPresentations: renegadeEffectPresentations,
  rotationStateSnapshot: renegadeStateSnapshot,
  paletteGroups: () => [
    {
      id: 'revenant-profession-specialization',
      label: 'F',
      skillIds: [SKILL.HEROIC_COMMAND, SKILL.CITADEL_BOMBARDMENT, SKILL.ORDERS_FROM_ABOVE],
      color: '#a84f54',
      // resourceAnchor makes this group the visual attachment point for the energy bar
      resourceAnchor: true
    }
  ],
  isPaletteSkillInstant: (context: RevenantUiContext, skill: RevenantSkill) =>
    // Band Together is instant only when the one-use enhancement window is active; the UI must expose this so the user can see at a glance that the next press is the empowered summon
    RENEGADE_ENHANCED_SKILL_BY_ID[Number(skill.id)] != null &&
    isBandTogetherReady(revenantUiState(context), Number(context.time || 0)),
  resourceViews: () => []
});
