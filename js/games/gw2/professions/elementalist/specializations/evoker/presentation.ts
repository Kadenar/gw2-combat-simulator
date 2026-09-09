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
  ProfessionUiContract,
  RotationStateSnapshotItem
} from '#gw2/platform/engine/profession/types.js';
import type { SchedulerRecord } from '#gw2/platform/engine/execution/types.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import { ELEMENTALIST_FAMILIAR_SKILL_IDS } from '#gw2/professions/elementalist/data/ids.js';
import { ELEMENTALIST_ATTUNEMENTS, type ElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';
import {
  BASIC_FAMILIARS,
  FAMILIAR_ELEMENTS
} from '#gw2/professions/elementalist/specializations/evoker/mechanics/constants.js';
import type { EvokerState } from '#gw2/professions/elementalist/specializations/evoker/state.js';

// the projected state record is absent until a simulation has produced one
function uiState(context: SchedulerRecord): Partial<EvokerState> {
  return (context.professionState as Partial<EvokerState> | undefined) || {};
}

// prefers simulated state, then the build's configured element, then Fire
function selectedElement(context: SchedulerRecord): ElementalistAttunement {
  const build = context.build as SchedulerRecord | undefined;
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
function familiarSkillId(context: SchedulerRecord): number {
  const element = selectedElement(context);
  const state = uiState(context);
  const build = context.build as SchedulerRecord | undefined;
  const empowered = Number(state.empowered ?? build?.initialEvokerEmpowered ?? 0);
  const name = FAMILIAR_SKILL_NAMES[element][empowered >= 3 ? 'empowered' : 'basic'];
  return ELEMENTALIST_FAMILIAR_SKILL_IDS[name];
}

// Keeps the F5 palette state aligned with scheduler validation so a familiar
// only looks clickable when the charges shown at the insertion point can cast it.
function familiarPaletteAvailability(context: SchedulerRecord, skill: Skill): PaletteSkillAvailability {
  const element = FAMILIAR_ELEMENTS.get(skill.id);
  if (!element) return { available: true, message: '' };
  if (selectedElement(context) !== element) {
    return {
      available: false,
      message: `${skill.name} is unavailable - the ${element} familiar is not selected.`
    };
  }

  const state = uiState(context);
  const build = context.build as SchedulerRecord | undefined;
  const maximum = Number(state.maximumCharges ?? 6);
  const charges = Number(state.charges ?? build?.initialEvokerCharges ?? maximum);
  const empowered = Number(state.empowered ?? build?.initialEvokerEmpowered ?? 0);
  if (BASIC_FAMILIARS.has(skill.id)) {
    return empowered < 3 && charges >= maximum
      ? { available: true, message: '' }
      : {
          available: false,
          message: `${skill.name} requires ${maximum} familiar charges.`
        };
  }

  return empowered >= 3
    ? { available: true, message: '' }
    : {
        available: false,
        message: `${skill.name} requires three empowered familiar charges.`
      };
}

/** Reports the brief Elemental Balance damage window only while it can affect the next action. */
function evokerStateSnapshot(context: SchedulerRecord): RotationStateSnapshotItem[] {
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
export const evokerUi: Partial<ProfessionUiContract> & SchedulerRecord = Object.freeze({
  paletteSkillAvailability: familiarPaletteAvailability,
  rotationStateSnapshot: evokerStateSnapshot,
  paletteGroups: (context: SchedulerRecord) => {
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
  resourceViews: (context: SchedulerRecord): ProfessionResourceView[] => {
    const state = uiState(context);
    const build = context.build as SchedulerRecord | undefined;
    const maximum = Number(state.maximumCharges || 6);
    const empowered = Math.max(
      0,
      Math.min(3, Math.floor(Number(state.empowered ?? build?.initialEvokerEmpowered ?? 0)))
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
        statusLabel: `Familiar (${empowered}/3 empowered)`
      },
      {
        // Expose empowered progress as a start-only resource so rotations can begin at any stage without adding a second live meter.
        id: 'evoker-empowered-charges',
        singular: 'empowered charge',
        plural: 'empowered charges',
        maximum: 3,
        value: empowered,
        startMaximum: 3,
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
