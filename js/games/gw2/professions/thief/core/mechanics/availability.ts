import { WEAPON } from '#gw2/platform/constants.js';
import { gw2ConfiguredWeaponSet } from '#gw2/platform/equipment/weapons/loadout.js';
import type { AvailabilityResult } from '#gw2/platform/execution/availability.js';
import { denySkillCast } from '#gw2/platform/execution/availability.js';
import { skillFlipReady, weaponFollowUpOpen } from '#gw2/platform/execution/skill-flips.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { thiefTrapAvailability } from '#gw2/professions/thief/core/mechanics/preparations.js';
import { thiefSpearAvailability } from '#gw2/professions/thief/core/mechanics/spear.js';
import { storedStolenSkillChoices } from '#gw2/professions/thief/core/mechanics/steal.js';
import {
  thiefBonusStealthAttack,
  thiefSameInstantStealthBreak,
  thiefStealthed
} from '#gw2/professions/thief/core/mechanics/stealth.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';

/** A closed follow-up reports the required opener before any later restriction. */
function closedFollowUpAvailability(
  runtime: MechanicQueriesOf<ThiefRuntime>,
  skill: ThiefSkill
): AvailabilityResult | null {
  const core = runtime.profession.core;
  const now = runtime.time;

  if (skill.type === 'Weapon' && skill.flipParentId != null && !skillFlipReady(core.availableFlips[skill.id], now)) {
    const parent = runtime.helpers.skillsById.get(Number(skill.flipParentId));
    return denySkillCast(
      skill,
      'thief.follow-up',
      parent?.dualWieldOpener ? 'use its opening dual-wield skill first.' : 'use its opening weapon skill first.'
    );
  }

  return null;
}

/** An open follow-up temporarily replaces its opening weapon skill. */
function activeFollowUpAvailability(
  runtime: MechanicQueriesOf<ThiefRuntime>,
  skill: ThiefSkill
): AvailabilityResult | null {
  const core = runtime.profession.core;
  const now = runtime.time;

  // A closed follow-up already answered above with its opener-specific reason.
  if (weaponFollowUpOpen(core.availableFlips, skill, now))
    return denySkillCast(skill, 'thief.follow-up-active', 'use or wait out the active follow-up skill.');

  return null;
}

/** Stealth replaces weapon slot one while retaining weapon and Shadow Shroud boundaries. */
function stealthAvailability(runtime: MechanicQueriesOf<ThiefRuntime>, skill: ThiefSkill): AvailabilityResult | null {
  const [mainHand] = gw2ConfiguredWeaponSet(runtime.config, runtime.activeWeaponSet === 2 ? 2 : 1);
  const stealthed = thiefStealthed(runtime);
  const bonusStealthAttack = thiefBonusStealthAttack(runtime);

  // Stealth replaces the equipped weapon's slot one, never the separate Shadow Shroud bar.
  if (skill.stealthAttack) {
    if (!stealthed && !bonusStealthAttack && !thiefSameInstantStealthBreak(runtime))
      return denySkillCast(skill, 'thief.not-stealthed', 'requires stealth.');

    if (skill.requiredMainHand && skill.requiredMainHand !== (mainHand || ''))
      return denySkillCast(skill, 'thief.stealth-weapon', `requires ${skill.requiredMainHand}.`);
  } else if (
    (stealthed || bonusStealthAttack) &&
    !skill.shadowShroudSkill &&
    skill.type === 'Weapon' &&
    skill.slot === 'Weapon_1'
  )
    return denySkillCast(skill, 'thief.stealth-replacement', "the active weapon's stealth attack replaces skill 1.");

  return null;
}

/** Kneel and Free Action select which rifle skills are currently usable. */
function rifleStanceAvailability(
  runtime: MechanicQueriesOf<ThiefRuntime>,
  skill: ThiefSkill
): AvailabilityResult | null {
  const core = runtime.profession.core;

  if (skill.id === ID.KNEEL && core.kneeling) return denySkillCast(skill, 'thief.kneeling', 'already kneeling.');

  if (skill.id === ID.FREE_ACTION && !core.kneeling) return denySkillCast(skill, 'thief.not-kneeling', 'kneel first.');

  if (
    skill.weapon === WEAPON.RIFLE &&
    skill.id !== ID.KNEEL &&
    skill.id !== ID.FREE_ACTION &&
    !skill.stealthAttack &&
    Boolean(skill.kneelSkill) !== core.kneeling
  )
    return denySkillCast(skill, 'thief.rifle-stance', core.kneeling ? 'use a kneeling rifle skill.' : 'kneel first.');

  return null;
}

/** A stolen skill requires an unconsumed use in the current inventory. */
function stolenSkillAvailability(
  runtime: MechanicQueriesOf<ThiefRuntime>,
  skill: ThiefSkill
): AvailabilityResult | null {
  const core = runtime.profession.core;

  if (
    skill.slot === 'Profession_2' &&
    (skill.categories || []).includes('stolen skill') &&
    !storedStolenSkillChoices(core).includes(skill.id)
  )
    return denySkillCast(skill, 'thief.stolen-skill', 'steal this skill before using it.');

  return null;
}

/** Keep the original gate order so the first restriction owns the reason and retry time. */
export function thiefAvailability(runtime: MechanicQueriesOf<ThiefRuntime>, skill: ThiefSkill): AvailabilityResult {
  return (
    closedFollowUpAvailability(runtime, skill) ??
    thiefSpearAvailability(runtime, skill) ??
    thiefTrapAvailability(runtime, skill) ??
    activeFollowUpAvailability(runtime, skill) ??
    stealthAvailability(runtime, skill) ??
    rifleStanceAvailability(runtime, skill) ??
    stolenSkillAvailability(runtime, skill) ?? { ready: true }
  );
}
