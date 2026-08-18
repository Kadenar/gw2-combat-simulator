import type { AvailabilityResult, Skill } from '../../../platform/engine/types.js';
import type {
  ElementalistCastContext as ElementalistLifecycleContext,
  ElementalistPrecastContext as ElementalistCastContext
} from '../types.js';
import { AUTOATTACK_CHAIN_PRESERVING_SKILL_IDS } from './constants.js';
import type { ElementalistAttunement, ElementalistCoreState } from './state.js';

function ready(): AvailabilityResult {
  return { ready: true };
}

function unavailable(skill: Skill, code: string, reason: string, retryAt: number | null = null): AvailabilityResult {
  return {
    ready: false,
    retryAt,
    code,
    reason: `${skill.name} is unavailable — ${reason}`
  };
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
  if (state.secondaryAttunement !== null) return ready();
  const required = attunement.split('+');
  return required.length === 1 && required[0] === state.primaryAttunement
    ? ready()
    : unavailable(skill, 'elementalist.attunement', `requires ${attunement} attunement.`);
}

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
  if (Number(skill.castTimeMs || 0) > 0 && !AUTOATTACK_CHAIN_PRESERVING_SKILL_IDS.has(Number(skill.id))) {
    state.autoattackChains = {};
    state.autoattackCarryover = null;
    state.pendingAutoattackCarryover = null;
  }
}
