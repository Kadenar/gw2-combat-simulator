import { professionCoreState } from '../../../platform/engine/profession/state.js';
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
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '../data/ids.js';
import {
  NECROMANCER_CORE_BALANCE_PROFILE_IDS as PROFILE,
  balanceProfileEffect,
  necromancerBalanceProfile
} from './profiles.js';
import { advanceNecromancerState, leaveShroud } from './life-force.js';
import {
  addCarapace,
  emitBuff,
  emitCondition,
  emitDamage,
  emitState,
  gainNecromancerLifeForce,
  hasTrait
} from './shared.js';
import { runNecromancerShroudEnter } from './shroud-lifecycle.js';
import type { NecromancerCastContext, NecromancerSkill } from '../types.js';

// Snapshot current life-force-related state, arm the matching exit skill, and
// apply all entry traits before publishing the shroud weapon-set transition.
function activateShroud(context: NecromancerCastContext, skill: NecromancerSkill): boolean {
  const state = professionCoreState(context);
  const shroud = String(skill.shroudEntry || '');
  const at = context.effectiveEnd;
  const specialization = context.config.specialization || 'Core';
  const timedCarapace = (state.carapaceExpiries || []).filter((expiresAt: number) => expiresAt > at).length;
  const minionCarapace = hasTrait(context, TRAIT.FLESH_OF_THE_MASTER)
    ? Object.values(state.activeMinions || {}).reduce((total, count) => total + Number(count || 0) * 2, 0)
    : 0;
  if (hasTrait(context, TRAIT.SOUL_COMPREHENSION)) {
    gainNecromancerLifeForce(context, Math.min(30, timedCarapace + minionCarapace) * 0.5, at);
  }

  if (hasTrait(context, TRAIT.ARMORED_SHROUD)) {
    addCarapace(state, 5, at);
  }

  if (hasTrait(context, TRAIT.SHROUDED_REMOVAL)) {
    const activeCondition = (state.selfConditions || []).find(
      (application) => application.appliedAt <= at && application.expiresAt > at
    );
    if (activeCondition) {
      state.selfConditions = state.selfConditions.filter((application) => application !== activeCondition);
      addCarapace(state, 3, at);
    }
  }

  state.activeShroud = shroud;
  state.activeShroudEntryId = skill.id;
  state.activeShroudProfileId = String(skill.shroudProfileId || PROFILE.shroud);
  state.shroudEnteredAt = at;
  state.lastResourceAt = at;
  const exitSkill = [...context.catalog.skillsById.values()].find((candidate) => candidate.shroudExit === shroud);
  state.activeShroudExitId = exitSkill?.id ?? null;
  if (exitSkill) state.availableFlips[exitSkill.id] = Number.POSITIVE_INFINITY;
  state.pendingShroudEntryId = skill.id;
  state.plagueSendingArmed =
    hasTrait(context, TRAIT.PLAGUE_SENDING) &&
    (state.selfConditions || []).some((application) => application.appliedAt <= at && application.expiresAt > at);
  state.plagueSendingEntrySkillId = null;
  runNecromancerShroudEnter(context, skill, at);

  if (hasTrait(context, TRAIT.SOUL_BARBS)) {
    emitBuff(context, skill, 'necromancer-soul-barbs', 15);
  }

  if (hasTrait(context, TRAIT.AWAKEN_THE_PAIN)) {
    emitBuff(context, skill, 'might', 5, 5);
  }

  if (hasTrait(context, TRAIT.FURIOUS_DEMISE)) {
    emitBuff(context, skill, 'fury', 8);
  }

  if (hasTrait(context, TRAIT.SPEED_OF_SHADOWS)) {
    emitBuff(context, skill, 'swiftness', 10);
  }

  if (hasTrait(context, TRAIT.ETERNAL_LIFE)) {
    emitBuff(context, skill, 'protection', 3);
  }

  if (hasTrait(context, TRAIT.WEAKENING_SHROUD)) {
    emitDamage(context, skill, 1.5, {
      name: 'Weakening Shroud',
      source: 'Trait',
      sourceId: TRAIT.WEAKENING_SHROUD,
      actorType: 'effect',
      skillWeapon: 'Unequipped'
    });
    emitCondition(context, skill, 'Bleeding', 2, 10, {
      source: 'Trait',
      sourceId: TRAIT.WEAKENING_SHROUD,
      actorType: 'effect'
    });
    emitCondition(context, skill, 'Weakness', 1, 6, {
      source: 'Trait',
      sourceId: TRAIT.WEAKENING_SHROUD,
      actorType: 'effect'
    });
  }

  if (hasTrait(context, TRAIT.SPITEFUL_SPIRIT)) {
    const strike = balanceProfileEffect(necromancerBalanceProfile(context, PROFILE.spitefulSpirit), 'strike');
    emitDamage(context, skill, Number(strike?.coefficient || 0), {
      name: 'Spiteful Spirit',
      source: 'Trait',
      sourceId: TRAIT.SPITEFUL_SPIRIT,
      actorType: 'effect',
      skillWeapon: 'Unequipped'
    });
  }

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
  emitState(context, at, 'shroud-enter');
  return true;
}

function shroud(context: NecromancerCastContext, skill: NecromancerSkill): boolean {
  advanceNecromancerState(context, context.start);
  if (skill.shroudEntry) return activateShroud(context, skill);
  if (skill.shroudExit) {
    leaveShroud(context, context.effectiveEnd);
    return true;
  }

  return false;
}

function lich(context: NecromancerCastContext, skill: NecromancerSkill): boolean {
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  if (skill.id === ID.LICH_FORM) {
    state.activeShroud = 'lich';
    state.lichEndsAt = at + 20;
    state.lastResourceAt = at;
    state.availableFlips[ID.EXIT_LICH_FORM] = state.lichEndsAt;
    emitState(context, at, 'lich-enter');
  } else {
    state.activeShroud = '';
    state.lichEndsAt = 0;
    delete state.availableFlips[ID.EXIT_LICH_FORM];
    gainNecromancerLifeForce(context, 15, at);
    emitState(context, at, 'lich-exit');
  }

  return true;
}

export const necromancerShroudSkillHandlers = Object.freeze({
  'necromancer.shroud': shroud,
  'necromancer.lich': lich
});
