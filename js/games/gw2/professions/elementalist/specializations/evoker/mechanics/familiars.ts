import { materializeSkillEffectApplications } from '#gw2/platform/engine/effects/materializer.js';
import type { SkillEffect } from '#gw2/platform/engine/skills/types.js';
import type { RuntimeCast, RuntimeProfession, SkillTaskData } from '#gw2/platform/simulation/runtime-state.js';
import type { ActionContext, SideEffectAction } from '#gw2/platform/simulation/side-effects.js';
import { withElementalistCast } from '#gw2/professions/elementalist/core/events.js';
import { applySpecializedElementsTrait } from '#gw2/professions/elementalist/specializations/evoker/traits/attunements.js';
import { applyFamiliarTraitProcs } from '#gw2/professions/elementalist/specializations/evoker/traits/familiars.js';
/**
 * Familiar cast lifecycle - the heart of the Evoker specialization.
 *
 * A basic familiar spends the whole charge bar and adds an empowered stack; at
 * three stacks its empowered flip form becomes castable and spends them back to
 * zero. This module drives that cycle across the cast-start, after-cast, and
 * cast-complete phases, including flip-interrupt cancellation, Ignite tiering,
 * the familiar traits (Prowess, Blessing, Galvanic Enchantment, Specialized
 * Elements), and the Evoker meditation payloads.
 */
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import { GW2_QUICKNESS_ACTION_RATE, castRelativeEffectTimingScale } from '#gw2/platform/skills/timing.js';
import {
  emitElementalistBuff,
  emitElementalistCondition,
  emitElementalistDamage
} from '#gw2/professions/elementalist/core/events.js';
import { emitElementalistProc } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import {
  BASIC_FAMILIARS,
  ELECTRIC_ENCHANTMENT_ICON,
  FAMILIAR_BASIC_BY_EMPOWERED,
  FAMILIAR_ELEMENTS,
  FAMILIAR_EMPOWERED_BY_BASIC,
  FAMILIAR_PROFILE_BY_BASIC
} from '#gw2/professions/elementalist/specializations/evoker/mechanics/constants.js';
import {
  emitResource,
  flushPendingWeaponChargeGains,
  grantWeaponSkillCharges,
  weaponSkillChargeGain
} from '#gw2/professions/elementalist/specializations/evoker/mechanics/resources.js';
import { EVOKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/evoker/profiles.js';
import { evokerState, grantElectricEnchantments } from '#gw2/professions/elementalist/specializations/evoker/state.js';
import type {
  ElementalistSkill,
  ElementalistRuntime,
  ElementalistRuntimeState
} from '#gw2/professions/elementalist/types.js';

// Replay all four empowered familiar effects with their native F5 strength so balance patches propagate here.
export function releaseElementalProcession(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  sourceSkill: Skill
): void {
  for (const skillId of [ID.CONFLAGRATION, ID.BUOYANT_DELUGE, ID.LIGHTNING_BLITZ, ID.SEISMIC_IMPACT]) {
    const familiar = context.helpers.skillsById.get(skillId);
    if (!familiar) continue;
    for (const effect of familiar.effects || []) {
      if (!['strike', 'condition', 'control', 'blind'].includes(effect.type)) continue;
      // Procession preserves the familiar's unquickened timing and each surviving packet's representation.
      const runtimeCastMs = Math.max(0, (familiar.castTimeMs || 0) * GW2_QUICKNESS_ACTION_RATE);
      const scale = effect.timingScale === 'cast' ? castRelativeEffectTimingScale(familiar, runtimeCastMs) : 1;
      for (const application of materializeSkillEffectApplications({
        skill: familiar,
        effect,
        start: 0,
        fullEnd: 0,
        baseEvent: { source: familiar.name, sourceId: familiar.id, actorType: 'player', triggeredBy: sourceSkill.name }
      })) {
        const { event } = application;
        const at = cast.effectiveEnd + application.at * scale;
        if (event.type === 'damage')
          emitElementalistDamage(context, {
            ...event,
            at,
            coefficient: Number(event.coefficient),
            skillId: familiar.id,
            skillName: familiar.name,
            skillWeapon: 'Profession mechanic'
          });
        else if (event.type === 'condition')
          emitElementalistCondition(context, {
            ...event,
            at,
            skillId: familiar.id,
            skillName: familiar.name,
            condition: String(event.condition),
            stacks: Number(event.stacks),
            duration: Number(event.duration)
          });
        else context.emit({ ...event, at, skillId: familiar.id, skillName: familiar.name });
      }
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
    const postFamiliarGain = gain > 0 ? gain : skill.id === ID.REJUVENATE ? state.maximumCharges : 0;
    if (postFamiliarGain > 0)
      state.pendingWeaponCompletions.push({ activationId: cast.id, at: cast.effectiveEnd, gain: postFamiliarGain });
  }
}

/** A skill-declared start owns its reservation and the basic/empowered replacement window. */
export function beginFamiliarCast(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: Skill
): void {
  const state = evokerState.from(context);
  const familiarElement = FAMILIAR_ELEMENTS.get(skill.id);
  // familiar casts block every other action until they finish (enforced in availability.ts)
  if (familiarElement) {
    state.activeFamiliarCast = {
      reservationId: cast.id,
      endsAt: cast.effectiveEnd,
      resetsCharges: BASIC_FAMILIARS.has(skill.id)
    };
  }

  // if the empowered familiar was recently cast and the basic fires within the window, the empowered effects are retroactively cancelled
  const empoweredSkill = FAMILIAR_EMPOWERED_BY_BASIC.get(skill.id);
  if (empoweredSkill) {
    const window = balanceProfileNumber(
      requireBalanceProfileFromContext(context, FAMILIAR_PROFILE_BY_BASIC.get(skill.id) ?? skill.id),
      'durationMultiplier'
    );
    const basicKey = String(skill.id);
    const recent = state.lastEmpoweredFamiliarByBasic[basicKey];
    if (recent?.skillId === empoweredSkill && cast.start - recent.start < window) {
      context.cancelOwner({ id: recent.activationId, generation: 0 });
      state.cancelledFamiliarActivations[cast.id] = true;
      state.lastEmpoweredFamiliarByBasic[basicKey] = null;
    }
  }

  const basic = FAMILIAR_BASIC_BY_EMPOWERED.get(skill.id);
  if (basic) {
    state.lastEmpoweredFamiliarByBasic[String(basic)] = {
      skillId: skill.id,
      activationId: cast.id,
      start: cast.start
    };
  }
}

const igniteBurningByCast = new WeakMap<RuntimeCast<ElementalistSkill>, SkillEffect | undefined>();

/** Capture and advance the tier once at acceptance; effect selection only reads this immutable choice. */
export function captureIgniteTier(context: ElementalistRuntime, cast: RuntimeCast<ElementalistSkill>): void {
  const state = evokerState.from(context);
  if (state.cancelledFamiliarActivations[cast.id]) return;
  const profile = requireBalanceProfileFromContext(context, PROFILE.ignite);
  if (cast.start - state.igniteLastUsedAt >= balanceProfileNumber(profile, 'threshold')) state.igniteTier = 0;
  igniteBurningByCast.set(
    cast,
    requireEffect(profile, 'condition', ['Tier 1', 'Tier 2', 'Tier 3', 'Tier 4'][state.igniteTier])
  );
  state.igniteTier = Math.min(state.igniteTier + 1, 3);
  state.igniteLastUsedAt = cast.start;
}

/** Replacement cancellation remains shared across familiar packets, independent of their selected payload. */
export function modifyFamiliarEffects(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  effects: readonly SkillEffect[]
): readonly SkillEffect[] {
  return evokerState.from(context).cancelledFamiliarActivations[cast.id] ? [] : effects;
}

/** Ignite's definition selects Burning from its accepted tier without advancing state during a query. */
export function selectIgniteEffects(cast: RuntimeCast<ElementalistSkill>): readonly SkillEffect[] {
  const burning = igniteBurningByCast.get(cast);
  const effects = cast.skill.effects ?? [];
  return effects.flatMap<SkillEffect>((effect) => {
    if (effect.type !== 'condition') return [effect];
    if (effect.ticks)
      return [
        {
          ...effect,
          ticks: effect.ticks.flatMap((tick) =>
            tick.condition !== 'Burning' ? [tick] : burning ? [{ ...tick, duration: Number(burning.duration) }] : []
          )
        }
      ];
    return effect.condition !== 'Burning'
      ? [effect]
      : burning
        ? [{ ...effect, duration: Number(burning.duration) }]
        : [];
  });
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
    const state = evokerState.from(context);
    const at = cast.effectiveEnd;
    withElementalistCast(context, cast, () => {
      const familiarUtilityProfile = requireBalanceProfileFromContext(context, PROFILE.familiarUtility);
      const stacks = balanceProfileNumber(familiarUtilityProfile, 'resourceGain');
      const enchantment = requireEffect(familiarUtilityProfile, 'buff', 'Lightning Blitz Enchantment');
      if (enchantment) {
        grantElectricEnchantments(state, at, stacks, enchantment.duration);

        emitElementalistProc(context, {
          at,
          name: 'Electric Enchantment',
          procType: 'skill',
          sourceId: skill.id,
          sourceSkill: skill.name,
          detail: `+${stacks} ${stacks === 1 ? 'stack' : 'stacks'}`,
          icon: ELECTRIC_ENCHANTMENT_ICON
        });
      }
    });
  },
  'elementalist.evoker.zap'(context, data) {
    const { cast } = data as SkillTaskData<ElementalistSkill>;
    const skill = cast.skill;
    const at = cast.effectiveEnd;
    withElementalistCast(context, cast, () => {
      const familiarUtilityProfile = requireBalanceProfileFromContext(context, PROFILE.familiarUtility);
      const zap = requireEffect(familiarUtilityProfile, 'buff', 'Zap Window');
      if (zap) {
        emitElementalistBuff(context, {
          at,
          source: skill.name,
          sourceId: skill.id,
          actorType: 'player',
          skillName: skill.name,
          kind: 'zap buff',
          stacks: Number(zap.stacks),
          duration: zap.duration
        });
      }
    });
  },
  'elementalist.evoker.settle-basic-familiar'(context, data) {
    const { cast } = data as SkillTaskData<ElementalistSkill>;
    const skill = cast.skill;
    const state = evokerState.from(context);
    const at = cast.effectiveEnd;
    withElementalistCast(context, cast, () => {
      state.charges = 0;
      const resourcesProfile = requireBalanceProfileFromContext(context, PROFILE.resources);
      state.empowered = Math.min(balanceProfileNumber(resourcesProfile, 'minimumStacks'), state.empowered + 1);
      const flip = FAMILIAR_EMPOWERED_BY_BASIC.get(skill.id);
      const empowered = flip ? context.helpers.skillsById.get(flip) : undefined;
      if (flip && empowered) {
        const delay = balanceProfileNumber(
          requireBalanceProfileFromContext(context, FAMILIAR_PROFILE_BY_BASIC.get(skill.id) ?? skill.id),
          'initialDelay'
        );
        context.cooldownController.setReadyAt(
          empowered.id,
          Math.max(context.cooldowns.get(empowered.id) || 0, at + delay)
        );
      }

      emitResource(context, cast, skill, state);
    });
  },
  'elementalist.evoker.settle-empowered-familiar'(context, data) {
    const { cast } = data as SkillTaskData<ElementalistSkill>;
    const skill = cast.skill;
    const state = evokerState.from(context);
    withElementalistCast(context, cast, () => {
      state.empowered = 0;
      emitResource(context, cast, skill, state);
    });
  },
  'elementalist.evoker.rejuvenate'(context, data) {
    const { cast } = data as SkillTaskData<ElementalistSkill>;
    const skill = cast.skill;
    const state = evokerState.from(context);
    withElementalistCast(context, cast, () => {
      state.charges = state.maximumCharges;
      emitResource(context, cast, skill, state);
    });
  },
  'elementalist.evoker.hares-agility'(context, data) {
    const { cast } = data as SkillTaskData<ElementalistSkill>;
    const skill = cast.skill;
    const state = evokerState.from(context);
    const at = cast.effectiveEnd;
    withElementalistCast(context, cast, () => {
      const familiarUtilityProfile = requireBalanceProfileFromContext(context, PROFILE.familiarUtility);
      const stacks = balanceProfileNumber(familiarUtilityProfile, 'playerStacks');
      const enchantment = requireEffect(familiarUtilityProfile, 'buff', 'Hare Enchantment');
      if (enchantment) {
        grantElectricEnchantments(state, at, stacks, enchantment.duration);

        emitElementalistProc(context, {
          at,
          name: 'Electric Enchantment',
          procType: 'skill',
          sourceId: skill.id,
          sourceSkill: skill.name,
          detail: `+${stacks} stacks`,
          icon: ELECTRIC_ENCHANTMENT_ICON
        });
      }
    });
  },
  'elementalist.evoker.toads-fortitude'(context, data) {
    const { cast } = data as SkillTaskData<ElementalistSkill>;
    const skill = cast.skill;
    const at = cast.effectiveEnd;
    withElementalistCast(context, cast, () => {
      const familiarUtilityProfile = requireBalanceProfileFromContext(context, PROFILE.familiarUtility);
      const resistance = requireEffect(familiarUtilityProfile, 'boon', 'Toad Resistance');
      if (resistance) {
        emitElementalistBuff(context, {
          skill: skill,
          at,
          source: skill.name,
          sourceId: skill.id,
          actorType: 'player',
          kind: String(resistance.boon).toLowerCase(),
          stacks: Number(resistance.stacks),
          duration: resistance.duration,
          skillName: skill.name
        });
      }
    });
  },
  'elementalist.evoker.foxs-fury'(context, data) {
    const { cast } = data as SkillTaskData<ElementalistSkill>;
    const skill = cast.skill;
    const state = evokerState.from(context);
    const at = cast.effectiveEnd;
    withElementalistCast(context, cast, () => {
      const familiarUtilityProfile = requireBalanceProfileFromContext(context, PROFILE.familiarUtility);
      const might = requireEffect(familiarUtilityProfile, 'boon', 'Fox Might');
      const fireMight = requireEffect(familiarUtilityProfile, 'boon', 'Fox Fire Bonus');
      const fury = requireEffect(familiarUtilityProfile, 'boon', 'Fox Fury');
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
        emitElementalistBuff(context, {
          skill: skill,
          at,
          source: skill.name,
          sourceId: skill.id,
          actorType: 'player',
          skillName: skill.name,
          audience: { recipients: 'party' as const, maximumRecipients: 5 },
          ...boon
        });
      }
    });
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
