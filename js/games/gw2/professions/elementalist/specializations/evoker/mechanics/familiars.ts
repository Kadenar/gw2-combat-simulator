import type { RuntimeCast, SkillTaskData } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';
import type { ActionContext, SideEffectAction } from '#gw2/platform/effects/actions.js';
import { applySpecializedElementsTrait } from '#gw2/professions/elementalist/specializations/evoker/traits/attunement-policy.js';
import { applyFamiliarTraitProcs } from '#gw2/professions/elementalist/specializations/evoker/traits/familiars.js';
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
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { GW2_QUICKNESS_ACTION_RATE, castRelativeEffectTimingScale } from '#gw2/platform/execution/cast-timing.js';
import { elementalistBuffRequest } from '#gw2/professions/elementalist/core/events.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { grantElectricEnchantments } from '#gw2/professions/elementalist/specializations/evoker/mechanics/electric-enchantment.js';
import { settleBasicFamiliar } from '#gw2/professions/elementalist/specializations/evoker/skills/familiar-skills.js';
import {
  emitResource,
  flushPendingWeaponChargeGains,
  grantWeaponSkillCharges,
  weaponSkillChargeGain
} from '#gw2/professions/elementalist/specializations/evoker/mechanics/resources.js';
import { EVOKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/evoker/mechanics/constants.js';
import { evokerState } from '#gw2/professions/elementalist/specializations/evoker/state.js';
import { elementalProcessionEffects } from '#gw2/professions/elementalist/specializations/evoker/mechanics/familiar-projection.js';
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
          actorType: 'player',
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
export function scheduleEvokerSkillCommit(
  context: ElementalistRuntime,
  trigger: ActionContext<ElementalistSkill>,
  action: SideEffectAction
): void {
  if (trigger.kind !== 'cast') throw new TypeError('Evoker skill completion requires a cast trigger.');
  context.scheduleForCast(action.type, context.time, trigger.cast, {}, undefined, -101);
}

export const evokerSkillCommitTasks: NonNullable<
  RuntimeProfession<ElementalistRuntimeState, ElementalistSkill>['tasks']
> = {
  'elementalist.evoker.lightning-blitz'(context, data) {
    const { cast } = data as SkillTaskData<ElementalistSkill>;
    const skill = cast.skill;
    const at = cast.effectiveEnd;
    {
      const profile = requireBalanceProfileFromContext(context, PROFILE.lightningBlitz);
      const stacks = balanceProfileNumber(profile, 'resourceGain');
      const enchantment = requireEffect(profile, 'buff', 'Lightning Blitz Enchantment');
      if (enchantment) {
        grantElectricEnchantments(context, { at, stacks, duration: enchantment.duration, skill, procType: 'skill' });
      }
    }
  },
  'elementalist.evoker.zap'(context, data) {
    const { cast } = data as SkillTaskData<ElementalistSkill>;
    const skill = cast.skill;
    const at = cast.effectiveEnd;
    {
      const profile = requireBalanceProfileFromContext(context, PROFILE.zap);
      const zap = requireEffect(profile, 'buff', 'Zap Window');
      if (zap) {
        context.effects.emit(
          elementalistBuffRequest(
            {
              at,
              source: skill.name,
              sourceId: skill.id,
              actorType: 'player',
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
    {
      context.resourceController.replace('empoweredCharges', 0);
      emitResource(context, cast, skill, state);
    }
  },
  'elementalist.evoker.rejuvenate'(context, data) {
    const { cast } = data as SkillTaskData<ElementalistSkill>;
    const skill = cast.skill;
    const state = evokerState.from(context);
    {
      context.resourceController.grant('familiarCharges', state.familiarCharges.maximum);
      emitResource(context, cast, skill, state);
    }
  },
  'elementalist.evoker.hares-agility'(context, data) {
    const { cast } = data as SkillTaskData<ElementalistSkill>;
    const skill = cast.skill;
    const at = cast.effectiveEnd;
    {
      const profile = requireBalanceProfileFromContext(context, PROFILE.haresAgility);
      const stacks = balanceProfileNumber(profile, 'playerStacks');
      const enchantment = requireEffect(profile, 'buff', 'Hare Enchantment');
      if (enchantment) {
        grantElectricEnchantments(context, { at, stacks, duration: enchantment.duration, skill, procType: 'skill' });
      }
    }
  },
  'elementalist.evoker.toads-fortitude'(context, data) {
    const { cast } = data as SkillTaskData<ElementalistSkill>;
    const skill = cast.skill;
    const at = cast.effectiveEnd;
    {
      const profile = requireBalanceProfileFromContext(context, PROFILE.toadsFortitude);
      const resistance = requireEffect(profile, 'boon', 'Toad Resistance');
      if (resistance) {
        context.effects.emit(
          elementalistBuffRequest(
            {
              skill: skill,
              at,
              source: skill.name,
              sourceId: skill.id,
              actorType: 'player',
              kind: String(resistance.boon).toLowerCase(),
              stacks: Number(resistance.stacks),
              duration: resistance.duration,
              skillName: skill.name
            },
            { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
          )
        );
      }
    }
  },
  'elementalist.evoker.foxs-fury'(context, data) {
    const { cast } = data as SkillTaskData<ElementalistSkill>;
    const skill = cast.skill;
    const state = evokerState.from(context);
    const at = cast.effectiveEnd;
    {
      const profile = requireBalanceProfileFromContext(context, PROFILE.foxsFury);
      const might = requireEffect(profile, 'boon', 'Fox Might');
      const fireMight = requireEffect(profile, 'boon', 'Fox Fire Bonus');
      const fury = requireEffect(profile, 'boon', 'Fox Fury');
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
              actorType: 'player',
              skillName: skill.name,
              audience: { recipients: 'party' as const, maximumRecipients: 5 },
              ...boon
            },
            { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
          )
        );
      }
    }
  }
};
/** Release each deferred grant after the familiar reset, then run the final familiar trait observer. */
export function finishEvokerCast(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: Skill
): void {
  const state = evokerState.from(context);
  if (state.activeFamiliarCast?.reservationId === cast.id) {
    flushPendingWeaponChargeGains(context, state);
    state.activeFamiliarCast = null;
  }

  applySpecializedElementsTrait(context, cast, skill);
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
  applyFamiliarTraitProcs(context, cast, skill);
}
