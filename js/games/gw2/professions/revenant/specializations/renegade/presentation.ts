import { ENDURANCE } from '#gw2/platform/combat/resources/endurance-rules.js';
import type { ProfessionStateSnapshotContext } from '#gw2/platform/profession-presentation/types.js';
import type {
  ProfessionAttributePreviewContext,
  ProfessionAttributePreviewPreparation
} from '#gw2/platform/profession-presentation/attribute-preview.js';
import { createPreviewControls } from '#gw2/professions/shared/attribute-preview.js';
import { readProfessionCoreState } from '#gw2/platform/profession-definition/state.js';
import { type RevenantCoreState } from '#gw2/professions/revenant/core/state.js';
import { REVENANT_SKILL_IDS as SKILL, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { selectedTraits } from '#gw2/professions/shared/trait-data.js';
import { RENEGADE_ENHANCED_SKILL_BY_ID } from '#gw2/professions/revenant/data/renegade-enhanced-skills.js';
import { balanceNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { revenantUiState } from '#gw2/professions/revenant/core/presentation.js';
import { planningBuffAt } from '#gw2/platform/results/result-queries.js';
import type {
  ProfessionEffectPresentation,
  RotationStateSnapshotItem
} from '#gw2/platform/profession-presentation/types.js';
import type { RevenantSkill, RevenantUiContext, RevenantUiSlice } from '#gw2/professions/revenant/types.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';

/** Both displays select the same trait-dependent cap as runtime Fervor grants. */
function fervorMaximum(context: RevenantUiContext & Pick<ProfessionStateSnapshotContext, 'balanceContext'>): number {
  // App snapshots provide a build; direct runtime UI queries provide resolved trait IDs.
  const lastingLegacy =
    hasTrait(context, TRAIT.LASTING_LEGACY) ||
    selectedTraits(context.balanceContext.catalog, context.build?.specializations).some(
      (trait) => trait.id === TRAIT.LASTING_LEGACY
    );
  return Math.max(
    1,
    balanceNumberFromContext(
      context.balanceContext,
      lastingLegacy ? TRAIT.LASTING_LEGACY : TRAIT.AMBUSH_COMMANDER,
      'maximumStacks'
    )
  );
}

/** Shows Kalla's Fervor stacks and the one-use Band Together enhancement window. */
function renegadeStateSnapshot(
  context: RevenantUiContext & Pick<ProfessionStateSnapshotContext, 'balanceContext'>
): RotationStateSnapshotItem[] {
  const state = revenantUiState(context);
  const at = Math.max(0, context.atSeconds || 0);
  const items: RotationStateSnapshotItem[] = [];
  const fervor = (state[STATE.KALLAS_FERVOR] || []).filter(
    (stack) => (stack.at || 0) <= at && (stack.expiresAt || 0) > at
  );

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

  const band = planningBuffAt(context.planningState, 'band-together');

  if (band) {
    items.push({
      id: 'renegade-band-together',
      label: 'Band Together',
      value: `${band.remaining.toFixed(1)}s`,
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
    preview.add({
      key: 'kallasFervor',
      label: "Kalla's Fervor",
      group: 'Mechanic',
      kind: 'special',
      scope: ['damage'],
      max: balanceNumberFromContext(
        context,
        preview.has('Lasting Legacy') ? TRAIT.LASTING_LEGACY : TRAIT.AMBUSH_COMMANDER,
        'maximumStacks'
      ),
      description: 'Active Fervor stacks'
    });
    preview.trait('Brutal Momentum', {
      key: 'fullEndurance',
      kind: 'special',
      scope: ['attributes', 'damage'],
      description: 'Full endurance'
    });
    return preview.controls;
  },
  /** Seed only the detached attribute query; combat state and saved builds remain untouched. */
  prepareAttributePreview(context: ProfessionAttributePreviewPreparation) {
    if ('fullEndurance' in context.values)
      readProfessionCoreState<RevenantCoreState>(context.professionState).endurance!.value = context.values
        .fullEndurance
        ? ENDURANCE.maximum
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
    // The palette observes the same timed buff as combat, including early consumption.
    RENEGADE_ENHANCED_SKILL_BY_ID[Number(skill.id)] != null &&
    planningBuffAt(context.planningState, 'band-together') != null,
  resourceViews: () => []
});
