import type {
  SkillDamagePreviewPreparation,
  SkillDamageProbeSetup
} from '#gw2/platform/profession-presentation/skill-damage.js';
import type { Skill as PreviewSkill } from '#gw2/platform/engine/skills/types.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { HOLOSMITH_FORGE_TOGGLE_SKILL_IDS } from '#gw2/professions/engineer/specializations/holosmith/mechanics/constants.js';
import {
  engineerToolbeltSkillIds,
  engineerUiSpecialization,
  engineerUiState,
  hasActiveTrait,
  namedSkillId,
  uniqueIdsBySkillName
} from '#gw2/professions/engineer/core/presentation.js';
import type { CanonicalCatalog, SkillId } from '#gw2/platform/engine/skills/types.js';
import type {
  ProfessionEventLogDescriptor,
  ProfessionResourceView
} from '#gw2/platform/profession-presentation/types.js';
import type { EngineerResolverEvent, EngineerUiContext, EngineerUiSlice } from '#gw2/professions/engineer/types.js';
import type { HolosmithSkill } from '#gw2/professions/engineer/specializations/holosmith/types.js';
import type { ProfessionAttributePreviewContext } from '#gw2/platform/profession-presentation/attribute-preview.js';
import { createPreviewControls } from '#gw2/professions/shared/attribute-preview.js';
import { enhancedCapacityMaximumHeat } from '#gw2/professions/engineer/specializations/holosmith/traits/heat.js';

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
        key: 'forgeCycle',
        label: 'Prepare Forge traits',
        group: 'Mechanic',
        kind: 'special',
        scope: ['damage'],
        description: 'Enter and leave Photon Forge before ordinary attacks; charges and cooling follow the runtime'
      });
      preview.add({
        key: 'heat',
        label: 'Starting heat',
        group: 'Mechanic',
        kind: 'special',
        scope: ['damage'],
        max: enhancedCapacityMaximumHeat({ selectedTraitIds: context.activeTraits.map((trait) => trait.id) }),
        initial: Number((context.build as { readonly initialHeat?: unknown }).initialHeat) || 0,
        description: 'Heat before setup; skill tiers, cooling and overheat follow the runtime'
      });
      return preview.controls;
    },
    prepareSkillDamagePreview: ({ values }: SkillDamagePreviewPreparation) =>
      values.heat == null ? {} : { initialHeat: Number(values.heat) },
    /** Prepare legal preview casts with the same catalog metadata and transitions used by the runtime. */
    skillDamageProbe(context: SkillDamagePreviewPreparation, skill: PreviewSkill): SkillDamageProbeSetup | null {
      // A real Forge cycle prepares Lens and cooling windows without manufacturing their charges or multipliers.
      if (!(skill as HolosmithSkill).forgeSkill && !HOLOSMITH_FORGE_TOGGLE_SKILL_IDS.has(Number(skill.id))) {
        if (skill.id === SHARED_SKILL_IDS.SWAP_WEAPONS) return null;
        if (!context.values.forgeCycle) return null;
        const kit = (skill as HolosmithSkill).kitId;
        return {
          setup: [
            { type: 'cast', skillId: ID.ENGAGE_PHOTON_FORGE },
            { type: 'cast', skillId: ID.DEACTIVATE_PHOTON_FORGE },
            ...(kit != null && kit !== skill.id ? [{ type: 'cast' as const, skillId: kit }] : [])
          ]
        };
      }

      if (skill.id === ID.ENGAGE_PHOTON_FORGE) return null;
      const positions = context.catalog.autoattackChainPositions;
      const position = positions.get(Number(skill.id));
      const root = (skill as HolosmithSkill).chainRoot;
      const predecessors =
        position || root == null
          ? []
          : context.catalog.skills
              .filter(
                (candidate) => candidate.chainRoot === root && Number(candidate.chainStep) < Number(skill.chainStep)
              )
              .sort((a, b) => Number(a.chainStep) - Number(b.chainStep));
      return {
        setup: [
          { type: 'cast', skillId: ID.ENGAGE_PHOTON_FORGE },
          ...predecessors.map((candidate) => ({ type: 'cast' as const, skillId: candidate.id }))
        ]
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
          skillIds: uniqueIdsBySkillName(
            catalog,
            [
              ...engineerToolbeltSkillIds(catalog, context).slice(0, 4),
              namedSkillId(catalog, 'Engage Photon Forge'),
              namedSkillId(catalog, 'Deactivate Photon Forge')
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
      const maximum = state.maximumHeat || 100;
      return [
        {
          id: 'heat',
          singular: 'heat',
          plural: 'heat',
          maximum,
          value: state.heat ?? context.initialHeat ?? 0,
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
