import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import {
  evokerChargeProfile,
  initializeSpecializedElements
} from '#gw2/professions/elementalist/specializations/evoker/traits/attunements.js';
import { EPSILON } from '#kernel/core/clock.js';
/**
 * The Evoker familiar-charge economy.
 *
 * Owns charge capacity setup, how much each weapon skill contributes, the
 * deferral queue that protects grants from a charge-resetting familiar cast, and
 * the resource events the charge dial renders. Spending charges belongs to the
 * familiar handlers; this module only accrues and reports them.
 */
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type { ElementalistRuntime, ElementalistSkill } from '#gw2/professions/elementalist/types.js';
// Use Core's bundle names so conjure availability and familiar-charge exclusions agree.
import { CONJURED_WEAPONS } from '#gw2/professions/elementalist/core/constants.js';
import {
  EVOKER_NO_CHARGE_SKILLS,
  EVOKER_NO_CHARGE_SPEAR_SKILLS
} from '#gw2/professions/elementalist/specializations/evoker/mechanics/constants.js';
import { EVOKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/evoker/profiles.js';
import { evokerState, type EvokerState } from '#gw2/professions/elementalist/specializations/evoker/state.js';

/**
 * Seeds charge capacity from the active balance profile before the first cast,
 * and pins the Core attunement to the selected element when Specialized Elements
 * has disabled attunement swapping.
 */
export function initialize(context: ElementalistRuntime): void {
  const state = evokerState.from(context);
  state.maximumCharges = balanceProfileNumber(evokerChargeProfile(context), 'maximumStacks');
  state.charges = Math.max(
    0,
    Math.min(state.maximumCharges, context.config.initialEvokerCharges ?? state.maximumCharges)
  );
  const resourcesProfile = requireBalanceProfileFromContext(context, PROFILE.resources);
  state.empowered = Math.max(
    0,
    Math.min(balanceProfileNumber(resourcesProfile, 'minimumStacks'), context.config.initialEvokerEmpowered ?? 0)
  );
  initializeSpecializedElements(context);
}

/** Publishes the current charge and empowered totals as an absolute reading at the cast's end. */
export function emitResource(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: Skill,
  state: EvokerState
): void {
  context.effects.emit({
    kind: 'packet',
    event: {
      type: 'resource',
      at: cast.effectiveEnd,
      source: skill.name,
      sourceId: skill.id,
      actorType: 'player',
      skillName: skill.name,
      kind: 'evoker-charges',
      value: state.charges,
      maximum: state.maximumCharges,
      empowered: state.empowered
    }
  });
}

/**
 * Charges a single weapon skill is worth: zero for anything outside weapon slots
 * 2-5, conjures, exempt skills, and lesser or completed spear etchings;
 * otherwise the matching-element amount when the skill shares the selected
 * element, and the smaller off-element amount when it does not.
 */
export function weaponSkillChargeGain(context: unknown, skill: Skill, state: Pick<EvokerState, 'element'>): number {
  const slot = /^Weapon_(\d)$/.exec(String(skill.slot || ''));
  if (
    skill.type !== 'Weapon' ||
    !slot ||
    Number(slot[1]) < 2 ||
    Number(slot[1]) > 5 ||
    CONJURED_WEAPONS.has(skill.skillWeapon || skill.weapon || '') ||
    EVOKER_NO_CHARGE_SKILLS.has(skill.id) ||
    (skill.weapon === 'Spear' && EVOKER_NO_CHARGE_SPEAR_SKILLS.has(skill.id))
  ) {
    return 0;
  }

  // Split-attunement skills gain the matching-element amount; Specialized
  // Elements raises that amount from two charges to three.
  return String(skill.attunement || '')
    .split('+')
    .includes(state.element)
    ? balanceProfileNumber(evokerChargeProfile(context), 'playerStacks')
    : balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.resources), 'allyStacks');
}

// Commit at the live flush time, clamped to capacity, so deferred grants follow the familiar's reset.
function applyWeaponSkillChargeGain(
  context: ElementalistRuntime,
  state: EvokerState,
  chargeGain: EvokerState['pendingWeaponChargeGains'][number]
): void {
  const before = state.charges;
  state.charges = Math.min(state.maximumCharges, state.charges + chargeGain.gain);
  if (state.charges === before) return;
  context.effects.emit({
    kind: 'packet',
    event: {
      type: 'resource',
      activationId: chargeGain.activationId,
      at: context.time,
      source: chargeGain.source,
      sourceId: chargeGain.sourceId,
      actorType: 'player',
      skillName: chargeGain.source,
      kind: 'evoker-charges',
      value: state.charges,
      maximum: state.maximumCharges,
      empowered: state.empowered,
      change: state.charges - before
    }
  });
}

/**
 * Awards a completing weapon skill's charges, queueing the grant instead when a
 * charge-resetting basic familiar is still casting so the charges land after the
 * reset rather than being wiped by it.
 */
export function grantWeaponSkillCharges(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: Skill,
  state: EvokerState
): void {
  const gain = weaponSkillChargeGain(context, skill, state);
  if (gain <= 0) return;
  const chargeGain = {
    activationId: cast.id,
    source: skill.name,
    sourceId: skill.id,
    gain
  };
  // defer if a charge-resetting basic familiar is still casting — granting before the reset would lose the charges
  // reservationId check excludes the familiar itself from deferring its own grant
  if (
    state.activeFamiliarCast &&
    state.activeFamiliarCast.resetsCharges &&
    cast.id !== state.activeFamiliarCast.reservationId &&
    cast.effectiveEnd <= state.activeFamiliarCast.endsAt + EPSILON
  ) {
    state.pendingWeaponChargeGains.push(chargeGain);
    return;
  }

  applyWeaponSkillChargeGain(context, state, chargeGain);
}

/** Replays every deferred grant once the familiar cast that blocked them has settled. */
export function flushPendingWeaponChargeGains(context: ElementalistRuntime, state: EvokerState): void {
  for (const chargeGain of state.pendingWeaponChargeGains) {
    applyWeaponSkillChargeGain(context, state, chargeGain);
  }

  state.pendingWeaponChargeGains = [];
}
