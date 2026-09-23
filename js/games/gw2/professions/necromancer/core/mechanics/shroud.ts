import { armSkillFlip, consumeSkillFlip } from '#gw2/platform/engine/skills/skill-flips.js';
import { canonicalTime, isTimeInWindow } from '#kernel/core/clock.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { BalanceProfile, StatusEffect } from '#gw2/platform/engine/skills/types.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { emitSkillBuff, emitSkillCondition, emitSkillDamage } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { activeStackCount } from '#gw2/platform/combat/resources/timed-stacks.js';
import { emitNecromancerStateSnapshot } from '#gw2/professions/necromancer/family-state.js';
/**
 * Shroud entry/exit and Lich Form handlers.
 *
 * `activateShroud` enters death/reaper/harbinger/ritualist shroud: sets active
 * shroud state, arms the exit flip, and fires the on-enter trait payloads
 * (carapace/life-force gains, boons, Weakening Shroud, etc.). Exit is delegated
 * to `leaveShroud` in life-force.js. Lich Form is a separate timed transform.
 * The resource clock is advanced to `context.start` first so entry sees an
 * up-to-date life-force pool. Exports `necromancerShroudSkillHandlers`.
 */
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { NECROMANCER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/core/profiles.js';
import { advanceNecromancerState, leaveShroud } from '#gw2/professions/necromancer/core/mechanics/life-force.js';
import { addCarapace, gainNecromancerLifeForce } from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import { runNecromancerShroudEnter } from '#gw2/professions/necromancer/core/mechanics/shroud-lifecycle.js';
import { emitTransitionLockout } from '#gw2/platform/skills/transition-delays.js';
import type { NecromancerCastContext, NecromancerSkill } from '#gw2/professions/necromancer/types.js';

/** Emit one surviving entry boon with its authored identity; a removed boon emits nothing. */
function emitEntryBoon(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
  at: number,
  profile: BalanceProfile,
  boon: StatusEffect | undefined
): void {
  if (!boon) return;
  emitSkillBuff(context, skill, {
    at,
    kind: String(boon.boon),
    duration: effectNumber(profile, boon, 'duration'),
    stacks: effectNumber(profile, boon, 'stacks')
  });
}

// Snapshot current life-force-related state, arm the matching exit skill, and
// apply all entry traits before publishing the shroud weapon-set transition.
function activateShroud(context: NecromancerCastContext, skill: NecromancerSkill): boolean {
  const state = professionCoreState(context);
  const shroud = String(skill.shroudEntry || '');
  const at = context.effectiveEnd;
  const specialization = context.config.specialization || 'Core';
  const timedCarapace = activeStackCount(state.carapaceExpiries || [], at);
  const minionCarapace = hasTrait(context, TRAIT.FLESH_OF_THE_MASTER)
    ? Object.values(state.activeMinions || {}).reduce((total, count) => total + Number(count || 0) * 2, 0)
    : 0;
  // Resolve entry-time carapace and life-force traits against the pre-transform state.
  if (hasTrait(context, TRAIT.SOUL_COMPREHENSION)) {
    const profile = requireBalanceProfileFromContext(context, TRAIT.SOUL_COMPREHENSION);
    gainNecromancerLifeForce(
      context,
      Math.min(balanceProfileNumber(profile, 'maximumStacks'), timedCarapace + minionCarapace) *
        balanceProfileNumber(profile, 'lifeForcePerStack'),
      at
    );
  }

  if (hasTrait(context, TRAIT.ARMORED_SHROUD)) {
    const profile = requireBalanceProfileFromContext(context, TRAIT.ARMORED_SHROUD);
    addCarapace(state, balanceProfileNumber(profile, 'resourceGain'), at, balanceProfileNumber(profile, 'duration'));
  }

  if (hasTrait(context, TRAIT.SHROUDED_REMOVAL)) {
    // Remove only the patched number of active applications and reward each successful removal.
    const profile = requireBalanceProfileFromContext(context, TRAIT.SHROUDED_REMOVAL);
    const removed = state.selfConditions
      .filter((application) => isTimeInWindow(at, application.appliedAt, application.expiresAt))
      .slice(0, balanceProfileNumber(profile, 'maximumConditions'));
    if (removed.length) {
      state.selfConditions = state.selfConditions.filter((application) => !removed.includes(application));
      addCarapace(
        state,
        removed.length * balanceProfileNumber(profile, 'resourceGain'),
        at,
        balanceProfileNumber(profile, 'duration')
      );
    }
  }

  // Establish the transform, exit flip, and Plague Sending arm before lifecycle callbacks run.
  state.activeShroud = shroud;
  state.activeShroudEntryId = skill.id;
  state.activeShroudProfileId = String(skill.shroudProfileId || PROFILE.shroud);
  state.lastResourceAt = at;
  const exitSkill = [...context.catalog.skillsById.values()].find((candidate) => candidate.shroudExit === shroud);
  state.activeShroudExitId = exitSkill?.id ?? null;
  if (exitSkill) armSkillFlip(state.availableFlips, exitSkill.id, at);
  state.pendingShroudEntryId = skill.id;
  state.plagueSendingArmed =
    hasTrait(context, TRAIT.PLAGUE_SENDING) &&
    (state.selfConditions || []).some((application) =>
      isTimeInWindow(at, application.appliedAt, application.expiresAt)
    );
  state.plagueSendingEntrySkillId = null;
  runNecromancerShroudEnter(context, skill);
  emitTransitionLockout(context, 'shroudEntryMs', at, skill);

  // Emit shared on-entry boons and trait attacks after specialization lifecycle effects.
  if (hasTrait(context, TRAIT.SOUL_BARBS)) {
    emitSkillBuff(context, skill, {
      at,
      kind: 'necromancer-soul-barbs',
      duration: balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.SOUL_BARBS), 'duration'),
      stacks: 1
    });
  }

  for (const [trait, boon] of [
    [TRAIT.AWAKEN_THE_PAIN, 'might'],
    [TRAIT.FURIOUS_DEMISE, 'fury'],
    [TRAIT.SPEED_OF_SHADOWS, 'swiftness'],
    [TRAIT.ETERNAL_LIFE, 'protection']
  ] as const) {
    if (!hasTrait(context, trait)) continue;
    const profile = requireBalanceProfileFromContext(context, trait);
    emitEntryBoon(context, skill, at, profile, requireEffect(profile, 'boon', boon));
  }

  if (hasTrait(context, TRAIT.WEAKENING_SHROUD)) {
    const profile = requireBalanceProfileFromContext(context, TRAIT.WEAKENING_SHROUD);
    // The strike and both conditions are independent packets; removing one keeps the others.
    const strike = requireEffect(profile, 'strike', 'Strike');
    const bleeding = requireEffect(profile, 'condition', 'Bleeding');
    const weakness = requireEffect(profile, 'condition', 'Weakness');
    if (strike)
      emitSkillDamage(context, skill, {
        at,
        name: 'Weakening Shroud',
        source: 'Trait',
        sourceId: TRAIT.WEAKENING_SHROUD,
        actorType: 'effect',
        coefficient: effectNumber(profile, strike, 'coefficient'),
        skillWeapon: 'Unequipped'
      });
    for (const condition of [bleeding, weakness]) {
      if (!condition) continue;
      emitSkillCondition(context, {
        skill,
        at,
        source: 'Trait',
        sourceId: TRAIT.WEAKENING_SHROUD,
        actorType: 'effect',
        condition: String(condition.condition),
        stacks: effectNumber(profile, condition, 'stacks'),
        duration: effectNumber(profile, condition, 'duration')
      });
    }
  }

  if (hasTrait(context, TRAIT.SPITEFUL_SPIRIT)) {
    const profile = requireBalanceProfileFromContext(context, PROFILE.spitefulSpirit);
    const strike = requireEffect(profile, 'strike', 'Strike');
    if (strike)
      emitSkillDamage(context, skill, {
        at,
        name: 'Spiteful Spirit',
        source: 'Trait',
        sourceId: TRAIT.SPITEFUL_SPIRIT,
        actorType: 'effect',
        coefficient: effectNumber(profile, strike, 'coefficient'),
        skillWeapon: 'Unequipped'
      });
  }

  // Publish the visible weapon transition only after all entry state and trait effects are committed.
  context.emit({
    type: 'weapon_set',
    at,
    source: 'necromancer',
    sourceId: `necromancer.${shroud}-shroud-enter`,
    actorType: 'player',
    weaponSet: context.state.activeWeaponSet,
    shroudSwap: true,
    specialization
  });
  emitNecromancerStateSnapshot(context, at, 'shroud-enter', {
    dedupeAcrossSourceIds: true
  });
  return true;
}

// Route transform skills through entry or the shared life-force shroud exit path.
function shroud(context: NecromancerCastContext, skill: NecromancerSkill): boolean {
  advanceNecromancerState(context, context.start);
  if (skill.shroudEntry) return activateShroud(context, skill);
  if (skill.shroudExit) {
    leaveShroud(context, context.effectiveEnd);
    return true;
  }

  return false;
}

// Enter or leave the fixed-duration Lich transform without invoking life-force shroud lifecycle hooks.
function lich(context: NecromancerCastContext, skill: NecromancerSkill): boolean {
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  if (skill.id === ID.LICH_FORM) {
    state.activeShroud = 'lich';
    // Form lifetime is exact; resource advancement and the exit flip share this deadline.
    state.lichEndsAt = canonicalTime(at + 20);
    state.lastResourceAt = at;
    armSkillFlip(state.availableFlips, ID.EXIT_LICH_FORM, at, state.lichEndsAt);
    emitNecromancerStateSnapshot(context, at, 'lich-enter', {
      dedupeAcrossSourceIds: true
    });
  } else {
    state.activeShroud = '';
    state.lichEndsAt = 0;
    consumeSkillFlip(state.availableFlips, ID.EXIT_LICH_FORM);
    gainNecromancerLifeForce(context, 15, at);
    emitNecromancerStateSnapshot(context, at, 'lich-exit', {
      dedupeAcrossSourceIds: true
    });
  }

  return true;
}

/** Maps shroud and Lich transform handler keys to their cast implementations. */
export const necromancerShroudSkillHandlers = Object.freeze({
  'necromancer.shroud': shroud,
  'necromancer.lich': lich
});
