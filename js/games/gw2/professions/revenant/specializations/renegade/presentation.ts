import { REVENANT_SKILL_IDS as SKILL } from '#gw2/professions/revenant/data/ids.js';
import { balanceProfileValueFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { revenantUiState } from '#gw2/professions/revenant/core/presentation.js';
import { isBandTogetherReady } from '#gw2/professions/revenant/specializations/renegade/mechanics/kalla-and-band-together.js';
import { RENEGADE_PROFILE_IDS as PROFILE } from '#gw2/professions/revenant/specializations/renegade/profiles.js';
import type {
  ProfessionEffectPresentation,
  ProfessionUiContract,
  RotationStateSnapshotItem
} from '#gw2/platform/engine/profession/types.js';
import type { SchedulerRecord } from '#gw2/platform/engine/execution/types.js';
import type { RevenantSkill, RevenantUiContext } from '#gw2/professions/revenant/types.js';

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
function renegadeEffectPresentations(context: SchedulerRecord): ProfessionEffectPresentation[] {
  return [
    {
      id: 'revenant-kallas-fervor',
      kind: 'kallas-fervor',
      name: "Kalla's Fervor",
      maximumStacks: balanceProfileValueFromContext(context, PROFILE.kallasFervor, 'maximumStacks', 5)
    }
  ];
}

export const renegadeUi: Partial<ProfessionUiContract> & SchedulerRecord = Object.freeze({
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
    skill.handlerId === 'revenant.band-together' &&
    isBandTogetherReady(revenantUiState(context), Number(context.time || 0)),
  resourceViews: () => []
});
