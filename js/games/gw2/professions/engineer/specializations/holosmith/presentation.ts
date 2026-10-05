import type { CanonicalCatalog, Skill as PreviewSkill, SkillId } from '#gw2/platform/skills/types.js';
import type { ProfessionAttributePreviewContext } from '#gw2/platform/profession-presentation/attribute-preview.js';
import type {
  SkillDamagePreviewPreparation,
  SkillDamageState
} from '#gw2/platform/profession-presentation/skill-damage.js';
import type {
  ProfessionEventLogDescriptor,
  ProfessionResourceView
} from '#gw2/platform/profession-presentation/types.js';
import {
  engineerToolbeltSkillIds,
  engineerUiSpecialization,
  engineerUiState,
  hasActiveTrait,
  uniqueSkillIds
} from '#gw2/professions/engineer/core/presentation.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import { HOLOSMITH_FORGE_TOGGLE_SKILL_IDS } from '#gw2/professions/engineer/specializations/holosmith/mechanics/constants.js';
import { enhancedCapacityMaximumHeat } from '#gw2/professions/engineer/specializations/holosmith/traits/heat.js';
import type { HolosmithSkill } from '#gw2/professions/engineer/specializations/holosmith/types.js';
import type { EngineerResolverEvent, EngineerUiContext, EngineerUiSlice } from '#gw2/professions/engineer/types.js';
import { createPreviewControls } from '#gw2/professions/shared/attribute-preview.js';

const HEAT_STATE_REASONS = new Set<string>([
  'enter-forge',
  'exit-forge',
  'heat',
  'overheat',
  'passive-heat',
  // Vent Exhaust publishes the heat spent by Thermal Release Valve.
  'vent-exhaust'
]);

const HOLOSMITH_PACKET_EVENTS = new Set<string>([
  // Lens grants only update resolver charges; consumed charges produce visible Burning rows.
  'engineer.solar-focusing-lens',
  'engineer.prime-light-beam-field',
  'engineer.laser-disk',
  'engineer.launch-wall',
  'engineer.radiant-arc-quickness',
  'engineer.refraction-cutter-extra-blades'
]);

/** Hides internal packets with `null`, renders heat snapshots, and defers unrelated events with `undefined`. */
function holosmithEventLogRow(
  context: EngineerUiContext,
  event: EngineerResolverEvent
): ProfessionEventLogDescriptor | null | undefined {
  const buildSpecializations = Array.isArray(context.build?.specializations) ? context.build.specializations : [];
  const isHolosmith =
    engineerUiSpecialization(context) === 'Holosmith' ||
    buildSpecializations.some((specialization) => String(specialization.name || specialization) === 'Holosmith');
  if (!isHolosmith) return undefined;
  if (HOLOSMITH_PACKET_EVENTS.has(event.type)) return null;
  if (event.type !== 'engineer.heat') return undefined;
  if (!HEAT_STATE_REASONS.has(String(event.reason || ''))) return null;
  return {
    type: event.type,
    description: `${event.reason || 'State'} - ` + `Heat ${Number(event.heat || 0).toFixed(1)}`,
    className: 'resource',
    order: 30
  };
}

/** Captures this UI's catalog so other profession instances cannot change its projections. */
export function bindHolosmithUi(catalog: Readonly<CanonicalCatalog<HolosmithSkill>>): EngineerUiSlice {
  return Object.freeze({
    /** Heat tiers use the runtime's starting state and trait-dependent cap; cooling and overheat remain simulated. */
    previewControls(context: ProfessionAttributePreviewContext) {
      const preview = createPreviewControls(context);
      preview.add({
        key: 'lensCharges',
        label: 'Solar Focusing Lens charges',
        group: 'Mechanic',
        kind: 'special',
        scope: ['damage'],
        max: 6,
        description: 'Starting charges; consumed by strikes in impact order'
      });
      preview.add({
        key: 'heat',
        label: 'Starting heat',
        group: 'Mechanic',
        kind: 'special',
        scope: ['damage'],
        max: enhancedCapacityMaximumHeat({ selectedTraitIds: context.activeTraits.map((trait) => trait.id) }),
        initial: Number((context.build as { readonly initialHeat?: unknown }).initialHeat) || 0,
        description: 'Heat before the occurrence; skill tiers, cooling and overheat follow the runtime'
      });
      return preview.controls;
    },
    prepareSkillDamagePreview: ({ values }: SkillDamagePreviewPreparation) =>
      values.heat == null ? {} : { initialHeat: Number(values.heat) },
    /** Declare damage inputs without constructing prerequisite actions. */
    skillDamageState(context: SkillDamagePreviewPreparation, _skill: PreviewSkill): SkillDamageState | null {
      // Direct evaluation supplies damage state without prerequisite actions.
      return {
        assumptions: [`Solar Focusing Lens: ${Number(context.values.lensCharges ?? 0)} starting charges`]
      };
    },

    // Tile identity follows the active bar even when the visible skill cannot currently be cast.
    paletteOverride: (context, skill) => {
      if (skill.id === ID.ENGAGE_PHOTON_FORGE || skill.id === ID.DEACTIVATE_PHOTON_FORGE)
        return {
          tileActive: (skill.id === ID.DEACTIVATE_PHOTON_FORGE) === Boolean(engineerUiState(context).photonForgeActive)
        };
    },
    eventLogRow: holosmithEventLogRow,
    // Photon Forge changes weapon presentation only while the Holosmith slice is active.
    timelineWeaponLineTransition: (context: EngineerUiContext) => {
      if (context.skill?.id === ID.ENGAGE_PHOTON_FORGE) return 'Photon Forge';
      if (context.skill && HOLOSMITH_FORGE_TOGGLE_SKILL_IDS.has(Number(context.skill.id))) return null;
      return undefined;
    },
    paletteGroups: (context: EngineerUiContext) => {
      const storm = hasActiveTrait(context, 'Crystal Configuration: Storm');
      // Keep profession toggles and Forge weapon skills in separate stacked palette groups.
      return [
        {
          id: 'engineer-profession',
          label: 'F',
          skillIds: uniqueSkillIds(
            catalog,
            [
              ...engineerToolbeltSkillIds(catalog, context).slice(0, 4),
              ID.ENGAGE_PHOTON_FORGE,
              ID.DEACTIVATE_PHOTON_FORGE
            ].filter((skillId): skillId is SkillId => skillId != null)
          ),
          color: '#b88a35',
          className: 'compact-resource-palette engineer-profession-skills',
          resourceAnchor: true,
          stackId: 'holosmith-profession',
          includeActionSkills: true
        },
        {
          id: 'engineer-forge',
          label: 'Forge',
          skillIds: catalog.skills
            .filter((skill) => {
              if (!skill.forgeSkill) return false;
              // Include only the base or Storm autoattack variant selected by the active trait.
              if (skill.slot !== 'Weapon_1') return true;
              return skill.name.endsWith('—Storm') === storm;
            })
            // Display Forge weapons in slot order regardless of canonical catalog ordering.
            .sort((left, right) => String(left.slot).localeCompare(String(right.slot)))
            .map((skill) => skill.id),
          color: '#e5a72d',
          className: 'engineer-forge-skills',
          stackId: 'holosmith-profession'
        }
      ];
    },
    resourceViews: (context: EngineerUiContext): ProfessionResourceView[] => {
      const state = engineerUiState(context);
      // Use the observed clock capacity, or selected traits before an initial result exists.
      const maximum = state.heat?.maximum ?? enhancedCapacityMaximumHeat(context.config ?? {});
      return [
        {
          id: 'heat',
          singular: 'heat',
          plural: 'heat',
          maximum,
          value: state.heat?.value ?? context.initialHeat ?? 0,
          startMaximum: maximum,
          canStart: true,
          buildKey: 'initialHeat',
          step: 1,
          displayMode: 'bar',
          pipStyle: 'compact-profession-resource-holosmith-heat',
          shortLabel: 'Heat',
          statusLabel: state.overheated ? 'Overheated' : 'Current'
        }
      ];
    }
  });
}
