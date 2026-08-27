import type {
  PaletteSkillAvailability,
  ProfessionResourceView,
  ProfessionUiContract,
  RotationStateSnapshotItem,
  SchedulerRecord,
  Skill
} from '../../../../platform/engine/types.js';
import { ELEMENTALIST_FAMILIAR_SKILL_IDS } from '../../data/ids.js';
import { ELEMENTALIST_ATTUNEMENTS, type ElementalistAttunement } from '../../core/state.js';
import { BASIC_FAMILIARS, FAMILIAR_ELEMENTS } from './constants.js';
import type { EvokerState } from './state.js';

function uiState(context: SchedulerRecord): Partial<EvokerState> {
  return (context.professionState as Partial<EvokerState> | undefined) || {};
}

function selectedElement(context: SchedulerRecord): ElementalistAttunement {
  const build = context.build as SchedulerRecord | undefined;
  const value = String(uiState(context).element || build?.evokerElement || 'Fire');
  return ELEMENTALIST_ATTUNEMENTS.includes(value as ElementalistAttunement)
    ? (value as ElementalistAttunement)
    : 'Fire';
}

const FAMILIAR_SKILL_NAMES = Object.freeze({
  Fire: { basic: 'Ignite', empowered: 'Conflagration' },
  Water: { basic: 'Splash', empowered: 'BuoyantDeluge' },
  Air: { basic: 'Zap', empowered: 'LightningBlitz' },
  Earth: { basic: 'Calcify', empowered: 'SeismicImpact' }
} as const);

// returns the empowered form when 3 stacks are ready so the UI shows which familiar is currently usable
function familiarSkillId(context: SchedulerRecord, element = selectedElement(context)): number {
  const state = uiState(context);
  const build = context.build as SchedulerRecord | undefined;
  const empowered = Number(state.empowered ?? build?.initialEvokerEmpowered ?? 0);
  const name = FAMILIAR_SKILL_NAMES[element][empowered >= 3 ? 'empowered' : 'basic'];
  return ELEMENTALIST_FAMILIAR_SKILL_IDS[name];
}

// returns boolean to signal whether the platform should treat the update as consumed
function updateFamiliarSelection(context: SchedulerRecord, selection: SchedulerRecord): boolean {
  const value = String(selection.value || '');
  if (
    selection.key !== 'evokerElement' ||
    Number(selection.index) !== 0 ||
    !ELEMENTALIST_ATTUNEMENTS.includes(value as ElementalistAttunement) ||
    !context.build ||
    typeof context.build !== 'object'
  ) {
    return false;
  }

  (context.build as SchedulerRecord).evokerElement = value;
  return true;
}

// Keeps the F5 palette state aligned with scheduler validation so a familiar
// only looks clickable when the charges shown at the insertion point can cast it.
function familiarPaletteAvailability(context: SchedulerRecord, skill: Skill): PaletteSkillAvailability {
  const element = FAMILIAR_ELEMENTS[skill.name];
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
  if (BASIC_FAMILIARS.has(skill.name)) {
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

export const evokerUi: Partial<ProfessionUiContract> & SchedulerRecord = Object.freeze({
  skillBarGroups: (context: SchedulerRecord) => {
    const element = selectedElement(context);
    return [
      {
        id: 'elementalist-evoker-familiar',
        label: 'Familiar',
        skillIds: [],
        selections: [
          {
            skillId: familiarSkillId(context),
            optionEntries: ELEMENTALIST_ATTUNEMENTS.map((option) => {
              const skillId = familiarSkillId(context, option);
              const skill = (
                context.catalog as
                  | {
                      skillsById?: ReadonlyMap<number, { icon?: string; description?: string }>;
                    }
                  | undefined
              )?.skillsById?.get(skillId);
              return {
                value: option,
                label: `${option} Familiar`,
                icon: skill?.icon,
                description: skill?.description || `${option} familiar`,
                skillId
              };
            }),
            selectionValue: element,
            selectionKey: 'evokerElement',
            selectionIndex: 0
          }
        ],
        color: '#c85142',
        className: 'elementalist-familiar',
        order: -10
      }
    ];
  },
  updateSkillBarSelection: updateFamiliarSelection,
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
        startValue: Number(build?.initialEvokerCharges ?? maximum),
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
        startValue: Number(build?.initialEvokerEmpowered ?? 0),
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
