import type { AvailabilityResult, ScheduledTask, SchedulerRecord, Skill } from '../../../../platform/engine/types.js';
import { professionCoreState } from '../../../../platform/engine/profession/state.js';
import {
  resetAutoattackChains,
  type AutoattackChainTransition,
  type AutoattackChainTransitionContext
} from '../../../../platform/skills/autoattack-chains.js';
import { denySkillCast as unavailable } from '../../lib/availability.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '../data/ids.js';
import type {
  ElementalistCastContext as ElementalistLifecycleContext,
  ElementalistPrecastContext as ElementalistCastContext,
  ElementalistSchedulerContext
} from '../types.js';
import type { ElementalistRuntimeState } from '../types.js';
import type { ElementalistAttunement, ElementalistCoreState } from './state.js';

export const AERIAL_AGILITY_FLIP_WINDOW_SECONDS = 5;
const AERIAL_AGILITY_EXPIRY_OWNER = 'elementalist:aerial-agility-flip';
const AERIAL_AGILITY_EXPIRY_TASK = 'elementalist.aerial-agility-flip-expiry';

function ready(): AvailabilityResult {
  return { ready: true };
}

function attunementVariantBaseName(name: string): string {
  return name.replace(/\s*\((?:Fire|Water|Air|Earth)\)$/, '');
}

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
export function shareAttunementVariantRecharge(context: ElementalistLifecycleContext, skill: Skill): void {
  if (!['Heal', 'Utility', 'Elite'].includes(String(skill.type)) || !skill.attunement) {
    return;
  }

  const baseName = attunementVariantBaseName(skill.name);
  if (baseName === skill.name) return;
  const readyAt = context.state.cooldowns.get(skill.id);
  const ammo = context.state.ammo.get(skill.id);
  if (readyAt == null && !ammo) return;
  for (const candidate of context.catalog.skills) {
    if (candidate.type === skill.type && attunementVariantBaseName(candidate.name) === baseName) {
      if (readyAt != null) context.state.cooldowns.set(candidate.id, readyAt);
      if (ammo) context.state.ammo.set(candidate.id, ammo);
    }
  }
}

export function weaponAttunementAvailable(
  context: ElementalistCastContext,
  skill: Skill,
  state: ElementalistCoreState
): AvailabilityResult {
  // A carried root exposes its shared-controller-approved next step even after
  // the Elementalist has moved to a different attunement.
  const chain = context.catalog.autoattackChainPositions.get(Number(skill.id));
  if (
    chain &&
    state.autoattackCarryover?.root === chain.root &&
    state.autoattackCarryover.attunement === skill.attunement
  ) {
    return ready();
  }

  const attunement = String(skill.attunement || '');
  if (!attunement) return ready();
  const specialization = context.state.profession.specialization.state as Record<string, unknown>;
  // A specialization that owns a secondary attunement supplies its own weapon-hand availability policy.
  if (Object.hasOwn(specialization, 'secondaryAttunement')) return ready();
  const required = attunement.split('+');
  return required.length === 1 && required[0] === state.primaryAttunement
    ? ready()
    : unavailable(skill, 'elementalist.attunement', `requires ${attunement} attunement.`);
}

export function activeSecondaryAttunement(context: ElementalistCastContext): ElementalistAttunement | null {
  const specialization = (context.state.profession as ElementalistRuntimeState).specialization.state as Record<
    string,
    unknown
  >;
  const value = specialization.secondaryAttunement;
  return typeof value === 'string' ? (value as ElementalistAttunement) : null;
}

export function progressedAutoattackCarryover(
  context: ElementalistLifecycleContext,
  state: ElementalistCoreState,
  attunement: ElementalistAttunement
): ElementalistCoreState['autoattackCarryover'] {
  for (const [rawRoot, rawExpected] of Object.entries(state.autoattackChains)) {
    const root = Number(rawRoot);
    // Aerial Agility is a slot-three flip and must not inherit slot-one
    // autoattack carryover into a different attunement.
    if (root === ID.AERIAL_AGILITY) continue;
    if (Number(rawExpected) === root) continue;
    const rootSkill = context.catalog.skillsById.get(root);
    if (rootSkill?.attunement === attunement) {
      return { root, attunement };
    }
  }

  return null;
}

export function inFlightAutoattackCarryover(
  context: ElementalistLifecycleContext,
  attunement: ElementalistAttunement
): ElementalistCoreState['pendingAutoattackCarryover'] {
  for (const skillId of context.inFlight.keys()) {
    const position = context.catalog.autoattackChainPositions.get(Number(skillId));
    const skill = context.catalog.skillsById.get(Number(skillId));
    if (position && position.root !== ID.AERIAL_AGILITY && skill?.attunement === attunement) {
      return { root: position.root, attunement };
    }
  }

  return null;
}

function clearAerialAgilityCarryover(state: ElementalistCoreState): void {
  if (state.autoattackCarryover?.root === ID.AERIAL_AGILITY) state.autoattackCarryover = null;
  if (state.pendingAutoattackCarryover?.root === ID.AERIAL_AGILITY) state.pendingAutoattackCarryover = null;
}

/** Expires only the Aerial Agility stage that originally opened this five-second window. */
function expireAerialAgilityFlip(context: ElementalistSchedulerContext, task: ScheduledTask<SchedulerRecord>): void {
  const expectedSkillId = Number(task.payload?.expectedSkillId);
  const state = professionCoreState(context) as ElementalistCoreState;
  if (Number(state.autoattackChains[ID.AERIAL_AGILITY]) !== expectedSkillId) return;
  resetAutoattackChains(context, [ID.AERIAL_AGILITY]);
  clearAerialAgilityCarryover(state);
}

export const elementalistWeaponStateTaskHandlers = Object.freeze({
  [AERIAL_AGILITY_EXPIRY_TASK]: expireAerialAgilityFlip
});

/** Rearms the flip timeout after each stage and restarts the full root cooldown once its first follow-up is used. */
function updateAerialAgilityFlip(
  transition: AutoattackChainTransitionContext,
  change: AutoattackChainTransition
): void {
  const context = transition.cast as unknown as ElementalistLifecycleContext;
  context.tasks.cancelOwner(AERIAL_AGILITY_EXPIRY_OWNER);

  if (Number(transition.skill.id) === ID.AERIAL_AGILITY_CHAIN) {
    const root = context.catalog.skillsById.get(ID.AERIAL_AGILITY);
    if (root) {
      context.state.cooldowns.set(
        root.id,
        context.effectiveEnd + context.rechargeDurationFor(root, context.effectiveEnd)
      );
    }
  }

  if (change.decision !== 'advance' || change.nextSkillId == null) return;
  context.tasks.schedule({
    type: AERIAL_AGILITY_EXPIRY_TASK,
    at: context.effectiveEnd + AERIAL_AGILITY_FLIP_WINDOW_SECONDS,
    ownerId: AERIAL_AGILITY_EXPIRY_OWNER,
    payload: { expectedSkillId: change.nextSkillId }
  });
}

/** Keeps Elementalist's attunement carryover metadata synchronized with shared chain transition results. */
export function observeElementalistAutoattackTransition(transition: AutoattackChainTransitionContext): void {
  const context = transition.cast as unknown as ElementalistLifecycleContext;
  const state = professionCoreState(context) as ElementalistCoreState;
  const chainRoot = transition.result.castChainRootId;
  if (!transition.result.committed && chainRoot != null && state.pendingAutoattackCarryover?.root === chainRoot) {
    state.pendingAutoattackCarryover = null;
  }

  const chainChange = transition.result.transitions.find((change) => change.chainRootId === chainRoot);
  if (
    chainRoot === ID.AERIAL_AGILITY &&
    chainChange &&
    (chainChange.decision === 'advance' || chainChange.decision === 'complete')
  ) {
    updateAerialAgilityFlip(transition, chainChange);
  }

  if (chainRoot != null && chainChange && (chainChange.decision === 'advance' || chainChange.decision === 'complete')) {
    const position = context.catalog.autoattackChainPositions.get(Number(transition.skill.id));
    const pending = state.pendingAutoattackCarryover;
    const pendingMatches =
      pending?.root === chainRoot &&
      pending.attunement === transition.skill.attunement &&
      pending.attunement !== state.primaryAttunement;
    if (pendingMatches) state.autoattackCarryover = pending;
    state.pendingAutoattackCarryover = null;
    if (chainChange.decision === 'complete' && state.autoattackCarryover?.root === chainRoot) {
      state.autoattackCarryover = null;
    } else if (position && state.autoattackCarryover?.root !== position.root) {
      state.autoattackCarryover = null;
    }
  }

  const resetRoots = new Set(
    transition.result.transitions
      .filter((change) => change.decision === 'reset')
      .map((change) => Number(change.chainRootId))
  );
  if (state.autoattackCarryover && resetRoots.has(state.autoattackCarryover.root)) state.autoattackCarryover = null;
  if (state.pendingAutoattackCarryover && resetRoots.has(state.pendingAutoattackCarryover.root)) {
    state.pendingAutoattackCarryover = null;
  }
}
