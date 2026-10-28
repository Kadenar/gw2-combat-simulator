/**
 * Familiar cast lifecycle - the heart of the Evoker specialization.
 *
 * A basic familiar spends the whole charge bar and adds an empowered stack; at
 * three stacks its empowered flip form becomes castable and spends them back to
 * zero. This module drives that cycle across the cast-start, after-cast, and
 * cast-complete phases. Skill-owned replacement, tiering, and flip logic lives
 * in `skills/familiar-skills.ts`; this module coordinates the familiar traits
 * (Prowess, Blessing, Galvanic Enchantment, Specialized Elements) and the Evoker
 * meditation payloads.
 */
import { ACTOR, RECIPIENT } from '#gw2/platform/constants.js';
import { requireSkillAction, type ActionContext, type SideEffectAction } from '#gw2/platform/effects/actions.js';
import type { RuntimeCast, SkillTaskData } from '#gw2/platform/execution/cast-contracts.js';
import { castRelativeEffectTimingScale, GW2_QUICKNESS_ACTION_RATE } from '#gw2/platform/execution/cast-timing.js';
import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { effectNumber, requireEffect } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { elementalistBuffRequest } from '#gw2/professions/elementalist/core/events.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { grantElectricEnchantments } from '#gw2/professions/elementalist/specializations/evoker/mechanics/electric-enchantment.js';
import { elementalProcessionEffects } from '#gw2/professions/elementalist/specializations/evoker/mechanics/familiar-projection.js';
import {
  emitResource,
  flushPendingWeaponChargeGains,
  grantWeaponSkillCharges,
  weaponSkillChargeGain
} from '#gw2/professions/elementalist/specializations/evoker/mechanics/resources.js';
import {
  evokerCastCompleted,
  familiarSettled
} from '#gw2/professions/elementalist/specializations/evoker/mechanics/trigger-points.js';
import { settleBasicFamiliar } from '#gw2/professions/elementalist/specializations/evoker/skills/familiar-skills.js';
import { evokerState } from '#gw2/professions/elementalist/specializations/evoker/state.js';
import type {
  ElementalistRuntime,
  ElementalistRuntimeState,
  ElementalistSkill
} from '#gw2/professions/elementalist/types.js';

// Replay all four empowered familiar effects with their native F5 strength so balance patches propagate here.
export function releaseElementalProcession(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  sourceSkill: Skill
): void {
  for (const { familiar, effects } of elementalProcessionEffects(context.helpers.skillsById)) {
    for (const effect of effects) {
      // Procession preserves the familiar's unquickened timing and each surviving packet's representation.
      const runtimeCastMs = Math.max(0, (familiar.castTimeMs || 0) * GW2_QUICKNESS_ACTION_RATE);
      const scale = effect.timingScale === 'cast' ? castRelativeEffectTimingScale(familiar, runtimeCastMs) : 1;
      context.effects.emit({
        kind: 'profile',
        profile: familiar,
        effects: [effect],
        at: 0,
        fullEnd: 0,
        cast: { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget },
        attribution: {
          source: familiar.name,
          sourceId: familiar.id,
          actorType: ACTOR.PLAYER,
          triggeredBy: sourceSkill.name,
          skillId: familiar.id,
          skillName: familiar.name
        },
        transform: (event) => ({
          ...event,
          at: cast.effectiveEnd + event.at * scale,
          ...(event.type === 'damage' ? { skillWeapon: 'Profession mechanic' } : {})
        })
      });
    }
  }
}

/**
 * Shared pre-cast bookkeeping records pending charge providers so familiar
 * availability can retry after the weapon or refill commits.
 */
export function onCastStart(context: ElementalistRuntime, cast: RuntimeCast<ElementalistSkill>, skill: Skill): void {
  const state = evokerState.from(context);

  // Track pending grants so early familiar inputs can wait for their resource provider.
  if (cast.command.concurrentOffsetMs == null) {
    const gain = weaponSkillChargeGain(context, skill, state);
    const postFamiliarGain = gain > 0 ? gain : skill.id === ID.REJUVENATE ? state.familiarCharges.maximum : 0;

    if (postFamiliarGain > 0)
      state.pendingWeaponCompletions.push({ activationId: cast.id, at: cast.effectiveEnd, gain: postFamiliarGain });
  }
}

/** Skill-selected commit work runs after this cast's shared trait/bookkeeping hooks and before the next completion. */
function scheduleEvokerSkillCommit(
  context: ElementalistRuntime,
  trigger: ActionContext<ElementalistSkill>,
  action: SideEffectAction
): void {
  if (trigger.kind !== 'cast') throw new TypeError('Evoker skill completion requires a cast trigger.');

  context.scheduleForCast(action.type, context.time, trigger.cast, {}, undefined, -101);
}

const evokerSkillCommitTasks: NonNullable<RuntimeProfession<ElementalistRuntimeState, ElementalistSkill>['tasks']> = {
  'elementalist.evoker.lightning-blitz'(context, data) {
    const { cast } = data as SkillTaskData<ElementalistSkill>;
    const skill = cast.skill;
    const at = cast.effectiveEnd;
    // The selected skill owns the grant; shared enchantment state still owns expiry and consumption.
    const action = requireSkillAction(skill, 'electric-enchantment');
    const enchantment = requireEffect(skill, 'buff', 'Lightning Blitz Enchantment', action);

    if (enchantment)
      grantElectricEnchantments(context, {
        at,
        stacks: effectNumber(skill, enchantment, 'stacks'),
        duration: enchantment.duration,
        skill
      });
  },
  'elementalist.evoker.zap'(context, data) {
    const { cast } = data as SkillTaskData<ElementalistSkill>;
    const skill = cast.skill;
    const at = cast.effectiveEnd;
    const action = requireSkillAction(skill, 'zap-window');
    const zap = requireEffect(skill, 'buff', 'Zap Window', action);

    if (zap) {
      context.effects.emit(
        elementalistBuffRequest(
          {
            at,
            source: skill.name,
            sourceId: skill.id,
            actorType: ACTOR.PLAYER,
            skillName: skill.name,
            // Use the declared identity so the policy and damage modifier observe this same window.
            kind: String(zap.kind),
            stacks: Number(zap.stacks),
            duration: zap.duration
          },
          { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
        )
      );
    }
  },
  'elementalist.evoker.settle-basic-familiar'(context, data) {
    const { cast } = data as SkillTaskData<ElementalistSkill>;
    settleBasicFamiliar(context, cast);
  },
  'elementalist.evoker.settle-empowered-familiar'(context, data) {
    const { cast } = data as SkillTaskData<ElementalistSkill>;
    const skill = cast.skill;
    const state = evokerState.from(context);

    context.resourceController.replace('empoweredCharges', 0);
    emitResource(context, cast, skill, state);
  },
  'elementalist.evoker.rejuvenate'(context, data) {
    const { cast } = data as SkillTaskData<ElementalistSkill>;
    const skill = cast.skill;
    const state = evokerState.from(context);

    context.resourceController.grant('familiarCharges', state.familiarCharges.maximum);
    emitResource(context, cast, skill, state);
  },
  'elementalist.evoker.hares-agility'(context, data) {
    const { cast } = data as SkillTaskData<ElementalistSkill>;
    const skill = cast.skill;
    const at = cast.effectiveEnd;
    // Read charges from the selected buff, independently of this meditation's endurance grant.
    const action = requireSkillAction(skill, 'electric-enchantment');
    const enchantment = requireEffect(skill, 'buff', 'Hare Enchantment', action);

    if (enchantment)
      grantElectricEnchantments(context, {
        at,
        stacks: effectNumber(skill, enchantment, 'stacks'),
        duration: enchantment.duration,
        skill
      });
  },
  'elementalist.evoker.toads-fortitude'(context, data) {
    const { cast } = data as SkillTaskData<ElementalistSkill>;
    const skill = cast.skill;
    const at = cast.effectiveEnd;
    // Read the accepted skill's selected payload without changing the deferred meditation ordering.
    const action = requireSkillAction(skill, 'earth-resistance');
    const resistance = requireEffect(skill, 'boon', 'Toad Resistance', action);

    if (resistance)
      context.effects.emit(
        elementalistBuffRequest(
          {
            skill,
            at,
            source: skill.name,
            sourceId: skill.id,
            actorType: ACTOR.PLAYER,
            kind: String(resistance.boon).toLowerCase(),
            stacks: Number(resistance.stacks),
            duration: resistance.duration,
            audience: resistance.audience,
            skillName: skill.name
          },
          { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
        )
      );
  },
  'elementalist.evoker.foxs-fury'(context, data) {
    const { cast } = data as SkillTaskData<ElementalistSkill>;
    const skill = cast.skill;
    const state = evokerState.from(context);
    const at = cast.effectiveEnd;
    const action = requireSkillAction(skill, 'boons');
    const might = requireEffect(skill, 'boon', 'Fox Might', action);
    const fireMight = requireEffect(skill, 'boon', 'Fox Fire Bonus', action);
    const fury = requireEffect(skill, 'boon', 'Fox Fury', action);
    const fireBonus = state.element === 'Fire' ? fireMight : undefined;
    const combinedMight =
      might && fireBonus && might.boon === fireBonus.boon && might.duration === fireBonus.duration
        ? { ...might, stacks: Number(might.stacks) + Number(fireBonus.stacks) }
        : undefined;
    for (const effect of [...(combinedMight ? [combinedMight] : [might, fireBonus]), fury]) {
      if (!effect) continue;

      const boon = {
        kind: String(effect.boon).toLowerCase(),
        stacks: Number(effect.stacks),
        duration: effect.duration
      };
      context.effects.emit(
        elementalistBuffRequest(
          {
            skill: skill,
            at,
            source: skill.name,
            sourceId: skill.id,
            actorType: ACTOR.PLAYER,
            skillName: skill.name,
            audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
            ...boon
          },
          { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
        )
      );
    }
  }
};

/** Each familiar commit action schedules its matching task so deferred settlement keeps the cast it belongs to. */
export const evokerSkillCommitLifecycle = {
  sideEffectHandlers: Object.fromEntries(
    Object.keys(evokerSkillCommitTasks).map((type) => [type, scheduleEvokerSkillCommit])
  ),
  tasks: evokerSkillCommitTasks
} satisfies RuntimeHooks<ElementalistRuntimeState, ElementalistSkill>;

/** Release each deferred grant after the familiar reset, then run the final familiar trait observer. */
export function finishEvokerCast(context: ElementalistRuntime, cast: RuntimeCast<ElementalistSkill>): void {
  const state = evokerState.from(context);

  if (state.activeFamiliarCast?.reservationId === cast.id) {
    flushPendingWeaponChargeGains(context, state);
    state.activeFamiliarCast = null;
  }

  context.fireTrigger(familiarSettled, { cast });
}

/**
 * Shared completion observers settle pending weapon grants and familiar traits
 * before the skill-declared resource reset and final observer tasks run.
 */
export function onCastCommit(context: ElementalistRuntime, cast: RuntimeCast<ElementalistSkill>, skill: Skill): void {
  const state = evokerState.from(context);
  // A settled grant cannot fund another retry or be awarded again after a familiar spends it.
  state.pendingWeaponCompletions = state.pendingWeaponCompletions.filter((entry) => entry.activationId !== cast.id);
  grantWeaponSkillCharges(context, cast, skill, state);
  context.fireTrigger(evokerCastCompleted, { cast });
}
