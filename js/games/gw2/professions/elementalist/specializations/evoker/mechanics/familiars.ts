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
  balanceProfileEffectFromContext,
  balanceProfileValue,
  balanceProfileValueFromContext
} from '#gw2/platform/combat/state/balance-profiles.js';
import { emitSkillBuff, emitSkillCondition, emitSkillDamage } from '#gw2/platform/scheduler/skill-events.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { castRelativeEffectTimingScale } from '#gw2/platform/skills/timing.js';
import type { SchedulerRecord } from '#gw2/platform/engine/execution/types.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type { ElementalistCastContext, ElementalistSchedulerContext } from '#gw2/professions/elementalist/types.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { emitElementalistProc } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import {
  BASIC_FAMILIARS,
  ELECTRIC_ENCHANTMENT_ICON,
  FAMILIAR_BASIC_BY_EMPOWERED,
  FAMILIAR_ELEMENTS,
  FAMILIAR_FLIP_DELAYS,
  FAMILIAR_INTERRUPT_WINDOWS,
  FAMILIAR_PROFILE_BY_BASIC
} from '#gw2/professions/elementalist/specializations/evoker/mechanics/constants.js';
import {
  completeEvokerAttunement,
  triggerSpecializedElementEntry
} from '#gw2/professions/elementalist/specializations/evoker/mechanics/attunements.js';
import { materializeArmedElectricEnchantments } from '#gw2/professions/elementalist/specializations/evoker/mechanics/enchantments.js';
import {
  emitResource,
  flushPendingWeaponChargeGains,
  grantWeaponSkillCharges,
  weaponSkillChargeGain
} from '#gw2/professions/elementalist/specializations/evoker/mechanics/resources.js';
import { evokerState } from '#gw2/professions/elementalist/specializations/evoker/state.js';
import { EVOKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/evoker/profiles.js';

// reads effects directly from the catalog so balance patches to those skills propagate without code changes
function releaseElementalProcession(context: ElementalistCastContext, sourceSkill: Skill): void {
  for (const skillId of [ID.CONFLAGRATION, ID.LIGHTNING_BLITZ, ID.SEISMIC_IMPACT]) {
    const familiar = context.catalog.skillsById.get(skillId);
    if (!familiar) continue;
    for (const rawEffect of familiar.effects || []) {
      const effect = rawEffect as SchedulerRecord;
      // Procession launches an independent familiar sequence rather than a
      // player cast, so its packets retain their unquickened runtime spacing.
      const runtimeCastMs = Math.max(0, Number(familiar.castTimeMs || 0));
      const timingScale = effect.timingScale === 'cast' ? castRelativeEffectTimingScale(familiar, runtimeCastMs) : 1;
      const ticks = Array.isArray(effect.ticks) ? effect.ticks : [effect];
      for (const rawTick of ticks) {
        const tick = rawTick as SchedulerRecord;
        const at = context.effectiveEnd + (Number(tick.atMs ?? effect.atMs ?? 0) * timingScale) / 1_000;
        const comboFinishers = tick.comboFinishers || effect.comboFinishers;
        if (effect.type === 'strike') {
          emitSkillDamage(context, {
            at,
            source: familiar.name,
            sourceId: familiar.id,
            actorType: 'player',
            skillName: familiar.name,
            skillId: familiar.id,
            coefficient: Number(tick.coefficient ?? effect.coefficient ?? 0),
            skillWeapon: 'Unequipped',
            canCrit: effect.canCrit !== false,
            comboFinishers,
            triggeredBy: sourceSkill.name
          });
        } else if (effect.type === 'condition') {
          emitSkillCondition(context, {
            at,
            source: familiar.name,
            sourceId: familiar.id,
            actorType: 'player',
            skillName: familiar.name,
            skillId: familiar.id,
            condition: String(tick.condition || effect.condition || ''),
            stacks: Number(tick.stacks ?? effect.stacks ?? 1),
            duration: Number(tick.duration ?? effect.duration ?? 0),
            triggeredBy: sourceSkill.name
          });
        } else if (effect.type === 'control' || effect.type === 'blind') {
          context.emit({
            type: String(effect.type),
            at,
            source: familiar.name,
            sourceId: familiar.id,
            actorType: 'player',
            skillName: familiar.name,
            skillId: familiar.id,
            controlKind: tick.controlKind ?? effect.controlKind,
            comboFinishers,
            triggeredBy: sourceSkill.name
          });
        }
      }
    }
  }
}

function cancelActivationEffects(context: ElementalistSchedulerContext, activationId: string, from: number): void {
  // replaces to "marker" rather than deleting to keep the event sequence stable for downstream processing
  for (const event of [...context.events]) {
    if (event.activationId === activationId && event.at >= from && event.type !== 'action') {
      context.replaceEvent(event, {
        type: 'marker',
        cancelled: true,
        detail: 'cancelled by familiar flip interaction'
      });
    }
  }
}

/**
 * Pre-cast bookkeeping: records the charge grant this command will produce,
 * marks a starting familiar cast as active, and applies the flip-interrupt rule
 * when a basic familiar cuts its own empowered form short.
 */
export function onCastStart(context: ElementalistCastContext, skill: Skill): void {
  const state = evokerState.from(context);
  const familiarElement = FAMILIAR_ELEMENTS.get(skill.id);
  // non-concurrent commands anchor their own charge grant so a concurrent familiar can adopt it below
  if (context.command.concurrentOffsetMs == null) {
    const gain = weaponSkillChargeGain(context, skill, state);
    const postFamiliarGain = gain > 0 ? gain : skill.id === ID.REJUVENATE ? state.maximumCharges : 0;
    state.concurrentParentAnchors.push({
      commandIndex: context.commandIndex,
      weaponChargeGain:
        postFamiliarGain > 0
          ? {
              activationId: context.reservationId,
              at: context.effectiveEnd,
              source: skill.name,
              sourceId: skill.id,
              gain: postFamiliarGain
            }
          : null
    });
  }

  // familiar casts block every other action until they finish (enforced in availability.ts)
  if (familiarElement) {
    const concurrentParent =
      context.command.concurrentOffsetMs != null
        ? state.concurrentParentAnchors
            .filter((entry) => entry.commandIndex < context.commandIndex)
            .sort((left, right) => right.commandIndex - left.commandIndex)[0]
        : null;
    // steal the parent command's charge grant so it doesn't reset before the basic familiar resets charges
    if (
      BASIC_FAMILIARS.has(skill.id) &&
      concurrentParent?.weaponChargeGain &&
      concurrentParent.weaponChargeGain.at <= context.start + context.epsilon
    ) {
      state.pendingWeaponChargeGains.push(concurrentParent.weaponChargeGain);
      concurrentParent.weaponChargeGain = null;
    }

    state.activeFamiliarCast = {
      reservationId: context.reservationId,
      endsAt: context.effectiveEnd,
      resetsCharges: BASIC_FAMILIARS.has(skill.id)
    };
  }

  // if the empowered familiar was recently cast and the basic fires within the window, the empowered effects are retroactively cancelled
  const interrupt = FAMILIAR_INTERRUPT_WINDOWS.get(skill.id);
  if (interrupt) {
    const [empoweredSkill, fallbackWindow] = interrupt;
    const window = balanceProfileValueFromContext(
      context,
      FAMILIAR_PROFILE_BY_BASIC.get(skill.id) ?? skill.id,
      'durationMultiplier',
      fallbackWindow
    );
    const basicKey = String(skill.id);
    const recent = state.lastEmpoweredFamiliarByBasic[basicKey];
    if (recent?.skillId === empoweredSkill && context.start - recent.start < window) {
      cancelActivationEffects(context, recent.activationId, context.start);
      state.cancelledFamiliarActivations[context.reservationId] = true;
      state.lastEmpoweredFamiliarByBasic[basicKey] = null;
    }
  }

  const basic = FAMILIAR_BASIC_BY_EMPOWERED.get(skill.id);
  if (basic) {
    state.lastEmpoweredFamiliarByBasic[String(basic)] = {
      skillId: skill.id,
      activationId: context.reservationId,
      start: context.start
    };
  }
}

/**
 * Post-scheduling adjustments to a cast's own events: drops them all when the
 * activation was flip-interrupted, rewrites Ignite's burning duration for its
 * current tier, and emits Fox's Fury's might-scaled bonus payload.
 */
export function afterCast(context: ElementalistCastContext, skill: Skill): void {
  const state = evokerState.from(context);
  if (state.cancelledFamiliarActivations[context.reservationId]) {
    cancelActivationEffects(context, context.reservationId, context.start);
    delete state.cancelledFamiliarActivations[context.reservationId];
    return;
  }

  if (skill.id === ID.IGNITE) {
    // tier resets if unused for 15s; cycling through 4 tiers gives a short pulse on tier 1 to front-load damage
    if (
      context.start - state.igniteLastUsedAt >=
      balanceProfileValueFromContext(context, PROFILE.ignite, 'threshold', 15)
    ) {
      state.igniteTier = 0;
    }

    const durations = [2, 0.5, 1, 1.5];
    for (const event of context.events) {
      if (event.activationId === context.reservationId && event.type === 'condition' && event.condition === 'Burning') {
        context.replaceEvent(event, {
          duration: balanceProfileValue(
            balanceProfileEffectFromContext(context, PROFILE.ignite, 'condition', 0, `Tier ${state.igniteTier + 1}`),
            'duration',
            durations[state.igniteTier]
          )
        });
      }
    }

    state.igniteTier = (state.igniteTier + 1) % durations.length;
    state.igniteLastUsedAt = context.start;
  }

  // Fox's Fury picks one of three tiers from the might stacks held at cast start
  if (skill.id === ID.FOXS_FURY) {
    const might = context.buffStacks('might', context.start);
    const threshold = balanceProfileValueFromContext(context, PROFILE.foxsFury, 'threshold', 10);
    const tier = might >= threshold * 2 ? 2 : might >= threshold ? 1 : 0;
    const effectName = `Tier ${tier + 1}`;
    const strike = balanceProfileEffectFromContext(context, PROFILE.foxsFury, 'strike', 0, effectName);
    const burning = balanceProfileEffectFromContext(context, PROFILE.foxsFury, 'condition', 0, effectName);
    const at =
      context.start +
      balanceProfileValueFromContext(context, PROFILE.foxsFury, 'initialDelay', 0.56) /
        (context.hasBuff('quickness', context.start) ? 1.5 : 1);
    emitSkillDamage(context, {
      at,
      source: skill.name,
      sourceId: skill.id,
      actorType: 'player',
      skillName: skill.name,
      skillId: skill.id,
      coefficient: Number(strike?.coefficient ?? [1.5, 2.25, 3][tier]),
      skillWeapon: 'Unequipped'
    });
    emitSkillCondition(context, {
      at,
      source: skill.name,
      sourceId: skill.id,
      actorType: 'player',
      skillName: skill.name,
      skillId: skill.id,
      condition: String(burning?.condition || 'Burning'),
      stacks: Number(burning?.stacks ?? [1, 2, 3][tier]),
      duration: Number(burning?.duration ?? [3, 5, 7][tier])
    });
  }
}

// refreshes the Familiar's Prowess damage buff, extending an active one rather than stacking a second
function grantFamiliarProwess(context: ElementalistCastContext, skill: Skill): void {
  const at = context.effectiveEnd;
  const baseDuration = balanceProfileValueFromContext(context, PROFILE.familiarsProwess, 'durationMultiplier', 5);
  const extension = balanceProfileValueFromContext(context, PROFILE.familiarsProwess, 'durationPerTier', 5);
  const maximumDuration = balanceProfileValueFromContext(context, PROFILE.familiarsProwess, 'maximumStacks', 15);
  const current = context.events
    .filter(
      (event) =>
        event.type === 'buff' &&
        event.kind === "familiar's-prowess" &&
        event.at <= at &&
        event.at + Number(event.duration || 0) > at
    )
    .at(-1);
  // extend existing buff expiry rather than stacking a new one; hard cap is maximumDuration from now
  if (current) {
    const expiry = current.at + Number(current.duration || 0);
    context.replaceEvent(current, {
      duration: Math.min(expiry + extension, at + maximumDuration) - current.at
    });
    return;
  }

  emitSkillBuff(context, {
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

// Specialized Elements: shortens every weapon skill's remaining recharge by the given multiplier
function applyWeaponSkillRechargeMultiplier(context: ElementalistCastContext, multiplier: number): void {
  const at = context.effectiveEnd;
  for (const candidate of context.catalog.skills) {
    if (candidate.type !== 'Weapon') continue;
    const rechargeDuration = context.rechargeDurationFor(candidate, at);
    const reduction = rechargeDuration * Math.max(0, 1 - multiplier);
    context.cooldownController.reduceSkillRecharge(candidate, reduction, at);
  }
}

// Familiar completions fan out through named steps so their ordering remains visible.
function applyFamiliarTraitProcs(context: ElementalistCastContext, skill: Skill): void {
  const state = evokerState.from(context);
  const at = context.effectiveEnd;
  if (FAMILIAR_ELEMENTS.has(skill.id) && hasTrait(context, "Familiar's Prowess")) {
    grantFamiliarProwess(context, skill);
  }

  const familiarElement = FAMILIAR_ELEMENTS.get(skill.id);
  if (familiarElement && hasTrait(context, "Familiar's Blessing")) {
    const quick = familiarElement === 'Fire' || familiarElement === 'Air';
    const blessing = balanceProfileEffectFromContext(
      context,
      PROFILE.familiarsBlessing,
      'boon',
      0,
      quick ? 'Quickness' : 'Alacrity'
    );
    emitSkillBuff(context, skill, {
      at,
      source: "Familiar's Blessing",
      sourceId: skill.id,
      actorType: 'player',
      kind: String(blessing?.boon || (quick ? 'Quickness' : 'Alacrity')).toLowerCase(),
      stacks: Number(blessing?.stacks ?? 1),
      duration: Number(blessing?.duration ?? (quick ? 1.75 : 4)),
      skillName: "Familiar's Blessing"
    });
  }

  if (familiarElement && hasTrait(context, 'Galvanic Enchantment')) {
    const stacks = balanceProfileValueFromContext(context, PROFILE.galvanicEnchantment, 'playerStacks', 2);
    state.electricEnchantmentStacks += stacks;
    emitElementalistProc(context as never, {
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

function applyFamiliarSkillEffects(context: ElementalistCastContext, skill: Skill): void {
  const state = evokerState.from(context);
  const at = context.effectiveEnd;
  const familiarElement = FAMILIAR_ELEMENTS.get(skill.id);
  if (skill.id === ID.LIGHTNING_BLITZ) {
    const stacks = balanceProfileValueFromContext(context, PROFILE.familiarUtility, 'resourceGain', 1);
    state.electricEnchantmentStacks += stacks;
    emitElementalistProc(context as never, {
      at,
      name: 'Electric Enchantment',
      procType: 'skill',
      sourceId: skill.id,
      sourceSkill: skill.name,
      detail: `+${stacks} ${stacks === 1 ? 'stack' : 'stacks'}`,
      icon: ELECTRIC_ENCHANTMENT_ICON
    });
  }

  if (familiarElement) {
    materializeArmedElectricEnchantments(context, state);
  }

  if (skill.id === ID.ZAP) {
    const zap = balanceProfileEffectFromContext(context, PROFILE.familiarUtility, 'buff', 0, 'Zap Window');
    emitSkillBuff(context, {
      at,
      source: skill.name,
      sourceId: skill.id,
      actorType: 'player',
      skillName: skill.name,
      kind: 'zap buff',
      stacks: Number(zap?.stacks ?? 1),
      duration: Number(zap?.duration ?? 5)
    });
  }
}

function settleFamiliarChargeState(context: ElementalistCastContext, skill: Skill): void {
  const state = evokerState.from(context);
  const at = context.effectiveEnd;
  // charge state machine: a basic familiar spends the whole bar and adds an
  // empowered stack (arming its flip skill after the profile delay), the empowered
  // form spends the stacks back to zero, and Rejuvenate refills the bar outright
  if (BASIC_FAMILIARS.has(skill.id)) {
    state.charges = 0;
    state.empowered = Math.min(
      balanceProfileValueFromContext(context, PROFILE.resources, 'minimumStacks', 3),
      state.empowered + 1
    );
    const flip = FAMILIAR_FLIP_DELAYS.get(skill.id);
    const empowered = flip ? context.catalog.skillsById.get(flip[0]) : undefined;
    if (flip && empowered) {
      const delay = balanceProfileValueFromContext(
        context,
        FAMILIAR_PROFILE_BY_BASIC.get(skill.id) ?? skill.id,
        'initialDelay',
        flip[1]
      );
      context.state.cooldowns.set(
        empowered.id,
        Math.max(Number(context.state.cooldowns.get(empowered.id) || 0), at + delay)
      );
    }

    emitResource(context, skill, state);
  } else if (FAMILIAR_ELEMENTS.has(skill.id)) {
    state.empowered = 0;
    emitResource(context, skill, state);
  } else if (skill.id === ID.REJUVENATE) {
    state.charges = state.maximumCharges;
    emitResource(context, skill, state);
  }
}

function releaseDeferredWeaponChargeGains(context: ElementalistCastContext, completesActiveFamiliar: boolean): void {
  // the blocking familiar cast is over: release the grants deferred past its charge reset
  if (completesActiveFamiliar) {
    const state = evokerState.from(context);
    flushPendingWeaponChargeGains(context, state);
    state.activeFamiliarCast = null;
  }
}

function applyMeditationEffects(context: ElementalistCastContext, skill: Skill): void {
  const state = evokerState.from(context);
  const at = context.effectiveEnd;
  // remaining branches are the Evoker meditation utility payloads
  if (skill.id === ID.ELEMENTAL_PROCESSION) {
    releaseElementalProcession(context, skill);
  }

  if (skill.id === ID.HARES_AGILITY) {
    const stacks = balanceProfileValueFromContext(context, PROFILE.familiarUtility, 'playerStacks', 5);
    state.electricEnchantmentStacks += stacks;
    emitElementalistProc(context as never, {
      at,
      name: 'Electric Enchantment',
      procType: 'skill',
      sourceId: skill.id,
      sourceSkill: skill.name,
      detail: `+${stacks} stacks`,
      icon: ELECTRIC_ENCHANTMENT_ICON
    });
    materializeArmedElectricEnchantments(context, state);
  } else if (skill.id === ID.TOADS_FORTITUDE && state.element === 'Earth') {
    const resistance = balanceProfileEffectFromContext(context, PROFILE.familiarUtility, 'boon', 0, 'Toad Resistance');
    emitSkillBuff(context, skill, {
      at,
      source: skill.name,
      sourceId: skill.id,
      actorType: 'player',
      kind: String(resistance?.boon || 'Resistance').toLowerCase(),
      stacks: Number(resistance?.stacks ?? 1),
      duration: Number(resistance?.duration ?? 4),
      skillName: skill.name
    });
  } else if (skill.id === ID.FOXS_FURY) {
    const might = balanceProfileEffectFromContext(context, PROFILE.familiarUtility, 'boon', 0, 'Fox Might');
    const fireMight = balanceProfileEffectFromContext(context, PROFILE.familiarUtility, 'boon', 0, 'Fox Fire Bonus');
    const fury = balanceProfileEffectFromContext(context, PROFILE.familiarUtility, 'boon', 0, 'Fox Fury');
    for (const boon of [
      {
        kind: String(might?.boon || 'Might').toLowerCase(),
        stacks: Number(might?.stacks ?? 8) + (state.element === 'Fire' ? Number(fireMight?.stacks ?? 3) : 0),
        duration: Number(might?.duration ?? 10)
      },
      {
        kind: String(fury?.boon || 'Fury').toLowerCase(),
        stacks: Number(fury?.stacks ?? 1),
        duration: Number(fury?.duration ?? 10)
      }
    ]) {
      emitSkillBuff(context, skill, {
        at,
        source: skill.name,
        sourceId: skill.id,
        actorType: 'player',
        skillName: skill.name,
        audience: { recipients: 'party' as const, maximumRecipients: 5 },
        ...boon
      });
    }
  }
}

function applySpecializedElementsTrait(context: ElementalistCastContext, skill: Skill): void {
  const familiarElement = FAMILIAR_ELEMENTS.get(skill.id);
  // Basic familiars retain 90% weapon recharge; empowered familiars retain
  // 67% and trigger the elemental entry effects.
  if (familiarElement && hasTrait(context, 'Specialized Elements')) {
    const basic = BASIC_FAMILIARS.has(skill.id);
    applyWeaponSkillRechargeMultiplier(
      context,
      balanceProfileValueFromContext(
        context,
        basic ? PROFILE.specializedElementsBasicRecharge : PROFILE.specializedElementsEmpoweredRecharge,
        'rechargeMultiplier',
        basic ? 0.9 : 0.67
      )
    );
    if (!basic) {
      triggerSpecializedElementEntry(context, skill, familiarElement);
    }
  }
}

/**
 * Settles a completed cast: the attunement transition, weapon charge accrual,
 * the familiar traits, the charge/empowered state machine, and the Evoker
 * utility skill payloads.
 */
export function onCastComplete(context: ElementalistCastContext, skill: Skill): void {
  // Evoker supplies its trait-proc policy before Core's completion hook, while Core still owns the shared transition.
  if (completeEvokerAttunement(context, skill)) {
    (context as unknown as SchedulerRecord).elementalistAttunementHandled = true;
  }

  const state = evokerState.from(context);
  const completesActiveFamiliar = state.activeFamiliarCast?.reservationId === context.reservationId;
  grantWeaponSkillCharges(context, skill, state);
  applyFamiliarTraitProcs(context, skill);
  applyFamiliarSkillEffects(context, skill);
  settleFamiliarChargeState(context, skill);
  releaseDeferredWeaponChargeGains(context, completesActiveFamiliar);
  applyMeditationEffects(context, skill);
  applySpecializedElementsTrait(context, skill);
}
