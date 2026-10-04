import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { RuntimeCast, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { ElementalistAttunement, ElementalistCoreState } from '#gw2/professions/elementalist/core/state.js';
/**
 * Owns Core pistol-bullet loading, consumption, and enhanced payloads.
 *
 * Each elemental pistol skill either loads its element's bullet or spends an
 * already loaded one for an enhanced payload; this module owns that flip at
 * cast completion. Pistol skill fragments live in `skills/weapons/pistol.ts`.
 */
import { professionCoreState, readProfessionCoreState } from '#gw2/platform/engine/profession/state.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { projectCastRelativeEffectTimingMs } from '#gw2/platform/skills/timing.js';
import { elementalistBuffRequest, elementalistStrikeRequest } from '#gw2/professions/elementalist/core/events.js';
import {
  elementalistProfiledBuffRequest,
  elementalistProfiledConditionRequest
} from '#gw2/professions/elementalist/core/mechanics/effects.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/core/profiles.js';
import { applyElementalistAura } from '#gw2/professions/elementalist/core/traits/dispatch.js';
import type { ElementalistRuntimeState, ElementalistSkill } from '#gw2/professions/elementalist/types.js';
/** Reads the completion-time bullet before the declaration's final load/spend action changes it. */
export function hasPistolBullet(
  context: MechanicQueriesOf<MechanicContext>,
  cast: RuntimeCast<ElementalistSkill>
): boolean {
  return readProfessionCoreState<ElementalistCoreState>(context.profession).pistolBullets![
    cast.skill.attunement as ElementalistAttunement
  ];
}

/** Payloads are selected by the skill; the last action toggles its element exactly once. */
export const elementalistPistolSideEffects: RuntimeProfession<
  ElementalistRuntimeState,
  ElementalistSkill
>['sideEffectHandlers'] = {
  'elementalist.pistol.load-or-spend'(context, trigger) {
    if (trigger.kind !== 'cast') throw new TypeError('Pistol bullets require a cast trigger.');
    const element = trigger.skill.attunement as ElementalistAttunement;
    const state = professionCoreState(context);
    state.pistolBullets[element] = !state.pistolBullets[element];
  },
  'elementalist.pistol.load'(context, trigger) {
    if (trigger.kind !== 'cast') throw new TypeError('Pistol bullets require a cast trigger.');
    professionCoreState(context).pistolBullets[trigger.skill.attunement as ElementalistAttunement] = true;
  },
  'elementalist.pistol.raging-ricochet'(context, trigger) {
    if (trigger.kind !== 'cast') throw new TypeError('Pistol enhancements require a cast trigger.');
    const { cast, skill } = trigger;
    const at = cast.effectiveEnd;
    {
      context.effects.emit(
        elementalistProfiledBuffRequest(
          context,
          at,
          PROFILE.ragingRicochet,
          'Fire',
          skill.name,
          skill.id,
          undefined,
          undefined,
          { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
        )
      );
    }
  },
  'elementalist.pistol.searing-salvo'(context, trigger) {
    if (trigger.kind !== 'cast') throw new TypeError('Pistol enhancements require a cast trigger.');
    const { cast, skill } = trigger;
    const at = cast.effectiveEnd;
    {
      const searingSalvoProfile = requireBalanceProfileFromContext(context, PROFILE.searingSalvo);
      const aura = requireEffect(searingSalvoProfile, 'buff', 'Fire');
      if (aura) {
        applyElementalistAura(context, {
          at,
          aura: String(aura.kind),
          duration: aura.duration,
          skillName: skill.name,
          sourceId: skill.id
        });
      }
    }
  },
  'elementalist.pistol.frozen-fusillade'(context, trigger) {
    if (trigger.kind !== 'cast') throw new TypeError('Pistol enhancements require a cast trigger.');
    const { cast, skill } = trigger;
    {
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
        context.effects.emit(
          elementalistStrikeRequest(
            context,
            {
              at: detonationAt,
              source: skill.name,
              sourceId: skill.id,
              actorType: 'player',
              skillName: skill.name,
              skillId: skill.id,
              coefficient: effectNumber(frozenFusilladeProfile, frozenFusilladeWaterBulletStrike, 'coefficient'),
              skillWeapon: 'Pistol'
            },
            { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
          )
        );
      }

      context.effects.emit(
        elementalistProfiledConditionRequest(
          context,
          detonationAt,
          PROFILE.frozenFusillade,
          'Water Bullet',
          skill.name,
          skill.id,
          undefined,
          { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
        )
      ).length > 0;
    }
  },
  'elementalist.pistol.dazing-discharge'(context, trigger) {
    if (trigger.kind !== 'cast') throw new TypeError('Pistol enhancements require a cast trigger.');
    const { cast } = trigger;
    const at = cast.effectiveEnd;
    {
      const dazingDischargeProfile = requireBalanceProfileFromContext(context, PROFILE.dazingDischarge);
      // Arms a window that shortens the next pistol skill's recharge; the
      // reduction is consumed in `mechanics/recharge.ts`.
      professionCoreState(context).dazingDischargeUntil =
        at + balanceProfileNumber(dazingDischargeProfile, 'durationMultiplier');
    }
  },
  'elementalist.pistol.shattering-stone'(context, trigger) {
    if (trigger.kind !== 'cast') throw new TypeError('Pistol enhancements require a cast trigger.');
    const { cast, skill } = trigger;
    const at = cast.effectiveEnd;
    {
      const shatteringStoneProfile = requireBalanceProfileFromContext(context, PROFILE.shatteringStone);
      // Arm the buff on the event timeline so the resolver consumes its charges
      // in impact order, including attacks scheduled before this cast.
      context.effects.emit(
        elementalistBuffRequest(
          {
            skill: skill,
            at,
            source: skill.name,
            kind: 'shattering stone',
            stacks: balanceProfileNumber(shatteringStoneProfile, 'maximumStacks'),
            duration: balanceProfileNumber(shatteringStoneProfile, 'durationMultiplier')
          },
          { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
        )
      );
    }
  },
  'elementalist.pistol.boulder-blast'(context, trigger) {
    if (trigger.kind !== 'cast') throw new TypeError('Pistol enhancements require a cast trigger.');
    const { cast, skill } = trigger;
    const at = cast.effectiveEnd;
    {
      // The projectile finisher is a separate non-weapon activation from the
      // pistol strike, so downstream combo damage must not reuse its roll.
      context.effects.emit(
        elementalistStrikeRequest(
          context,
          {
            at,
            source: skill.name,
            sourceId: skill.id,
            actorType: 'effect',
            skillName: skill.name,
            skillId: skill.id,
            coefficient: 0,
            canCrit: false,
            activationId: `${cast.id}:boulder-finisher`,
            comboFinishers: [
              {
                ownerId: 'elementalist',
                finisherType: 'Projectile',
                ambiguousFieldSelection: 'oldest'
              }
            ]
          },
          { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
        )
      );
    }
  }
};
