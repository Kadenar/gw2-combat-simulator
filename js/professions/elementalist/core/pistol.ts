import type { SchedulerRecord, Skill } from '../../../platform/engine/types.js';
import type { ElementalistCastContext as ElementalistLifecycleContext } from '../types.js';
import { elementalistCoreState } from './state.js';
import { PISTOL_DUAL_ELEMENTS, PISTOL_NO_CONSUME, PISTOL_NO_GRANT, PISTOL_SKILL_ELEMENTS } from './constants.js';
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
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  const at = context.effectiveEnd;
  const dual = PISTOL_DUAL_ELEMENTS[Number(skill.id)];
  if (dual) {
    const active = dual.filter((element) => state.pistolBullets[element]);
    if (active.length) {
      for (const element of active) {
        state.pistolBullets[element] = false;
        if (skill.name === 'Frostfire Flurry') {
          if (element === 'Fire') {
            const aura = profiledEffect(context, PROFILE.frostfireFlurry, 'buff', 'Fire');
            applyElementalistAura(context, {
              at,
              aura: String(aura?.kind || 'Fire Aura'),
              duration: Number(aura?.duration ?? 3),
              skillName: skill.name,
              sourceId: skill.id
            });
          } else if (element === 'Water') {
            emitProfiledCondition(
              context,
              at,
              PROFILE.frostfireFlurry,
              'Water',
              'Vulnerability',
              4,
              8,
              skill.name,
              skill.id
            );
          }
        } else if (skill.name === 'Purblinding Plasma' && element === 'Fire') {
          emitProfiledCondition(context, at, PROFILE.purblindingPlasma, 'Fire', 'Burning', 3, 4, skill.name, skill.id);
        } else if (skill.name === 'Molten Meteor' && element === 'Earth') {
          emitProfiledCondition(context, at, PROFILE.moltenMeteor, 'Earth', 'Bleeding', 3, 8, skill.name, skill.id);
        } else if (skill.name === 'Flowing Finesse') {
          if (element === 'Water') {
            const aura = profiledEffect(context, PROFILE.flowingFinesse, 'buff', 'Water');
            applyElementalistAura(context, {
              at,
              aura: String(aura?.kind || 'Frost Aura'),
              duration: Number(aura?.duration ?? 3),
              skillName: skill.name,
              sourceId: skill.id
            });
          } else if (element === 'Air') {
            emitProfiledBuff(context, at, PROFILE.flowingFinesse, 'Air', 'Superspeed', 1, 4, skill.name, skill.id);
          }
        } else if (skill.name === 'Enervating Earth') {
          if (element === 'Air') {
            context.emit({
              type: 'control',
              at,
              source: skill.name,
              sourceId: skill.id,
              actorType: 'player',
              skillName: skill.name,
              skillId: skill.id,
              controlKind: 'crowd-control'
            });
          } else if (element === 'Earth') {
            emitProfiledCondition(
              context,
              at,
              PROFILE.enervatingEarth,
              'Earth',
              'Bleeding',
              4,
              8,
              skill.name,
              skill.id
            );
          }
        }
      }
    } else {
      state.pistolBullets[state.primaryAttunement] = true;
    }

    return;
  }

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
