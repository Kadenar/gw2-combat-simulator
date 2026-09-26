import { type SkillFlipWindows, skillFlipReady } from '#gw2/platform/engine/skills/skill-flips.js';
import { flattenProfessionState } from '#gw2/platform/engine/profession/state.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS } from '#gw2/platform/simulation/randomness.js';
import { PERMANENT_COMBO_FIELD_ASSUMPTION_CONTROLS } from '#gw2/platform/combos/permanent-field-assumption.js';
import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS } from '#gw2/professions/guardian/data/ids.js';
import { activeSymbolicAvengerExpirations } from '#gw2/professions/guardian/core/state.js';
import type { CanonicalCatalog, SkillId } from '#gw2/platform/engine/skills/types.js';
import type {
  ProfessionEffectPresentation,
  RotationStateSnapshotItem
} from '#gw2/platform/profession-presentation/types.js';
import type {
  GuardianSkill,
  GuardianState,
  GuardianUiContext,
  GuardianUiSlice
} from '#gw2/professions/guardian/types.js';

function guardianUiSpecialization(context: GuardianUiContext = {}): string {
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
  const expirations = activeSymbolicAvengerExpirations(state, at);
  const remaining = Math.max(0, ...expirations) - at;
  const stacks = expirations.length;
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
export function guardianUiSkillIdsByName(
  catalog: Readonly<CanonicalCatalog>,
  names: readonly string[],
  context: GuardianUiContext = {}
): SkillId[] {
  const activeFlips =
    (flattenProfessionState(context.state?.profession || context.professionState).availableFlips as SkillFlipWindows) ||
    {};
  return names.flatMap((name) => {
    const id = catalog.skillsByName.get(name)?.id;
    if (id == null) return [];
    const skill = catalog.skillsById.get(id);
    const flipId = skill?.flipSkillId;
    const flip = flipId == null ? undefined : catalog.skillsById.get(flipId);
    // Direct UI callers may supply an older snapshot, so apply the same expiry gate as cast availability.
    return flipId != null &&
      flip?.flipParentId === id &&
      skillFlipReady(activeFlips[flipId], guardianSnapshotAt(context))
      ? [id, flipId]
      : [id];
  });
}

export function guardianUiSkillsByMode(
  catalog: Readonly<CanonicalCatalog>,
  property: keyof GuardianSkill,
  value: unknown = true
): SkillId[] {
  // Keep each root before its same-slot flip so the inactive UI defaults to the root face.
  return catalog.skills
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
const GUARDIAN_CORE_EFFECT_PRESENTATIONS: readonly ProfessionEffectPresentation[] = Object.freeze([
  {
    id: 'guardian-inspiring-virtue',
    kind: 'guardian-inspiring-virtue',
    name: 'Inspiring Virtue',
    maximumStacks: 1
  }
]);

/** Captures this UI's catalog so other profession instances cannot change its projections. */
export function bindGuardianCoreUi(catalog: Readonly<CanonicalCatalog>): GuardianUiSlice {
  return Object.freeze({
    assumptionControls: [...SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS, ...PERMANENT_COMBO_FIELD_ASSUMPTION_CONTROLS],
    // Inspiring Virtue is a binary Core effect shared by every Guardian specialization.
    effectPresentations: () => [...GUARDIAN_CORE_EFFECT_PRESENTATIONS],
    rotationStateSnapshot: guardianCoreStateSnapshot,
    paletteWeaponSkills: guardianPaletteWeaponSkills,
    paletteGroups: (context: GuardianUiContext) =>
      guardianUiSpecialization(context) === 'Core'
        ? [
            {
              id: 'profession',
              label: 'F',
              skillIds: guardianUiSkillIdsByName(catalog, CORE_VIRTUE_NAMES, context),
              color: '#2f7eb8',
              resourceAnchor: true
            }
          ]
        : []
  });
}
