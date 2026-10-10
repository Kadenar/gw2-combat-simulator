import type { ProfessionAttributePreviewContext } from '#gw2/platform/profession-presentation/attribute-preview.js';
import { createPreviewControls } from '#gw2/professions/shared/attribute-preview.js';

import { selectedSkillIdSet } from '#gw2/platform/builds/selected-skills.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { PERMANENT_COMBO_FIELD_ASSUMPTION_CONTROLS } from '#gw2/platform/combos/permanent-field-assumption.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { planningBuffAt } from '#gw2/platform/results/result-queries.js';
import { SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS } from '#gw2/platform/builds/randomness-assumptions.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { ENGINEER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/engineer/core/profiles.js';

import type { CanonicalCatalog, SkillId } from '#gw2/platform/skills/types.js';
import type {
  ProfessionEventLogDescriptor,
  ProfessionPaletteGroup,
  ProfessionResourceView,
  RotationStateSnapshotItem
} from '#gw2/platform/profession-presentation/types.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { getActiveTraits } from '#gw2/professions/engineer/data/traits-data.js';
import type {
  EngineerResolverEvent,
  EngineerSkill,
  EngineerState,
  EngineerUiContext,
  EngineerUiSlice
} from '#gw2/professions/engineer/types.js';

/**
 * Core Engineer presentation and shared application callbacks. Elite modules
 * own their profession bars, resources, assumptions, and palette groups.
 */

// Order kit groups by stable equip IDs; catalog names are display labels.
const KIT_ORDER = new Map<SkillId, number>([
  [ID.GRENADE_KIT, 0],
  [ID.FLAMETHROWER, 1],
  [ID.BOMB_KIT, 2],
  [ID.MED_KIT, 3],
  [ID.ELIXIR_GUN, 5],
  [ID.ELITE_MORTAR_KIT, 6]
]);

const SKILL_SLOT_ORDER: readonly string[] = Object.freeze(['Heal', 'Utility1', 'Utility2', 'Utility3', 'Elite']);

/** Flattens Core and active-specialization state for Engineer UI consumers. */
export function engineerUiState(context: EngineerUiContext = {}): Partial<EngineerState> {
  // Presentation callers supply the flat projection for the inspected rotation point.
  return context.professionState ?? {};
}

/** Resolves the active Engineer specialization name from UI, config, or build context. */
export function engineerUiSpecialization(context: EngineerUiContext = {}): string {
  return context.specialization || context.config?.specialization || context.build?.specialization || 'Core';
}

/** Normalizes the selected slot-skill loadout into a membership set. */
function selectedIds(context: EngineerUiContext = {}): Set<SkillId> {
  return new Set(selectedSkillIdSet(context.config?.selectedSkillIds || context.build?.selectedSkillIds));
}

/** Returns selected heal, utility, and elite skill names in their fixed slot order. */
function selectedIdsInSlotOrder(context: EngineerUiContext = {}): (SkillId | undefined)[] {
  if (context.build) return SKILL_SLOT_ORDER.map((slot) => context.build!.selectedSkillIds?.[slot] ?? undefined);
  return [...(context.config?.selectedSkillIds ?? [])];
}

/** Lists equipped kits in the stable display order used by palette groups. */
function selectedKits(catalog: Readonly<CanonicalCatalog<EngineerSkill>>, context: EngineerUiContext): EngineerSkill[] {
  const names = selectedIds(context);
  return catalog.skills
    .filter((skill) => skill.kitTransition === 'equip' && names.has(skill.id))
    .sort(
      (left, right) =>
        (KIT_ORDER.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (KIT_ORDER.get(right.id) ?? Number.MAX_SAFE_INTEGER) ||
        left.name.localeCompare(right.name)
    );
}

/** Retain distinct catalog variants while removing repeated references to the same skill. */
export function uniqueSkillIds(
  catalog: Readonly<CanonicalCatalog<EngineerSkill>>,
  skillIds: readonly SkillId[]
): SkillId[] {
  return [...new Set(skillIds)].filter((id) => catalog.skillsById.has(id));
}

/** Palette entries deduplicate by identity while retaining distinct catalog variants. */
function uniqueSkillsById(skills: readonly EngineerSkill[]): EngineerSkill[] {
  return [...new Map(skills.map((skill) => [skill.id, skill])).values()];
}

/** Reports whether the build's selected trait lines activate the named trait. */
export function hasActiveTrait(context: EngineerUiContext, name: string): boolean {
  return getActiveTraits(context.build?.specializations || []).some((trait) => trait.name === name);
}

/** Detects the Tools trait line even when programmatic contexts omit build specialization metadata. */
function usesToolsTraitline(catalog: Readonly<CanonicalCatalog<EngineerSkill>>, context: EngineerUiContext): boolean {
  if ((context.build?.specializations || []).some((selection) => selection.name === 'Tools')) return true;
  // Programmatic UI contexts may omit build specialization metadata, so infer
  // the Tools line from the canonical trait selection.
  return catalog.traits.some((trait) => trait.specialization === 'Tools' && hasTrait(context, trait.id));
}

// toolbelt skill is the non-Detonate variant — each parent has both a toolbelt skill and a detonate flip
/** Resolves an equipped slot skill to its non-detonate toolbelt skill. */
function toolbeltSkillId(
  catalog: Readonly<CanonicalCatalog<EngineerSkill>>,
  parentId: SkillId | undefined
): SkillId | null {
  if (parentId == null) return null;
  return catalog.skills.find((skill) => skill.toolbeltParentId === parentId && skill.flipParentId == null)?.id ?? null;
}

/** Maps the selected slot-skill loadout to its ordered Engineer toolbelt bar. */
export function engineerToolbeltSkillIds(
  catalog: Readonly<CanonicalCatalog<EngineerSkill>>,
  context: EngineerUiContext
): (SkillId | null)[] {
  return selectedIdsInSlotOrder(context).map((id) => toolbeltSkillId(catalog, id));
}

/** Returns populated Core profession-skill IDs for palette and bar consumers. */
function professionSkills(catalog: Readonly<CanonicalCatalog<EngineerSkill>>, context: EngineerUiContext): SkillId[] {
  return engineerToolbeltSkillIds(catalog, context).filter((id) => id != null);
}

/** Suppresses internal Engineer events whose visible effects already have dedicated result rows. */
function engineerEventLogRow(
  context: EngineerUiContext,
  event: EngineerResolverEvent
): ProfessionEventLogDescriptor | null | undefined {
  // Surface charge progress and the fifth-charge activation before suppressing internal snapshots.
  if (event.type === 'engineer.kinetic-battery') {
    const charges = Number(event.kineticCharges || 0);
    return {
      type: event.type,
      description: charges ? `Kinetic Charge - ${charges}/5` : 'Kinetic Battery activated - charges reset to 0/5',
      className: 'resource',
      order: 30
    };
  }

  if (
    [
      'engineer.dodge',
      // Air Blast's conditional Burning application supplies its visible result row.
      'engineer.air-blast',
      'engineer.lightning-rod-pulse',
      'engineer.conduit-surge',
      'engineer.electric-artillery'
    ].includes(event.type)
  ) {
    // These resolver events materialize skill packets. The ordinary action,
    // damage, and condition rows already present their user-visible effects.
    return null;
  }

  if (event.type === 'engineer.heat' && engineerUiSpecialization(context) !== 'Holosmith') return null;
  return undefined;
}

/** Captures this UI's catalog so other profession instances cannot change its projections. */
export function bindEngineerCoreUi(catalog: Readonly<CanonicalCatalog<EngineerSkill>>): EngineerUiSlice {
  return Object.freeze({
    /** Declare this module's conditional inputs without adding simulation settings. */
    previewControls(context: ProfessionAttributePreviewContext) {
      const preview = createPreviewControls(context);
      // Expose held combat bonuses to isolated damage calculations.
      preview.damageBuff('Thermal Vision', 'thermalVision', 'thermal-vision');
      preview.damageBuff('Kinetic Battery', 'kineticBattery', 'kinetic-battery');
      preview.boon('vigor', 'Excessive Energy');

      preview.boon('regeneration', 'Energy Amplifier');
      preview.buff('Explosive Temper', 'explosiveTemper', 'explosive-temper', 'Ferocity', true);
      preview.buff('Grand Entrance', 'grandEntrance', 'grand-entrance', 'Critical Chance');
      preview.trait('High Caliber', {
        key: 'highCaliber',
        kind: 'queryTrait',
        field: 'High Caliber',
        description: 'Within range; Critical Chance'
      });
      preview.targetHealth('Heavy Metal');
      return preview.controls;
    },

    // Tile identity follows the active bar even when the visible skill cannot currently be cast.
    paletteOverride: (context, skill) => {
      const state = engineerUiState(context);
      if (skill.kitTransition === 'equip') return { tileActive: state.activeKit !== skill.id };
      if (skill.kitTransition === 'stow') return { tileActive: state.activeKit === skill.kitId };
    },
    // Swap Weapons also leaves an active kit, so it stays beside Dodge even without an alternate set; planning
    // availability disables it whenever it can neither stow a kit nor swap equipped sets before combat.
    paletteActionSkills(_context, skills) {
      const swap = catalog.skillsById.get(SHARED_SKILL_IDS.SWAP_WEAPONS);
      if (!swap || skills.some((skill) => skill.id === swap.id)) return [...skills];
      const dodge = skills.findIndex((skill) => skill.id === SHARED_SKILL_IDS.DODGE);
      return [...skills.slice(0, dodge + 1), swap, ...skills.slice(dodge + 1)];
    },
    assumptionControls: [...SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS, ...PERMANENT_COMBO_FIELD_ASSUMPTION_CONTROLS],
    // Builds one stacked palette group per selected kit, plus Core's profession-skill group.
    paletteGroups: (context: EngineerUiContext) => {
      const groups: ProfessionPaletteGroup[] = [];
      // Each selected kit gets a stable slot-ordered group in the shared kit stack.
      for (const kit of selectedKits(catalog, context)) {
        const kitSkills = uniqueSkillsById(catalog.skills.filter((skill) => skill.kitId === kit.id));
        groups.push({
          id: `engineer-kit-${kit.id}`,
          label: kit.name.replace(' Kit', '').slice(0, 4),
          skillIds: kitSkills
            .sort(
              (left, right) =>
                Number(String(left.slot || '').split('_')[1] || 99) -
                Number(String(right.slot || '').split('_')[1] || 99)
            )
            .map((skill) => skill.id),
          color: '#9d762e',
          stackId: 'engineer-kits',
          // Kits belong to the active weapon bar regardless of the selected starting equipment set.
          placement: 'active-weapon'
        });
      }

      // Specializations own their profession group; Core contributes its toolbelt group only when active.
      if (engineerUiSpecialization(context) === 'Core') {
        groups.push({
          id: 'engineer-profession',
          label: 'F',
          skillIds: uniqueSkillIds(catalog, professionSkills(catalog, context)),
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
      if (skill?.kitTransition === 'equip') {
        return skill.name;
      }

      if (skill?.kitTransition === 'stow' || (context.weaponLine && skill?.id === SHARED_SKILL_IDS.SWAP_WEAPONS)) {
        return null;
      }

      return undefined;
    },
    // Shows endurance only when the Tools line makes dodge resource management relevant.
    resourceViews: (context: EngineerUiContext) => {
      const state = engineerUiState(context);
      if (!usesToolsTraitline(catalog, context)) return [];
      const resourcesProfile = requireBalanceProfileFromContext(context, PROFILE.resources);
      const maximum = state.endurance?.maximum ?? balanceProfileNumber(resourcesProfile, 'maximumStacks');
      const endurance: ProfessionResourceView = {
        id: 'endurance',
        singular: 'endurance',
        plural: 'endurance',
        maximum,
        value: state.endurance?.value ?? maximum,
        startMaximum: maximum,
        canStart: false,
        displayMode: 'bar',
        shortLabel: 'End',
        statusLabel: 'Current',
        // Keep the conditional Tools endurance meter with the Dodge action that
        // spends it, matching the shared palette placement used by professions.
        paletteSkillId: SHARED_SKILL_IDS.DODGE
      };
      return [endurance];
    },
    // Keep battery progress and its active buff timer together at the inspected rotation point.
    rotationStateSnapshot: (context: EngineerUiContext): RotationStateSnapshotItem[] => {
      const items: RotationStateSnapshotItem[] = [];
      if (hasTrait(context, TRAIT.KINETIC_BATTERY) || hasActiveTrait(context, 'Kinetic Battery')) {
        items.push({
          id: 'engineer-kinetic-charges',
          label: 'Kinetic Charges',
          value: `${engineerUiState(context).kineticCharges || 0}/5`
        });
      }

      const buff = planningBuffAt(context.planningState, 'kinetic-battery');
      if (buff) {
        items.push({
          id: 'engineer-kinetic-battery',
          label: 'Kinetic Battery',
          value: `${buff.remaining.toFixed(1)}s`,
          title: 'Kinetic Battery is active; time remaining'
        });
      }

      return items;
    },
    // Excludes contextual flips and palette-only kit controls from loadout slots.
    isSlotSkillSelectable(_context: EngineerUiContext, skill: EngineerSkill): boolean {
      return (
        skill.slotSelectable !== false &&
        // Stow and flip skills live in the palette but are not placed in loadout slots.
        skill.kitTransition !== 'stow' &&
        skill.flipParentId == null &&
        !(skill.name || '').startsWith('Detonate')
      );
    },
    eventLogRow: engineerEventLogRow
  });
}
