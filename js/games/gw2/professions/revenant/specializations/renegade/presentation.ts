import type {
  ProfessionAttributePreviewContext,
  ProfessionAttributePreviewPreparation
} from '#gw2/platform/profession-presentation/attribute-preview.js';
import { createPreviewControls } from '#gw2/professions/shared/attribute-preview.js';
import { readProfessionCoreState } from '#gw2/platform/profession-definition/state.js';
import { REVENANT_MAXIMUM_ENDURANCE, type RevenantCoreState } from '#gw2/professions/revenant/core/state.js';
import { REVENANT_SKILL_IDS as SKILL, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { getActiveTraits } from '#gw2/professions/revenant/data/traits-data.js';
import { RENEGADE_ENHANCED_SKILL_BY_ID } from '#gw2/professions/revenant/data/renegade-enhanced-skills.js';
import { requireBalanceProfileFromContext, balanceProfileNumber } from '#gw2/platform/skills/balance-profiles.js';
import { revenantUiState } from '#gw2/professions/revenant/core/presentation.js';
import { isBandTogetherReady } from '#gw2/professions/revenant/specializations/renegade/mechanics/kalla-and-band-together.js';
import { RENEGADE_PROFILE_IDS as PROFILE } from '#gw2/professions/revenant/specializations/renegade/profiles.js';
import type {
  ProfessionEffectPresentation,
  RotationStateSnapshotItem
} from '#gw2/platform/profession-presentation/types.js';
import type { RevenantSkill, RevenantUiContext, RevenantUiSlice } from '#gw2/professions/revenant/types.js';

/** Both displays select the same trait-dependent cap as runtime Fervor grants. */
function fervorMaximum(context: RevenantUiContext): number {
  // App snapshots provide a build; direct runtime UI queries provide resolved trait IDs.
  const lastingLegacy =
    hasTrait(context, TRAIT.LASTING_LEGACY) ||
    getActiveTraits(context.build?.specializations).some((trait) => trait.id === TRAIT.LASTING_LEGACY);
  return Math.max(
    1,
    balanceProfileNumber(
      requireBalanceProfileFromContext(
        context.balanceContext,
        lastingLegacy ? PROFILE.kallasFervorLastingLegacy : PROFILE.kallasFervor
      ),
      'maximumStacks'
    )
  );
}

/** Shows Kalla's Fervor stacks and the one-use Band Together enhancement window. */
function renegadeStateSnapshot(context: RevenantUiContext): RotationStateSnapshotItem[] {
  const state = revenantUiState(context);
  const at = Math.max(0, context.atSeconds || 0);
  const items: RotationStateSnapshotItem[] = [];
  const fervor = (state.kallasFervor || []).filter((stack) => (stack.at || 0) <= at && (stack.expiresAt || 0) > at);
  if (fervor.length) {
    const maximum = fervorMaximum(context);
    const remaining = Math.min(...fervor.map((stack) => stack.expiresAt)) - at;
    items.push({
      id: 'renegade-kallas-fervor',
      label: "Kalla's Fervor",
      value: `${Math.min(maximum, fervor.length)}/${maximum} · ${remaining.toFixed(1)}s`,
      title: "Active Kalla's Fervor stacks and time until the next stack expires"
    });
  }

  const bandRemaining = (state.bandTogetherExpiresAt || 0) - at;
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
function renegadeEffectPresentations(_context: RevenantUiContext): ProfessionEffectPresentation[] {
  return [
    {
      id: 'revenant-kallas-fervor',
      kind: 'kallas-fervor',
      name: "Kalla's Fervor"
    }
  ];
}

export const renegadeUi: RevenantUiSlice = Object.freeze({
  /** Declare this module's conditional inputs without adding simulation settings. */
  previewControls(context: ProfessionAttributePreviewContext) {
    const preview = createPreviewControls(context);
    preview.trait('Brutal Momentum', { key: 'fullEndurance', kind: 'special', description: 'Full endurance' });
    return preview.controls;
  },
  /** Seed only the detached attribute query; combat state and saved builds remain untouched. */
  prepareAttributePreview(context: ProfessionAttributePreviewPreparation) {
    if ('fullEndurance' in context.values)
      readProfessionCoreState<RevenantCoreState>(context.professionState).endurance!.value = context.values
        .fullEndurance
        ? REVENANT_MAXIMUM_ENDURANCE
        : 0;
  },

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
    isBandTogetherReady(revenantUiState(context), context.time || 0),
  resourceViews: () => []
});
