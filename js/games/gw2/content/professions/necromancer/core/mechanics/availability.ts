import { professionCoreState } from '../../../../../platform/engine/profession/state.js';
import { selectedSkillNameSet } from '../../../../../platform/builds/selected-skills.js';
import { actualNecromancerLifeForceCost, normalizedNecromancerLifeForceCost } from '../state.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import { hasTrait } from '../../../../../platform/combat/state/traits.js';
import { denySkillCast as deny } from '../../../lib/availability.js';
import type { AvailabilityResult, SkillId } from '../../../../../platform/engine/types.js';
import type { NecromancerPrecastContext, NecromancerCoreState, NecromancerSkill } from '../../types.js';

const LICH_SKILL_IDS: ReadonlySet<SkillId> = new Set([
  ID.DEATHLY_CLAWS,
  ID.LICHS_GAZE,
  ID.RIPPLE_OF_HORROR,
  ID.MARCH_OF_UNDEATH,
  ID.SUMMON_MADNESS,
  ID.GRIM_SPECTER,
  ID.EXIT_LICH_FORM
]);
interface AvailabilityEnvironment {
  readonly state: NecromancerCoreState;
  readonly activeShroud: string;
  readonly spec: string;
}

type AvailabilityVerdict = Readonly<AvailabilityResult> | null;

type CastStateGate = (
  context: NecromancerPrecastContext,
  skill: NecromancerSkill,
  environment: AvailabilityEnvironment
) => AvailabilityVerdict;

function specialization(context: NecromancerPrecastContext): string {
  return context.config?.specialization || 'Core';
}

export function requiredShroud(skill?: NecromancerSkill): string {
  return String(skill?.shroud || '');
}

const READY: Readonly<AvailabilityResult> = Object.freeze({ ready: true });

// The Devouring Darkness / Feast of Corruption swap terminates here so its
// out-of-shroud requirement never falls through to the baseline gate (which the
// original if-ladder skipped for this skill via an early return).
function devouringGate(
  context: NecromancerPrecastContext,
  skill: NecromancerSkill,
  { activeShroud }: AvailabilityEnvironment
): AvailabilityVerdict {
  if (skill.id !== ID.DEVOURING_DARKNESS) return null;
  if (!hasTrait(context, TRAIT.LINGERING_CURSE)) {
    return deny(skill, 'necromancer.trait-locked', 'requires Lingering Curse.');
  }

  return activeShroud ? deny(skill, 'necromancer.in-shroud', `cannot cast in ${activeShroud} shroud.`) : READY;
}

// Validate shroud ownership, current transform state, and minimum life force
// before an entry skill can begin.
function shroudEntryGate(
  _context: NecromancerPrecastContext,
  skill: NecromancerSkill,
  { state, activeShroud, spec }: AvailabilityEnvironment
): AvailabilityVerdict {
  if (!skill.shroudEntry) return null;
  if (activeShroud) {
    return deny(skill, 'necromancer.in-shroud', `already in ${activeShroud} shroud.`);
  }

  const expectedSpecialization = skill.specialization || 'Core';
  if (expectedSpecialization !== spec) {
    return deny(skill, 'necromancer.wrong-specialization', `not available for the ${spec} specialization.`);
  }

  const minimumPercent = Number(skill.minimumShroudLifeForcePercent ?? 10);
  const minimumLifeForce = Number(state.maximumLifeForce || 100) * (minimumPercent / 100);
  if (Number(state.lifeForce || 0) < minimumLifeForce) {
    return deny(skill, 'necromancer.insufficient-life-force', `requires ${minimumPercent} life force.`);
  }

  return READY;
}

function shroudExitGate(
  context: NecromancerPrecastContext,
  skill: NecromancerSkill,
  { state, activeShroud }: AvailabilityEnvironment
): AvailabilityVerdict {
  if (!skill.shroudExit) return null;
  const available = activeShroud === skill.shroudExit || Number(state.availableFlips[skill.id] || 0) > context.start;
  return available ? READY : deny(skill, 'necromancer.not-in-shroud', 'the matching shroud is not active.');
}

function lichFormGate(
  _context: NecromancerPrecastContext,
  skill: NecromancerSkill,
  { activeShroud }: AvailabilityEnvironment
): AvailabilityVerdict {
  if (skill.id !== ID.LICH_FORM) return null;
  return activeShroud ? deny(skill, 'necromancer.in-shroud', `cannot cast in ${activeShroud} shroud.`) : READY;
}

function lichSkillGate(
  _context: NecromancerPrecastContext,
  skill: NecromancerSkill,
  { activeShroud }: AvailabilityEnvironment
): AvailabilityVerdict {
  if (!LICH_SKILL_IDS.has(skill.id)) return null;
  return activeShroud === 'lich' ? READY : deny(skill, 'necromancer.requires-lich', 'requires Lich Form.');
}

function inShroudGate(
  context: NecromancerPrecastContext,
  skill: NecromancerSkill,
  { state, activeShroud }: AvailabilityEnvironment
): AvailabilityVerdict {
  const shroud = requiredShroud(skill);
  if (!shroud) return null;
  if (activeShroud !== shroud) {
    return deny(skill, 'necromancer.wrong-shroud', `requires ${shroud} shroud.`);
  }

  return READY;
}

function activeMinionGate(
  context: NecromancerPrecastContext,
  skill: NecromancerSkill,
  { state }: AvailabilityEnvironment
): AvailabilityVerdict {
  if (!skill.rechargeOnMinionDeath) return null;
  const commandAvailableUntil = Number(skill.flipSkillId == null ? 0 : state.availableFlips?.[skill.flipSkillId] || 0);
  return commandAvailableUntil > context.start
    ? deny(skill, 'necromancer.minion-active', 'its summoned minion is still alive.')
    : null;
}

// Reject unselected heal, utility, and elite skills while allowing profession
// mechanics and generated replacement skills through their own gates.
function selectedSlotSkillGate(context: NecromancerPrecastContext, skill: NecromancerSkill): AvailabilityVerdict {
  if (!['Heal', 'Utility', 'Elite'].includes(String(skill.type || '')) || skill.flipParentId != null) {
    return null;
  }

  const selected = selectedSkillNameSet(context.config?.selectedSkills);
  if (selected.size === 0 || selected.has(skill.name)) return null;
  return deny(skill, 'necromancer.slot-skill', 'the skill is not equipped.');
}

// Terminal gate for ordinary out-of-shroud skills. Always yields a verdict.
function baselineGate(
  context: NecromancerPrecastContext,
  skill: NecromancerSkill,
  { state, activeShroud }: AvailabilityEnvironment
): Readonly<AvailabilityResult> {
  if (skill.usableInShroud) return READY;
  if (activeShroud) {
    return deny(skill, 'necromancer.in-shroud', `cannot cast in ${activeShroud} shroud.`);
  }

  if (
    skill.lifeForceCost &&
    Number(state.lifeForce || 0) < normalizedNecromancerLifeForceCost(state, skill.lifeForceCost)
  ) {
    return deny(
      skill,
      'necromancer.insufficient-life-force',
      `requires ${Math.round(actualNecromancerLifeForceCost(skill.lifeForceCost))} life force.`
    );
  }

  // Cataloged autoattack links are armed by their chain position and retention window, not duplicate API flip state.
  const isAutoattackChainSkill = context.catalog.autoattackChainPositions.has(Number(skill.id));
  if (
    skill.flipParentId != null &&
    !isAutoattackChainSkill &&
    !(Number(state.availableFlips[skill.id] || 0) > context.start)
  ) {
    return deny(skill, 'necromancer.flip-not-armed', 'not currently armed.');
  }

  return READY;
}

// First-match dispatch: each gate returns a verdict for skills in its domain or
// null to defer. Order reproduces the original if-ladder exactly, so the first
// non-null verdict is authoritative.
const CAST_STATE_GATES: readonly CastStateGate[] = Object.freeze([
  devouringGate,
  shroudEntryGate,
  shroudExitGate,
  lichFormGate,
  lichSkillGate,
  inShroudGate,
  selectedSlotSkillGate,
  activeMinionGate,
  baselineGate
]);

/**
 * Permanent build gating: nothing here can become valid by advancing time, so
 * failures deny the current command without advertising a retry timestamp.
 */
export function necromancerBuildAvailability(
  context: NecromancerPrecastContext,
  skill: NecromancerSkill
): Readonly<AvailabilityResult> {
  if (!skill.implemented) {
    return deny(skill, 'necromancer.not-implemented', 'it is not implemented by the simulator.');
  }

  if (skill.simulatorExcluded) {
    return deny(skill, 'necromancer.simulator-excluded', 'it is excluded from simulation.');
  }

  if (skill.type !== 'Weapon' && skill.specialization && skill.specialization !== specialization(context)) {
    return deny(skill, 'necromancer.specialization', `requires the ${skill.specialization} specialization.`);
  }

  if (skill.id === ID.FEAST_OF_CORRUPTION && hasTrait(context, TRAIT.LINGERING_CURSE)) {
    return deny(
      skill,
      'necromancer.trait-replacement',
      'Devouring Darkness replaces it while Lingering Curse is selected.'
    );
  }

  return READY;
}

/**
 * Structured state/resource availability. Returns {ready:true} or a denial with
 * a specific reason and code, replacing the former monolithic boolean ladder.
 */
export function necromancerCastAvailability(
  context: NecromancerPrecastContext,
  skill: NecromancerSkill
): Readonly<AvailabilityResult> {
  const state = professionCoreState(context);
  const env = {
    state,
    activeShroud: String(state.activeShroud || ''),
    spec: specialization(context)
  };
  for (const gate of CAST_STATE_GATES) {
    const verdict = gate(context, skill, env);
    if (verdict != null) return verdict;
  }

  return READY;
}
