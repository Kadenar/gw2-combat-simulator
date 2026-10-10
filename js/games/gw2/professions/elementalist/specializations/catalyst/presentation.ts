import { planningBuffAt, planningBuffStacks } from '#gw2/platform/results/result-queries.js';
import type {
  ProfessionAttributePreviewContext,
  ProfessionAttributePreviewPreparation
} from '#gw2/platform/profession-presentation/attribute-preview.js';
import { createPreviewControls } from '#gw2/professions/shared/attribute-preview.js';
import { readProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type {
  ProfessionEffectPresentation,
  ProfessionResourceView,
  RotationStateSnapshotItem
} from '#gw2/platform/profession-presentation/types.js';
import {
  ELEMENTALIST_JADE_SPHERE_SKILL_IDS,
  ELEMENTALIST_SKILL_IDS,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
import { CATALYST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/catalyst/profiles.js';
import { type CatalystState } from '#gw2/professions/elementalist/specializations/catalyst/state.js';
import type { ElementalistUiContext, ElementalistUiSlice } from '#gw2/professions/elementalist/types.js';

const CATALYST_SPHERE_SKILL_IDS = Object.freeze(Object.values(ELEMENTALIST_JADE_SPHERE_SKILL_IDS));

function uiState(context: ElementalistUiContext): Partial<CatalystState> {
  return context.professionState || {};
}

/** Shows timed Catalyst combat state that changes decisions at the inspected rotation point. */
function catalystStateSnapshot(context: ElementalistUiContext): RotationStateSnapshotItem[] {
  const state = uiState(context);
  const at = Math.max(0, context.atSeconds || 0);
  const items: RotationStateSnapshotItem[] = [];
  const empowerment = planningBuffStacks(context.planningState, 'elemental empowerment');
  if (empowerment > 0) {
    const elementalEmpowermentProfile = requireBalanceProfileFromContext(
      context.balanceContext,
      TRAIT.ELEMENTAL_EMPOWERMENT
    );
    const maximum = balanceProfileNumber(elementalEmpowermentProfile, 'maximumStacks');
    items.push({
      id: 'catalyst-elemental-empowerment',
      label: 'Elemental Empowerment',
      value: `${empowerment}/${maximum}`,
      title: 'Active Elemental Empowerment stacks'
    });
  }

  const empoweringAuras = planningBuffAt(context.planningState, 'empowering auras');
  if (empoweringAuras) {
    const empoweringAurasProfile = requireBalanceProfileFromContext(context.balanceContext, TRAIT.EMPOWERING_AURAS);
    items.push({
      id: 'catalyst-empowering-auras',
      label: 'Empowering Auras',
      value: `${planningBuffStacks(context.planningState, 'empowering auras')}/${balanceProfileNumber(empoweringAurasProfile, 'maximumStacks')} · ${empoweringAuras.remaining.toFixed(1)}s`,
      title: 'Active Empowering Auras stacks and refreshed duration remaining'
    });
  }

  for (const element of ['Fire', 'Water', 'Air', 'Earth']) {
    const remaining = (state.sphereExpiry?.[element] || 0) - at;
    if (remaining <= 0) continue;
    items.push({
      id: `catalyst-${element.toLowerCase()}-sphere`,
      label: `${element} Sphere`,
      value: `${remaining.toFixed(1)}s`,
      title: `Time remaining for the active ${element} Jade Sphere`
    });
  }

  return items;
}

/** Publishes Catalyst effect presentation from its active balance profile. */
function catalystEffectPresentations(_context: ElementalistUiContext): ProfessionEffectPresentation[] {
  return [
    {
      id: 'elementalist-elemental-empowerment',
      kind: 'elemental empowerment',
      name: 'Elemental Empowerment'
    }
  ];
}

/**
 * Catalyst UI contract: the F5 Jade Sphere skill and palette groups, palette gating,
 * the energy resource bar, and the timed state shown at a rotation point.
 */
export const catalystUi: ElementalistUiSlice = Object.freeze({
  /** Declare this module's conditional inputs without adding simulation settings. */
  previewControls(context: ProfessionAttributePreviewContext) {
    const preview = createPreviewControls(context);
    // Expose held combat bonuses to isolated damage calculations.
    if (preview.skills.has(ELEMENTALIST_SKILL_IDS.RELENTLESS_FIRE))
      preview.add({
        key: 'relentlessFire',
        label: 'Relentless Fire',
        group: 'Other buffs',
        kind: 'buff',
        field: 'relentless fire',
        scope: ['damage'],
        description: 'Augment damage bonus active'
      });
    // These are the same resolved buff kinds that the native aura and empowerment owners consume.
    if (preview.has('Elemental Empowerment'))
      preview.trait('Elemental Empowerment', {
        key: 'startingEmpowerment',
        kind: 'buff',
        field: 'elemental empowerment',
        scope: ['damage'],
        max: preview.maximumStacks('Elemental Empowerment'),
        description: 'Starting empowerment stacks; later grants follow the runtime'
      });
    if (preview.has('Empowering Auras'))
      preview.trait('Empowering Auras', {
        key: 'empoweringAuras',
        kind: 'buff',
        field: 'empowering auras',
        scope: ['damage'],
        max: preview.maximumStacks('Empowering Auras'),
        description: 'Aura-earned outgoing damage stacks'
      });

    if (preview.has('Elemental Empowerment'))
      preview.trait('Elemental Empowerment', {
        key: 'elementalEmpowerment',
        kind: 'special',
        max: preview.maximumStacks('Elemental Empowerment'),
        description: 'stacks; includes Empowered Empowerment'
      });
    return preview.controls;
  },
  /** Seed only the detached attribute query; combat state and saved builds remain untouched. */
  prepareAttributePreview(context: ProfessionAttributePreviewPreparation) {
    readProfessionSpecializationState<CatalystState>(
      context.professionState,
      'Catalyst'
    )!.elementalEmpowermentExpiries = Array(Number(context.values.elementalEmpowerment || 0)).fill(60);
  },

  effectPresentations: catalystEffectPresentations,
  paletteGroups: () => [
    {
      id: 'elementalist-catalyst-spheres',
      label: 'F5',
      skillIds: CATALYST_SPHERE_SKILL_IDS,
      color: '#44ddaa',
      className: 'compact-resource-palette elementalist-catalyst-spheres',
      resourceAnchor: true,
      order: -10
    }
  ],
  rotationStateSnapshot: catalystStateSnapshot,
  resourceViews: (context: ElementalistUiContext): ProfessionResourceView[] => {
    const state = uiState(context);
    const build = context.build;
    const resourcesProfile = requireBalanceProfileFromContext(context, PROFILE.resources);
    // Observed clocks carry their selected cap; the build-only view uses the active profile before simulation.
    const maximum = state.catalystEnergy?.maximum ?? balanceProfileNumber(resourcesProfile, 'maximumStacks');
    return [
      {
        id: 'catalyst-energy',
        singular: 'energy',
        plural: 'energy',
        maximum,
        value: state.catalystEnergy?.value ?? Math.min(maximum, build?.initialCatalystEnergy ?? maximum),
        startMaximum: maximum,
        canStart: true,
        buildKey: 'initialCatalystEnergy',
        step: 1,
        displayMode: 'bar',
        pipStyle: 'compact-profession-resource-catalyst-energy',
        shortLabel: 'Energy',
        statusLabel: 'Catalyst'
      }
    ];
  }
});
