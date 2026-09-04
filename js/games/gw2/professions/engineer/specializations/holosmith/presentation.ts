import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import {
  engineerFSkillBarGroups,
  engineerToolbeltSkillIds,
  engineerUiSpecialization,
  engineerUiState,
  hasActiveTrait,
  namedSkillId,
  uniqueIdsBySkillName
} from '#gw2/professions/engineer/core/presentation.js';
import type {
  CanonicalCatalog,
  PaletteSkillAvailability,
  ProfessionEventLogDescriptor,
  ProfessionResourceView,
  ProfessionUiContract,
  SchedulerRecord,
  SkillId
} from '#gw2/platform/engine/types.js';
import type { EngineerResolverEvent, EngineerUiContext } from '#gw2/professions/engineer/types.js';
import type { HolosmithSkill } from '#gw2/professions/engineer/specializations/holosmith/types.js';

const HEAT_STATE_REASONS = new Set<string>([
  'enter-forge',
  'exit-forge',
  'heat',
  'overheat',
  'passive-heat',
  'thermal-release-valve'
]);

const HOLOSMITH_PACKET_EVENTS = new Set<string>([
  'engineer.prime-light-beam-field',
  'engineer.laser-disk',
  'engineer.launch-wall',
  'engineer.radiant-arc-quickness',
  'engineer.refraction-cutter-extra-blades'
]);

// Populated by bindHolosmithUi at module init time; safe to read thereafter.
let engineerSkills: readonly HolosmithSkill[] = [];
let engineerSkillsById: ReadonlyMap<SkillId, HolosmithSkill> = new Map();

/** Returns the available Photon Forge bar, selecting the Storm autoattack variant when traited. */
function holosmithForgeSkillIds(context: EngineerUiContext): number[] {
  const storm = hasActiveTrait(context, 'Crystal Configuration: Storm');
  return [
    storm ? ID.LIGHT_STRIKE_STORM : ID.LIGHT_STRIKE,
    ID.HOLO_LEAP,
    ID.CORONA_BURST,
    ID.PHOTON_BLITZ,
    ID.HOLOGRAPHIC_SHOCKWAVE
  ].filter((skillId) => engineerSkillsById.has(skillId));
}

/** Projects the tool-belt and current Photon Forge toggle onto Holosmith's profession bar. */
function holosmithProfessionSkills(context: EngineerUiContext) {
  const state = engineerUiState(context);
  return [
    ...engineerToolbeltSkillIds(context).slice(0, 4),
    namedSkillId(state.photonForgeActive ? 'Deactivate Photon Forge' : 'Engage Photon Forge')
  ];
}

/** Projects Forge replacement rules and the kit lockout into palette availability. */
function holosmithPaletteAvailability(context: EngineerUiContext, skill: HolosmithSkill): PaletteSkillAvailability {
  const state = engineerUiState(context);
  const now = Number(context.time || 0);
  const kitLockoutUntil = Number(state.kitLockoutUntil || 0);
  // The shared tile projector selects the active Photon Forge transition while
  // this contract remains the sole source of its state availability.
  if (skill.id === ID.ENGAGE_PHOTON_FORGE && state.photonForgeActive) {
    return { available: false, message: 'Photon Forge is already active' };
  }

  if (skill.id === ID.DEACTIVATE_PHOTON_FORGE && !state.photonForgeActive) {
    return { available: false, message: 'Enter Photon Forge first' };
  }

  if (skill.type === 'Weapon' && skill.weapon && state.photonForgeActive) {
    return {
      available: false,
      message: 'Photon Forge replaces equipped weapon skills'
    };
  }

  if (skill.forgeSkill && !state.photonForgeActive) {
    return { available: false, message: 'Enter Photon Forge first' };
  }

  // Project the Forge kit lockout as a retryable context cooldown so kit tiles
  // show a countdown while remaining click-queueable for their ready time.
  if (skill.handlerId === 'engineer.kit-equip' && now < kitLockoutUntil) {
    return {
      available: false,
      message: 'Kits are disabled briefly after entering Photon Forge.',
      retryAt: kitLockoutUntil
    };
  }

  return { available: true, message: '' };
}

/** Hides internal packets with `null`, renders heat snapshots, and defers unrelated events with `undefined`. */
function holosmithEventLogRow(
  context: EngineerUiContext,
  event: EngineerResolverEvent
): ProfessionEventLogDescriptor | null | undefined {
  const buildSpecializations = Array.isArray(context.build?.specializations) ? context.build.specializations : [];
  const isHolosmith =
    engineerUiSpecialization(context) === 'Holosmith' ||
    buildSpecializations.some((specialization) => String(specialization?.name || specialization) === 'Holosmith');
  if (!isHolosmith) return undefined;
  if (HOLOSMITH_PACKET_EVENTS.has(event?.type)) return null;
  if (event?.type !== 'engineer.state') return undefined;
  if (!HEAT_STATE_REASONS.has(String(event.reason || ''))) return null;
  return {
    type: event.type,
    description: `${event.reason || 'State'} - ` + `Heat ${Number(event.state?.heat || 0).toFixed(1)}`,
    className: 'resource',
    order: 30,
    flags: []
  };
}

/** Supplies Holosmith skill-bar, palette, heat-resource, and event-log presentation behavior. */
export const holosmithUi: Partial<ProfessionUiContract> & SchedulerRecord = Object.freeze({
  eventLogRow: holosmithEventLogRow,
  // Photon Forge changes weapon presentation only while the Holosmith slice is active.
  timelineWeaponLineTransition: (context: EngineerUiContext) => {
    if (context.skill?.handlerId === 'engineer.photon-forge-enter') return 'Photon Forge';
    if (context.skill?.handlerId === 'engineer.photon-forge-exit') return null;
    return undefined;
  },
  skillBarGroups: (context: EngineerUiContext) => [
    ...engineerFSkillBarGroups(holosmithProfessionSkills(context)),
    {
      id: 'engineer-photon-forge',
      label: 'Photon Forge',
      skillIds: holosmithForgeSkillIds(context),
      color: '#e5a72d'
    }
  ],
  paletteGroups: (context: EngineerUiContext) => {
    const storm = hasActiveTrait(context, 'Crystal Configuration: Storm');
    // Keep profession toggles and Forge weapon skills in separate stacked palette groups.
    return [
      {
        id: 'engineer-profession',
        label: 'F',
        skillIds: uniqueIdsBySkillName(
          [
            ...engineerToolbeltSkillIds(context).slice(0, 4),
            namedSkillId('Engage Photon Forge'),
            namedSkillId('Deactivate Photon Forge')
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
        skillIds: engineerSkills
          .filter((skill) => {
            if (!skill.forgeSkill) return false;
            // Include only the base or Storm autoattack variant selected by the active trait.
            if (skill.slot !== 'Weapon_1') return true;
            return skill.name.endsWith('—Storm') === storm;
          })
          .map((skill) => skill.id),
        color: '#e5a72d',
        className: 'engineer-forge-skills',
        stackId: 'holosmith-profession'
      }
    ];
  },
  resourceViews: (context: EngineerUiContext): ProfessionResourceView[] => {
    const state = engineerUiState(context);
    const maximum = Number(state.maximumHeat || 100);
    return [
      {
        id: 'heat',
        singular: 'heat',
        plural: 'heat',
        maximum,
        value: Number(state.heat ?? context.initialHeat ?? 0),
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
  },
  paletteSkillAvailability: holosmithPaletteAvailability
});

/** Binds canonical skills used by Holosmith UI projections and returns the shared UI contract. */
export function bindHolosmithUi(catalog: Readonly<CanonicalCatalog>): typeof holosmithUi {
  engineerSkills = catalog.skills;
  engineerSkillsById = catalog.skillsById;
  return holosmithUi;
}
