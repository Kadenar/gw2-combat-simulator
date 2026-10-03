import type {
  ProfessionAttributePreviewContext,
  ProfessionAttributePreviewPreparation
} from '#gw2/platform/profession-presentation/attribute-preview.js';
import { createAttributePreviewControls } from '#gw2/professions/shared/attribute-preview.js';
import { readProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import { activeStackCount } from '#gw2/platform/combat/resources/timed-stacks.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type {
  ProfessionEffectPresentation,
  ProfessionResourceView,
  RotationStateSnapshotItem
} from '#gw2/platform/profession-presentation/types.js';
import {
  ELEMENTALIST_JADE_SPHERE_SKILL_IDS,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
import { CATALYST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/catalyst/profiles.js';
import { type CatalystState } from '#gw2/professions/elementalist/specializations/catalyst/state.js';
import type { ElementalistUiContext, ElementalistUiSlice } from '#gw2/professions/elementalist/types.js';

const CATALYST_SPHERE_SKILL_IDS = Object.freeze(Object.values(ELEMENTALIST_JADE_SPHERE_SKILL_IDS));

function uiState(context: ElementalistUiContext): Partial<CatalystState> {
  return context.professionState || {};
}

// Replay grants and refresh observations together so capped refreshes preserve
// live stacks without adding stacks or reviving expired ones.
function empoweringAurasAt(context: ElementalistUiContext, at: number): { stacks: number; remaining: number } | null {
  const empoweringAurasProfile = requireBalanceProfileFromContext(context.balanceContext, TRAIT.EMPOWERING_AURAS);
  const maximum = balanceProfileNumber(empoweringAurasProfile, 'maximumStacks');
  let expiries: number[] = [];
  const applications = (context.result?.events || [])
    .filter((event) => event.type === 'buff' && event.kind === 'empowering auras')
    .map((event) => ({
      at: event.at,
      expiresAt: event.at + (event.duration || 0),
      stacks: Math.max(1, event.stacks || 1)
    }));
  const refreshes = (context.result?.procSteps || [])
    .filter((proc) => proc.type === 'trait_proc' && proc.skill === 'Empowering Auras')
    .map((proc) => ({ at: proc.start / 1000, expiresAt: (proc.expiresAt || 0) / 1000, stacks: 0 }));
  for (const event of [...applications, ...refreshes].sort((a, b) => a.at - b.at)) {
    const applicationAt = event.at;
    if (applicationAt > at) break;
    expiries = expiries.filter((expiry) => expiry > applicationAt);
    const expiresAt = event.expiresAt;
    // Empowering Auras refreshes every active stack whenever another aura is
    // gained, then adds one stack up to five; replay that refresh contract.
    expiries = expiries.map(() => expiresAt);
    for (let stack = 0; stack < event.stacks && expiries.length < maximum; stack += 1) {
      if (expiresAt > applicationAt) expiries.push(expiresAt);
    }
  }

  expiries = expiries.filter((expiry) => expiry > at);
  return expiries.length ? { stacks: expiries.length, remaining: Math.min(...expiries) - at } : null;
}

/** Shows timed Catalyst combat state that changes decisions at the inspected rotation point. */
function catalystStateSnapshot(context: ElementalistUiContext): RotationStateSnapshotItem[] {
  const state = uiState(context);
  const at = Math.max(0, context.atSeconds || 0);
  const items: RotationStateSnapshotItem[] = [];
  const empowerment = activeStackCount(state.elementalEmpowermentExpiries || [], at);
  if (empowerment > 0) {
    const elementalEmpowermentProfile = requireBalanceProfileFromContext(
      context.balanceContext,
      TRAIT.ELEMENTAL_EMPOWERMENT
    );
    const maximum = balanceProfileNumber(elementalEmpowermentProfile, 'maximumStacks');
    items.push({
      id: 'catalyst-elemental-empowerment',
      label: 'Elemental Empowerment',
      value: `${Math.min(maximum, empowerment)}/${maximum}`,
      title: 'Active Elemental Empowerment stacks'
    });
  }

  const empoweringAuras = empoweringAurasAt(context, at);
  if (empoweringAuras) {
    const empoweringAurasProfile = requireBalanceProfileFromContext(context.balanceContext, TRAIT.EMPOWERING_AURAS);
    items.push({
      id: 'catalyst-empowering-auras',
      label: 'Empowering Auras',
      value: `${empoweringAuras.stacks}/${balanceProfileNumber(empoweringAurasProfile, 'maximumStacks')} · ${empoweringAuras.remaining.toFixed(1)}s`,
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
function catalystEffectPresentations(context: ElementalistUiContext): ProfessionEffectPresentation[] {
  const elementalEmpowermentProfile = requireBalanceProfileFromContext(context, TRAIT.ELEMENTAL_EMPOWERMENT);
  return [
    {
      id: 'elementalist-elemental-empowerment',
      kind: 'elemental empowerment',
      name: 'Elemental Empowerment',
      maximumStacks: balanceProfileNumber(elementalEmpowermentProfile, 'maximumStacks')
    }
  ];
}

/**
 * Catalyst UI contract: the F5 Jade Sphere skill and palette groups, palette gating,
 * the energy resource bar, and the timed state shown at a rotation point.
 */
export const catalystUi: ElementalistUiSlice = Object.freeze({
  /** Declare this module's conditional inputs without adding simulation settings. */
  attributePreviewControls(context: ProfessionAttributePreviewContext) {
    const preview = createAttributePreviewControls(context);

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
    const maximum = balanceProfileNumber(resourcesProfile, 'maximumStacks');
    return [
      {
        id: 'catalyst-energy',
        singular: 'energy',
        plural: 'energy',
        maximum,
        value: state.energy ?? build?.initialCatalystEnergy ?? maximum,
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
