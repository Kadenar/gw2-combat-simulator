import { professionCoreState } from '../../../platform/engine/profession/state.js';
import { enqueueOrdered } from '../../../platform/engine/events/queue.js';
import { gw2StatsForWeaponSet } from '../../../platform/gw2/combat/query/runtime-rules.js';
import { CANONICAL_TARGET_CONDITIONS } from '../../../platform/gw2/combat/state/targets.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '../data/ids.js';
import { hasThiefTrait } from './state.js';
import { emitThiefCondition, emitThiefState, gainThiefEndurance, gainThiefInitiative } from './shared.js';
import type { SkillId } from '../../../platform/engine/types.js';
import type {
  ThiefCastContext,
  ThiefResolverContext,
  ThiefResolverEvent,
  ThiefResolverReactionDetails,
  ThiefSkill
} from '../types.js';
import {
  thiefBalanceProfile,
  thiefBalanceProfileEffect,
  THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE
} from './profiles.js';

function traitEffect(context: unknown, profileId: SkillId, type: string, index = 0) {
  return thiefBalanceProfileEffect(thiefBalanceProfile(context, profileId), type, index);
}

function emitStealBoon(context: ThiefCastContext, at: number, boon: string, duration: number, stacks = 1): void {
  context.emit({
    type: 'buff',
    at,
    source: 'Trait',
    sourceId: `thief.steal.${boon}`,
    actorType: 'player',
    skillId: context.skill?.id,
    skillName: context.skill?.name,
    name: `Steal — ${boon}`,
    kind: boon,
    boon,
    duration,
    stacks
  });
}

export function emitStealTraitEffects(context: ThiefCastContext): void {
  const at = context.effectiveEnd;
  const state = professionCoreState(context);
  const potentPoison = hasThiefTrait(context.config, TRAIT.POTENT_POISON);
  if (hasThiefTrait(context.config, TRAIT.SERPENTS_TOUCH)) {
    const profile = thiefBalanceProfile(context, PROFILE.serpentsTouch);
    const poison = thiefBalanceProfileEffect(profile, 'condition');
    emitThiefCondition(context, {
      at,
      condition: String(poison?.condition || 'Poisoned'),
      duration: Number(poison?.duration || 10),
      stacks: potentPoison ? Number(profile?.playerStacks || 3) : Number(poison?.stacks || 2),
      sourceId: TRAIT.SERPENTS_TOUCH,
      name: "Serpent's Touch — Poison"
    });
  }

  if (hasThiefTrait(context.config, TRAIT.MUG)) {
    const strike = traitEffect(context, PROFILE.mug, 'strike');
    context.emit({
      type: 'damage',
      at,
      source: 'Trait',
      sourceId: TRAIT.MUG,
      actorType: 'player',
      skillId: context.skill?.id,
      skillName: context.skill?.name,
      name: 'Mug',
      coefficient: Number(strike?.coefficient || 1.5),
      hits: Number(strike?.hits || 1),
      canCrit: false
    });
  }

  if (hasThiefTrait(context.config, TRAIT.EVEN_THE_ODDS)) {
    const vulnerability = traitEffect(context, PROFILE.evenTheOdds, 'condition');
    emitThiefCondition(context, {
      at,
      condition: String(vulnerability?.condition || 'Vulnerability'),
      duration: Number(vulnerability?.duration || 10),
      stacks: Number(vulnerability?.stacks || 10),
      sourceId: TRAIT.EVEN_THE_ODDS,
      name: 'Even the Odds — Vulnerability'
    });
  }

  if (hasThiefTrait(context.config, TRAIT.DEADLY_AMBUSH)) {
    const bleeding = traitEffect(context, PROFILE.deadlyAmbush, 'condition');
    emitThiefCondition(context, {
      at,
      condition: String(bleeding?.condition || 'Bleeding'),
      duration: Number(bleeding?.duration || 10),
      stacks: Number(bleeding?.stacks || 3),
      sourceId: TRAIT.DEADLY_AMBUSH,
      name: 'Deadly Ambush — Bleeding'
    });
  }

  if (hasThiefTrait(context.config, TRAIT.THRILL_OF_THE_CRIME)) {
    for (const effect of (thiefBalanceProfile(context, PROFILE.thrillOfTheCrime)?.effects || []).filter(
      (entry) => entry.type === 'boon'
    )) {
      emitStealBoon(
        context,
        at,
        String(effect.boon || effect.kind || ''),
        Number(effect.duration || 10),
        Number(effect.stacks || 1)
      );
    }
  }

  if (hasThiefTrait(context.config, TRAIT.BOUNTIFUL_THEFT)) {
    const vigor = traitEffect(context, PROFILE.bountifulTheft, 'boon', 0);
    const might = traitEffect(context, PROFILE.bountifulTheft, 'boon', 1);
    emitStealBoon(
      context,
      at,
      String(vigor?.boon || 'Vigor'),
      Number(vigor?.duration || 10),
      Number(vigor?.stacks || 1)
    );
    if (context.config.target?.boonless !== false) {
      emitStealBoon(
        context,
        at,
        String(might?.boon || 'Might'),
        Number(might?.duration || 10),
        Number(might?.stacks || 5)
      );
    }
  }

  if (hasThiefTrait(context.config, TRAIT.SLEIGHT_OF_HAND)) {
    const control = traitEffect(context, PROFILE.sleightOfHand, 'control');
    context.emit({
      type: 'control',
      at,
      source: 'Trait',
      sourceId: TRAIT.SLEIGHT_OF_HAND,
      actorType: 'player',
      skillId: context.skill?.id,
      skillName: context.skill?.name,
      name: 'Sleight of Hand - Daze',
      effect: 'Daze',
      duration: Number(control?.duration || 1)
    });
  }

  if (hasThiefTrait(context.config, TRAIT.HIDDEN_THIEF)) {
    const profile = thiefBalanceProfile(context, PROFILE.hiddenThief);
    const blindness = thiefBalanceProfileEffect(profile, 'condition', 0);
    const weakness = thiefBalanceProfileEffect(profile, 'condition', 1);
    const readyAt = Number(state.traitProcReadyAt[TRAIT.HIDDEN_THIEF] ?? 0);
    if (at + 1e-9 >= readyAt) {
      state.traitProcReadyAt[TRAIT.HIDDEN_THIEF] = at + Number(profile?.internalCooldown || 2);
      emitThiefCondition(context, {
        at,
        condition: 'Blindness',
        duration: Number(blindness?.duration || 3),
        stacks: Number(blindness?.stacks || 1),
        sourceId: TRAIT.HIDDEN_THIEF,
        name: 'Hidden Thief - Blindness'
      });
      emitThiefCondition(context, {
        at,
        condition: 'Weakness',
        duration: Number(weakness?.duration || 3),
        stacks: Number(weakness?.stacks || 1),
        sourceId: TRAIT.HIDDEN_THIEF,
        name: 'Hidden Thief - Weakness'
      });
    }
  }
}

export function applyStealCompletionTraits(context: ThiefCastContext, at: number): void {
  if (hasThiefTrait(context.config, TRAIT.KLEPTOMANIAC)) {
    gainThiefInitiative(
      context,
      Number(thiefBalanceProfile(context, PROFILE.kleptomaniac)?.resourceGain || 2),
      at,
      'kleptomaniac'
    );
  }

  if (hasThiefTrait(context.config, TRAIT.ENDURANCE_THIEF)) {
    gainThiefEndurance(
      context,
      Number(thiefBalanceProfile(context, PROFILE.enduranceThief)?.resourceGain || 50),
      at,
      'endurance-thief'
    );
  }
}

export function updateThiefTraitCastState(context: ThiefCastContext, skill: ThiefSkill): void {
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  const initiativeCost = Math.max(0, Number(skill.initiativeCost || 0));
  if (initiativeCost > 0 && hasThiefTrait(context.config, TRAIT.LEAD_ATTACKS)) {
    const profile = thiefBalanceProfile(context, PROFILE.leadAttacks);
    const expirations = state.leadAttackExpirations || [];
    for (
      let stack = 0;
      stack < initiativeCost && expirations.length < Number(profile?.maximumStacks || 15);
      stack += 1
    ) {
      expirations.push(at + Number(profile?.durationMultiplier || 10));
    }

    state.leadAttackExpirations = expirations;
    state.leadAttacksStacks = expirations.length;
    state.leadAttacksUntil = expirations.length ? Math.max(...expirations) : 0;
    emitThiefState(context, at, 'lead-attacks');
  }

  if (skill.movementSkill) {
    let movementStateChanged = false;
    if (hasThiefTrait(context.config, TRAIT.FLUID_STRIKES)) {
      state.fluidStrikesUntil =
        at + Number(thiefBalanceProfile(context, PROFILE.fluidStrikes)?.durationMultiplier || 5);
      movementStateChanged = true;
    }

    if (hasThiefTrait(context.config, TRAIT.HARD_TO_CATCH)) {
      gainThiefEndurance(
        context,
        Number(thiefBalanceProfile(context, PROFILE.hardToCatch)?.resourceGain || 8),
        at,
        'hard-to-catch'
      );
    } else if (movementStateChanged) {
      emitThiefState(context, at, 'fluid-strikes');
    }
  }

  const isDualWieldAttack =
    skill.categories?.includes('DualWield') ||
    Boolean(skill.requiredMainHand && typeof skill.requiredOffHand === 'string');
  if (isDualWieldAttack && hasThiefTrait(context.config, TRAIT.DEADLY_AMBITION)) {
    const potentPoison = hasThiefTrait(context.config, TRAIT.POTENT_POISON);
    const profile = thiefBalanceProfile(context, PROFILE.deadlyAmbition);
    const poison = thiefBalanceProfileEffect(profile, 'condition');
    emitThiefCondition(context, {
      at,
      condition: String(poison?.condition || 'Poisoned'),
      duration: Number(poison?.duration || 3),
      stacks: potentPoison ? Number(profile?.playerStacks || 2) : Number(poison?.stacks || 1),
      sourceId: TRAIT.DEADLY_AMBITION,
      name: 'Deadly Ambition — Poison'
    });
  }
}

const EPSILON = 1e-9;

function thiefBoonDuration(
  context: ThiefResolverContext,
  event: ThiefResolverEvent,
  kind: string,
  baseDuration: number
): number {
  const stats = context.query.statsAt(event.at, event, context);
  const configuredStats = gw2StatsForWeaponSet(context.config, context.activeWeaponSet);
  const sigil = context.query.activeSigilSetAt(event.at);
  const name = `${kind.charAt(0).toUpperCase()}${kind.slice(1)}`;
  const bonus =
    Number(stats.concentration || 0) / 1500 +
    Number(configuredStats.boonDurationBonus || 0) / 100 +
    Number(configuredStats.boonDurationBonuses?.[name] || 0) / 100 +
    Number(sigil?.boonDurationBonus || 0) / 100;
  return baseDuration * Math.max(1, Math.min(2, 1 + bonus));
}

function queueThiefBoon(
  context: ThiefResolverContext,
  event: ThiefResolverEvent,
  {
    traitId,
    traitName,
    boon,
    duration,
    stacks = 1,
    recipients = 'self'
  }: {
    readonly traitId: SkillId;
    readonly traitName: string;
    readonly boon: string;
    readonly duration: number;
    readonly stacks?: number;
    readonly recipients?: 'self' | 'party';
  }
): void {
  enqueueOrdered(context.queue, {
    type: 'buff',
    at: event.at,
    source: 'Trait',
    sourceId: traitId,
    actorType: 'effect',
    skillId: traitId,
    skillName: traitName,
    name: `${traitName} - ${boon}`,
    kind: boon.toLowerCase(),
    duration: thiefBoonDuration(context, event, boon, duration),
    stacks,
    recipients,
    maximumRecipients: recipients === 'party' ? 5 : 1,
    triggeredBy: event.skillName
  });
}

function activeSelfFuryApplications(context: ThiefResolverContext, at: number) {
  return (context.boons.get('fury') || []).filter(
    (application) =>
      application.affectsSelf !== false && application.at <= at + EPSILON && application.expiresAt > at + EPSILON
  );
}

function extendActiveFury(context: ThiefResolverContext, event: ThiefResolverEvent, duration: number): void {
  const applications = context.boons.get('fury') || [];
  const active = new Set(activeSelfFuryApplications(context, event.at));
  if (!active.size) return;
  context.boons.set(
    'fury',
    applications.map((application) =>
      active.has(application) ? { ...application, expiresAt: application.expiresAt + duration } : application
    )
  );
  enqueueOrdered(context.queue, {
    type: 'proc',
    at: event.at,
    source: 'Trait',
    sourceId: TRAIT.NO_QUARTER,
    actorType: 'effect',
    skillId: TRAIT.NO_QUARTER,
    skillName: 'No Quarter',
    name: 'No Quarter - Fury Extension',
    duration,
    triggeredBy: event.skillName
  });
}

function traitCriticalProgress(context: ThiefResolverContext, traitId: SkillId): number {
  return Number(professionCoreState(context).traitProcProgress[String(traitId)] || 0);
}

function setTraitCriticalProgress(context: ThiefResolverContext, traitId: SkillId, value: number): void {
  professionCoreState(context).traitProcProgress[String(traitId)] = value;
}

export const thiefCoreCriticalReactions = Object.freeze({
  unrelentingStrikes: Object.freeze({
    id: 'thief.unrelenting-strikes',
    order: 10,
    actorTypes: ['player'] as const,
    when: (context: ThiefResolverContext, event: ThiefResolverEvent, details: ThiefResolverReactionDetails) =>
      Boolean(details.hitContext?.critEligible) &&
      Number(event.coefficient) > 0 &&
      hasThiefTrait(context.config, TRAIT.UNRELENTING_STRIKES),
    expectedProgress: {
      get: (context: ThiefResolverContext) => traitCriticalProgress(context, TRAIT.UNRELENTING_STRIKES),
      set: (context: ThiefResolverContext, value: number) =>
        setTraitCriticalProgress(context, TRAIT.UNRELENTING_STRIKES, value)
    },
    internalCooldown: {
      duration: (context: ThiefResolverContext) =>
        Number(thiefBalanceProfile(context, PROFILE.unrelentingStrikes)?.internalCooldown || 8),
      readyAt: (context: ThiefResolverContext) =>
        Number(professionCoreState(context).traitProcReadyAt[TRAIT.UNRELENTING_STRIKES] || 0),
      setReadyAt: (context: ThiefResolverContext, readyAt: number) => {
        professionCoreState(context).traitProcReadyAt[TRAIT.UNRELENTING_STRIKES] = readyAt;
      }
    },
    attribution: {
      kind: 'trait' as const,
      id: TRAIT.UNRELENTING_STRIKES
    },
    handler: (context: ThiefResolverContext, event: ThiefResolverEvent) => {
      const fury = traitEffect(context, PROFILE.unrelentingStrikes, 'boon');
      queueThiefBoon(context, event, {
        traitId: TRAIT.UNRELENTING_STRIKES,
        traitName: 'Unrelenting Strikes',
        boon: String(fury?.boon || 'Fury'),
        duration: Number(fury?.duration || 4),
        stacks: Number(fury?.stacks || 1),
        recipients: 'party'
      });
    }
  }),
  noQuarter: Object.freeze({
    id: 'thief.no-quarter',
    order: 20,
    actorTypes: ['player'] as const,
    when: (context: ThiefResolverContext, event: ThiefResolverEvent, details: ThiefResolverReactionDetails) =>
      Boolean(details.hitContext?.critEligible) &&
      Number(event.coefficient) > 0 &&
      hasThiefTrait(context.config, TRAIT.NO_QUARTER) &&
      context.query.furyActiveAt(event.at, context, event),
    expectedProgress: {
      get: (context: ThiefResolverContext) => traitCriticalProgress(context, TRAIT.NO_QUARTER),
      set: (context: ThiefResolverContext, value: number) => setTraitCriticalProgress(context, TRAIT.NO_QUARTER, value)
    },
    internalCooldown: {
      duration: (context: ThiefResolverContext) =>
        Number(thiefBalanceProfile(context, PROFILE.noQuarter)?.internalCooldown || 2),
      readyAt: (context: ThiefResolverContext) =>
        Number(professionCoreState(context).traitProcReadyAt[TRAIT.NO_QUARTER] || 0),
      setReadyAt: (context: ThiefResolverContext, readyAt: number) => {
        professionCoreState(context).traitProcReadyAt[TRAIT.NO_QUARTER] = readyAt;
      }
    },
    attribution: { kind: 'trait' as const, id: TRAIT.NO_QUARTER },
    handler: (context: ThiefResolverContext, event: ThiefResolverEvent) =>
      extendActiveFury(context, event, Number(traitEffect(context, PROFILE.noQuarter, 'boon')?.duration || 2))
  })
});

export function reactToThiefCoreBuff(context: ThiefResolverContext, event: ThiefResolverEvent): void {
  if (
    String(event.kind || '').toLowerCase() !== 'fury' ||
    event.affectsSelf === false ||
    !hasThiefTrait(context.config, TRAIT.ASSASSINS_FURY)
  )
    return;
  const state = professionCoreState(context);
  const profile = thiefBalanceProfile(context, PROFILE.assassinsFury);
  const might = thiefBalanceProfileEffect(profile, 'boon');
  const readyAt = Number(state.traitProcReadyAt[TRAIT.ASSASSINS_FURY] || 0);
  if (event.at + EPSILON < readyAt) return;
  state.traitProcReadyAt[TRAIT.ASSASSINS_FURY] = event.at + Number(profile?.internalCooldown || 2);
  queueThiefBoon(context, event, {
    traitId: TRAIT.ASSASSINS_FURY,
    traitName: "Assassin's Fury",
    boon: String(might?.boon || 'Might'),
    duration: Number(might?.duration || 8),
    stacks: Number(might?.stacks || 3)
  });
}

function enqueueSiphon(
  context: ThiefResolverContext,
  event: ThiefResolverEvent,
  {
    sourceId,
    name,
    coefficient
  }: {
    readonly sourceId: SkillId;
    readonly name: string;
    readonly coefficient: number;
  }
): void {
  enqueueOrdered(context.queue, {
    type: 'damage',
    at: event.at,
    source: 'Trait',
    sourceId,
    actorType: 'effect',
    skillId: sourceId,
    skillName: name,
    name,
    coefficient,
    hits: 1,
    canCrit: false,
    noCrit: true,
    lifeSiphon: true,
    triggeredBy: event.skillName
  });
}

function applySpiderVenom(
  context: ThiefResolverContext,
  event: ThiefResolverEvent,
  details: ThiefResolverReactionDetails = {}
): void {
  if (event.actorType !== 'player' || !(Number(event.coefficient) > 0)) return;
  const state = professionCoreState(context);
  if (Number(state.spiderVenomCharges || 0) <= 0 || Number(state.spiderVenomExpiresAt || 0) <= event.at) return;
  state.spiderVenomCharges -= 1;
  const poison = traitEffect(context, PROFILE.spiderVenomProc, 'condition');
  details.applyCondition?.(context, {
    type: 'condition',
    at: event.at,
    source: 'thief',
    sourceId: ID.SPIDER_VENOM,
    actorType: 'player',
    skillId: ID.SPIDER_VENOM,
    skillName: 'Spider Venom',
    name: 'Spider Venom - Poison',
    condition: String(poison?.condition || 'Poisoned'),
    stacks: Number(poison?.stacks || 1),
    duration: Number(poison?.duration || 3),
    activationId: event.activationId || `${event.skillId}:${event.at}`,
    triggeredBy: event.skillName
  });
  if (hasThiefTrait(context.config, TRAIT.LEECHING_VENOMS)) {
    const strike = traitEffect(context, PROFILE.leechingVenoms, 'strike');
    enqueueSiphon(context, event, {
      sourceId: TRAIT.LEECHING_VENOMS,
      name: 'Leeching Venoms',
      coefficient: Number(strike?.coefficient || 0.033)
    });
  }
}

function applyShadowSiphoning(context: ThiefResolverContext, event: ThiefResolverEvent): void {
  if (
    event.actorType !== 'player' ||
    !(Number(event.coefficient) > 0) ||
    !hasThiefTrait(context.config, TRAIT.SHADOW_SIPHONING)
  )
    return;
  const skill = event.skillId == null ? undefined : context.helpers.skillsById?.get(event.skillId);
  const namedSkill = event.skillName == null ? undefined : context.helpers.skillsByName?.get(event.skillName);
  if (!(skill || namedSkill)?.stealthAttack) return;
  const state = professionCoreState(context);
  const profile = thiefBalanceProfile(context, PROFILE.shadowSiphoning);
  const readyAt = Number(state.traitProcReadyAt[TRAIT.SHADOW_SIPHONING] || 0);
  if (event.at + 1e-9 < readyAt) return;
  state.traitProcReadyAt[TRAIT.SHADOW_SIPHONING] = event.at + Number(profile?.internalCooldown || 1);
  enqueueSiphon(context, event, {
    sourceId: TRAIT.SHADOW_SIPHONING,
    name: 'Shadow Siphoning',
    coefficient: Number(thiefBalanceProfileEffect(profile, 'strike')?.coefficient || 0.1)
  });
}

function targetConditionCount(context: ThiefResolverContext, at: number): number {
  return CANONICAL_TARGET_CONDITIONS.filter((condition) => context.query?.targetHasCondition(condition, at, context))
    .length;
}

function applyPanicStrike(
  context: ThiefResolverContext,
  event: ThiefResolverEvent,
  details: ThiefResolverReactionDetails = {}
): void {
  if (
    event.actorType !== 'player' ||
    !(Number(event.coefficient) > 0) ||
    !hasThiefTrait(context.config, TRAIT.PANIC_STRIKE) ||
    targetConditionCount(context, event.at) < Number(thiefBalanceProfile(context, PROFILE.panicStrike)?.threshold || 3)
  )
    return;
  const state = professionCoreState(context);
  const profile = thiefBalanceProfile(context, PROFILE.panicStrike);
  const immobilized = thiefBalanceProfileEffect(profile, 'condition', 0);
  const readyAt = Number(state.traitProcReadyAt[TRAIT.PANIC_STRIKE] || 0);
  if (event.at + 1e-9 < readyAt) return;
  state.traitProcReadyAt[TRAIT.PANIC_STRIKE] = event.at + Number(profile?.internalCooldown || 20);
  details.applyCondition?.(context, {
    type: 'condition',
    at: event.at,
    source: 'Trait',
    sourceId: TRAIT.PANIC_STRIKE,
    actorType: 'player',
    skillId: TRAIT.PANIC_STRIKE,
    skillName: 'Panic Strike',
    name: 'Panic Strike - Immobilized',
    condition: String(immobilized?.condition || 'Immobilized'),
    stacks: Number(immobilized?.stacks || 1),
    duration: Number(immobilized?.duration || 2.5),
    activationId: `panic-strike:${event.at}`,
    triggeredBy: event.skillName
  });
}

export function reactToThiefCoreDamage(
  context: ThiefResolverContext,
  event: ThiefResolverEvent,
  details: ThiefResolverReactionDetails = {}
): void {
  applySpiderVenom(context, event, details);
  applyShadowSiphoning(context, event);
  applyPanicStrike(context, event, details);
}

export function reactToThiefCoreCondition(context: ThiefResolverContext, application: ThiefResolverEvent): void {
  if (
    application.condition === 'Poisoned' &&
    application.skillId === ID.SPIDER_VENOM &&
    application.triggeredByAlly &&
    hasThiefTrait(context.config, TRAIT.LEECHING_VENOMS)
  ) {
    const strike = traitEffect(context, PROFILE.leechingVenoms, 'strike');
    enqueueSiphon(context, application, {
      sourceId: TRAIT.LEECHING_VENOMS,
      name: 'Leeching Venoms',
      coefficient: Number(strike?.coefficient || 0.033)
    });
  }

  if (
    application.condition === 'Immobilized' &&
    application.actorType === 'player' &&
    hasThiefTrait(context.config, TRAIT.PANIC_STRIKE)
  ) {
    const profile = thiefBalanceProfile(context, PROFILE.panicStrike);
    const poison = thiefBalanceProfileEffect(profile, 'condition', 1);
    enqueueOrdered(context.queue, {
      type: 'condition',
      at: application.at,
      source: 'Trait',
      sourceId: TRAIT.PANIC_STRIKE,
      actorType: 'player',
      skillId: TRAIT.PANIC_STRIKE,
      skillName: 'Panic Strike',
      name: 'Panic Strike - Poison',
      condition: String(poison?.condition || 'Poisoned'),
      stacks: hasThiefTrait(context.config, TRAIT.POTENT_POISON)
        ? Number(profile?.playerStacks || 2)
        : Number(poison?.stacks || 1),
      duration: Number(poison?.duration || 4),
      activationId: application.activationId || `panic-strike:${application.at}`,
      triggeredBy: application.skillName
    });
  }

  if (application.condition === 'Blindness' && hasThiefTrait(context.config, TRAIT.CLOAKED_IN_SHADOW)) {
    const strike = traitEffect(context, PROFILE.cloakedInShadow, 'strike');
    enqueueSiphon(context, application, {
      sourceId: TRAIT.CLOAKED_IN_SHADOW,
      name: 'Cloaked in Shadow',
      coefficient: Number(strike?.coefficient || 0.04)
    });
  }

  if (application.condition === 'Bleeding' && Number(application.bonusAboveNinetyStacks || 0) > 0) {
    const maximum = Number(context.config?.target?.health || 0);
    const damage = Number(context.totals?.strike || 0) + Number(context.totals?.condition || 0);
    if (!(maximum > 0) || damage / maximum < 0.1) {
      enqueueOrdered(context.queue, {
        ...application,
        type: 'condition',
        name: 'Unsuspecting Strike - Bonus Bleeding',
        condition: application.condition,
        duration: Number(application.duration || 0),
        stacks: Number(application.bonusAboveNinetyStacks),
        bonusAboveNinetyStacks: 0
      });
    }
  }
}
