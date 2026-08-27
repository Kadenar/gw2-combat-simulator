import { emitSkillBuff, emitSkillCondition, emitSkillDamage } from '../../../../platform/gw2/scheduler/skill-events.js';
import { hasTrait } from '../../../../platform/gw2/combat/state/traits.js';
import { castRelativeEffectTimingScale } from '../../../../platform/gw2/skills/timing.js';
import type { SchedulerRecord, Skill } from '../../../../platform/engine/types.js';
import type { ElementalistCastContext, ElementalistSchedulerContext } from '../../types.js';
import { emitElementalistProc } from '../../core/mechanics.js';
import { elementalistBalanceEffect, elementalistBalanceValue, elementalistEffectValue } from '../../core/profiles.js';
import {
  BASIC_FAMILIARS,
  ELECTRIC_ENCHANTMENT_ICON,
  FAMILIAR_BASIC_BY_EMPOWERED,
  FAMILIAR_ELEMENTS,
  FAMILIAR_FLIP_DELAYS,
  FAMILIAR_INTERRUPT_WINDOWS,
  FAMILIAR_PROFILE_BY_BASIC
} from './constants.js';
import { completeEvokerAttunement, triggerSpecializedElementEntry } from './attunements.js';
import { materializeArmedElectricEnchantments } from './enchantments.js';
import {
  emitResource,
  flushPendingWeaponChargeGains,
  grantWeaponSkillCharges,
  weaponSkillChargeGain
} from './resources.js';
import { evokerState } from './state.js';
import { EVOKER_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';

// reads effects directly from the catalog so balance patches to those skills propagate without code changes
function releaseElementalProcession(context: ElementalistCastContext, sourceSkill: Skill): void {
  for (const name of ['Conflagration', 'Lightning Blitz', 'Seismic Impact']) {
    const familiar = context.catalog.skillsByName.get(name);

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
        const metadata = (tick.metadata || effect.metadata || {}) as SchedulerRecord;
        const comboFinishers = tick.comboFinishers || effect.comboFinishers;

        if (effect.type === 'strike') {
          emitSkillDamage(context, {
            at,
            source: name,
            sourceId: familiar.id,
            actorType: 'player',
            skillName: name,
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
            source: name,
            sourceId: familiar.id,
            actorType: 'player',
            skillName: name,
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
            source: name,
            sourceId: familiar.id,
            actorType: 'player',
            skillName: name,
            skillId: familiar.id,
            controlKind: metadata.controlKind,
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

export function onCastStart(context: ElementalistCastContext, skill: Skill): void {
  const state = evokerState.from(context);
  const familiarElement = FAMILIAR_ELEMENTS[skill.name];

  if (context.command.concurrentOffsetMs == null) {
    const gain = weaponSkillChargeGain(context, skill, state);
    const postFamiliarGain = gain > 0 ? gain : skill.name === 'Rejuvenate' ? state.maximumCharges : 0;
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

  if (familiarElement) {
    const concurrentParent =
      context.command.concurrentOffsetMs != null
        ? state.concurrentParentAnchors
            .filter((entry) => entry.commandIndex < context.commandIndex)
            .sort((left, right) => right.commandIndex - left.commandIndex)[0]
        : null;

    // steal the parent command's charge grant so it doesn't reset before the basic familiar resets charges
    if (
      BASIC_FAMILIARS.has(skill.name) &&
      concurrentParent?.weaponChargeGain &&
      concurrentParent.weaponChargeGain.at <= context.start + context.epsilon
    ) {
      state.pendingWeaponChargeGains.push(concurrentParent.weaponChargeGain);
      concurrentParent.weaponChargeGain = null;
    }

    state.activeFamiliarCast = {
      reservationId: context.reservationId,
      endsAt: context.effectiveEnd,
      resetsCharges: BASIC_FAMILIARS.has(skill.name)
    };
  }

  // if the empowered familiar was recently cast and the basic fires within the window, the empowered effects are retroactively cancelled
  const interrupt = FAMILIAR_INTERRUPT_WINDOWS[skill.name];

  if (interrupt) {
    const [empoweredSkill, fallbackWindow] = interrupt;
    const window = elementalistBalanceValue(
      context,
      FAMILIAR_PROFILE_BY_BASIC[skill.name],
      'durationMultiplier',
      fallbackWindow
    );
    const recent = state.lastEmpoweredFamiliarByBasic[skill.name];

    if (recent?.skill === empoweredSkill && context.start - recent.start < window) {
      cancelActivationEffects(context, recent.activationId, context.start);
      state.cancelledFamiliarActivations[context.reservationId] = true;
      state.lastEmpoweredFamiliarByBasic[skill.name] = null;
    }
  }

  const basic = FAMILIAR_BASIC_BY_EMPOWERED[skill.name];

  if (basic) {
    state.lastEmpoweredFamiliarByBasic[basic] = {
      skill: skill.name,
      activationId: context.reservationId,
      start: context.start
    };
  }
}

export function afterCast(context: ElementalistCastContext, skill: Skill): void {
  const state = evokerState.from(context);

  if (state.cancelledFamiliarActivations[context.reservationId]) {
    cancelActivationEffects(context, context.reservationId, context.start);
    delete state.cancelledFamiliarActivations[context.reservationId];
    return;
  }

  if (skill.name === 'Ignite') {
    // tier resets if unused for 15s; cycling through 4 tiers gives a short pulse on tier 1 to front-load damage
    if (context.start - state.igniteLastUsedAt >= elementalistBalanceValue(context, PROFILE.ignite, 'threshold', 15)) {
      state.igniteTier = 0;
    }

    const durations = [2, 0.5, 1, 1.5];
    for (const event of context.events) {
      if (event.activationId === context.reservationId && event.type === 'condition' && event.condition === 'Burning') {
        context.replaceEvent(event, {
          duration: elementalistEffectValue(
            context,
            PROFILE.ignite,
            'condition',
            'duration',
            durations[state.igniteTier],
            `Tier ${state.igniteTier + 1}`
          )
        });
      }
    }

    state.igniteTier = (state.igniteTier + 1) % durations.length;
    state.igniteLastUsedAt = context.start;
  }

  if (skill.name === "Fox's Fury") {
    const might = context.buffStacks('might', context.start);
    const threshold = elementalistBalanceValue(context, PROFILE.foxsFury, 'threshold', 10);
    const tier = might >= threshold * 2 ? 2 : might >= threshold ? 1 : 0;
    const effectName = `Tier ${tier + 1}`;
    const strike = elementalistBalanceEffect(context, PROFILE.foxsFury, 'strike', effectName);
    const burning = elementalistBalanceEffect(context, PROFILE.foxsFury, 'condition', effectName);
    const at =
      context.start +
      elementalistBalanceValue(context, PROFILE.foxsFury, 'initialDelay', 0.56) /
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

function grantFamiliarProwess(context: ElementalistCastContext, skill: Skill): void {
  const at = context.effectiveEnd;
  const baseDuration = elementalistBalanceValue(context, PROFILE.familiarsProwess, 'durationMultiplier', 5);
  const extension = elementalistBalanceValue(context, PROFILE.familiarsProwess, 'durationPerTier', 5);
  const maximumDuration = elementalistBalanceValue(context, PROFILE.familiarsProwess, 'maximumStacks', 15);
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

function applyWeaponSkillRechargeMultiplier(context: ElementalistCastContext, multiplier: number): void {
  const at = context.effectiveEnd;
  for (const candidate of context.catalog.skills) {
    if (candidate.type !== 'Weapon') continue;
    const rechargeDuration = context.rechargeDurationFor(candidate, at);
    const reduction = rechargeDuration * Math.max(0, 1 - multiplier);
    context.cooldownController.reduceSkillRecharge(candidate, reduction, at);
  }
}

export function onCastComplete(context: ElementalistCastContext, skill: Skill): void {
  // Evoker supplies its trait-proc policy before Core's completion hook, while Core still owns the shared transition.
  if (completeEvokerAttunement(context, skill)) {
    (context as unknown as SchedulerRecord).elementalistAttunementHandled = true;
  }

  const state = evokerState.from(context);
  const at = context.effectiveEnd;
  const completesActiveFamiliar = state.activeFamiliarCast?.reservationId === context.reservationId;
  grantWeaponSkillCharges(context, skill, state);

  if (FAMILIAR_ELEMENTS[skill.name] && hasTrait(context, "Familiar's Prowess")) {
    grantFamiliarProwess(context, skill);
  }

  const familiarElement = FAMILIAR_ELEMENTS[skill.name];

  if (familiarElement && hasTrait(context, "Familiar's Blessing")) {
    const quick = familiarElement === 'Fire' || familiarElement === 'Air';
    const blessing = elementalistBalanceEffect(
      context,
      PROFILE.familiarsBlessing,
      'boon',
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
    const stacks = elementalistBalanceValue(context, PROFILE.galvanicEnchantment, 'playerStacks', 2);
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

  if (skill.name === 'Lightning Blitz') {
    const stacks = elementalistBalanceValue(context, PROFILE.familiarUtility, 'resourceGain', 1);
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

  if (skill.name === 'Zap') {
    const zap = elementalistBalanceEffect(context, PROFILE.familiarUtility, 'buff', 'Zap Window');
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

  if (BASIC_FAMILIARS.has(skill.name)) {
    state.charges = 0;
    state.empowered = Math.min(
      elementalistBalanceValue(context, PROFILE.resources, 'minimumStacks', 3),
      state.empowered + 1
    );
    const flip = FAMILIAR_FLIP_DELAYS[skill.name];
    const empowered = flip ? context.catalog.skillsByName.get(flip[0]) : undefined;

    if (flip && empowered) {
      const delay = elementalistBalanceValue(context, FAMILIAR_PROFILE_BY_BASIC[skill.name], 'initialDelay', flip[1]);
      context.state.cooldowns.set(
        empowered.id,
        Math.max(Number(context.state.cooldowns.get(empowered.id) || 0), at + delay)
      );
    }

    emitResource(context, skill, state);
  } else if (FAMILIAR_ELEMENTS[skill.name]) {
    state.empowered = 0;
    emitResource(context, skill, state);
  } else if (skill.name === 'Rejuvenate') {
    state.charges = state.maximumCharges;
    emitResource(context, skill, state);
  }

  if (completesActiveFamiliar) {
    flushPendingWeaponChargeGains(context, state);
    state.activeFamiliarCast = null;
  }

  if (skill.name === 'Elemental Procession') {
    releaseElementalProcession(context, skill);
  }

  if (skill.name === "Hare's Agility") {
    const stacks = elementalistBalanceValue(context, PROFILE.familiarUtility, 'playerStacks', 5);
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
  } else if (skill.name === "Toad's Fortitude" && state.element === 'Earth') {
    const resistance = elementalistBalanceEffect(context, PROFILE.familiarUtility, 'boon', 'Toad Resistance');
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
  } else if (skill.name === "Fox's Fury") {
    const might = elementalistBalanceEffect(context, PROFILE.familiarUtility, 'boon', 'Fox Might');
    const fireMight = elementalistBalanceEffect(context, PROFILE.familiarUtility, 'boon', 'Fox Fire Bonus');
    const fury = elementalistBalanceEffect(context, PROFILE.familiarUtility, 'boon', 'Fox Fury');
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
        recipients: 'party',
        maximumRecipients: 5,
        ...boon
      });
    }
  }

  // Basic familiars retain 90% weapon recharge; empowered familiars retain
  // 67% and trigger the elemental entry effects.
  if (familiarElement && hasTrait(context, 'Specialized Elements')) {
    const basic = BASIC_FAMILIARS.has(skill.name);
    applyWeaponSkillRechargeMultiplier(
      context,
      elementalistBalanceValue(
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
