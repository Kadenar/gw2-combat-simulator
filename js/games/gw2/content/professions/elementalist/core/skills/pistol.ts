/**
 * Core pistol bullet mechanics.
 *
 * Each elemental pistol skill either loads its element's bullet or spends an
 * already loaded one for an enhanced payload; this module owns that flip at
 * cast completion. Pistol skill data lives in `weapons/pistol.ts`.
 */
import { balanceProfileValueFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { emitSkillDamage } from '#gw2/platform/scheduler/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { Skill } from '#gw2/platform/engine/types.js';
import type { ElementalistCastContext as ElementalistLifecycleContext } from '#gw2/content/professions/elementalist/types.js';
import {
  PISTOL_NO_CONSUME,
  PISTOL_NO_GRANT,
  PISTOL_SKILL_ELEMENTS
} from '#gw2/content/professions/elementalist/core/constants.js';
import {
  emitProfiledBuff,
  emitProfiledCondition,
  profiledEffect,
  skillWeapon
} from '#gw2/content/professions/elementalist/core/mechanics/effects.js';
import { applyElementalistAura } from '#gw2/content/professions/elementalist/core/traits/index.js';
import {
  ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE,
  elementalistEffectValue
} from '#gw2/content/professions/elementalist/core/profiles.js';

/**
 * Applies the load-or-spend bullet flip for one completed pistol cast: a loaded
 * bullet of the skill's element is spent for that skill's enhanced payload,
 * otherwise the cast leaves one loaded. The no-consume and no-grant sets (the
 * Aerial Agility chain) opt out of one or both halves.
 */
export function applyPistolState(context: ElementalistLifecycleContext, skill: Skill): void {
  if (skillWeapon(skill) !== 'Pistol') return;
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  const element = PISTOL_SKILL_ELEMENTS[Number(skill.id)];
  if (!element) return;
  // Spend branch: the enhanced payload differs per skill, so each is authored
  // inline (immediate buff, aura, delayed strike, or armed follow-up state).
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
      // The enhanced hit lands well after the cast, so it is scheduled as a
      // delayed strike plus its Bleeding rather than emitted at cast end.
      const delay = balanceProfileValueFromContext(context, PROFILE.frozenFusillade, 'initialDelay', 4);
      emitSkillDamage(context, {
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
      // Arms a window that shortens the next pistol skill's recharge; the
      // reduction is consumed in `recharge.ts`.
      state.dazingDischargeUntil =
        at + balanceProfileValueFromContext(context, PROFILE.dazingDischarge, 'durationMultiplier', 5);
    } else if (skill.name === 'Shattering Stone') {
      // Arms a limited number of player strikes inside a window; each armed hit
      // is converted to Bleeding by the event observer in `transient-state.ts`.
      state.shatteringStoneHitsRemaining = balanceProfileValueFromContext(
        context,
        PROFILE.shatteringStone,
        'maximumStacks',
        3
      );
      state.shatteringStoneUntil =
        at + balanceProfileValueFromContext(context, PROFILE.shatteringStone, 'durationMultiplier', 10);
    } else if (skill.name === 'Boulder Blast') {
      // The projectile finisher is a separate non-weapon activation from the
      // pistol strike, so downstream combo damage must not reuse its roll.
      emitSkillDamage(context, {
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
    // Load branch: nothing was spent, so the cast leaves a bullet of its element behind.
    state.pistolBullets[element] = true;
  }
}
