import { flattenProfessionState } from '#gw2/platform/engine/profession/state.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS } from '#gw2/platform/simulation/randomness.js';
import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS } from '#gw2/content/professions/guardian/data/ids.js';
import type {
  CanonicalCatalog,
  ProfessionEventLogDescriptor,
  ProfessionUiContract,
  RotationStateSnapshotItem,
  SchedulerRecord,
  SkillId
} from '#gw2/platform/engine/types.js';
import type {
  GuardianResolverEvent,
  GuardianSkill,
  GuardianState,
  GuardianUiContext
} from '#gw2/content/professions/guardian/types.js';

let guardianCatalog: Readonly<CanonicalCatalog>;

export function guardianUiSpecialization(context: GuardianUiContext = {}): string {
  return context.specialization || context.config?.specialization || 'Core';
}

/** Simulation time (seconds) of the rotation point being inspected. */
export function guardianSnapshotAt(context: GuardianUiContext = {}): number {
  return Math.max(0, Number(context.atSeconds || 0));
}

/** Formats a remaining duration for the active-state bar (e.g. `4.2s`). */
export function formatSecondsRemaining(seconds: number): string {
  return `${Math.max(0, seconds).toFixed(1)}s`;
}

export function guardianUiState(context: GuardianUiContext = {}): Partial<GuardianState> {
  return flattenProfessionState(context.state?.profession || context.professionState);
}

/** Keeps Symbolic Avenger visible for every Guardian specialization while its damage bonus is active. */
function guardianCoreStateSnapshot(context: GuardianUiContext): RotationStateSnapshotItem[] {
  const state = guardianUiState(context);
  const at = guardianSnapshotAt(context);
  const remaining = Number(state.symbolicAvengerUntil || 0) - at;
  const stacks = Math.max(0, Math.min(5, Math.trunc(Number(state.symbolicAvengerStacks || 0))));
  return remaining > 0 && stacks > 0
    ? [
        {
          id: 'guardian-symbolic-avenger',
          label: 'Symbolic Avenger',
          value: `${stacks}/5 · ${formatSecondsRemaining(remaining)}`,
          title: 'Active Symbolic Avenger stacks and time remaining'
        }
      ]
    : [];
}

// Resolve named Guardian mechanic skills to their currently active flip faces for
// stable skill-bar and palette projection.
export function guardianUiSkillIdsByName(names: readonly string[], context: GuardianUiContext = {}): SkillId[] {
  const activeFlips =
    (flattenProfessionState(context.state?.profession || context.professionState).availableFlips as Record<
      string,
      number
    >) || {};
  return names.flatMap((name) => {
    const id = guardianCatalog.skillsByName.get(name)?.id;
    if (id == null) return [];
    const skill = guardianCatalog.skillsById.get(id);
    const flipId = skill?.flipSkillId;
    const flip = flipId == null ? undefined : guardianCatalog.skillsById.get(flipId);
    return flipId != null && flip?.flipParentId === id && Number(activeFlips[flipId] || 0) > 0 ? [id, flipId] : [id];
  });
}

export function guardianUiSkillsByMode(property: keyof GuardianSkill, value: unknown = true): SkillId[] {
  // Keep each root before its same-slot flip so the inactive UI defaults to the root face.
  return guardianCatalog.skills
    .filter((skill) => skill[property] === value)
    .sort((left, right) => {
      const slotOrder = String(left.slot).localeCompare(String(right.slot));
      if (slotOrder) return slotOrder;
      if (left.flipParentId === right.id) return 1;
      if (right.flipParentId === left.id) return -1;
      return left.name.localeCompare(right.name);
    })
    .map((skill) => skill.id);
}

// Render Guardian-specific virtue and state events while delegating ordinary
// combat events to the shared log formatter.
export function guardianEventLogRow(
  _context: SchedulerRecord,
  event: GuardianResolverEvent
): ProfessionEventLogDescriptor | null | undefined {
  if (event.type === 'guardian.righteous-instincts-tick' || event.type === 'guardian.symbol-of-ignition-field') {
    return null;
  }

  const base = {
    type: event.type,
    className: 'resource',
    order: 30,
    flags: []
  };
  if (event.type === 'guardian.virtue-activated') {
    return {
      ...base,
      description: `VIRTUE ACTIVATED ${event.skillName || event.virtue || 'Unknown'}`
    };
  }

  if (event.type === 'guardian.virtues-refreshed') {
    return { ...base, description: 'VIRTUES REFRESHED' };
  }

  return undefined;
}

function guardianPaletteWeaponSkills(context: GuardianUiContext, skills: readonly GuardianSkill[]): GuardianSkill[] {
  const glacialHeart = hasTrait(context, GUARDIAN_TRAIT_IDS.GLACIAL_HEART);
  // Glacial Heart replaces Hammer 2 for the entire build, so only its selected
  // identity should reach the shared weapon palette.
  return skills.filter((skill) => {
    if (skill.id === GUARDIAN_SKILL_IDS.MIGHTY_BLOW) return !glacialHeart;
    if (skill.id === GUARDIAN_SKILL_IDS.GLACIAL_BLOW) return glacialHeart;
    return true;
  });
}

const CORE_VIRTUE_NAMES = Object.freeze(['Virtue of Justice', 'Virtue of Resolve', 'Virtue of Courage']);

export const guardianCoreUi: Partial<ProfessionUiContract> & SchedulerRecord = Object.freeze({
  assumptionControls: SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS,
  eventLogRow: guardianEventLogRow,
  rotationStateSnapshot: guardianCoreStateSnapshot,
  paletteWeaponSkills: guardianPaletteWeaponSkills,
  skillBarGroups: (context: GuardianUiContext) =>
    guardianUiSpecialization(context) === 'Core'
      ? [
          {
            id: 'guardian-f-keys',
            label: 'F Keys',
            skillIds: guardianUiSkillIdsByName(CORE_VIRTUE_NAMES, context),
            color: '#2f7eb8'
          }
        ]
      : [],
  paletteGroups: (context: GuardianUiContext) =>
    guardianUiSpecialization(context) === 'Core'
      ? [
          {
            id: 'profession',
            label: 'F',
            skillIds: guardianUiSkillIdsByName(CORE_VIRTUE_NAMES, context),
            color: '#2f7eb8',
            resourceAnchor: true
          }
        ]
      : []
});

export function bindGuardianCoreUi(catalog: Readonly<CanonicalCatalog>): typeof guardianCoreUi {
  guardianCatalog = catalog;
  return guardianCoreUi;
}
