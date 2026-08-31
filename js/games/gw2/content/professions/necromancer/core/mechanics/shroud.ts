import { balanceProfileEffect, balanceProfileFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { emitSkillBuff, emitSkillCondition, emitSkillDamage } from '#gw2/platform/scheduler/skill-events.js';
import { emitStateSnapshot } from '#gw2/platform/engine/events/state-snapshots.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { snapshotNecromancerState } from '#gw2/content/professions/necromancer/state.js';
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
import {
  NECROMANCER_SKILL_IDS as ID,
  NECROMANCER_TRAIT_IDS as TRAIT
} from '#gw2/content/professions/necromancer/data/ids.js';
import { NECROMANCER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/necromancer/core/profiles.js';
import {
  advanceNecromancerState,
  leaveShroud
} from '#gw2/content/professions/necromancer/core/mechanics/life-force.js';
import {
  addCarapace,
  gainNecromancerLifeForce
} from '#gw2/content/professions/necromancer/core/mechanics/state-helpers.js';
import { runNecromancerShroudEnter } from '#gw2/content/professions/necromancer/core/mechanics/shroud-lifecycle.js';
import type { NecromancerCastContext, NecromancerSkill } from '#gw2/content/professions/necromancer/types.js';

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
  // Resolve entry-time carapace and life-force traits against the pre-transform state.
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

  // Establish the transform, exit flip, and Plague Sending arm before lifecycle callbacks run.
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

  // Emit shared on-entry boons and trait attacks after specialization lifecycle effects.
  if (hasTrait(context, TRAIT.SOUL_BARBS)) {
    emitSkillBuff(context, skill, { at, kind: 'necromancer-soul-barbs', duration: 15, stacks: 1 });
  }

  if (hasTrait(context, TRAIT.AWAKEN_THE_PAIN)) {
    emitSkillBuff(context, skill, { at, kind: 'might', duration: 5, stacks: 5 });
  }

  if (hasTrait(context, TRAIT.FURIOUS_DEMISE)) {
    emitSkillBuff(context, skill, { at, kind: 'fury', duration: 8, stacks: 1 });
  }

  if (hasTrait(context, TRAIT.SPEED_OF_SHADOWS)) {
    emitSkillBuff(context, skill, { at, kind: 'swiftness', duration: 10, stacks: 1 });
  }

  if (hasTrait(context, TRAIT.ETERNAL_LIFE)) {
    emitSkillBuff(context, skill, { at, kind: 'protection', duration: 3, stacks: 1 });
  }

  if (hasTrait(context, TRAIT.WEAKENING_SHROUD)) {
    emitSkillDamage(context, skill, {
      at,
      name: 'Weakening Shroud',
      source: 'Trait',
      sourceId: TRAIT.WEAKENING_SHROUD,
      actorType: 'effect',
      coefficient: 1.5,
      skillWeapon: 'Unequipped'
    });
    emitSkillCondition(context, skill, {
      at,
      source: 'Trait',
      sourceId: TRAIT.WEAKENING_SHROUD,
      actorType: 'effect',
      condition: 'Bleeding',
      stacks: 2,
      duration: 10
    });
    emitSkillCondition(context, skill, {
      at,
      source: 'Trait',
      sourceId: TRAIT.WEAKENING_SHROUD,
      actorType: 'effect',
      condition: 'Weakness',
      stacks: 1,
      duration: 6
    });
  }

  if (hasTrait(context, TRAIT.SPITEFUL_SPIRIT)) {
    const strike = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.spitefulSpirit), 'strike');
    emitSkillDamage(context, skill, {
      at,
      name: 'Spiteful Spirit',
      source: 'Trait',
      sourceId: TRAIT.SPITEFUL_SPIRIT,
      actorType: 'effect',
      coefficient: Number(strike?.coefficient || 0),
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
  emitStateSnapshot(context, 'necromancer', at, 'shroud-enter', snapshotNecromancerState(context.state.profession), {
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
    state.lichEndsAt = at + 20;
    state.lastResourceAt = at;
    state.availableFlips[ID.EXIT_LICH_FORM] = state.lichEndsAt;
    emitStateSnapshot(context, 'necromancer', at, 'lich-enter', snapshotNecromancerState(context.state.profession), {
      dedupeAcrossSourceIds: true
    });
  } else {
    state.activeShroud = '';
    state.lichEndsAt = 0;
    delete state.availableFlips[ID.EXIT_LICH_FORM];
    gainNecromancerLifeForce(context, 15, at);
    emitStateSnapshot(context, 'necromancer', at, 'lich-exit', snapshotNecromancerState(context.state.profession), {
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
