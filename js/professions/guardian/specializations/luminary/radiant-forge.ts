import { emitSkillBuff, emitSkillCondition } from '../../../../platform/gw2/scheduler/skill-events.js';
import { luminaryState } from './state.js';
import { professionCoreState } from '../../../../platform/engine/profession/state.js';
import { resetAutoattackChains } from '../../../../platform/gw2/skills/autoattack-chains.js';
/**
 * @fileoverview Implements Luminary Radiant Forge cast validation, mode
 * transitions, radiant-weapon effects, forge expiry, and resolver state
 * replay.
 */

import { GUARDIAN_SKILL_IDS } from '../../data/ids.js';
import { selectedGuardianSpecialization } from '../../core/availability.js';
import { handleRadiantWeaponEquipped } from './traits.js';
import { buildGuardianStrike, emitGuardianEvent } from '../../core/events.js';
import { guardianBalanceProfile, guardianBalanceProfileEffect } from '../../core/profiles.js';
import { LUMINARY_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';
import { CAST_READY, denyCast } from '../../../../platform/engine/skills/availability.js';
import type { AvailabilityResult } from '../../../../platform/engine/types.js';
import type {
  GuardianCastContext,
  GuardianEventContext,
  GuardianEventExtra,
  GuardianPrecastContext,
  GuardianResolverContext,
  GuardianResolverEvent,
  GuardianSchedulerContext,
  GuardianSkill
} from '../../types.js';

/**
 * Emits the sigil-swap trigger caused by equipping a radiant weapon.
 *
 * @param {GuardianEventContext} context Scheduler callback context.
 * @param {GuardianSkill} skill Radiant weapon skill being equipped.
 * @param {GuardianEventExtra} [event] Additional event fields.
 * @returns {void}
 */
function emitForgeWeaponSwap(
  context: GuardianEventContext,
  skill: GuardianSkill,
  event: GuardianEventExtra = {}
): void {
  // sigil_swap (not weapon_set) so the sigil proc engine triggers on-swap
  // sigil procs for the radiant weapon equip without changing the active
  // weapon bar. mechanicSwap prevents the sigil engine from treating this as
  // a genuine player-initiated weapon swap for ICD purposes.
  emitGuardianEvent(context, skill, 'sigil_swap', {
    weaponSet: context.state.activeWeaponSet,
    mechanicSwap: true,
    ...event
  });
}

/**
 * Emits a weapon-bar transition for entering or leaving Radiant Forge.
 *
 * @param {GuardianEventContext} context Scheduler callback context.
 * @param {GuardianSkill} skill Forge transition skill.
 * @param {GuardianEventExtra} [event] Additional event fields.
 * @returns {void}
 */
function emitForgeTransition(
  context: GuardianEventContext,
  skill: GuardianSkill,
  event: GuardianEventExtra = {}
): void {
  emitGuardianEvent(context, skill, 'weapon_set', {
    weaponSet: context.state.activeWeaponSet,
    mechanicSwap: true,
    ...event
  });
}

/**
 * Determines whether a forge transition or forge-only skill is currently
 * castable. Unrelated skills return ready under the shared result contract.
 *
 * @param {GuardianPrecastContext} context Cast-validation context.
 * @param {GuardianSkill} skill Candidate skill.
 * @returns {AvailabilityResult} Whether the relevant forge skill is castable.
 */
export function radiantForgeAvailability(context: GuardianPrecastContext, skill: GuardianSkill): AvailabilityResult {
  const forgeActive = luminaryState.from(context).radiantForge;

  if (skill.type === 'Weapon' && luminaryState.from(context).radiantForge) {
    return denyCast(
      'guardian.radiant-forge-weapon-lockout',
      `${skill.name} is unavailable — exit Radiant Forge first.`
    );
  }

  if (skill.radiantForgeSkill) {
    return forgeActive
      ? CAST_READY
      : denyCast('guardian.radiant-forge-inactive', `${skill.name} is unavailable — requires Radiant Forge.`);
  }

  if (skill.name === 'Enter Radiant Forge') {
    if (selectedGuardianSpecialization(context) !== 'Luminary') {
      return denyCast(
        'guardian.luminary-specialization',
        `${skill.name} is unavailable — requires the Luminary specialization.`
      );
    }

    return forgeActive
      ? denyCast('guardian.radiant-forge-active', `${skill.name} is unavailable — Radiant Forge is already active.`)
      : CAST_READY;
  }

  if (skill.name === 'Exit Radiant Forge') {
    if (selectedGuardianSpecialization(context) !== 'Luminary') {
      return denyCast(
        'guardian.luminary-specialization',
        `${skill.name} is unavailable — requires the Luminary specialization.`
      );
    }

    return forgeActive
      ? CAST_READY
      : denyCast('guardian.radiant-forge-inactive', `${skill.name} is unavailable — requires Radiant Forge.`);
  }

  return CAST_READY;
}

/**
 * Enters or exits Radiant Forge and emits the corresponding state and
 * weapon-bar transition events.
 *
 * @param {GuardianCastContext} context Skill-handler context.
 * @param {GuardianSkill} skill Enter or Exit Radiant Forge.
 * @returns {boolean} Always true because this replacing handler owns the cast.
 */
function radiantForge(context: GuardianCastContext, skill: GuardianSkill): boolean {
  const entering = skill.name === 'Enter Radiant Forge';
  const state = luminaryState.from(context);

  if (!entering) {
    // Cooldown is finalized on manual exit; automatic expiry calls this
    // separately via advanceRadiantForgeState, so it must not be called twice.
    finalizeRadiantForgeCooldown(context, context.effectiveEnd);
  }

  state.radiantForge = entering;
  state.radiantForgeEndsAt = entering
    ? context.effectiveEnd +
      Number(guardianBalanceProfileEffect(guardianBalanceProfile(context, PROFILE.forge), 'buff')?.duration || 20)
    : 0;
  state.radiantForgeEnteredAt = entering ? context.effectiveEnd : 0;
  // Reset active weapon so traits don't carry stale weapon state across entries.
  state.radiantWeapon = '';
  // Autoattack chains must be wiped because the weapon bar changes entirely.
  resetAutoattackChains(context);

  if (entering) {
    state.radiantWeaponsUsed = {};
  }

  if (!entering) professionCoreState(context).availableFlips = {};
  emitGuardianEvent(context, skill, entering ? 'guardian.radiant-forge-entered' : 'guardian.radiant-forge-exited', {
    radiantForge: state.radiantForge,
    radiantForgeEndsAt: state.radiantForgeEndsAt,
    radiantForgeEnteredAt: state.radiantForgeEnteredAt,
    radiantWeapon: state.radiantWeapon
  });
  emitForgeTransition(context, skill);
  return true;
}

/**
 * Applies state changes and conditional virtue bonuses after a radiant weapon
 * finishes casting.
 *
 * @param {GuardianCastContext} context Skill-handler context.
 * @param {GuardianSkill} skill Radiant weapon or radiant weapon flip skill.
 * @returns {boolean} True for interrupted casts; otherwise false so declared
 * effects remain authoritative.
 */
function radiantWeapon(context: GuardianCastContext, skill: GuardianSkill): boolean {
  // Return true (interrupted) so the engine discards declared effects; the
  // handler owns all output and must suppress on interrupt.
  if (context.effectiveEnd < context.fullEnd - context.epsilon) return true;

  if (skill.radiantWeapon && skill.flipParentId == null) {
    luminaryState.from(context).radiantWeapon = skill.radiantWeapon;
    handleRadiantWeaponEquipped(context, skill);
    emitForgeWeaponSwap(context, skill);
  }

  if (skill.id === GUARDIAN_SKILL_IDS.DAZZLING_HAMMER && luminaryState.from(context).radiantJusticeArmed) {
    const profile = guardianBalanceProfile(context, PROFILE.radiantJusticeImpact);
    const strike = guardianBalanceProfileEffect(profile, 'strike');
    const vulnerability = guardianBalanceProfileEffect(profile, 'condition');
    const delay = Number(strike?.atMs || 750) / 1000;
    luminaryState.from(context).radiantJusticeArmed = false;
    context.emit(
      buildGuardianStrike({
        at: context.effectiveEnd + delay,
        sourceId: skill.id,
        skillId: skill.id,
        skillName: skill.name,
        name: 'Dazzling Hammer — Radiant Justice Impact',
        coefficient: Number(strike?.coefficient || 1.5)
      })
    );
    emitSkillCondition(context, {
      at: context.effectiveEnd + delay,
      source: 'guardian',
      sourceId: skill.id,
      actorType: 'effect',
      skillId: skill.id,
      skillName: skill.name,
      condition: 'Vulnerability',
      stacks: Number(vulnerability?.stacks || 8),
      duration: Number(vulnerability?.duration || 8)
    });
  }

  if (skill.id === GUARDIAN_SKILL_IDS.GLEAMING_BLADE && luminaryState.from(context).radiantCourageSwordArmed) {
    luminaryState.from(context).radiantCourageSwordArmed = false;
    emitSkillBuff(context, {
      at: context.effectiveEnd,
      source: 'guardian',
      sourceId: GUARDIAN_SKILL_IDS.RADIANT_COURAGE,
      actorType: 'player',
      skillId: GUARDIAN_SKILL_IDS.RADIANT_COURAGE,
      skillName: 'Radiant Courage',
      kind: 'guardian-radiant-courage-sword',
      stacks: 1,
      // Minimal duration: this buff is checked by the gleaming-blade modifier
      // rule at the exact cast end timestamp, so it only needs to exist for
      // that instant — a longer duration could incorrectly carry over to the
      // next cast.
      duration: 0.001
    });
  }

  if (skill.id === GUARDIAN_SKILL_IDS.RADIANT_BULWARK && luminaryState.from(context).radiantCourageShieldArmed) {
    luminaryState.from(context).radiantCourageShieldArmed = false;
  }

  return false;
}

/**
 * Emits Glaring Burst's weapon-dependent replacement strike.
 *
 * @param {GuardianCastContext} context Skill-handler context.
 * @param {GuardianSkill} skill Glaring Burst skill definition.
 * @returns {void}
 */
function glaringBurst(context: GuardianCastContext, skill: GuardianSkill): void {
  if (context.effectiveEnd < context.fullEnd - context.epsilon) return;
  const radiantWeapon = luminaryState.from(context).radiantWeapon;
  const profileId =
    radiantWeapon === 'hammer'
      ? PROFILE.glaringBurstHammer
      : radiantWeapon === 'blade'
        ? PROFILE.glaringBurstBlade
        : null;
  const coefficient = Number(
    guardianBalanceProfileEffect(profileId ? guardianBalanceProfile(context, profileId) : undefined, 'strike')
      ?.coefficient || 0
  );

  if (coefficient <= 0) return;
  context.emit(
    buildGuardianStrike({
      at: context.effectiveEnd,
      sourceId: skill.id,
      skillId: skill.id,
      skillName: skill.name,
      name: skill.name,
      coefficient,
      radiantWeapon
    })
  );
}

/**
 * Replaces Radiant Forge's provisional recharge with the final recharge based
 * on how many distinct radiant weapons were used during the entry.
 *
 * @param {GuardianSchedulerContext} context Scheduler context.
 * @param {number} at Simulation time when the forge ends.
 * @returns {void}
 */
function finalizeRadiantForgeCooldown(context: GuardianSchedulerContext, at: number): void {
  const state = luminaryState.from(context);
  const enter = context.catalog.skillsById.get(GUARDIAN_SKILL_IDS.ENTER_RADIANT_FORGE);

  if (!enter || !state.radiantForge) return;
  const used = Object.keys(state.radiantWeaponsUsed || {}).filter((weapon) =>
    ['hammer', 'staff', 'blade', 'bulwark'].includes(weapon)
  ).length;
  const forge = guardianBalanceProfile(context, PROFILE.forge);
  // Each unused weapon slot adds 5 s to the recharge (capped at 5 s minimum).
  const unused = Math.max(0, Number(forge?.maximumStacks || 4) - used);
  const baseRecharge = Math.max(0, Number(enter.cooldown ?? enter.recharge ?? 10));
  const adjustedBase = Math.max(
    Number(forge?.threshold || 5),
    baseRecharge - unused * Number(forge?.rechargeReduction || 5)
  );
  // Preserve the ratio of effective-to-base recharge so alacrity/recharge
  // traits still apply proportionally to the adjusted cooldown.
  const fullEffective = context.rechargeDurationFor(enter, at);
  const rechargeScale = baseRecharge > 0 ? fullEffective / baseRecharge : 1;
  context.state.cooldowns.set(enter.id, at + adjustedBase * rechargeScale);
}

/**
 * Raw Radiant Forge callbacks consumed by the central handler registry.
 */
export const guardianRadiantForgeSkillHandlers = Object.freeze({
  'guardian.radiant-forge': radiantForge,
  'guardian.radiant-weapon': radiantWeapon,
  'guardian.glaring-burst': glaringBurst
});

/**
 * Replays a scheduler forge transition into chronological resolver state.
 *
 * @param {GuardianResolverContext} context Resolver event-handler context.
 * @param {GuardianResolverEvent} event Forge-entered or forge-exited timeline
 * event.
 * @returns {void}
 */
function handleRadiantForgeTransition(context: GuardianResolverContext, event: GuardianResolverEvent): void {
  // One handler serves both entered and exited events; the event payload
  // carries the full post-transition snapshot so no conditional logic is needed.
  luminaryState.from(context).radiantForge = Boolean(event.radiantForge);
  luminaryState.from(context).radiantForgeEndsAt = Number(event.radiantForgeEndsAt || 0);
  luminaryState.from(context).radiantForgeEnteredAt = Number(event.radiantForgeEnteredAt || 0);
  luminaryState.from(context).radiantWeapon = String(event.radiantWeapon || '');

  if (!luminaryState.from(context).radiantForge) {
    // Clear flips so the resolver doesn't offer Exit Radiant Forge after expiry.
    professionCoreState(context).availableFlips = {};
  }
}

/**
 * Resolver handlers for Radiant Forge timeline events.
 */
export const guardianRadiantForgeEventHandlers = Object.freeze({
  'guardian.radiant-forge-entered': handleRadiantForgeTransition,
  'guardian.radiant-forge-exited': handleRadiantForgeTransition
});

/**
 * Expires Radiant Forge when scheduler time advances past its end, finalizes
 * its cooldown, and emits the automatic exit transition.
 *
 * @param {GuardianSchedulerContext} context Scheduler advancement context.
 * @param {number} target Target simulation time.
 * @returns {void}
 */
export function advanceRadiantForgeState(context: GuardianSchedulerContext, target: number): void {
  const state = luminaryState.from(context);

  if (state.radiantForge && state.radiantForgeEndsAt <= target + context.epsilon) {
    const expiredAt = state.radiantForgeEndsAt;
    finalizeRadiantForgeCooldown(context, expiredAt);
    const exit = context.catalog.skillsById.get(GUARDIAN_SKILL_IDS.EXIT_RADIANT_FORGE);

    if (exit) {
      emitGuardianEvent(context, exit, 'guardian.radiant-forge-exited', {
        at: expiredAt,
        automatic: true,
        radiantForge: false,
        radiantForgeEndsAt: 0,
        radiantForgeEnteredAt: 0,
        radiantWeapon: ''
      });
      emitForgeTransition(context, exit, {
        at: expiredAt,
        automatic: true
      });
    }

    state.radiantForge = false;
    state.radiantForgeEndsAt = 0;
    state.radiantForgeEnteredAt = 0;
    state.radiantWeapon = '';
    resetAutoattackChains(context);
    professionCoreState(context).availableFlips = {};
  }
}
