/**
 * Weaver-side runtime behaviour for the pistol bullet resource; the cataloged
 * pistol skill data lives in `skills/weapons/pistol.ts`.
 */
import { emitSkillControl } from '#gw2/platform/scheduler/skill-events.js';
import { balanceProfileEffectFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { Skill } from '#gw2/platform/engine/types.js';
import type { ElementalistCastContext } from '#gw2/content/professions/elementalist/types.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/content/professions/elementalist/data/ids.js';
import {
  emitProfiledBuff,
  emitProfiledCondition,
  skillWeapon
} from '#gw2/content/professions/elementalist/core/mechanics/effects.js';
import { applyElementalistAura } from '#gw2/content/professions/elementalist/core/traits/index.js';
import { WEAVER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/elementalist/specializations/weaver/profiles.js';
import { weaverDualAttunements } from '#gw2/content/professions/elementalist/specializations/weaver/skills/index.js';

/** Consumes and grants pistol bullets for Weaver's dual-attunement weapon skills. */
export function applyWeaverPistolState(context: ElementalistCastContext, skill: Skill): void {
  if (skillWeapon(skill) !== 'Pistol') return;
  const elements = weaverDualAttunements(skill);
  if (!elements) return;
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  // With no bullet loaded for either half of the pair, the dual skill loads one
  // for the current main-hand element instead of firing.
  const active = elements.filter((element) => state.pistolBullets[element]);
  if (!active.length) {
    state.pistolBullets[state.primaryAttunement] = true;
    return;
  }

  // Otherwise every matching bullet is consumed and adds the bonus effect that
  // this specific dual skill grants for that element.
  for (const element of active) {
    state.pistolBullets[element] = false;
    if (skill.id === ID.FROSTFIRE_FLURRY && element === 'Fire') {
      const aura = balanceProfileEffectFromContext(context, PROFILE.frostfireFlurry, 'buff', 0, 'Fire');
      applyElementalistAura(context, {
        at,
        aura: String(aura?.kind || 'Fire Aura'),
        duration: Number(aura?.duration ?? 3),
        skillName: skill.name,
        sourceId: skill.id
      });
    } else if (skill.id === ID.FROSTFIRE_FLURRY && element === 'Water') {
      emitProfiledCondition(context, at, PROFILE.frostfireFlurry, 'Water', 'Vulnerability', 4, 8, skill.name, skill.id);
    } else if (skill.id === ID.PURBLINDING_PLASMA && element === 'Fire') {
      emitProfiledCondition(context, at, PROFILE.purblindingPlasma, 'Fire', 'Burning', 3, 4, skill.name, skill.id);
    } else if (skill.id === ID.MOLTEN_METEOR && element === 'Earth') {
      emitProfiledCondition(context, at, PROFILE.moltenMeteor, 'Earth', 'Bleeding', 3, 8, skill.name, skill.id);
    } else if (skill.id === ID.FLOWING_FINESSE && element === 'Water') {
      const aura = balanceProfileEffectFromContext(context, PROFILE.flowingFinesse, 'buff', 0, 'Water');
      applyElementalistAura(context, {
        at,
        aura: String(aura?.kind || 'Frost Aura'),
        duration: Number(aura?.duration ?? 3),
        skillName: skill.name,
        sourceId: skill.id
      });
    } else if (skill.id === ID.FLOWING_FINESSE && element === 'Air') {
      emitProfiledBuff(context, at, PROFILE.flowingFinesse, 'Air', 'Superspeed', 1, 4, skill.name, skill.id);
    } else if (skill.id === ID.ENERVATING_EARTH && element === 'Air') {
      emitSkillControl(context, {
        at,
        source: skill.name,
        sourceId: skill.id,
        actorType: 'player',
        skillName: skill.name,
        skillId: skill.id,
        controlKind: 'crowd-control'
      });
    } else if (skill.id === ID.ENERVATING_EARTH && element === 'Earth') {
      emitProfiledCondition(context, at, PROFILE.enervatingEarth, 'Earth', 'Bleeding', 4, 8, skill.name, skill.id);
    }
  }
}
