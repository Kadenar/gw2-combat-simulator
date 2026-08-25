import { professionCoreState } from '../../../platform/engine/profession/state.js';
import type { Skill } from '../../../platform/engine/types.js';
import type { ElementalistCastContext as ElementalistLifecycleContext } from '../types.js';
import { PISTOL_NO_CONSUME, PISTOL_NO_GRANT, PISTOL_SKILL_ELEMENTS } from './constants.js';
import {
  applyElementalistAura,
  emitProfiledBuff,
  emitProfiledCondition,
  profiledEffect,
  skillWeapon
} from './mechanics.js';
import {
  ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE,
  elementalistBalanceValue,
  elementalistEffectValue
} from './profiles.js';

export function applyPistolState(context: ElementalistLifecycleContext, skill: Skill): void {
  if (skillWeapon(skill) !== 'Pistol') return;
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  const element = PISTOL_SKILL_ELEMENTS[Number(skill.id)];
  if (!element) return;
  if (state.pistolBullets[element] && !PISTOL_NO_CONSUME.has(Number(skill.id))) {
    state.pistolBullets[element] = false;
    if (skill.name === 'Raging Ricochet') {
      emitProfiledBuff(context, at, PROFILE.ragingRicochet, 'Fire', 'Might', 1, 10, skill.name, skill.id);
    } else if (skill.name === 'Searing Salvo') {
      const aura = profiledEffect(context, PROFILE.searingSalvo, 'buff', 'Fire');
      applyElementalistAura(context, {
        at,
        aura: String(aura?.kind || 'Fire Aura'),
        duration: Number(aura?.duration ?? 4),
        skillName: skill.name,
        sourceId: skill.id
      });
    } else if (skill.name === 'Frozen Fusillade') {
      const delay = elementalistBalanceValue(context, PROFILE.frozenFusillade, 'initialDelay', 4);
      context.emit({
        type: 'damage',
        at: at + delay,
        source: skill.name,
        sourceId: skill.id,
        actorType: 'player',
        skillName: skill.name,
        skillId: skill.id,
        coefficient: elementalistEffectValue(context, PROFILE.frozenFusillade, 'strike', 'coefficient', 0.75),
        skillWeapon: 'Pistol'
      });
      emitProfiledCondition(
        context,
        at + delay,
        PROFILE.frozenFusillade,
        'Water Bullet',
        'Bleeding',
        5,
        8,
        skill.name,
        skill.id
      );
    } else if (skill.name === 'Dazing Discharge') {
      state.dazingDischargeUntil =
        at + elementalistBalanceValue(context, PROFILE.dazingDischarge, 'durationMultiplier', 5);
    } else if (skill.name === 'Shattering Stone') {
      state.shatteringStoneHitsRemaining = elementalistBalanceValue(
        context,
        PROFILE.shatteringStone,
        'maximumStacks',
        3
      );
      state.shatteringStoneUntil =
        at + elementalistBalanceValue(context, PROFILE.shatteringStone, 'durationMultiplier', 10);
    } else if (skill.name === 'Boulder Blast') {
      // The projectile finisher is a separate non-weapon activation from the
      // pistol strike, so downstream combo damage must not reuse its roll.
      context.emit({
        type: 'damage',
        at,
        source: skill.name,
        sourceId: skill.id,
        actorType: 'effect',
        skillName: skill.name,
        skillId: skill.id,
        coefficient: 0,
        noCrit: true,
        activationId: context.createActivationId('effect'),
        comboFinishers: [
          {
            ownerId: 'elementalist',
            finisherType: 'Projectile',
            ambiguousFieldSelection: 'oldest'
          }
        ]
      });
    }
  } else if (!PISTOL_NO_GRANT.has(Number(skill.id))) {
    state.pistolBullets[element] = true;
  }
}
