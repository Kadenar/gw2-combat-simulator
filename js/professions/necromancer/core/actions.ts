import { professionCoreState } from '../../../platform/engine/profession.js';
/**
 * Core (profession-agnostic) necromancer skill handlers.
 *
 * Covers mechanics that aren't tied to an elite specialization: weapon swap
 * and flip-skill arming/expiry (`availableFlips`). Exposed as the
 * `necromancerCoreSkillHandlers` map.
 */
import { NECROMANCER_SKILL_IDS as ID } from '../data/ids.js';
import { emitState } from './shared.js';
import type { NecromancerCastContext, NecromancerSkill } from '../types.js';

function swapWeapons(context: NecromancerCastContext, skill: NecromancerSkill): boolean {
  const weaponSet = context.state.activeWeaponSet === 1 ? 2 : 1;
  context.state.activeWeaponSet = weaponSet;
  professionCoreState(context).autoattackChains = {};
  context.emit({
    type: 'weapon_set',
    at: context.effectiveEnd,
    source: 'necromancer',
    sourceId: skill.id,
    actorType: 'player',
    skillId: skill.id,
    skillName: skill.name,
    weaponSet
  });
  return true;
}

function flip(context: NecromancerCastContext, skill: NecromancerSkill): boolean {
  const state = professionCoreState(context);
  if (skill.flipSkillId != null) {
    const duration =
      (
        {
          [ID.DARK_PATH]: 3,
          [ID.INFUSING_TERROR]: 6,
          [ID.RIPPLE_OF_HORROR]: 12
        } as Readonly<Record<string | number, number>>
      )[skill.id] || 5;
    state.availableFlips[skill.flipSkillId] = context.effectiveEnd + duration;
  }

  if (skill.flipParentId != null) {
    delete state.availableFlips[skill.id];
  }

  emitState(context, context.effectiveEnd, 'flip');
  return false;
}

export const necromancerCoreSkillHandlers = Object.freeze({
  'necromancer.weapon-swap': swapWeapons,
  'necromancer.flip': flip
});
