import { SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS } from '#gw2/platform/simulation/randomness.js';
import { flattenProfessionState } from '#gw2/platform/engine/profession/state.js';
import {
  normalizeSelectedSkillNames,
  selectedSkillNameSet,
  type Gw2SelectedSkillLoadout
} from '#gw2/platform/builds/selected-skills.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import { getActiveTraits } from '#gw2/professions/engineer/data/traits-data.js';
import type {
  PaletteSkillAvailability,
  CanonicalCatalog,
  CatalogEntity,
  ProfessionEventLogDescriptor,
  ProfessionPaletteGroup,
  ProfessionResourceView,
  ProfessionSkillBarGroup,
  ProfessionUiContract,
  SchedulerRecord,
  SkillId
} from '#gw2/platform/engine/types.js';
import type {
  EngineerResolverEvent,
  EngineerSkill,
  EngineerState,
  EngineerUiContext
} from '#gw2/professions/engineer/types.js';

/**
 * Core Engineer presentation and shared application callbacks. Elite modules
 * own their profession bars, resources, assumptions, and palette groups.
 */

// display sort order for kit palette groups
const KIT_ORDER = new Map<string, number>([
  ['Grenade Kit', 0],
  ['Flamethrower', 1],
  ['Bomb Kit', 2],
  ['Med Kit', 3],
  ['Elixir Gun', 5],
  ['Elite Mortar Kit', 6]
]);

const SKILL_SLOT_ORDER: readonly string[] = Object.freeze(['Heal', 'Utility1', 'Utility2', 'Utility3', 'Elite']);

// controls which engineer.state events Core spec suppresses from the event log;
// specialization modules handle filtering of their own state reasons
const CORE_STATE_REASONS = new Set<string>([
  'arm-flip',
  'consume-flip',
  'equip-kit',
  'stow-kit',
  'dodge',
  'resources',
  'lightning-rod-active',
  'conduit-surge',
  'electric-artillery-consumed',
  'electric-artillery-ready',
  'electric-artillery-expired',
  'kinetic-battery',
  'deploy-turret'
]);

// module-level; populated once at catalog-bind time (bindEngineerCoreUi) and stable for the session
let engineerSkills: readonly EngineerSkill[] = [];
let engineerSkillsById: ReadonlyMap<SkillId, EngineerSkill> = new Map();
let engineerTraits: readonly CatalogEntity[] = [];

/** Flattens Core and active-specialization state for Engineer UI consumers. */
export function engineerUiState(context: EngineerUiContext = {}): Partial<EngineerState> {
  return flattenProfessionState(context.state?.profession || context.professionState);
}

/** Resolves the active Engineer specialization name from UI, config, or build context. */
export function engineerUiSpecialization(context: EngineerUiContext = {}): string {
  return String(context.specialization || context.config?.specialization || context.build?.specialization || 'Core');
}

/** Normalizes the selected slot-skill loadout into a membership set. */
function selectedNames(context: EngineerUiContext = {}): Set<string> {
  return new Set(selectedSkillNameSet(context.config?.selectedSkills || context.build?.selectedSkills));
}

/** Returns selected heal, utility, and elite skill names in their fixed slot order. */
export function selectedNamesInSlotOrder(context: EngineerUiContext = {}): (string | undefined)[] {
  const source: Gw2SelectedSkillLoadout = context.config?.selectedSkills || context.build?.selectedSkills || [];
  if (Array.isArray(source)) return [...normalizeSelectedSkillNames(source)];
  const slots = source as Readonly<Record<string, unknown>>;
  return SKILL_SLOT_ORDER.map((slot) => normalizeSelectedSkillNames([slots[slot]])[0]);
}

/** Lists equipped kits in the stable display order used by palette groups. */
export function selectedKitNames(context: EngineerUiContext): string[] {
  return [
    ...new Set(
      engineerSkills
        .filter((skill) => skill.handlerId === 'engineer.kit-equip' && selectedNames(context).has(skill.name))
        .map((skill) => skill.kitName || skill.name)
    )
  ].sort(
    (left, right) =>
      (KIT_ORDER.get(left) ?? Number.MAX_SAFE_INTEGER) - (KIT_ORDER.get(right) ?? Number.MAX_SAFE_INTEGER) ||
      left.localeCompare(right)
  );
}

// deduplicates by skill name — some skills have multiple IDs (different specs); keep the first
/** Deduplicates skill IDs by canonical skill name while preserving first occurrence order. */
export function uniqueIdsBySkillName(skillIds: readonly SkillId[]): SkillId[] {
  return [
    ...new Map(
      skillIds.map((id) => {
        const skill = engineerSkillsById.get(id);
        return [skill?.name || id, id];
      })
    ).values()
  ];
}

/** Deduplicates skill records by name for palette and profession-bar presentation. */
export function uniqueSkillsByName(skills: readonly EngineerSkill[]): EngineerSkill[] {
  return [...new Map(skills.map((skill) => [skill.name, skill])).values()];
}

/** Reports whether the build's selected trait lines activate the named trait. */
export function hasActiveTrait(context: EngineerUiContext, name: string): boolean {
  return getActiveTraits(context.build?.specializations || []).some((trait) => trait.name === name);
}

/** Detects the Tools trait line even when programmatic contexts omit build specialization metadata. */
function usesToolsTraitline(context: EngineerUiContext): boolean {
  if ((context.build?.specializations || []).some((selection) => selection?.name === 'Tools')) return true;
  // Programmatic UI contexts may omit build specialization metadata, so infer
  // the Tools line from the canonical trait selection.
  return engineerTraits.some((trait) => trait.specialization === 'Tools' && hasTrait(context, trait.id));
}

// toolbelt skill is the non-Detonate variant — each parent has both a toolbelt skill and a detonate flip
/** Resolves an equipped slot skill to its non-detonate toolbelt skill. */
export function toolbeltSkillId(parentName: string | undefined): SkillId | null {
  if (!parentName) return null;
  return (
    uniqueSkillsByName(
      engineerSkills.filter(
        (skill) => skill.toolbeltParentName === parentName && !String(skill.name || '').startsWith('Detonate')
      )
    )[0]?.id ?? null
  );
}

/** Finds the first named Engineer skill that satisfies an optional metadata predicate. */
export function namedSkillId(name: string, predicate: (skill: EngineerSkill) => boolean = () => true): SkillId | null {
  return engineerSkills.find((skill) => skill.name === name && predicate(skill))?.id ?? null;
}

/** Maps the selected slot-skill loadout to its ordered Engineer toolbelt bar. */
export function engineerToolbeltSkillIds(context: EngineerUiContext): (SkillId | null)[] {
  return selectedNamesInSlotOrder(context).map(toolbeltSkillId);
}

/** Returns the fixed Core Engineer profession-skill slots for the active loadout. */
export function professionSkillSlots(context: EngineerUiContext): (SkillId | null)[] {
  return engineerToolbeltSkillIds(context);
}

// Shared Engineer bars contain only fixed F-skills; configurable protocols are Amalgam-owned.
/** Builds the shared F-skill bar group, omitting it when no profession skills are populated. */
export function engineerFSkillBarGroups(skillIds: readonly (SkillId | null)[]): ProfessionSkillBarGroup[] {
  const populated = skillIds.filter((skillId): skillId is SkillId => skillId != null);
  if (!populated.length) return [];
  return [
    {
      id: 'engineer-skill-bar-f-skills',
      label: 'F Skills',
      skillIds: populated,
      color: '#b88a35'
    }
  ];
}

/** Builds Core Engineer's skill bar groups from the selected toolbelt parents. */
export function engineerSkillBarGroups(context: EngineerUiContext): ProfessionSkillBarGroup[] {
  return engineerFSkillBarGroups(engineerToolbeltSkillIds(context));
}

/** Returns populated Core profession-skill IDs for palette and bar consumers. */
export function professionSkills(context: EngineerUiContext): SkillId[] {
  return professionSkillSlots(context).filter((id) => id != null);
}

/** Explains whether a Core Engineer skill is usable in the currently displayed state. */
export function engineerCorePaletteSkillAvailability(
  context: EngineerUiContext = {},
  skill: EngineerSkill
): PaletteSkillAvailability {
  const state = engineerUiState(context);
  // Lightning Rod and Electric Artillery share one contextual profession slot.
  if (skill.name === 'Electric Artillery') {
    return {
      available: Boolean(state.electricArtilleryAvailable),
      message: state.electricArtilleryAvailable ? '' : 'Lightning Rod has not finished charging'
    };
  }

  if (
    skill.name === 'Lightning Rod' &&
    (state.electricArtilleryAvailable || Number(state.electricArtilleryReadyAt || 0) > 0)
  ) {
    return {
      available: false,
      message: 'Electric Artillery currently replaces this skill'
    };
  }

  // The synthetic swap action exists only to return from a kit to baseline weapons.
  if (skill.id === -3) {
    return {
      available: Boolean(state.activeKit),
      message: state.activeKit ? '' : 'Engineers can use weapon swap only to leave an active kit'
    };
  }

  // Active kits replace the weapon bar and cannot be equipped again until stowed.
  if (skill.kit && state.activeKit !== skill.kit) {
    return { available: false, message: `Equip ${skill.kit} first` };
  }

  if (skill.handlerId === 'engineer.kit-equip' && state.activeKit === (skill.kitName || skill.name)) {
    return {
      available: false,
      message: `Use Stow ${skill.kitName || skill.name} to leave this kit`
    };
  }

  if (skill.type === 'Weapon' && skill.weapon && state.activeKit) {
    return {
      available: false,
      message: `${state.activeKit} replaces equipped weapon skills`
    };
  }

  return { available: true, message: '' };
}

/** Suppresses internal Engineer events whose visible effects already have dedicated result rows. */
export function engineerEventLogRow(
  context: EngineerUiContext,
  event: EngineerResolverEvent
): ProfessionEventLogDescriptor | null | undefined {
  if (
    [
      'engineer.dodge',
      'engineer.lightning-rod-pulse',
      'engineer.conduit-surge',
      'engineer.electric-artillery'
    ].includes(event?.type)
  ) {
    // These resolver events materialize skill packets. The ordinary action,
    // damage, and condition rows already present their user-visible effects.
    return null;
  }

  if (
    event?.type === 'engineer.state' &&
    (engineerUiSpecialization(context) === 'Core' || CORE_STATE_REASONS.has(String(event.reason)))
  )
    // null = suppress; undefined = use platform default row
    return null;
  return undefined;
}

export const engineerCoreUi: Partial<ProfessionUiContract> & SchedulerRecord = Object.freeze({
  assumptionControls: SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS,
  skillBarGroups: (context: EngineerUiContext) =>
    engineerUiSpecialization(context) === 'Core' ? engineerSkillBarGroups(context) : [],
  // Builds one stacked palette group per selected kit, plus Core's profession-skill group.
  paletteGroups: (context: EngineerUiContext) => {
    const groups: ProfessionPaletteGroup[] = [];
    // Each selected kit gets a stable slot-ordered group in the shared kit stack.
    for (const kit of selectedKitNames(context)) {
      const kitSkills = uniqueSkillsByName(engineerSkills.filter((skill) => skill.kit === kit));
      groups.push({
        id: `engineer-kit-${kit.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        label: kit.replace(' Kit', '').slice(0, 4),
        skillIds: kitSkills
          .sort(
            (left, right) =>
              Number(String(left.slot || '').split('_')[1] || 99) - Number(String(right.slot || '').split('_')[1] || 99)
          )
          .map((skill) => skill.id),
        color: '#9d762e',
        stackId: 'engineer-kits',
        placement: 'weapon-set-1'
      });
    }

    // Specializations own their profession group; Core contributes its toolbelt group only when active.
    if (engineerUiSpecialization(context) === 'Core') {
      groups.push({
        id: 'engineer-profession',
        label: 'F',
        skillIds: uniqueIdsBySkillName(professionSkills(context)),
        color: '#b88a35',
        className: 'engineer-profession-skills',
        resourceAnchor: true,
        includeActionSkills: true
      });
    }

    return groups;
  },
  // Tracks kit equip and stow operations as timeline weapon-line transitions.
  timelineWeaponLineTransition: (context: EngineerUiContext) => {
    const skill = context.skill;
    if (skill?.handlerId === 'engineer.kit-equip') {
      return skill.kitName || skill.name;
    }

    if (skill?.handlerId === 'engineer.kit-stow' || (context.weaponLine && skill?.name === 'Swap Weapons')) {
      return null;
    }

    return undefined;
  },
  // Shows endurance only when the Tools line makes dodge resource management relevant.
  resourceViews: (context: EngineerUiContext) => {
    const state = engineerUiState(context);
    const views: ProfessionResourceView[] = [];
    const endurance: ProfessionResourceView = {
      id: 'endurance',
      singular: 'endurance',
      plural: 'endurance',
      maximum: Number(state.maximumEndurance || 100),
      value: Number(state.endurance ?? 100),
      startMaximum: 100,
      canStart: false,
      displayMode: 'bar',
      shortLabel: 'End',
      statusLabel: 'Current',
      // Keep the conditional Tools endurance meter with the Dodge action that
      // spends it, matching the shared palette placement used by professions.
      paletteSkillId: ID.DODGE
    };
    // endurance bar only shown when Tools traitline is active — that's when endurance management is relevant
    if (usesToolsTraitline(context)) views.push(endurance);
    return views;
  },
  paletteSkillAvailability: engineerCorePaletteSkillAvailability,
  // Excludes contextual flips and palette-only kit controls from loadout slots.
  isSlotSkillSelectable(_context: EngineerUiContext, skill: EngineerSkill): boolean {
    return (
      skill.slotSelectable !== false &&
      // Stow and flip skills live in the palette but are not placed in loadout slots.
      skill.handlerId !== 'engineer.kit-stow' &&
      skill.flipParentId == null &&
      !String(skill.name || '').startsWith('Detonate')
    );
  },
  // engineer weapon swap exits a kit, not a true weapon set change — sigil system must know this
  weaponSwapChangesSet: false,
  eventLogRow: engineerEventLogRow
});

/** Binds canonical Engineer catalog data to the stable Core UI contract. */
export function bindEngineerCoreUi(catalog: Readonly<CanonicalCatalog>): typeof engineerCoreUi {
  engineerSkills = catalog.skills as readonly EngineerSkill[];
  engineerSkillsById = catalog.skillsById as ReadonlyMap<SkillId, EngineerSkill>;
  engineerTraits = catalog.traits;
  return engineerCoreUi;
}
