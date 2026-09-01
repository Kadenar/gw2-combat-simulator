/** Applies Core Elementalist one-shot, weapon, and attunement recharge policy. */
import { balanceProfileValueFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { SchedulerRecord, Skill } from '#gw2/platform/engine/types.js';
import type { ElementalistSchedulerContext } from '#gw2/content/professions/elementalist/types.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/content/professions/elementalist/data/ids.js';
import { elementalistCoreAvailability } from '#gw2/content/professions/elementalist/core/mechanics/availability.js';
import { skillWeapon } from '#gw2/content/professions/elementalist/core/mechanics/effects.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/elementalist/core/profiles.js';

/**
 * Consume one-shot weapon recharge modifiers before applying persistent
 * attunement training and skill-specific recharge rules.
 *
 * Cast rule invoked for every recharge the scheduler is about to start; the
 * returned duration replaces the skill's catalog cooldown.
 */
export function modifyElementalistRechargeDuration(
  context: ElementalistSchedulerContext & { skill?: Skill },
  duration: number
): number {
  const skill = context.skill;
  if (!skill) return duration;
  // The summon owns this recharge: `elementals.ts` starts the glyph cooldown
  // when the elemental expires, so the cast itself must not start one.
  if (skill.id === ID.GLYPH_OF_ELEMENTALS) return 0;
  const state = professionCoreState(context);
  const at = Number((context as unknown as SchedulerRecord).start ?? context.state.time ?? 0);
  // Rock Barrier holds its recharge until the stored barrier is released; the
  // release handler re-requests the duration with that flag set.
  if (skill.id === ID.ROCK_BARRIER && !(context as unknown as SchedulerRecord).rockBarrierRelease) {
    return 0;
  }

  // Everything below is weapon-slot policy; other skill types keep their catalog recharge.
  if (skill.type !== 'Weapon') {
    return duration;
  }

  let adjustedDuration = duration;
  let weaponRechargeMultiplier = 1;
  // Armed spear and pistol empowerments are one-shot: they are cleared as they
  // are spent, so each applies to exactly one non-autoattack weapon skill.
  if (state.spearNextRechargeReduction && skillWeapon(skill) === 'Spear' && String(skill.slot || '') !== 'Weapon_1') {
    weaponRechargeMultiplier *= balanceProfileValueFromContext(
      context,
      PROFILE.spearEmpowerments,
      'rechargeMultiplier',
      0.67
    );
    state.spearNextRechargeReduction = false;
  }

  if (state.dazingDischargeUntil > at && skillWeapon(skill) === 'Pistol' && String(skill.slot || '') !== 'Weapon_1') {
    weaponRechargeMultiplier *= balanceProfileValueFromContext(
      context,
      PROFILE.dazingDischarge,
      'rechargeMultiplier',
      0.67
    );
    state.dazingDischargeUntil = 0;
  }

  adjustedDuration *= Math.max(0, weaponRechargeMultiplier);
  if (skill.id === ID.RIDE_THE_LIGHTNING) {
    adjustedDuration *= balanceProfileValueFromContext(context, PROFILE.rideTheLightning, 'rechargeMultiplier', 0.5);
  }

  // The four *mancer's Training traits shorten weapon recharges, each only for
  // skills belonging to its own attunement.
  const attunement = String(skill.attunement || '');
  if (
    (attunement === 'Fire' && hasTrait(context, "Pyromancer's Training")) ||
    (attunement === 'Air' && hasTrait(context, "Aeromancer's Training")) ||
    (attunement === 'Earth' && hasTrait(context, "Geomancer's Training")) ||
    (attunement === 'Water' && hasTrait(context, "Aquamancer's Training"))
  ) {
    const profileId =
      attunement === 'Fire'
        ? PROFILE.pyromancersTraining
        : attunement === 'Air'
          ? PROFILE.aeromancersTraining
          : attunement === 'Earth'
            ? PROFILE.geomancersTraining
            : PROFILE.aquamancersTraining;
    adjustedDuration *= balanceProfileValueFromContext(context, profileId, 'rechargeMultiplier', 0.8);
  }

  return adjustedDuration;
}

/** Cast-rule bundle the Core module registers: the shared availability gate plus this module's recharge policy. */
export const elementalistCoreCastRules = Object.freeze({
  availability: {
    id: 'elementalist.core-availability',
    order: 10,
    handler: elementalistCoreAvailability
  },
  modifyRechargeDuration: modifyElementalistRechargeDuration
});
