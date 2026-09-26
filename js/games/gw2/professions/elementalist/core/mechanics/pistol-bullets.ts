import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
/**
 * Owns Core pistol-bullet loading, consumption, and enhanced payloads.
 *
 * Each elemental pistol skill either loads its element's bullet or spends an
 * already loaded one for an enhanced payload; this module owns that flip at
 * cast completion. Pistol skill fragments live in `skills/weapons/pistol.ts`.
 */
import {
  requireBalanceProfileFromContext,
  requireEffect,
  balanceProfileNumber,
  effectNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { emitElementalistBuff, emitElementalistDamage } from '#gw2/professions/elementalist/core/live-events.js';
import { projectCastRelativeEffectTimingMs } from '#gw2/platform/skills/timing.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import {
  PISTOL_NO_CONSUME,
  PISTOL_NO_GRANT,
  PISTOL_SKILL_ELEMENTS
} from '#gw2/professions/elementalist/core/constants.js';
import {
  emitProfiledBuff,
  emitProfiledCondition,
  skillWeapon
} from '#gw2/professions/elementalist/core/mechanics/effects.js';
import { applyElementalistAura } from '#gw2/professions/elementalist/core/traits/index.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/core/profiles.js';

/**
 * Applies the load-or-spend bullet flip for one completed pistol cast: a loaded
 * bullet of the skill's element is spent for that skill's enhanced payload,
 * otherwise the cast leaves one loaded. The no-consume and no-grant sets (the
 * Aerial Agility chain) opt out of one or both halves.
 */
export function applyPistolState(context: ElementalistRuntime, cast: RuntimeCast, skill: Skill): void {
  if (skillWeapon(skill) !== 'Pistol') return;
  // A cancelled input cannot load or spend a bullet or apply its enhanced payload.
  const state = professionCoreState(context);
  const at = cast.effectiveEnd;
  const element = PISTOL_SKILL_ELEMENTS[Number(skill.id)];
  if (!element) return;
  // Spend branch: the enhanced payload differs per skill, so each is authored
  // inline (immediate buff, aura, delayed strike, or armed follow-up state).
  if (state.pistolBullets[element] && !PISTOL_NO_CONSUME.has(Number(skill.id))) {
    state.pistolBullets[element] = false;
    if (skill.id === ID.RAGING_RICOCHET) {
      emitProfiledBuff(context, at, PROFILE.ragingRicochet, 'Fire', skill.name, skill.id);
    } else if (skill.id === ID.SEARING_SALVO) {
      const searingSalvoProfile = requireBalanceProfileFromContext(context, PROFILE.searingSalvo);
      const aura = requireEffect(searingSalvoProfile, 'buff', 'Fire');
      if (aura) {
        applyElementalistAura(context, {
          at,
          aura: String(aura.kind),
          duration: Number(aura.duration),
          skillName: skill.name,
          sourceId: skill.id
        });
      }
    } else if (skill.id === ID.FROZEN_FUSILLADE) {
      const frozenFusilladeProfile = requireBalanceProfileFromContext(context, PROFILE.frozenFusillade);
      // The field's four-second lifetime starts at projectile release, so
      // aftercast length and cancellation cannot move its enhanced detonation.
      const delay = balanceProfileNumber(frozenFusilladeProfile, 'initialDelay');
      const detonationAt =
        cast.start +
        projectCastRelativeEffectTimingMs(skill, (cast.fullEnd - cast.start) * 1000, Number(skill.interruptCommitMs)) /
          1000 +
        delay;
      const frozenFusilladeWaterBulletStrike = requireEffect(frozenFusilladeProfile, 'strike', 'Water Bullet');
      if (frozenFusilladeWaterBulletStrike) {
        emitElementalistDamage(context, {
          at: detonationAt,
          source: skill.name,
          sourceId: skill.id,
          actorType: 'player',
          skillName: skill.name,
          skillId: skill.id,
          coefficient: effectNumber(frozenFusilladeProfile, frozenFusilladeWaterBulletStrike, 'coefficient'),
          skillWeapon: 'Pistol'
        });
      }

      emitProfiledCondition(context, detonationAt, PROFILE.frozenFusillade, 'Water Bullet', skill.name, skill.id);
    } else if (skill.id === ID.DAZING_DISCHARGE) {
      const dazingDischargeProfile = requireBalanceProfileFromContext(context, PROFILE.dazingDischarge);
      // Arms a window that shortens the next pistol skill's recharge; the
      // reduction is consumed in `mechanics/recharge.ts`.
      state.dazingDischargeUntil = at + balanceProfileNumber(dazingDischargeProfile, 'durationMultiplier');
    } else if (skill.id === ID.SHATTERING_STONE) {
      const shatteringStoneProfile = requireBalanceProfileFromContext(context, PROFILE.shatteringStone);
      // Arm the buff on the event timeline so the resolver consumes its charges
      // in impact order, including attacks scheduled before this cast.
      emitElementalistBuff(context, {
        skill: skill,
        at,
        source: skill.name,
        kind: 'shattering stone',
        stacks: balanceProfileNumber(shatteringStoneProfile, 'maximumStacks'),
        duration: balanceProfileNumber(shatteringStoneProfile, 'durationMultiplier')
      });
    } else if (skill.id === ID.BOULDER_BLAST) {
      // The projectile finisher is a separate non-weapon activation from the
      // pistol strike, so downstream combo damage must not reuse its roll.
      emitElementalistDamage(context, {
        at,
        source: skill.name,
        sourceId: skill.id,
        actorType: 'effect',
        skillName: skill.name,
        skillId: skill.id,
        coefficient: 0,
        noCrit: true,
        activationId: `${cast.id}:boulder-finisher`,
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
