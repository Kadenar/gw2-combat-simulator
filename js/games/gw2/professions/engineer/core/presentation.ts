import type {
  SkillDamagePreviewContext,
  SkillDamageProbeSetup
} from '#gw2/platform/profession-presentation/skill-damage.js';
import type { Skill as PreviewSkill } from '#gw2/platform/engine/skills/types.js';
import type { ProfessionAttributePreviewContext } from '#gw2/platform/profession-presentation/attribute-preview.js';
import { createPreviewControls } from '#gw2/professions/shared/attribute-preview.js';

import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { ENGINEER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/engineer/core/profiles.js';
import { SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS } from '#gw2/platform/simulation/randomness.js';
import { PERMANENT_COMBO_FIELD_ASSUMPTION_CONTROLS } from '#gw2/platform/combos/permanent-field-assumption.js';
import { flattenProfessionState } from '#gw2/platform/engine/profession/state.js';
import {
  normalizeSelectedSkillNames,
  selectedSkillNameSet,
  type Gw2SelectedSkillLoadout
} from '#gw2/platform/builds/selected-skills.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { timedBuffAt } from '#gw2/platform/results/query.js';

import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { getActiveTraits } from '#gw2/professions/engineer/data/traits-data.js';
import type {
  ProfessionEventLogDescriptor,
  ProfessionPaletteGroup,
  ProfessionResourceView,
  RotationStateSnapshotItem
} from '#gw2/platform/profession-presentation/types.js';
import type { CanonicalCatalog, SkillId } from '#gw2/platform/engine/skills/types.js';
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
  return flattenProfessionState(context.state?.profession || context.professionState);
}

/** Resolves the active Engineer specialization name from UI, config, or build context. */
export function engineerUiSpecialization(context: EngineerUiContext = {}): string {
  return context.specialization || context.config?.specialization || context.build?.specialization || 'Core';
}

/** Normalizes the selected slot-skill loadout into a membership set. */
function selectedNames(context: EngineerUiContext = {}): Set<string> {
  return new Set(selectedSkillNameSet(context.config?.selectedSkills || context.build?.selectedSkills));
}

/** Returns selected heal, utility, and elite skill names in their fixed slot order. */
function selectedNamesInSlotOrder(context: EngineerUiContext = {}): (string | undefined)[] {
  const source: Gw2SelectedSkillLoadout = context.config?.selectedSkills || context.build?.selectedSkills || [];
  if (Array.isArray(source)) return [...normalizeSelectedSkillNames(source)];
  const slots = source as Readonly<Record<string, unknown>>;
  return SKILL_SLOT_ORDER.map((slot) => normalizeSelectedSkillNames([slots[slot]])[0]);
}

/** Lists equipped kits in the stable display order used by palette groups. */
function selectedKits(catalog: Readonly<CanonicalCatalog<EngineerSkill>>, context: EngineerUiContext): EngineerSkill[] {
  const names = selectedNames(context);
  return catalog.skills
    .filter((skill) => skill.kitTransition === 'equip' && names.has(skill.name))
    .sort(
      (left, right) =>
        (KIT_ORDER.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (KIT_ORDER.get(right.id) ?? Number.MAX_SAFE_INTEGER) ||
        left.name.localeCompare(right.name)
    );
}

// deduplicates by skill name — some skills have multiple IDs (different specs); keep the first
/** Deduplicates skill IDs by canonical skill name while preserving first occurrence order. */
export function uniqueIdsBySkillName(
  catalog: Readonly<CanonicalCatalog<EngineerSkill>>,
  skillIds: readonly SkillId[]
): SkillId[] {
  return [
    ...new Map(
      skillIds.map((id) => {
        const skill = catalog.skillsById.get(id);
        return [skill?.name || id, id];
      })
    ).values()
  ];
}

/** Deduplicates skill records by name for palette and profession-bar presentation. */
function uniqueSkillsByName(skills: readonly EngineerSkill[]): EngineerSkill[] {
  return [...new Map(skills.map((skill) => [skill.name, skill])).values()];
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
  return (
    uniqueSkillsByName(
      catalog.skills.filter(
        (skill) => skill.toolbeltParentId === parentId && !(skill.name || '').startsWith('Detonate')
      )
    )[0]?.id ?? null
  );
}

/** Finds the first named Engineer skill for its profession bar. */
export function namedSkillId(catalog: Readonly<CanonicalCatalog<EngineerSkill>>, name: string): SkillId | null {
  return catalog.skills.find((skill) => skill.name === name)?.id ?? null;
}

/** Maps the selected slot-skill loadout to its ordered Engineer toolbelt bar. */
export function engineerToolbeltSkillIds(
  catalog: Readonly<CanonicalCatalog<EngineerSkill>>,
  context: EngineerUiContext
): (SkillId | null)[] {
  return selectedNamesInSlotOrder(context).map((name) =>
    toolbeltSkillId(catalog, name == null ? undefined : catalog.skillsByName.get(name)?.id)
  );
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
    /** Prepare legal preview casts with the same catalog metadata and transitions used by the runtime. */
    skillDamageProbe(context: SkillDamagePreviewContext, skill: PreviewSkill): SkillDamageProbeSetup | null {
      if (skill.id === SHARED_SKILL_IDS.SWAP_WEAPONS) return { setup: [{ type: 'cast', skillId: ID.GRENADE_KIT }] };
      // A full native counter cycle includes the delayed Orbital Command Strike in proc-only discovery.
      if (
        skill.type === 'Weapon' &&
        skill.kitId == null &&
        (skill.effects?.some((effect) => effect.projectile === true) || skill.categories?.includes('Projectile')) &&
        context.activeTraits.some((trait) => trait.id === TRAIT.AIM_ASSISTED_ROCKET)
      ) {
        const profile = requireBalanceProfileFromContext(context, TRAIT.AIM_ASSISTED_ROCKET);
        return {
          procSetup: Array.from({ length: balanceProfileNumber(profile, 'maximumStacks') - 1 }, () => [
            { type: 'cast' as const, skillId: skill.id, offTarget: false },
            { type: 'wait' as const, durationMs: balanceProfileNumber(profile, 'internalCooldown') * 1000 }
          ]).flat()
        };
      }

      const kitId = (skill as EngineerSkill).kitId;
      if (kitId == null || kitId === skill.id) return null;
      return { setup: [{ type: 'cast', skillId: kitId }] };
    },

    /** Declare this module's conditional inputs without adding simulation settings. */
    previewControls(context: ProfessionAttributePreviewContext) {
      const preview = createPreviewControls(context);

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
    assumptionControls: [...SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS, ...PERMANENT_COMBO_FIELD_ASSUMPTION_CONTROLS],
    // Builds one stacked palette group per selected kit, plus Core's profession-skill group.
    paletteGroups: (context: EngineerUiContext) => {
      const groups: ProfessionPaletteGroup[] = [];
      // Each selected kit gets a stable slot-ordered group in the shared kit stack.
      for (const kit of selectedKits(catalog, context)) {
        const kitSkills = uniqueSkillsByName(catalog.skills.filter((skill) => skill.kitId === kit.id));
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
          skillIds: uniqueIdsBySkillName(catalog, professionSkills(catalog, context)),
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
      const maximum = balanceProfileNumber(resourcesProfile, 'maximumStacks');
      const endurance: ProfessionResourceView = {
        id: 'endurance',
        singular: 'endurance',
        plural: 'endurance',
        maximum,
        value: state.endurance ?? maximum,
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

      const buff = timedBuffAt(context.result, 'kinetic-battery', context.atSeconds || 0);
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
    // engineer weapon swap exits a kit, not a true weapon set change — sigil system must know this
    weaponSwapChangesSet: false,
    eventLogRow: engineerEventLogRow
  });
}
