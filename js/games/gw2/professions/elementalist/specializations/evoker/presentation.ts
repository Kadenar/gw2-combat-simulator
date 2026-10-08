import type {
  ProfessionAttributePreviewContext,
  ProfessionAttributePreviewPreparation
} from '#gw2/platform/profession-presentation/attribute-preview.js';
import { createPreviewControls } from '#gw2/professions/shared/attribute-preview.js';

import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import { getActiveTraits } from '#gw2/professions/elementalist/data/traits-data.js';
import { EVOKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/evoker/mechanics/constants.js';
import type {
  ElementalistSkill,
  ElementalistUiContext,
  ElementalistUiSlice
} from '#gw2/professions/elementalist/types.js';
/**
 * Evoker rotation-palette presentation.
 *
 * Renders the active F5 familiar, mirrors charge/empowered state into palette
 * availability and resource dials, and surfaces the Elemental Balance window in
 * the rotation snapshot. Reads a projected UI-side state record rather than live
 * simulation state, falling back to build defaults before a run exists.
 */
import type { CanonicalCatalog, Skill } from '#gw2/platform/skills/types.js';
import type {
  SkillDamagePreviewContext,
  SkillDamageState
} from '#gw2/platform/profession-presentation/skill-damage.js';
import type {
  ProfessionResourceView,
  ProfessionSkillBarGroup,
  ProfessionSkillBarSelectionChange,
  RotationStateSnapshotItem
} from '#gw2/platform/profession-presentation/types.js';
import { elementalistAttunementConfig } from '#gw2/professions/elementalist/core/presentation.js';
import { ELEMENTALIST_ATTUNEMENTS, type ElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';
import { ELEMENTALIST_FAMILIAR_SKILL_IDS } from '#gw2/professions/elementalist/data/ids.js';
import type { EvokerState } from '#gw2/professions/elementalist/specializations/evoker/state.js';
import { boundedNumber } from '#kernel/core/numeric.js';

// the projected state record is absent until a simulation has produced one
function uiState(context: ElementalistUiContext): Partial<EvokerState> {
  return context.professionState || {};
}

// prefers simulated state, then the build's configured element, then Fire
function selectedElement(context: ElementalistUiContext): ElementalistAttunement {
  const build = context.build;
  const value = uiState(context).element || build?.evokerElement || 'Fire';
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
  const resourcesProfile = requireBalanceProfileFromContext(context, PROFILE.resources);
  const empoweredMaximum = state.empoweredCharges?.maximum ?? balanceProfileNumber(resourcesProfile, 'minimumStacks');
  const empowered = state.empoweredCharges?.value ?? build?.initialEvokerEmpowered ?? 0;
  const name = FAMILIAR_SKILL_NAMES[element][empowered >= empoweredMaximum ? 'empowered' : 'basic'];
  return ELEMENTALIST_FAMILIAR_SKILL_IDS[name];
}

/** The build's familiar in both forms; the preview never depends on charges earned in the rotation. */
function familiarSkillIds(context: SkillDamagePreviewContext): readonly [number, number] {
  const configured = (context.build as { readonly evokerElement?: unknown }).evokerElement;
  const element = ELEMENTALIST_ATTUNEMENTS.includes(configured as ElementalistAttunement)
    ? (configured as ElementalistAttunement)
    : 'Fire';
  const names = FAMILIAR_SKILL_NAMES[element];
  return [ELEMENTALIST_FAMILIAR_SKILL_IDS[names.basic], ELEMENTALIST_FAMILIAR_SKILL_IDS[names.empowered]];
}

/** The empowered familiar starts with its full empowered count; both forms keep their attunement requirement. */
function evokerSkillDamageOccurrence(context: SkillDamagePreviewContext, skill: Skill): SkillDamageState | null {
  const [basic, empowered] = familiarSkillIds(context);
  if (skill.id !== basic && skill.id !== empowered) return null;
  const resources = requireBalanceProfileFromContext(context, PROFILE.resources);
  // Each row starts from its own legal form using the simulation's existing initial resource fields.
  return {
    // Familiar completion may arm enchantments for a subsequent player hit.

    config: {
      ...elementalistAttunementConfig(skill),
      initialEvokerCharges: balanceProfileNumber(resources, 'maximumStacks'),
      initialEvokerEmpowered: skill.id === empowered ? balanceProfileNumber(resources, 'minimumStacks') : 0
    },
    context: skill.id === empowered ? 'Familiar ? empowered' : 'Familiar'
  };
}

/** Reports the brief Elemental Balance damage window only while it can affect the next action. */
function evokerStateSnapshot(context: ElementalistUiContext): RotationStateSnapshotItem[] {
  const remaining = (uiState(context).elementalBalanceUntil || 0) - Math.max(0, context.atSeconds || 0);
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
    const catalog = context.catalog as Readonly<CanonicalCatalog<ElementalistSkill>> | undefined;
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
      state.familiarCharges?.maximum ??
      balanceProfileNumber(
        requireBalanceProfileFromContext(
          context,
          getActiveTraits(context.build?.specializations || []).some((trait) => trait.id === TRAIT.SPECIALIZED_ELEMENTS)
            ? TRAIT.SPECIALIZED_ELEMENTS
            : PROFILE.resources
        ),
        'maximumStacks'
      );
    const resourcesProfile = requireBalanceProfileFromContext(context, PROFILE.resources);
    const empoweredMaximum = state.empoweredCharges?.maximum ?? balanceProfileNumber(resourcesProfile, 'minimumStacks');
    // Keep fractional patched progress in the reading; only the decorative wedge class uses whole stacks.
    const empowered = boundedNumber(
      state.empoweredCharges?.value ?? build?.initialEvokerEmpowered ?? 0,
      0,
      0,
      empoweredMaximum
    );
    const element = selectedElement(context).toLowerCase();
    const charges = state.familiarCharges?.value ?? build?.initialEvokerCharges ?? maximum;
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
