import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
/**
 * Weapon- and attunement-facing cast state for Core Elementalist.
 *
 * Slot-skill selection across attunement variants, weapon-skill attunement gating,
 * autoattack chain carryover across attunement swaps, and the Aerial Agility flip
 * window.
 */
import type { AvailabilityResult } from '#gw2/platform/execution/types.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import {
  resetAutoattackChains,
  type AutoattackChainTransition,
  type AutoattackChainTransitionResult
} from '#gw2/platform/skills/autoattack-chain-controller.js';
import { denySkillCast as unavailable } from '#gw2/platform/engine/skills/availability.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';
import type { ElementalistRuntimeState } from '#gw2/professions/elementalist/types.js';
import type { ElementalistAttunement, ElementalistCoreState } from '#gw2/professions/elementalist/core/state.js';

/** How long an advanced Aerial Agility stage stays offered before its chain resets. */
const AERIAL_AGILITY_FLIP_WINDOW_SECONDS = 5;

function ready(): AvailabilityResult {
  return { ready: true };
}

// Strips the trailing element suffix shared by the four faces of one
// attunement-variant slot skill.
function attunementVariantBaseName(name: string): string {
  return name.replace(/\s*\((?:Fire|Water|Air|Earth)\)$/, '');
}

/** Reports whether the equipped slot choices cover this skill, treating attunement variants as one slot. */
export function isSelectedSlotSkill(skill: Skill, selected: ReadonlySet<string>): boolean {
  if (selected.has(skill.name)) return true;
  if (!skill.attunement) return false;
  const baseName = attunementVariantBaseName(skill.name);
  return (
    baseName !== skill.name &&
    [...selected].some((selectedName) => attunementVariantBaseName(selectedName) === baseName)
  );
}

// Attunement variants are alternate faces of one utility slot, so copy both
// cooldown and ammo state to every variant after any one face is used.
export function shareAttunementVariantRecharge(context: ElementalistRuntime, _cast: RuntimeCast, skill: Skill): void {
  if (!['Heal', 'Utility', 'Elite'].includes(String(skill.type)) || !skill.attunement) {
    return;
  }

  const baseName = attunementVariantBaseName(skill.name);
  if (baseName === skill.name) return;
  const readyAt = context.cooldowns.get(skill.id);
  const ammo = context.ammo.get(skill.id);
  if (readyAt == null && !ammo) return;
  for (const candidate of context.helpers.skills) {
    if (candidate.type === skill.type && attunementVariantBaseName(candidate.name) === baseName) {
      if (readyAt != null) context.cooldownController.copy(skill.id, candidate.id);
      if (ammo) context.ammo.set(candidate.id, ammo);
    }
  }
}

/**
 * Gates weapon skills on the attuned element. Denials here are permanent for the
 * command — only a different attunement, never elapsed time, makes them usable.
 */
export function weaponAttunementAvailable(
  context: ElementalistRuntime,
  skill: Skill,
  state: ElementalistCoreState
): AvailabilityResult {
  // A carried root exposes its shared-controller-approved next step even after
  // the Elementalist has moved to a different attunement.
  const chain = context.helpers.autoattackChainPositions.get(Number(skill.id));
  if (
    chain &&
    state.autoattackCarryover?.root === chain.root &&
    state.autoattackCarryover.attunement === skill.attunement
  ) {
    return ready();
  }

  const attunement = String(skill.attunement || '');
  if (!attunement) return ready();
  const specialization = context.profession.specialization.state as Record<string, unknown>;
  // A specialization that owns a secondary attunement supplies its own weapon-hand availability policy.
  if (Object.hasOwn(specialization, 'secondaryAttunement')) return ready();
  const required = attunement.split('+');
  return required.length === 1 && required[0] === state.primaryAttunement
    ? ready()
    : unavailable(skill, 'elementalist.attunement', `requires ${attunement} attunement.`);
}

/** Reads the specialization-owned secondary attunement, or null when the active specialization has none. */
export function activeSecondaryAttunement(context: ElementalistRuntime): ElementalistAttunement | null {
  const specialization = (context.profession as ElementalistRuntimeState).specialization.state as Record<
    string,
    unknown
  >;
  const value = specialization.secondaryAttunement;
  return typeof value === 'string' ? (value as ElementalistAttunement) : null;
}

/** Captures the mid-chain autoattack of the attunement being left so its progress survives the swap. */
export function progressedAutoattackCarryover(
  context: ElementalistRuntime,
  _cast: RuntimeCast,
  state: ElementalistCoreState,
  attunement: ElementalistAttunement
): ElementalistCoreState['autoattackCarryover'] {
  for (const [rawRoot, rawExpected] of Object.entries(state.autoattackChains)) {
    const root = Number(rawRoot);
    // Aerial Agility is a slot-three flip and must not inherit slot-one
    // autoattack carryover into a different attunement.
    if (root === ID.AERIAL_AGILITY) continue;
    if (Number(rawExpected) === root) continue;
    const rootSkill = context.helpers.skillsById.get(root);
    if (rootSkill?.attunement === attunement) {
      return { root, attunement };
    }
  }

  return null;
}

/** Captures an autoattack still casting through the swap; it only becomes carryover once that cast commits. */
export function inFlightAutoattackCarryover(
  context: ElementalistRuntime,
  _cast: RuntimeCast,
  attunement: ElementalistAttunement
): ElementalistCoreState['pendingAutoattackCarryover'] {
  for (const skillId of context.inFlight.keys()) {
    const position = context.helpers.autoattackChainPositions.get(Number(skillId));
    const skill = context.helpers.skillsById.get(Number(skillId));
    if (position && position.root !== ID.AERIAL_AGILITY && skill?.attunement === attunement) {
      return { root: position.root, attunement };
    }
  }

  return null;
}

// Aerial Agility's flip must leave no carryover behind when its window lapses.
function clearAerialAgilityCarryover(state: ElementalistCoreState): void {
  if (state.autoattackCarryover?.root === ID.AERIAL_AGILITY) state.autoattackCarryover = null;
  if (state.pendingAutoattackCarryover?.root === ID.AERIAL_AGILITY) state.pendingAutoattackCarryover = null;
}

/** Every new stage replaces the old deadline; expiry checks the selected stage. */
export const elementalistWeaponStateTasks = {
  'elementalist.aerial-agility-expire'(context: ElementalistRuntime, data: unknown): void {
    const state = professionCoreState(context);
    if (Number(state.autoattackChains[ID.AERIAL_AGILITY]) !== Number(data)) return;
    resetAutoattackChains(context, [ID.AERIAL_AGILITY]);
    clearAerialAgilityCarryover(state);
  }
};
function updateAerialAgilityFlip(
  context: ElementalistRuntime,
  cast: RuntimeCast,
  change: AutoattackChainTransition
): void {
  context.cancelOwner({ id: 'elementalist.aerial-agility', generation: 0 });
  if (Number(cast.skill.id) === ID.AERIAL_AGILITY_CHAIN) {
    const root = context.helpers.skillsById.get(ID.AERIAL_AGILITY);
    if (root) context.cooldownController.startRecharge(root, context.time);
  }

  if (change.decision === 'advance' && change.nextSkillId != null)
    context.schedule(
      'elementalist.aerial-agility-expire',
      context.time + AERIAL_AGILITY_FLIP_WINDOW_SECONDS,
      change.nextSkillId,
      { id: 'elementalist.aerial-agility', generation: 0 }
    );
}

/** Keeps Elementalist's attunement carryover metadata synchronized with shared chain transition results. */
export function observeElementalistAutoattackTransition(
  context: ElementalistRuntime,
  cast: RuntimeCast,
  result: AutoattackChainTransitionResult
): void {
  const state = professionCoreState(context) as ElementalistCoreState;
  const chainRoot = result.castChainRootId;
  // An uncommitted cast never earns carryover, so drop the pending capture.
  if (!result.committed && chainRoot != null && state.pendingAutoattackCarryover?.root === chainRoot) {
    state.pendingAutoattackCarryover = null;
  }

  // Aerial Agility rearms its own flip timeout on every advance or completion.
  const chainChange = result.transitions.find((change) => change.chainRootId === chainRoot);
  if (
    chainRoot === ID.AERIAL_AGILITY &&
    chainChange &&
    (chainChange.decision === 'advance' || chainChange.decision === 'complete')
  ) {
    updateAerialAgilityFlip(context, cast, chainChange);
  }

  // Promote a pending capture only while its chain belongs to a now-inactive
  // attunement, and drop carryover once the chain completes or moves to another root.
  if (chainRoot != null && chainChange && (chainChange.decision === 'advance' || chainChange.decision === 'complete')) {
    const position = context.helpers.autoattackChainPositions.get(Number(cast.skill.id));
    const pending = state.pendingAutoattackCarryover;
    const pendingMatches =
      pending?.root === chainRoot &&
      pending.attunement === cast.skill.attunement &&
      pending.attunement !== state.primaryAttunement;
    if (pendingMatches) state.autoattackCarryover = pending;
    state.pendingAutoattackCarryover = null;
    if (chainChange.decision === 'complete' && state.autoattackCarryover?.root === chainRoot) {
      state.autoattackCarryover = null;
    } else if (position && state.autoattackCarryover?.root !== position.root) {
      state.autoattackCarryover = null;
    }
  }

  // Any chain the shared controller reset invalidates carryover recorded for it.
  const resetRoots = new Set(
    result.transitions.filter((change) => change.decision === 'reset').map((change) => Number(change.chainRootId))
  );
  if (state.autoattackCarryover && resetRoots.has(state.autoattackCarryover.root)) state.autoattackCarryover = null;
  if (state.pendingAutoattackCarryover && resetRoots.has(state.pendingAutoattackCarryover.root)) {
    state.pendingAutoattackCarryover = null;
  }
}
