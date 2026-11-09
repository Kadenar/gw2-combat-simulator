/** Owns pistol enhancement actions, charge rewards, recharge grants, and deferred tasks. */
import { consumeCharge, grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { ACTOR, COMBO_FINISHER, WEAPON } from '#gw2/platform/constants.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import { resolverSourceSkill } from '#gw2/platform/effects/packet-builders.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import { denySkillCast, type AvailabilityResult } from '#gw2/platform/execution/availability.js';
import type { SkillTaskData } from '#gw2/platform/execution/cast-contracts.js';
import { projectCastRelativeEffectTimingMs } from '#gw2/platform/execution/cast-timing.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { effectNumber, requireEffect, requireSkill, skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { elementalistBuffRequest, elementalistStrikeRequest } from '#gw2/professions/elementalist/core/events.js';
import { applyElementalistAura } from '#gw2/professions/elementalist/core/mechanics/auras.js';
import {
  elementalistBuffEffectRequest,
  elementalistConditionEffectRequest,
  skillWeapon
} from '#gw2/professions/elementalist/core/mechanics/effects.js';
import {
  allPistolBulletsLoaded,
  pistolBulletSideEffectHandlers,
  spendAllPistolBullets
} from '#gw2/professions/elementalist/core/mechanics/pistol-bullets.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type {
  ElementalistResolverContext,
  ElementalistRuntime,
  ElementalistRuntimeState,
  ElementalistSkill
} from '#gw2/professions/elementalist/types.js';

/** How long an advanced Aerial Agility stage stays offered before its chain resets. */
const AERIAL_AGILITY_FLIP_WINDOW_SECONDS = 5;

/** Enhancement actions read the completion-time bullet; the declaration changes its stock last. */
const pistolSideEffectHandlers: RuntimeHooks<ElementalistRuntimeState, ElementalistSkill>['sideEffectHandlers'] = {
  ...pistolBulletSideEffectHandlers,
  'elementalist.core.consume-elemental-explosion'(context, trigger) {
    if (trigger.kind !== 'cast') throw new TypeError('Elemental Explosion requires a cast trigger.');

    // Retain ordinary task priority: later deliveries and aura reactions must keep their existing ordering.
    context.scheduleForCast('elementalist.core.consume-elemental-explosion', context.time, trigger.cast, {});
  },
  'elementalist.pistol.raging-ricochet'(context, trigger, action) {
    if (trigger.kind !== 'cast') throw new TypeError('Pistol enhancements require a cast trigger.');

    const { cast, skill } = trigger;
    const at = cast.effectiveEnd;

    context.effects.emit(
      elementalistBuffEffectRequest(context, at, { skill, action }, 'Fire', skill.name, skill.id, {
        activationId: cast.id,
        skillId: cast.skill.id,
        offTarget: cast.command.offTarget
      })
    );
  },
  'elementalist.pistol.searing-salvo'(context, trigger, action) {
    if (trigger.kind !== 'cast') throw new TypeError('Pistol enhancements require a cast trigger.');

    const { cast, skill } = trigger;
    const at = cast.effectiveEnd;
    const aura = requireEffect(skill, 'aura', 'Fire', action);

    if (aura) {
      applyElementalistAura(context, {
        at,
        aura: aura.aura,
        duration: aura.duration,
        skillName: skill.name,
        sourceId: skill.id
      });
    }
  },
  'elementalist.pistol.frozen-fusillade'(context, trigger, action) {
    if (trigger.kind !== 'cast') throw new TypeError('Pistol enhancements require a cast trigger.');

    const { cast, skill } = trigger;
    // Anchor the selected detonation delay to release so aftercast length and
    // cancellation cannot move the enhanced reward.
    const delay = skillNumber(skill, 'detonationDelay');
    const detonationAt =
      cast.start +
      projectCastRelativeEffectTimingMs(skill, (cast.fullEnd - cast.start) * 1000, Number(skill.interruptCommitMs)) /
        1000 +
      delay;
    const frozenFusilladeWaterBulletStrike = requireEffect(skill, 'strike', 'Water Bullet', action);

    if (frozenFusilladeWaterBulletStrike) {
      context.effects.emit(
        elementalistStrikeRequest(
          context,
          {
            at: detonationAt,
            source: skill.name,
            sourceId: skill.id,
            actorType: ACTOR.PLAYER,
            skillName: skill.name,
            skillId: skill.id,
            coefficient: effectNumber(skill, frozenFusilladeWaterBulletStrike, 'coefficient'),
            skillWeapon: WEAPON.PISTOL
          },
          { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
        )
      );
    }

    context.effects.emit(
      elementalistConditionEffectRequest(
        context,
        detonationAt,
        { skill, action },
        'Water Bullet',
        skill.name,
        skill.id,
        {
          activationId: cast.id,
          skillId: cast.skill.id,
          offTarget: cast.command.offTarget
        }
      )
    );
  },
  'elementalist.pistol.dazing-discharge'(context, trigger) {
    if (trigger.kind !== 'cast') throw new TypeError('Pistol enhancements require a cast trigger.');

    const { cast } = trigger;
    const at = cast.effectiveEnd;

    // Arms a window that shortens the next pistol skill's recharge; the
    // reduction is consumed by this weapon's recharge reservation. That
    // reservation compares against the deadline, so no expiry task is needed.
    professionCoreState(context.profession).dazingDischargeUntil = at + skillNumber(cast.skill, 'duration');
  },
  'elementalist.pistol.shattering-stone'(context, trigger) {
    if (trigger.kind !== 'cast') throw new TypeError('Pistol enhancements require a cast trigger.');

    const { cast, skill } = trigger;
    const at = cast.effectiveEnd;
    // Arm the buff on the event timeline so the resolver consumes its charges
    // in impact order, including attacks scheduled before this cast.
    context.effects.emit(
      elementalistBuffRequest(
        {
          skill: skill,
          at,
          source: skill.name,
          kind: 'shattering stone',
          stacks: skillNumber(skill, 'maximumStacks'),
          duration: skillNumber(skill, 'duration')
        },
        { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
      )
    );
  },
  'elementalist.pistol.boulder-blast'(context, trigger) {
    if (trigger.kind !== 'cast') throw new TypeError('Pistol enhancements require a cast trigger.');

    const { cast, skill } = trigger;
    const at = cast.effectiveEnd;

    // The projectile finisher is a separate non-weapon activation from the
    // pistol strike, so downstream combo damage must not reuse its roll.
    context.effects.emit(
      elementalistStrikeRequest(
        context,
        {
          at,
          source: skill.name,
          sourceId: skill.id,
          actorType: ACTOR.EFFECT,
          skillName: skill.name,
          skillId: skill.id,
          coefficient: 0,
          canCrit: false,
          activationId: `${cast.id}:boulder-finisher`,
          comboFinishers: [
            {
              ownerId: 'elementalist',
              finisherType: COMBO_FINISHER.PROJECTILE
            }
          ]
        },
        { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
      )
    );
  }
};

/** Arms Shattering Stone only when its self buff reaches the resolver timeline. */
export function applyShatteringStoneBuff(context: ElementalistResolverContext, event: Gw2ResolverEvent): void {
  if (event.kind !== 'shattering stone' || !event.resolvedAudience?.includesSelf) return;

  const core = professionCoreState(context.profession);
  core.shatteringStone = grantCharges(event.stacks || 0, event.at + (event.duration || 0));
}

/** Spend Shattering Stone charges in resolved impact order, including previously scheduled attacks. */
export function triggerShatteringStone(context: ElementalistResolverContext, event: Gw2ResolverEvent): void {
  const core = professionCoreState(context.profession);

  if (
    (event.actorType === ACTOR.PLAYER || event.actorType === ACTOR.EFFECT) &&
    Number(event.coefficient) > 0 &&
    consumeCharge(core.shatteringStone, event.at)
  ) {
    // Follow-up hits read the same patched action that armed the charges, without emitting its payload on cast.
    const skill = requireSkill(context.helpers, ID.SHATTERING_STONE);
    const bleeding = requireEffect(skill, 'condition', 'Triggered Bleeding', requireSkillAction(skill, 'earth-bullet'));

    if (bleeding) {
      context.effects.emit({
        kind: 'packet',
        settlement: 'reaction',
        event: {
          type: 'condition',
          at: event.at,
          source: 'Shattering Stone',
          sourceId: ID.SHATTERING_STONE,
          actorType: ACTOR.PLAYER,
          skillName: 'Shattering Stone',
          condition: String(bleeding.condition),
          stacks: Number(bleeding.stacks),
          duration: Number(bleeding.duration),
          triggeredBy: resolverSourceSkill(event)
        }
      });
    }
  }
}

/** Elemental Explosion is castable only while one bullet of every element is stored. */
export function elementalExplosionAvailability(
  context: MechanicQueriesOf<ElementalistRuntime>,
  skill: Skill
): AvailabilityResult | null {
  return Number(skill.id) === ID.ELEMENTAL_EXPLOSION && !allPistolBulletsLoaded(context)
    ? denySkillCast(skill, 'elementalist.pistol-bullets', 'requires all four elemental bullets.')
    : null;
}

/** Pistol owns its flip deadlines and recharge, plus Elemental Explosion's aura and bullet consumption. */
export const elementalistPistolLifecycle = {
  sideEffectHandlers: pistolSideEffectHandlers,
  reserveRecharge: reservePistolRecharge,
  onAutoattackChainTransition(context, cast, result) {
    if (result.castChainRootId !== ID.AERIAL_AGILITY) return;

    const change = result.transitions.find((transition) => transition.chainRootId === ID.AERIAL_AGILITY);

    if (!change || (change.decision !== 'advance' && change.decision !== 'complete')) return;

    // Replace the previous stage's deadline so it cannot expire a newer stage, even after a reset.
    context.cancelOwner({ id: 'elementalist.aerial-agility', generation: 0 });

    if (Number(cast.skill.id) === ID.AERIAL_AGILITY_CHAIN) {
      const root = context.helpers.skillsById.get(ID.AERIAL_AGILITY);

      if (root) context.cooldownController.startRecharge(root, context.time);
    }

    if (change.decision === 'advance' && change.nextSkillId != null)
      context.schedule(
        'elementalist.aerial-agility-expire',
        context.time + AERIAL_AGILITY_FLIP_WINDOW_SECONDS,
        change.nextSkillId,
        { id: 'elementalist.aerial-agility', generation: 0 }
      );
  },
  tasks: {
    'elementalist.aerial-agility-expire'(context, data) {
      if (context.autoattackController.read(ID.AERIAL_AGILITY) !== Number(data)) return;

      // This slot-three flip never carries across attunements; expiry resets only its own chain.
      context.autoattackController.reset([ID.AERIAL_AGILITY]);
    },
    // Grant the current attunement's aura before consuming all four bullets.
    'elementalist.core.consume-elemental-explosion'(runtime, data) {
      const { cast } = data as SkillTaskData<ElementalistSkill>;
      const effect = requireEffect(
        cast.skill,
        'aura',
        runtime.profession.core.primaryAttunement,
        requireSkillAction(cast.skill, 'attunement-aura')
      );

      if (effect)
        applyElementalistAura(runtime, {
          at: runtime.time,
          aura: effect.aura,
          duration: effect.duration,
          skillName: cast.skill.name,
          sourceId: cast.skill.id
        });

      // Aura selection above uses the attunement at task execution; bullet consumption happens only after that reward.
      spendAllPistolBullets(runtime);
    }
  }
} satisfies RuntimeHooks<ElementalistRuntimeState, ElementalistSkill>;

/** An accepted non-auto pistol cast consumes Dazing Discharge once and keeps its reserved recharge. */
function reservePistolRecharge(context: ElementalistRuntime, skill: Skill, duration: number): number {
  if (skill.type !== 'Weapon' || String(skill.slot || '') === 'Weapon_1') return duration;

  const state = professionCoreState(context.profession);

  if (state.dazingDischargeUntil > context.time && skillWeapon(skill) === WEAPON.PISTOL) {
    // Spend when reserving recharge so a later expiry or another cast cannot change this cast's accepted reduction.
    state.dazingDischargeUntil = 0;
    return duration * skillNumber(requireSkill(context.helpers, ID.DAZING_DISCHARGE), 'nextSkillRechargeMultiplier');
  }

  return duration;
}
