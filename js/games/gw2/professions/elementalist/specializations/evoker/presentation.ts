import { balanceProfileNumberFromContext } from '#gw2/platform/engine/skills/balance-profiles.js';
import { getActiveTraits } from '#gw2/professions/elementalist/data/traits-data.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import { EVOKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/evoker/profiles.js';
import type { ElementalistUiContext, ElementalistUiSlice } from '#gw2/professions/elementalist/types.js';
/**
 * Evoker rotation-palette presentation.
 *
 * Renders the active F5 familiar, mirrors charge/empowered state into palette
 * availability and resource dials, and surfaces the Elemental Balance window in
 * the rotation snapshot. Reads a projected UI-side state record rather than live
 * simulation state, falling back to build defaults before a run exists.
 */
import type {
  PaletteSkillAvailability,
  ProfessionResourceView,
  ProfessionSkillBarGroup,
  ProfessionSkillBarSelectionChange,
  RotationStateSnapshotItem
} from '#gw2/platform/profession-presentation/types.js';
import type { CanonicalCatalog, Skill } from '#gw2/platform/engine/skills/types.js';
import { ELEMENTALIST_FAMILIAR_SKILL_IDS } from '#gw2/professions/elementalist/data/ids.js';
import { ELEMENTALIST_ATTUNEMENTS, type ElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';
import {
  BASIC_FAMILIARS,
  FAMILIAR_ELEMENTS
} from '#gw2/professions/elementalist/specializations/evoker/mechanics/constants.js';
import type { EvokerState } from '#gw2/professions/elementalist/specializations/evoker/state.js';
import { boundedNumber } from '#kernel/core/numeric.js';

// the projected state record is absent until a simulation has produced one
function uiState(context: ElementalistUiContext): Partial<EvokerState> {
  return (context.professionState as Partial<EvokerState> | undefined) || {};
}

// prefers simulated state, then the build's configured element, then Fire
function selectedElement(context: ElementalistUiContext): ElementalistAttunement {
  const build = context.build;
  const value = String(uiState(context).element || build?.evokerElement || 'Fire');
  return ELEMENTALIST_ATTUNEMENTS.includes(value as ElementalistAttunement)
    ? (value as ElementalistAttunement)
    : 'Fire';
}

// basic/empowered familiar pair per element, keyed for the familiar skill id table
const FAMILIAR_SKILL_NAMES = Object.freeze({
  Fire: { basic: 'Ignite', empowered: 'Conflagration' },
  Water: { basic: 'Splash', empowered: 'BuoyantDeluge' },
  Air: { basic: 'Zap', empowered: 'LightningBlitz' },
  Earth: { basic: 'Calcify', empowered: 'SeismicImpact' }
} as const);

// returns the empowered form when 3 stacks are ready so the UI shows which familiar is currently usable
function familiarSkillId(context: ElementalistUiContext): number {
  const element = selectedElement(context);
  const state = uiState(context);
  const build = context.build;
  const empoweredMaximum = balanceProfileNumberFromContext(context, PROFILE.resources, 'minimumStacks');
  const empowered = Number(state.empowered ?? build?.initialEvokerEmpowered ?? 0);
  const name = FAMILIAR_SKILL_NAMES[element][empowered >= empoweredMaximum ? 'empowered' : 'basic'];
  return ELEMENTALIST_FAMILIAR_SKILL_IDS[name];
}

// Keeps the F5 palette state aligned with scheduler validation so a familiar
// only looks clickable when the charges shown at the insertion point can cast it.
function familiarPaletteAvailability(context: ElementalistUiContext, skill: Skill): PaletteSkillAvailability {
  const element = FAMILIAR_ELEMENTS.get(skill.id);
  if (!element) return { available: true, message: '' };
  if (selectedElement(context) !== element) {
    return {
      available: false,
      message: `${skill.name} is unavailable - the ${element} familiar is not selected.`
    };
  }

  const state = uiState(context);
  const build = context.build;
  const maximum =
    state.maximumCharges ??
    balanceProfileNumberFromContext(
      context,
      getActiveTraits(context.build?.specializations || []).some((trait) => trait.id === TRAIT.SPECIALIZED_ELEMENTS)
        ? PROFILE.specializedElements
        : PROFILE.resources,
      'maximumStacks'
    );
  const charges = Number(state.charges ?? build?.initialEvokerCharges ?? maximum);
  const empoweredMaximum = balanceProfileNumberFromContext(context, PROFILE.resources, 'minimumStacks');
  const empowered = Number(state.empowered ?? build?.initialEvokerEmpowered ?? 0);
  if (BASIC_FAMILIARS.has(skill.id)) {
    return empowered < empoweredMaximum && charges >= maximum
      ? { available: true, message: '' }
      : {
          available: false,
          message: `${skill.name} requires ${maximum} familiar charges.`
        };
  }

  return empowered >= empoweredMaximum
    ? { available: true, message: '' }
    : {
        available: false,
        message: `${skill.name} requires ${empoweredMaximum} empowered familiar charges.`
      };
}

/** Reports the brief Elemental Balance damage window only while it can affect the next action. */
function evokerStateSnapshot(context: ElementalistUiContext): RotationStateSnapshotItem[] {
  const remaining = Number(uiState(context).elementalBalanceUntil || 0) - Math.max(0, Number(context.atSeconds || 0));
  return remaining > 0
    ? [
        {
          id: 'evoker-elemental-balance',
          label: 'Elemental Balance',
          value: `${remaining.toFixed(1)}s`,
          title: 'Time remaining in the Elemental Balance window'
        }
      ]
    : [];
}

/** Projects the active familiar, its availability, resources, and rotation snapshot. */
export const evokerUi: ElementalistUiSlice = Object.freeze({
  // Edit the build's familiar independently of attunement or a previous simulation's state.
  skillBarGroups: (context: ElementalistUiContext): ProfessionSkillBarGroup[] => {
    const element = selectedElement({ build: context.build });
    const catalog = context.catalog as Readonly<CanonicalCatalog> | undefined;
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
              const skill = catalog?.skillsById.get(ELEMENTALIST_FAMILIAR_SKILL_IDS[FAMILIAR_SKILL_NAMES[value].basic]);
              return { value, label: `${value} Familiar`, icon: skill?.icon, description: skill?.description };
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
  paletteSkillAvailability: familiarPaletteAvailability,
  rotationStateSnapshot: evokerStateSnapshot,
  paletteGroups: (context: ElementalistUiContext) => {
    const element = selectedElement(context);
    return [
      {
        id: 'elementalist-evoker-familiars',
        label: 'F5',
        skillIds: [familiarSkillId(context)],
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
      state.maximumCharges ??
      balanceProfileNumberFromContext(
        context,
        getActiveTraits(context.build?.specializations || []).some((trait) => trait.id === TRAIT.SPECIALIZED_ELEMENTS)
          ? PROFILE.specializedElements
          : PROFILE.resources,
        'maximumStacks'
      );
    const empoweredMaximum = balanceProfileNumberFromContext(context, PROFILE.resources, 'minimumStacks');
    const empowered = boundedNumber(
      Math.floor(Number(state.empowered ?? build?.initialEvokerEmpowered ?? 0)),
      0,
      0,
      empoweredMaximum
    );
    const element = selectedElement(context).toLowerCase();
    const charges = Number(state.charges ?? build?.initialEvokerCharges ?? maximum);
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
        pipStyle: `elementalist-evoker-${element}-${empowered}${basicReady ? '-ready' : ''}`,
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
