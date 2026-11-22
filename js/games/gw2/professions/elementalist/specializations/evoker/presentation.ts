/**
 * Renders the active Evoker F5 familiar and its charge and empowered state in the palette.
 * Adds the Elemental Balance window to the rotation snapshot. Reads projected UI state,
 * or build defaults before a simulation has run.
 */
import type {
  ProfessionAttributePreviewContext,
  ProfessionAttributePreviewPreparation
} from '#gw2/platform/profession-presentation/attribute-preview.js';
import type {
  SkillDamagePreviewContext,
  SkillDamageState
} from '#gw2/platform/profession-presentation/skill-damage.js';
import type {
  ProfessionResourceView,
  ProfessionSkillBarGroup,
  ProfessionSkillBarSelectionChange,
  ProfessionStateSnapshotContext,
  RotationStateSnapshotItem
} from '#gw2/platform/profession-presentation/types.js';
import { planningBuffAt } from '#gw2/platform/results/result-queries.js';
import { balanceNumber, balanceProfileNumber, requireBalanceProfile } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill, SkillId } from '#gw2/platform/skills/types.js';
import {
  ELEMENTALIST_ATTUNEMENTS,
  isElementalistAttunement,
  type ElementalistAttunement
} from '#gw2/professions/elementalist/core/state.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import { electricEnchantment } from '#gw2/professions/elementalist/specializations/evoker/mechanics/electric-enchantment.js';
import { evokerFamiliarPair } from '#gw2/professions/elementalist/specializations/evoker/mechanics/familiar-projection.js';
import type { ElementalistUiContext, ElementalistUiSlice } from '#gw2/professions/elementalist/types.js';
import { createPreviewControls } from '#gw2/professions/shared/attribute-preview.js';
import { selectedTraits } from '#gw2/professions/shared/trait-data.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { boundedNumber } from '#kernel/core/numeric.js';

// the projected state record is absent until a simulation has produced one
function uiState(
  context: Pick<ElementalistUiContext, 'professionState'>
): Partial<
  ReturnType<typeof import('#gw2/professions/elementalist/specializations/evoker/state.js').projectEvokerPlanningState>
> {
  return context.professionState || {};
}

// prefers simulated state, then the build's configured element, then Fire
function selectedElement(
  context: Pick<ElementalistUiContext, 'build' | 'config' | 'professionState'>
): ElementalistAttunement {
  const build = context.build;
  const value = uiState(context)[STATE.ELEMENT] || build?.evokerElement || 'Fire';
  return isElementalistAttunement(value) ? value : 'Fire';
}

/** F5 shows the empowered skill when charges reach the selected catalog's threshold. */
function familiarSkillId(context: ElementalistUiContext, element: ElementalistAttunement): SkillId {
  const state = uiState(context);
  const build = context.build;
  const empoweredMaximum =
    state[STATE.EMPOWERED_CHARGES]?.maximum ?? balanceNumber(context.catalog, TRAIT.EVOCATION, 'minimumStacks');
  const empowered = state[STATE.EMPOWERED_CHARGES]?.value ?? build?.initialEvokerEmpowered ?? 0;
  const pair = evokerFamiliarPair(context.catalog.skillsById, element);
  return empowered >= empoweredMaximum ? pair.empowered.id : pair.basic.id;
}

/** The build's familiar in both forms; the preview never depends on charges earned in the rotation. */
function familiarSkillIds(context: SkillDamagePreviewContext): readonly [SkillId, SkillId] {
  const configured = (context.build as { readonly evokerElement?: unknown }).evokerElement;
  const element = isElementalistAttunement(configured) ? configured : 'Fire';
  const { basic, empowered } = evokerFamiliarPair(context.catalog.skillsById, element);
  return [basic.id, empowered.id];
}

/** Familiar element selects the attack, while the preview's attunement supplies the player's conditional bonuses. */
function evokerSkillDamageOccurrence(context: SkillDamagePreviewContext, skill: Skill): SkillDamageState | null {
  const [basic, empowered] = familiarSkillIds(context);

  if (skill.id !== basic && skill.id !== empowered) return null;

  const resources = requireBalanceProfile(context.catalog, TRAIT.EVOCATION);
  // Each row starts from its own legal form using the simulation's existing initial resource fields.
  return {
    // Familiar completion may arm enchantments for a subsequent player hit.

    config: {
      initialEvokerCharges: balanceProfileNumber(resources, 'maximumStacks'),
      initialEvokerEmpowered: skill.id === empowered ? balanceProfileNumber(resources, 'minimumStacks') : 0
    },
    context: skill.id === empowered ? 'Familiar ? empowered' : 'Familiar'
  };
}

/** Reports the brief Elemental Balance damage window only while it can affect the next action. */
function evokerStateSnapshot(
  context: ProfessionStateSnapshotContext<ElementalistUiContext['professionState']>
): RotationStateSnapshotItem[] {
  const remaining = (uiState(context)[STATE.ELEMENTAL_BALANCE_UNTIL] || 0) - Math.max(0, context.atSeconds || 0);
  const items =
    remaining > 0
      ? [
          {
            id: 'evoker-elemental-balance',
            label: 'Elemental Balance',
            value: `${remaining.toFixed(1)}s`,
            title: 'Time remaining in the Elemental Balance window'
          }
        ]
      : [];
  // Show charges available to the next qualifying hit at the cursor.
  const grant = planningBuffAt(context.planningState, electricEnchantment.id);
  return grant
    ? [
        ...items,
        {
          id: electricEnchantment.id,
          label: electricEnchantment.name,
          icon: electricEnchantment.icon,
          value: `${grant.count} · ${grant.remaining.toFixed(1)}s`,
          title: 'Remaining charges and time until the last grant expires'
        }
      ]
    : items;
}

/** Projects the active familiar, its availability, resources, and rotation snapshot. */
export const evokerUi: ElementalistUiSlice = Object.freeze({
  skillDamageGroups: (context: SkillDamagePreviewContext) => [
    { id: 'familiar', title: 'Familiar', skillIds: familiarSkillIds(context), order: 0 }
  ],
  skillDamageState: evokerSkillDamageOccurrence,
  /** Declare this module's conditional inputs without adding simulation settings. */
  previewControls(context: ProfessionAttributePreviewContext) {
    const preview = createPreviewControls(context);

    preview.add({
      key: 'evokerElement',
      label: 'Familiar element',
      group: 'Attunement',
      kind: 'special',
      options: ['None', 'Fire', 'Water', 'Air', 'Earth'],
      description: 'Enhanced Potency'
    });
    return preview.controls;
  },
  /** Seed only the detached attribute query; combat state and saved builds remain untouched. */
  prepareAttributePreview(context: ProfessionAttributePreviewPreparation) {
    Object.assign(context.config, { evokerElement: context.values.evokerElement });
  },

  // Familiar packets record absolute charge totals, with a delta only when weapon skills award charges.
  eventLogRow: (_context, event) => {
    if (event.type !== 'resource' || event.kind !== 'evoker-charges') return undefined;

    const change =
      typeof event.change === 'number' && event.change !== 0 ? ` (${event.change > 0 ? '+' : ''}${event.change})` : '';
    return {
      type: 'resource',
      description: `FAMILIAR CHARGES${change} → ${event.value}/${event.maximum} · empowered ${event.empowered}`,
      className: 'resource'
    };
  },
  // Edit the build's familiar independently of attunement or a previous simulation's state.
  skillBarGroups: (context: ElementalistUiContext): ProfessionSkillBarGroup[] => {
    const element = selectedElement({ build: context.build });
    return [
      {
        id: 'elementalist-evoker-familiar-selection',
        label: `${element} Familiar`,
        skillIds: [],
        selections: [
          {
            selectionKey: 'evokerElement',
            selectionIndex: 0,
            selectionValue: element,
            optionEntries: ELEMENTALIST_ATTUNEMENTS.map((value) => {
              const { basic } = evokerFamiliarPair(context.catalog.skillsById, value);
              return { value, label: `${value} Familiar`, icon: basic.icon };
            })
          }
        ]
      }
    ];
  },
  // Only valid familiar choices may update the persisted element used by the palette and simulation.
  updateSkillBarSelection: (context: ElementalistUiContext, selection: ProfessionSkillBarSelectionChange): boolean => {
    const build = context.build;

    if (
      !build ||
      selection.key !== 'evokerElement' ||
      selection.index !== 0 ||
      !ELEMENTALIST_ATTUNEMENTS.includes(selection.value as ElementalistAttunement)
    )
      return false;

    build.evokerElement = selection.value;
    return true;
  },
  rotationStateSnapshot: evokerStateSnapshot,
  paletteGroups: (context: ElementalistUiContext) => {
    const element = selectedElement(context);
    return [
      {
        id: 'elementalist-evoker-familiars',
        label: 'F5',
        skillIds: [familiarSkillId(context, element)],
        color: '#c85142',
        className: `elementalist-evoker-familiar elementalist-evoker-${element.toLowerCase()}`,
        // Keep one layered dial beside F5 so basic pips can cycle around the
        // familiar after three empowered charges replace the inner wedges.
        resourceIds: ['evoker-charges'],
        resourcePlacement: 'beside' as const,
        order: -10
      }
    ];
  },
  resourceViews: (context: ElementalistUiContext): ProfessionResourceView[] => {
    const state = uiState(context);
    const build = context.build;
    const maximum =
      state[STATE.FAMILIAR_CHARGES]?.maximum ??
      balanceNumber(
        context.catalog,
        selectedTraits(context.catalog, context.build?.specializations || []).some(
          (trait) => trait.id === TRAIT.SPECIALIZED_ELEMENTS
        )
          ? TRAIT.SPECIALIZED_ELEMENTS
          : TRAIT.EVOCATION,
        'maximumStacks'
      );
    const empoweredMaximum =
      state[STATE.EMPOWERED_CHARGES]?.maximum ?? balanceNumber(context.catalog, TRAIT.EVOCATION, 'minimumStacks');
    // Keep fractional patched progress in the reading; only the decorative wedge class uses whole stacks.
    const empowered = boundedNumber(
      state[STATE.EMPOWERED_CHARGES]?.value ?? build?.initialEvokerEmpowered ?? 0,
      0,
      0,
      empoweredMaximum
    );
    const element = selectedElement(context).toLowerCase();
    const charges = state[STATE.FAMILIAR_CHARGES]?.value ?? build?.initialEvokerCharges ?? maximum;
    const basicReady = charges >= maximum;
    return [
      {
        id: 'evoker-charges',
        singular: 'charge',
        plural: 'charges',
        maximum,
        value: charges,
        startMaximum: maximum,
        canStart: true,
        buildKey: 'initialEvokerCharges',
        step: 1,
        displayMode: 'pips',
        pipStyle: `elementalist-evoker-${element}-${Math.floor(empowered)}${basicReady ? '-ready' : ''}`,
        showValue: false,
        shortLabel: 'Charges',
        statusLabel: `Familiar (${empowered}/${empoweredMaximum} empowered)`
      },
      {
        // Expose empowered progress as a start-only resource so rotations can begin at any stage without adding a second live meter.
        id: 'evoker-empowered-charges',
        singular: 'empowered charge',
        plural: 'empowered charges',
        maximum: empoweredMaximum,
        value: empowered,
        startMaximum: empoweredMaximum,
        canStart: true,
        buildKey: 'initialEvokerEmpowered',
        step: 1,
        displayMode: 'pips',
        showInPalette: false,
        showValue: false,
        shortLabel: 'Empowered',
        statusLabel: 'Familiar'
      }
    ];
  }
});
