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
import { emitSkillBuff, emitSkillCondition, emitSkillDamage } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  GW2_QUICKNESS_ACTION_RATE,
  castRelativeEffectTimingScale,
  gw2EffectExpiresAt
} from '#gw2/platform/skills/timing.js';
import { gw2BaseRecharge } from '#gw2/platform/skills/recharge.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type { ElementalistCastContext, ElementalistSchedulerContext } from '#gw2/professions/elementalist/types.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { emitElementalistProc } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import {
  BASIC_FAMILIARS,
  ELECTRIC_ENCHANTMENT_ICON,
  FAMILIAR_BASIC_BY_EMPOWERED,
  FAMILIAR_ELEMENTS,
  FAMILIAR_EMPOWERED_BY_BASIC,
  FAMILIAR_PROFILE_BY_BASIC
} from '#gw2/professions/elementalist/specializations/evoker/mechanics/constants.js';
import {
  completeEvokerAttunement,
  triggerSpecializedElementEntry
} from '#gw2/professions/elementalist/specializations/evoker/mechanics/attunements.js';
import { applyElectricEnchantmentsRetrospectively } from '#gw2/professions/elementalist/specializations/evoker/mechanics/enchantments.js';
import {
  emitResource,
  flushPendingWeaponChargeGains,
  grantWeaponSkillCharges,
  weaponSkillChargeGain
} from '#gw2/professions/elementalist/specializations/evoker/mechanics/resources.js';
import { evokerState, grantElectricEnchantments } from '#gw2/professions/elementalist/specializations/evoker/state.js';
import { EVOKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/evoker/profiles.js';

// Replay all four empowered familiar effects with their native F5 strength so balance patches propagate here.
function releaseElementalProcession(context: ElementalistCastContext, sourceSkill: Skill): void {
  for (const skillId of [ID.CONFLAGRATION, ID.BUOYANT_DELUGE, ID.LIGHTNING_BLITZ, ID.SEISMIC_IMPACT]) {
    const familiar = context.catalog.skillsById.get(skillId);
    if (!familiar) continue;
    for (const effect of familiar.effects || []) {
      if (!['strike', 'condition', 'control', 'blind'].includes(effect.type)) continue;
      // Procession preserves the familiar's unquickened timing and each surviving packet's representation.
      const runtimeCastMs = Math.max(0, Number(familiar.castTimeMs || 0) * GW2_QUICKNESS_ACTION_RATE);
      const scale = effect.timingScale === 'cast' ? castRelativeEffectTimingScale(familiar, runtimeCastMs) : 1;
      for (const application of materializeSkillEffectApplications({
        skill: familiar,
        effect,
        start: 0,
        fullEnd: 0,
        baseEvent: { source: familiar.name, sourceId: familiar.id, actorType: 'player', triggeredBy: sourceSkill.name }
      })) {
        const { event } = application;
        const at = context.effectiveEnd + application.at * scale;
        if (event.type === 'damage')
          emitSkillDamage(context, {
            ...event,
            at,
            coefficient: Number(event.coefficient),
            skillId: familiar.id,
            skillName: familiar.name,
            skillWeapon: 'Profession mechanic'
          });
        else if (event.type === 'condition')
          emitSkillCondition(context, {
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
  // Track pending grants so early familiar inputs can wait for their resource provider.
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
    state.activeFamiliarCast = {
      reservationId: context.reservationId,
      endsAt: context.effectiveEnd,
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
    const igniteProfile = requireBalanceProfileFromContext(context, PROFILE.ignite);
    // Consecutive Ignites stay at the final burning tier until the inactivity window resets it.
    if (context.start - state.igniteLastUsedAt >= balanceProfileNumber(igniteProfile, 'threshold')) {
      state.igniteTier = 0;
    }

    // Keep tier identity stable even when an earlier tier's Burning is removed.
    const tiers = ['Tier 1', 'Tier 2', 'Tier 3', 'Tier 4'];
    for (const event of context.events) {
      if (event.activationId === context.reservationId && event.type === 'condition' && event.condition === 'Burning') {
        const igniteCondition = requireEffect(igniteProfile, 'condition', tiers[state.igniteTier]);
        context.replaceEvent(
          event,
          igniteCondition ? { duration: Number(igniteCondition.duration) } : { cancelled: true }
        );
      }
    }

    state.igniteTier = Math.min(state.igniteTier + 1, tiers.length - 1);
    state.igniteLastUsedAt = context.start;
  }

  // Fox's Fury picks one of three tiers from the might stacks held at cast start
  if (skill.id === ID.FOXS_FURY) {
    const might = context.buffStacks('might', context.start);
    const foxsFuryProfile = requireBalanceProfileFromContext(context, PROFILE.foxsFury);
    const threshold = balanceProfileNumber(foxsFuryProfile, 'threshold');
    const tier = might >= threshold * 2 ? 2 : might >= threshold ? 1 : 0;
    const effectName = `Tier ${tier + 1}`;
    const strike = requireEffect(foxsFuryProfile, 'strike', effectName);
    const burning = requireEffect(foxsFuryProfile, 'condition', effectName);
    // The profile delay uses the authored cast timeline, just like declarative skill packets.
    const at =
      context.start +
      balanceProfileNumber(foxsFuryProfile, 'initialDelay') *
        castRelativeEffectTimingScale(skill, (context.fullEnd - context.start) * 1000);
    if (strike) {
      emitSkillDamage(context, {
        at,
        source: skill.name,
        sourceId: skill.id,
        actorType: 'player',
        skillName: skill.name,
        skillId: skill.id,
        coefficient: Number(strike.coefficient),
        skillWeapon: 'Unequipped'
      });
    }

    // Separate Burning applications preserve the total, including any fractional final stack.
    if (burning) {
      const stacks = Number(burning.stacks);
      for (let index = 0; index < Math.ceil(stacks); index += 1) {
        emitSkillCondition(context, {
          skill,
          at,
          source: skill.name,
          condition: String(burning.condition),
          stacks: Math.min(1, stacks - index),
          duration: Number(burning.duration)
        });
      }
    }
  }
}

// refreshes the Familiar's Prowess damage buff, extending an active one rather than stacking a second
function grantFamiliarProwess(context: ElementalistCastContext, skill: Skill): void {
  const at = context.effectiveEnd;
  const familiarsProwessProfile = requireBalanceProfileFromContext(context, PROFILE.familiarsProwess);
  const baseDuration = balanceProfileNumber(familiarsProwessProfile, 'durationMultiplier');
  const extension = balanceProfileNumber(familiarsProwessProfile, 'durationPerTier');
  const maximumDuration = balanceProfileNumber(familiarsProwessProfile, 'maximumStacks');
  const current = context.events
    .filter(
      (event) =>
        event.type === 'buff' &&
        event.kind === "familiar's-prowess" &&
        event.at <= at &&
        gw2EffectExpiresAt(event.at, Number(event.duration || 0)) > at
    )
    .at(-1);
  // extend existing buff expiry rather than stacking a new one; hard cap is maximumDuration from now
  if (current) {
    const expiry = gw2EffectExpiresAt(current.at, Number(current.duration || 0));
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

// Specialized Elements removes the profiled fraction of each weapon skill's base recharge.
function applyWeaponSkillRechargeMultiplier(context: ElementalistCastContext, multiplier: number): void {
  const at = context.effectiveEnd;
  for (const candidate of context.catalog.skills) {
    if (candidate.type !== 'Weapon') continue;
    const reduction = gw2BaseRecharge(candidate) * Math.max(0, 1 - multiplier);
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
    const familiarsBlessingProfile = requireBalanceProfileFromContext(context, PROFILE.familiarsBlessing);
    const blessing = requireEffect(familiarsBlessingProfile, 'boon', quick ? 'Quickness' : 'Alacrity');
    if (blessing) {
      emitSkillBuff(context, skill, {
        at,
        source: "Familiar's Blessing",
        sourceId: skill.id,
        actorType: 'player',
        kind: String(blessing.boon).toLowerCase(),
        stacks: Number(blessing.stacks),
        duration: Number(blessing.duration),
        skillName: "Familiar's Blessing"
      });
    }
  }

  if (familiarElement && hasTrait(context, 'Galvanic Enchantment')) {
    const galvanicEnchantmentProfile = requireBalanceProfileFromContext(context, PROFILE.galvanicEnchantment);
    const stacks = balanceProfileNumber(galvanicEnchantmentProfile, 'playerStacks');
    const duration = balanceProfileNumber(galvanicEnchantmentProfile, 'durationMultiplier');
    grantElectricEnchantments(state, at, stacks, duration);
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
    const familiarUtilityProfile = requireBalanceProfileFromContext(context, PROFILE.familiarUtility);
    const stacks = balanceProfileNumber(familiarUtilityProfile, 'resourceGain');
    const enchantment = requireEffect(familiarUtilityProfile, 'buff', 'Lightning Blitz Enchantment');
    if (enchantment) {
      grantElectricEnchantments(state, at, stacks, Number(enchantment.duration));

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
  }

  if (familiarElement) {
    applyElectricEnchantmentsRetrospectively(context, state);
  }

  if (skill.id === ID.ZAP) {
    const familiarUtilityProfile = requireBalanceProfileFromContext(context, PROFILE.familiarUtility);
    const zap = requireEffect(familiarUtilityProfile, 'buff', 'Zap Window');
    if (zap) {
      emitSkillBuff(context, {
        at,
        source: skill.name,
        sourceId: skill.id,
        actorType: 'player',
        skillName: skill.name,
        kind: 'zap buff',
        stacks: Number(zap.stacks),
        duration: Number(zap.duration)
      });
    }
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
    const resourcesProfile = requireBalanceProfileFromContext(context, PROFILE.resources);
    state.empowered = Math.min(balanceProfileNumber(resourcesProfile, 'minimumStacks'), state.empowered + 1);
    const flip = FAMILIAR_EMPOWERED_BY_BASIC.get(skill.id);
    const empowered = flip ? context.catalog.skillsById.get(flip) : undefined;
    if (flip && empowered) {
      const delay = balanceProfileNumber(
        requireBalanceProfileFromContext(context, FAMILIAR_PROFILE_BY_BASIC.get(skill.id) ?? skill.id),
        'initialDelay'
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
    const familiarUtilityProfile = requireBalanceProfileFromContext(context, PROFILE.familiarUtility);
    const stacks = balanceProfileNumber(familiarUtilityProfile, 'playerStacks');
    const enchantment = requireEffect(familiarUtilityProfile, 'buff', 'Hare Enchantment');
    if (enchantment) {
      grantElectricEnchantments(state, at, stacks, Number(enchantment.duration));

      emitElementalistProc(context as never, {
        at,
        name: 'Electric Enchantment',
        procType: 'skill',
        sourceId: skill.id,
        sourceSkill: skill.name,
        detail: `+${stacks} stacks`,
        icon: ELECTRIC_ENCHANTMENT_ICON
      });
    }

    applyElectricEnchantmentsRetrospectively(context, state);
  } else if (skill.id === ID.TOADS_FORTITUDE && state.element === 'Earth') {
    const familiarUtilityProfile = requireBalanceProfileFromContext(context, PROFILE.familiarUtility);
    const resistance = requireEffect(familiarUtilityProfile, 'boon', 'Toad Resistance');
    if (resistance) {
      emitSkillBuff(context, skill, {
        at,
        source: skill.name,
        sourceId: skill.id,
        actorType: 'player',
        kind: String(resistance.boon).toLowerCase(),
        stacks: Number(resistance.stacks),
        duration: Number(resistance.duration),
        skillName: skill.name
      });
    }
  } else if (skill.id === ID.FOXS_FURY) {
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
        duration: Number(effect.duration)
      };
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
      balanceProfileNumber(
        requireBalanceProfileFromContext(
          context,
          basic ? PROFILE.specializedElementsBasicRecharge : PROFILE.specializedElementsEmpoweredRecharge
        ),
        'rechargeMultiplier'
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
    context.elementalistAttunementHandled = true;
  }

  const state = evokerState.from(context);
  const completesActiveFamiliar = state.activeFamiliarCast?.reservationId === context.reservationId;
  // A settled grant cannot fund another retry or be awarded again after a familiar spends it.
  state.concurrentParentAnchors = state.concurrentParentAnchors.filter(
    (entry) => entry.commandIndex !== context.commandIndex
  );
  grantWeaponSkillCharges(context, skill, state);
  applyFamiliarTraitProcs(context, skill);
  applyFamiliarSkillEffects(context, skill);
  settleFamiliarChargeState(context, skill);
  releaseDeferredWeaponChargeGains(context, completesActiveFamiliar);
  applyMeditationEffects(context, skill);
  applySpecializedElementsTrait(context, skill);
}
