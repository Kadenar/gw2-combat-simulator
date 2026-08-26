import type { AvailabilityResult, Skill } from '../../../platform/engine/types.js';
import { denySkillCast as unavailable } from '../../lib/availability.js';
import type {
  ElementalistCastContext as ElementalistLifecycleContext,
  ElementalistPrecastContext as ElementalistCastContext
} from '../types.js';
import type { ElementalistRuntimeState } from '../types.js';
import { AUTOATTACK_CHAIN_PRESERVING_SKILL_IDS } from './constants.js';
import type { ElementalistAttunement, ElementalistCoreState } from './state.js';

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

// Enforce the expected autoattack-chain member while allowing in-flight progress
// and attunement carryover to expose the correct next skill.
export function autoattackChainAvailability(
  context: ElementalistCastContext,
  skill: Skill,
  state: ElementalistCoreState
): AvailabilityResult | null {
  const position = context.catalog.autoattackChainPositions.get(Number(skill.id));
  if (!position) return null;
  const expected = Number(state.autoattackChains[position.root]) || position.root;
  if (expected !== Number(skill.id)) {
    const expectedSkill = context.catalog.skillsById.get(expected);
    return unavailable(
      skill,
      'elementalist.autoattack-chain',
      `cast ${expectedSkill?.name || 'the earlier chain skill'} first.`
    );
  }

  const carryover = state.autoattackCarryover;
  return carryover?.root === position.root && carryover.attunement === skill.attunement ? ready() : null;
}

export function progressedAutoattackCarryover(
  context: ElementalistLifecycleContext,
  state: ElementalistCoreState,
  attunement: ElementalistAttunement
): ElementalistCoreState['autoattackCarryover'] {
  for (const [rawRoot, rawExpected] of Object.entries(state.autoattackChains)) {
    const root = Number(rawRoot);
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
    if (position && skill?.attunement === attunement) {
      return { root: position.root, attunement };
    }
  }

  return null;
}

export function updateAutoattackChainState(
  context: ElementalistLifecycleContext,
  skill: Skill,
  state: ElementalistCoreState
): void {
  if (context.effectiveEnd < context.fullEnd - context.epsilon) return;
  const position = context.catalog.autoattackChainPositions.get(Number(skill.id));
  if (position) {
    const pending = state.pendingAutoattackCarryover;
    const pendingMatches =
      pending?.root === position.root &&
      pending.attunement === skill.attunement &&
      pending.attunement !== state.primaryAttunement;
    if (pendingMatches) state.autoattackCarryover = pending;
    state.pendingAutoattackCarryover = null;

    const carryoverRoot = state.autoattackCarryover?.root;
    if (carryoverRoot != null && carryoverRoot !== position.root) {
      delete state.autoattackChains[carryoverRoot];
      state.autoattackCarryover = null;
    }

    for (const rawRoot of Object.keys(state.autoattackChains)) {
      const root = Number(rawRoot);
      if (root !== position.root) delete state.autoattackChains[root];
    }

    if (position.next == null) {
      delete state.autoattackChains[position.root];
      if (state.autoattackCarryover?.root === position.root) {
        state.autoattackCarryover = null;
      }
    } else {
      state.autoattackChains[position.root] = position.next;
    }

    return;
  }

  // Specialization skills declare chain-neutral behavior in their owning catalog fragments.
  const preservesChain =
    skill.preservesAutoattackChain === true || AUTOATTACK_CHAIN_PRESERVING_SKILL_IDS.has(Number(skill.id));
  if (Number(skill.castTimeMs || 0) > 0 && !preservesChain) {
    state.autoattackChains = {};
    state.autoattackCarryover = null;
    state.pendingAutoattackCarryover = null;
  }
}
