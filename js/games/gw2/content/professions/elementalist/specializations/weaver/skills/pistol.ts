import { emitSkillControl } from '../../../../../../platform/scheduler/skill-events.js';
import { professionCoreState } from '../../../../../../platform/engine/profession/state.js';
import type { Skill } from '../../../../../../platform/engine/types.js';
import type { ElementalistCastContext } from '../../../types.js';
import {
  applyElementalistAura,
  emitProfiledBuff,
  emitProfiledCondition,
  profiledEffect,
  skillWeapon
} from '../../../core/mechanics/effects.js';
import { WEAVER_BALANCE_PROFILE_IDS as PROFILE } from '../profiles.js';
import { weaverDualAttunements } from './index.js';

/** Consumes and grants pistol bullets for Weaver's dual-attunement weapon skills. */
export function applyWeaverPistolState(context: ElementalistCastContext, skill: Skill): void {
  if (skillWeapon(skill) !== 'Pistol') return;
  const elements = weaverDualAttunements(skill);
  if (!elements) return;
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  const active = elements.filter((element) => state.pistolBullets[element]);
  if (!active.length) {
    state.pistolBullets[state.primaryAttunement] = true;
    return;
  }

  for (const element of active) {
    state.pistolBullets[element] = false;
    if (skill.name === 'Frostfire Flurry' && element === 'Fire') {
      const aura = profiledEffect(context, PROFILE.frostfireFlurry, 'buff', 'Fire');
      applyElementalistAura(context, {
        at,
        aura: String(aura?.kind || 'Fire Aura'),
        duration: Number(aura?.duration ?? 3),
        skillName: skill.name,
        sourceId: skill.id
      });
    } else if (skill.name === 'Frostfire Flurry' && element === 'Water') {
      emitProfiledCondition(context, at, PROFILE.frostfireFlurry, 'Water', 'Vulnerability', 4, 8, skill.name, skill.id);
    } else if (skill.name === 'Purblinding Plasma' && element === 'Fire') {
      emitProfiledCondition(context, at, PROFILE.purblindingPlasma, 'Fire', 'Burning', 3, 4, skill.name, skill.id);
    } else if (skill.name === 'Molten Meteor' && element === 'Earth') {
      emitProfiledCondition(context, at, PROFILE.moltenMeteor, 'Earth', 'Bleeding', 3, 8, skill.name, skill.id);
    } else if (skill.name === 'Flowing Finesse' && element === 'Water') {
      const aura = profiledEffect(context, PROFILE.flowingFinesse, 'buff', 'Water');
      applyElementalistAura(context, {
        at,
        aura: String(aura?.kind || 'Frost Aura'),
        duration: Number(aura?.duration ?? 3),
        skillName: skill.name,
        sourceId: skill.id
      });
    } else if (skill.name === 'Flowing Finesse' && element === 'Air') {
      emitProfiledBuff(context, at, PROFILE.flowingFinesse, 'Air', 'Superspeed', 1, 4, skill.name, skill.id);
    } else if (skill.name === 'Enervating Earth' && element === 'Air') {
      emitSkillControl(context, {
        at,
        source: skill.name,
        sourceId: skill.id,
        actorType: 'player',
        skillName: skill.name,
        skillId: skill.id,
        controlKind: 'crowd-control'
      });
    } else if (skill.name === 'Enervating Earth' && element === 'Earth') {
      emitProfiledCondition(context, at, PROFILE.enervatingEarth, 'Earth', 'Bleeding', 4, 8, skill.name, skill.id);
    }
  }
}
