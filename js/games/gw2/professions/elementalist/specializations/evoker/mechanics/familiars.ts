import type { ActionContext, SideEffectAction } from '#gw2/platform/simulation/side-effects.js';
import { withElementalistCast } from '#gw2/professions/elementalist/core/events.js';
import {
  activeElementalistBuffs,
  refreshElementalistBuffs
} from '#gw2/professions/elementalist/core/mechanics/resolution-helpers.js';
import type { SkillEffect } from '#gw2/platform/engine/skills/types.js';
import type { RuntimeCast, RuntimeProfession, SkillTaskData } from '#gw2/platform/simulation/runtime-state.js';
import { materializeSkillEffectApplications } from '#gw2/platform/engine/effects/materializer.js';
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
  requireBalanceProfileFromContext,
  balanceProfileNumber,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import {
  emitElementalistBuff,
  emitElementalistCondition,
  emitElementalistDamage
} from '#gw2/professions/elementalist/core/events.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { GW2_QUICKNESS_ACTION_RATE, castRelativeEffectTimingScale } from '#gw2/platform/skills/timing.js';
import { gw2BaseRecharge } from '#gw2/platform/engine/skills/recharge.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type { ElementalistRuntime, ElementalistRuntimeState } from '#gw2/professions/elementalist/types.js';
import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
import { emitElementalistProc, emitProfiledBuff } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import {
  BASIC_FAMILIARS,
  ELECTRIC_ENCHANTMENT_ICON,
  FAMILIAR_BASIC_BY_EMPOWERED,
  FAMILIAR_ELEMENTS,
  FAMILIAR_EMPOWERED_BY_BASIC,
  FAMILIAR_PROFILE_BY_BASIC
} from '#gw2/professions/elementalist/specializations/evoker/mechanics/constants.js';
import { triggerSpecializedElementEntry } from '#gw2/professions/elementalist/specializations/evoker/mechanics/attunements.js';
import {
  emitResource,
  flushPendingWeaponChargeGains,
  grantWeaponSkillCharges,
  weaponSkillChargeGain
} from '#gw2/professions/elementalist/specializations/evoker/mechanics/resources.js';
import { evokerState, grantElectricEnchantments } from '#gw2/professions/elementalist/specializations/evoker/state.js';
import { EVOKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/evoker/profiles.js';

// Replay all four empowered familiar effects with their native F5 strength so balance patches propagate here.
export function releaseElementalProcession(context: ElementalistRuntime, cast: RuntimeCast, sourceSkill: Skill): void {
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
export function onCastStart(context: ElementalistRuntime, cast: RuntimeCast, skill: Skill): void {
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
export function beginFamiliarCast(context: ElementalistRuntime, cast: RuntimeCast, skill: Skill): void {
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

const igniteBurningByCast = new WeakMap<RuntimeCast, SkillEffect | undefined>();

/** Capture and advance the tier once at acceptance; effect selection only reads this immutable choice. */
export function captureIgniteTier(context: ElementalistRuntime, cast: RuntimeCast): void {
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
  cast: RuntimeCast,
  effects: readonly SkillEffect[]
): readonly SkillEffect[] {
  return evokerState.from(context).cancelledFamiliarActivations[cast.id] ? [] : effects;
}

/** Ignite's definition selects Burning from its accepted tier without advancing state during a query. */
export function selectIgniteEffects(cast: RuntimeCast): readonly SkillEffect[] {
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

// refreshes the Familiar's Prowess damage buff, extending an active one rather than stacking a second
function grantFamiliarProwess(context: ElementalistRuntime, cast: RuntimeCast, skill: Skill): void {
  const at = cast.effectiveEnd;
  const familiarsProwessProfile = requireBalanceProfileFromContext(context, PROFILE.familiarsProwess);
  const baseDuration = balanceProfileNumber(familiarsProwessProfile, 'durationMultiplier');
  const extension = balanceProfileNumber(familiarsProwessProfile, 'durationPerTier');
  const maximumDuration = balanceProfileNumber(familiarsProwessProfile, 'maximumStacks');
  const current = activeElementalistBuffs(context, "familiar's-prowess", at).at(-1);
  if (current) {
    refreshElementalistBuffs(context, "familiar's-prowess", at, (expiry) =>
      Math.min(expiry + extension, at + maximumDuration)
    );
    return;
  }

  emitElementalistBuff(context, {
    at,
    source: "Familiar's Prowess",
    sourceId: skill.id,
    actorType: 'player',
    skillName: "Familiar's Prowess",
    kind: "familiar's-prowess",
    stacks: 1,
    duration: baseDuration
  });
}

// Specialized Elements removes the profiled fraction of each weapon skill's base recharge.
function applyWeaponSkillRechargeMultiplier(context: ElementalistRuntime, cast: RuntimeCast, multiplier: number): void {
  const at = cast.effectiveEnd;
  for (const candidate of context.helpers.skills) {
    if (candidate.type !== 'Weapon') continue;
    const reduction = gw2BaseRecharge(candidate) * Math.max(0, 1 - multiplier);
    context.cooldownController.reduceSkillRecharge(candidate, reduction, at);
  }
}

// Familiar completions fan out through named steps so their ordering remains visible.
function applyFamiliarTraitProcs(context: ElementalistRuntime, cast: RuntimeCast, skill: Skill): void {
  const state = evokerState.from(context);
  const at = cast.effectiveEnd;
  if (FAMILIAR_ELEMENTS.has(skill.id) && hasTrait(context, TRAIT.FAMILIARS_PROWESS)) {
    grantFamiliarProwess(context, cast, skill);
  }

  const familiarElement = FAMILIAR_ELEMENTS.get(skill.id);
  if (familiarElement && hasTrait(context, TRAIT.FAMILIARS_BLESSING)) {
    const quick = familiarElement === 'Fire' || familiarElement === 'Air';
    // Blessing stays after Prowess and before charge grants; only packet construction is shared.
    emitProfiledBuff(
      context,
      at,
      PROFILE.familiarsBlessing,
      quick ? 'Quickness' : 'Alacrity',
      "Familiar's Blessing",
      skill.id
    );
  }

  if (familiarElement && hasTrait(context, TRAIT.GALVANIC_ENCHANTMENT)) {
    const galvanicEnchantmentProfile = requireBalanceProfileFromContext(context, PROFILE.galvanicEnchantment);
    const stacks = balanceProfileNumber(galvanicEnchantmentProfile, 'playerStacks');
    const duration = balanceProfileNumber(galvanicEnchantmentProfile, 'durationMultiplier');
    grantElectricEnchantments(state, at, stacks, duration);
    emitElementalistProc(context, {
      at,
      name: 'Electric Enchantment',
      procType: 'trait',
      sourceId: skill.id,
      sourceSkill: skill.name,
      detail: `+${stacks} stacks`,
      icon: ELECTRIC_ENCHANTMENT_ICON
    });
  }
}

/** Skill-selected commit work runs after this cast's shared trait/bookkeeping hooks and before the next completion. */
export function scheduleEvokerSkillCommit(
  context: ElementalistRuntime,
  trigger: ActionContext,
  action: SideEffectAction
): void {
  if (trigger.kind !== 'cast') throw new TypeError('Evoker skill completion requires a cast trigger.');
  context.scheduleForCast(action.type, context.time, trigger.cast, {}, undefined, -101);
}

export const evokerSkillCommitTasks: NonNullable<RuntimeProfession<ElementalistRuntimeState>['tasks']> = {
  'elementalist.evoker.lightning-blitz'(context, data) {
    const { cast } = data as SkillTaskData;
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
    const { cast } = data as SkillTaskData;
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
    const { cast } = data as SkillTaskData;
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
    const { cast } = data as SkillTaskData;
    const skill = cast.skill;
    const state = evokerState.from(context);
    withElementalistCast(context, cast, () => {
      state.empowered = 0;
      emitResource(context, cast, skill, state);
    });
  },
  'elementalist.evoker.rejuvenate'(context, data) {
    const { cast } = data as SkillTaskData;
    const skill = cast.skill;
    const state = evokerState.from(context);
    withElementalistCast(context, cast, () => {
      state.charges = state.maximumCharges;
      emitResource(context, cast, skill, state);
    });
  },
  'elementalist.evoker.hares-agility'(context, data) {
    const { cast } = data as SkillTaskData;
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
    const { cast } = data as SkillTaskData;
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
    const { cast } = data as SkillTaskData;
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
export function finishEvokerCast(context: ElementalistRuntime, cast: RuntimeCast, skill: Skill): void {
  const state = evokerState.from(context);
  if (state.activeFamiliarCast?.reservationId === cast.id) {
    flushPendingWeaponChargeGains(context, state);
    state.activeFamiliarCast = null;
  }

  applySpecializedElementsTrait(context, cast, skill);
}

function applySpecializedElementsTrait(context: ElementalistRuntime, cast: RuntimeCast, skill: Skill): void {
  const familiarElement = FAMILIAR_ELEMENTS.get(skill.id);
  // Basic familiars retain 90% weapon recharge; empowered familiars retain
  // 67% and trigger the elemental entry effects.
  if (familiarElement && hasTrait(context, TRAIT.SPECIALIZED_ELEMENTS)) {
    const basic = BASIC_FAMILIARS.has(skill.id);
    applyWeaponSkillRechargeMultiplier(
      context,
      cast,
      balanceProfileNumber(
        requireBalanceProfileFromContext(
          context,
          basic ? PROFILE.specializedElementsBasicRecharge : PROFILE.specializedElementsEmpoweredRecharge
        ),
        'rechargeMultiplier'
      )
    );
    if (!basic) {
      triggerSpecializedElementEntry(context, cast, skill, familiarElement);
    }
  }
}

/**
 * Shared completion observers settle pending weapon grants and familiar traits
 * before the skill-declared resource reset and final observer tasks run.
 */
export function onCastCommit(context: ElementalistRuntime, cast: RuntimeCast, skill: Skill): void {
  const state = evokerState.from(context);
  // A settled grant cannot fund another retry or be awarded again after a familiar spends it.
  state.pendingWeaponCompletions = state.pendingWeaponCompletions.filter((entry) => entry.activationId !== cast.id);
  grantWeaponSkillCharges(context, cast, skill, state);
  applyFamiliarTraitProcs(context, cast, skill);
}
