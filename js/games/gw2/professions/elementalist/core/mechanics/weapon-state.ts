/**
 * Weapon- and attunement-facing cast state for Core Elementalist.
 *
 * Slot-skill selection across attunement variants, weapon-skill attunement gating,
 * and autoattack chain carryover across attunement swaps.
 */
import type { AutoattackChainTransitionResult } from '#gw2/platform/execution/autoattack-chains.js';
import type { AvailabilityResult } from '#gw2/platform/execution/availability.js';
import { denySkillCast as unavailable } from '#gw2/platform/execution/availability.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { ReadonlyMechanicState } from '#gw2/platform/profession-definition/runtime-context.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { elementalistLoadoutIdentity } from '#gw2/professions/elementalist/core/mechanics/selection-policy.js';
import type { ElementalistAttunement, ElementalistCoreState } from '#gw2/professions/elementalist/core/state.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { elementalistAttunementPolicy } from '#gw2/professions/elementalist/family-state.js';
import type {
  ElementalistRuntime,
  ElementalistRuntimeState,
  ElementalistSkill
} from '#gw2/professions/elementalist/types.js';

/** Slot-three flips reuse chain sequencing but cannot earn slot-one attunement carryover. */
function isAttunementCarryoverChain(root: number): boolean {
  return root !== ID.AERIAL_AGILITY;
}

function ready(): AvailabilityResult {
  return { ready: true };
}

// Attunement variants are alternate faces of one utility slot, so copy both
// cooldown and ammo state to every variant after any one face is used.
export function shareAttunementVariantRecharge(context: ElementalistRuntime, skill: Skill): void {
  if (!['Heal', 'Utility', 'Elite'].includes(String(skill.type)) || !skill.attunement) {
    return;
  }

  const identity = elementalistLoadoutIdentity(skill.id);
  const readyAt = context.cooldownController.readyAt(skill.id);
  const ammo = context.cooldownController.readAmmo(skill.id);

  if (readyAt == null && !ammo) return;

  for (const candidate of context.helpers.skills) {
    if (candidate.type === skill.type && elementalistLoadoutIdentity(candidate.id) === identity) {
      if (readyAt != null) context.cooldownController.copy(skill.id, candidate.id);

      if (ammo) context.cooldownController.linkAmmo(skill.id, candidate.id);
    }
  }
}

/**
 * Gates weapon skills on the attuned element. Denials here are permanent for the
 * command — only a different attunement, never elapsed time, makes them usable.
 */
export function weaponAttunementAvailable(
  context: MechanicQueriesOf<ElementalistRuntime>,
  skill: Skill,
  state: ReadonlyMechanicState<ElementalistCoreState>
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

  // The selected Weaver owns weapon-hand eligibility, regardless of incidental state fields.
  if (elementalistAttunementPolicy(context).weaponGate === 'elite') return ready();

  const required = attunement.split('+');
  return required.length === 1 && required[0] === state.primaryAttunement
    ? ready()
    : unavailable(skill, 'elementalist.attunement', `requires ${attunement} attunement.`);
}

/** Captures the mid-chain autoattack of the attunement being left so its progress survives the swap. */
export function progressedAutoattackCarryover(
  context: ElementalistRuntime,
  state: ElementalistCoreState,
  attunement: ElementalistAttunement
): ElementalistCoreState['autoattackCarryover'] {
  for (const [rawRoot, rawExpected] of Object.entries(state.autoattackChains)) {
    const root = Number(rawRoot);

    if (!isAttunementCarryoverChain(root)) continue;

    if (rawExpected === root) continue;

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
  attunement: ElementalistAttunement
): ElementalistCoreState['pendingAutoattackCarryover'] {
  for (const skillId of context.castController.inFlightSkillIds()) {
    const position = context.helpers.autoattackChainPositions.get(Number(skillId));
    const skill = context.helpers.skillsById.get(Number(skillId));

    if (position && isAttunementCarryoverChain(position.root) && skill?.attunement === attunement) {
      return { root: position.root, attunement };
    }
  }

  return null;
}

/** Attunement carryover follows the shared controller's chain transitions. */
export const elementalistWeaponStateLifecycle = {
  onAutoattackChainTransition: observeElementalistAutoattackTransition
} satisfies RuntimeHooks<ElementalistRuntimeState, ElementalistSkill>;

/** Keeps Elementalist's attunement carryover metadata synchronized with shared chain transition results. */
function observeElementalistAutoattackTransition(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  result: AutoattackChainTransitionResult
): void {
  const state = professionCoreState(context);
  const chainRoot = result.castChainRootId;

  // An uncommitted cast never earns carryover, so drop the pending capture.
  if (!result.committed && chainRoot != null && state.pendingAutoattackCarryover?.root === chainRoot) {
    state.pendingAutoattackCarryover = null;
  }

  const chainChange = result.transitions.find((change) => change.chainRootId === chainRoot);

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
