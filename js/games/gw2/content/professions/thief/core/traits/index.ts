import {
  emitSkillBuff,
  emitSkillCondition,
  emitSkillControl,
  emitSkillDamage
} from '#gw2/platform/scheduler/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { emitStateSnapshot } from '#gw2/platform/engine/events/state-snapshots.js';
import { enqueueOrdered } from '#kernel/events/queue.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { CANONICAL_TARGET_CONDITIONS } from '#gw2/platform/combat/state/targets.js';
import { combinedTargetDamage } from '#gw2/platform/combat/state/target-health.js';
import { gw2ResolverBoonDuration } from '#gw2/platform/resolver/boon-duration.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/scheduler/policy.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/content/professions/thief/data/ids.js';
import { snapshotThiefState } from '#gw2/content/professions/thief/core/state.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  gainThiefEndurance,
  gainThiefInitiative
} from '#gw2/content/professions/thief/core/mechanics/resource-events.js';
import type { SkillId } from '#gw2/platform/engine/types.js';
import type { ResolvedCriticalHitOptions } from '#gw2/integrations/patches/authoring/mechanics.js';
import type {
  ThiefCastContext,
  ThiefResolverContext,
  ThiefResolverEvent,
  ThiefResolverReactionDetails,
  ThiefSkill
} from '#gw2/content/professions/thief/types.js';
import {
  thiefBalanceProfile,
  thiefBalanceProfileEffect,
  THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE
} from '#gw2/content/professions/thief/core/profiles.js';

function traitEffect(context: unknown, profileId: SkillId, type: string, index = 0) {
  return thiefBalanceProfileEffect(thiefBalanceProfile(context, profileId), type, index);
}

type ThiefCriticalHitDefinition = ResolvedCriticalHitOptions<
  ThiefResolverContext,
  ThiefResolverEvent,
  ThiefResolverReactionDetails
>;

// Materialize all selected on-Steal conditions, strikes, boons, control, and
// ICD-bound effects at the completed steal timestamp.
export function emitStealTraitEffects(context: ThiefCastContext): void {
  const at = context.effectiveEnd;
  const state = professionCoreState(context);
  const potentPoison = hasTrait(context.config, TRAIT.POTENT_POISON);
  if (hasTrait(context.config, TRAIT.SERPENTS_TOUCH)) {
    const profile = thiefBalanceProfile(context, PROFILE.serpentsTouch);
    const poison = thiefBalanceProfileEffect(profile, 'condition');
    emitSkillCondition(context, {
      at,
      source: 'Trait',
      actorType: 'player',
      skillId: context.skill?.id ?? null,
      skillName: context.skill?.name ?? null,
      condition: String(poison?.condition || 'Poisoned'),
      duration: Number(poison?.duration || 10),
      stacks: potentPoison ? Number(profile?.playerStacks || 3) : Number(poison?.stacks || 2),
      sourceId: TRAIT.SERPENTS_TOUCH,
      name: "Serpent's Touch — Poison"
    });
  }

  if (hasTrait(context.config, TRAIT.MUG)) {
    const strike = traitEffect(context, PROFILE.mug, 'strike');
    emitSkillDamage(context, {
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

  if (hasTrait(context.config, TRAIT.EVEN_THE_ODDS)) {
    const vulnerability = traitEffect(context, PROFILE.evenTheOdds, 'condition');
    emitSkillCondition(context, {
      at,
      source: 'Trait',
      actorType: 'player',
      skillId: context.skill?.id ?? null,
      skillName: context.skill?.name ?? null,
      condition: String(vulnerability?.condition || 'Vulnerability'),
      duration: Number(vulnerability?.duration || 10),
      stacks: Number(vulnerability?.stacks || 10),
      sourceId: TRAIT.EVEN_THE_ODDS,
      name: 'Even the Odds — Vulnerability'
    });
  }

  if (hasTrait(context.config, TRAIT.DEADLY_AMBUSH)) {
    const bleeding = traitEffect(context, PROFILE.deadlyAmbush, 'condition');
    emitSkillCondition(context, {
      at,
      source: 'Trait',
      actorType: 'player',
      skillId: context.skill?.id ?? null,
      skillName: context.skill?.name ?? null,
      condition: String(bleeding?.condition || 'Bleeding'),
      duration: Number(bleeding?.duration || 10),
      stacks: Number(bleeding?.stacks || 3),
      sourceId: TRAIT.DEADLY_AMBUSH,
      name: 'Deadly Ambush — Bleeding'
    });
  }

  if (hasTrait(context.config, TRAIT.THRILL_OF_THE_CRIME)) {
    for (const effect of (thiefBalanceProfile(context, PROFILE.thrillOfTheCrime)?.effects || []).filter(
      (entry) => entry.type === 'boon'
    )) {
      const boon = String(effect.boon || effect.kind || '');
      emitSkillBuff(context, {
        at,
        source: 'Trait',
        sourceId: `thief.steal.${boon}`,
        actorType: 'player',
        skillId: context.skill?.id ?? null,
        skillName: context.skill?.name ?? null,
        name: `Steal — ${boon}`,
        kind: boon,
        boon,
        duration: gw2SchedulerBoonDuration(context, context.skill, boon, Number(effect.duration || 10)),
        stacks: Number(effect.stacks || 1)
      });
    }
  }

  if (hasTrait(context.config, TRAIT.BOUNTIFUL_THEFT)) {
    const vigor = traitEffect(context, PROFILE.bountifulTheft, 'boon', 0);
    const might = traitEffect(context, PROFILE.bountifulTheft, 'boon', 1);
    const vigorName = String(vigor?.boon || 'Vigor');
    emitSkillBuff(context, {
      at,
      source: 'Trait',
      sourceId: `thief.steal.${vigorName}`,
      actorType: 'player',
      skillId: context.skill?.id ?? null,
      skillName: context.skill?.name ?? null,
      name: `Steal — ${vigorName}`,
      kind: vigorName,
      boon: vigorName,
      duration: gw2SchedulerBoonDuration(context, context.skill, vigorName, Number(vigor?.duration || 10)),
      stacks: Number(vigor?.stacks || 1)
    });
    if (context.config.target?.boonless !== false) {
      const mightName = String(might?.boon || 'Might');
      emitSkillBuff(context, {
        at,
        source: 'Trait',
        sourceId: `thief.steal.${mightName}`,
        actorType: 'player',
        skillId: context.skill?.id ?? null,
        skillName: context.skill?.name ?? null,
        name: `Steal — ${mightName}`,
        kind: mightName,
        boon: mightName,
        duration: gw2SchedulerBoonDuration(context, context.skill, mightName, Number(might?.duration || 10)),
        stacks: Number(might?.stacks || 5)
      });
    }
  }

  if (hasTrait(context.config, TRAIT.SLEIGHT_OF_HAND)) {
    const control = traitEffect(context, PROFILE.sleightOfHand, 'control');
    emitSkillControl(context, {
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

  if (hasTrait(context.config, TRAIT.HIDDEN_THIEF)) {
    const profile = thiefBalanceProfile(context, PROFILE.hiddenThief);
    const blindness = thiefBalanceProfileEffect(profile, 'condition', 0);
    const weakness = thiefBalanceProfileEffect(profile, 'condition', 1);
    const readyAt = Number(state.traitProcReadyAt[TRAIT.HIDDEN_THIEF] ?? 0);
    if (isInternalCooldownReady(at, readyAt)) {
      state.traitProcReadyAt[TRAIT.HIDDEN_THIEF] = at + Number(profile?.internalCooldown || 2);
      emitSkillCondition(context, {
        at,
        source: 'Trait',
        actorType: 'player',
        skillId: context.skill?.id ?? null,
        skillName: context.skill?.name ?? null,
        condition: 'Blindness',
        duration: Number(blindness?.duration || 3),
        stacks: Number(blindness?.stacks || 1),
        sourceId: TRAIT.HIDDEN_THIEF,
        name: 'Hidden Thief - Blindness'
      });
      emitSkillCondition(context, {
        at,
        source: 'Trait',
        actorType: 'player',
        skillId: context.skill?.id ?? null,
        skillName: context.skill?.name ?? null,
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
  if (hasTrait(context.config, TRAIT.KLEPTOMANIAC)) {
    gainThiefInitiative(
      context,
      Number(thiefBalanceProfile(context, PROFILE.kleptomaniac)?.resourceGain || 2),
      at,
      'kleptomaniac'
    );
  }

  if (hasTrait(context.config, TRAIT.ENDURANCE_THIEF)) {
    gainThiefEndurance(
      context,
      Number(thiefBalanceProfile(context, PROFILE.enduranceThief)?.resourceGain || 50),
      at,
      'endurance-thief'
    );
  }
}

// Convert initiative spending, movement, and dual-wield completion into their
// persistent trait state and immediate resource or condition effects.
export function updateThiefTraitCastState(context: ThiefCastContext, skill: ThiefSkill): void {
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  const initiativeCost = Math.max(0, Number(skill.initiativeCost || 0));
  if (initiativeCost > 0 && hasTrait(context.config, TRAIT.LEAD_ATTACKS)) {
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
    emitStateSnapshot(context, 'thief', at, 'lead-attacks', snapshotThiefState(context.state.profession));
  }

  if (skill.movementSkill) {
    let movementStateChanged = false;
    if (hasTrait(context.config, TRAIT.FLUID_STRIKES)) {
      state.fluidStrikesUntil =
        at + Number(thiefBalanceProfile(context, PROFILE.fluidStrikes)?.durationMultiplier || 5);
      movementStateChanged = true;
    }

    if (hasTrait(context.config, TRAIT.HARD_TO_CATCH)) {
      gainThiefEndurance(
        context,
        Number(thiefBalanceProfile(context, PROFILE.hardToCatch)?.resourceGain || 8),
        at,
        'hard-to-catch'
      );
    } else if (movementStateChanged) {
      emitStateSnapshot(context, 'thief', at, 'fluid-strikes', snapshotThiefState(context.state.profession));
    }
  }

  const isDualWieldAttack =
    skill.categories?.includes('DualWield') ||
    Boolean(skill.requiredMainHand && typeof skill.requiredOffHand === 'string');
  if (isDualWieldAttack && hasTrait(context.config, TRAIT.DEADLY_AMBITION)) {
    const potentPoison = hasTrait(context.config, TRAIT.POTENT_POISON);
    const profile = thiefBalanceProfile(context, PROFILE.deadlyAmbition);
    const poison = thiefBalanceProfileEffect(profile, 'condition');
    emitSkillCondition(context, {
      at,
      source: 'Trait',
      actorType: 'player',
      skillId: context.skill?.id ?? null,
      skillName: context.skill?.name ?? null,
      condition: String(poison?.condition || 'Poisoned'),
      duration: Number(poison?.duration || 3),
      stacks: potentPoison ? Number(profile?.playerStacks || 2) : Number(poison?.stacks || 1),
      sourceId: TRAIT.DEADLY_AMBITION,
      name: 'Deadly Ambition — Poison'
    });
  }
}

const EPSILON = 1e-9;

// Queue a trait boon with live duration scaling and explicit self or party
// recipient semantics.
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
    duration: gw2ResolverBoonDuration(context, event, boon, duration),
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
    materialization: 'threshold',
    actorTypes: ['player'] as const,
    when: (context: ThiefResolverContext, event: ThiefResolverEvent, details: ThiefResolverReactionDetails) =>
      Boolean(details.hitContext?.critEligible) &&
      Number(event.coefficient) > 0 &&
      hasTrait(context.config, TRAIT.UNRELENTING_STRIKES),
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
    handler: (context, event, _details, application) => {
      // Unrelenting Strikes emits its discrete boon package for every threshold proc.
      for (let proc = 0; proc < application.quantity; proc += 1) {
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
    }
  } satisfies ThiefCriticalHitDefinition),
  noQuarter: Object.freeze({
    id: 'thief.no-quarter',
    order: 20,
    materialization: 'threshold',
    actorTypes: ['player'] as const,
    when: (context: ThiefResolverContext, event: ThiefResolverEvent, details: ThiefResolverReactionDetails) =>
      Boolean(details.hitContext?.critEligible) &&
      Number(event.coefficient) > 0 &&
      hasTrait(context.config, TRAIT.NO_QUARTER) &&
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
    handler: (context, event, _details, application) => {
      // No Quarter extends Fury once for each discrete threshold proc.
      for (let proc = 0; proc < application.quantity; proc += 1) {
        extendActiveFury(context, event, Number(traitEffect(context, PROFILE.noQuarter, 'boon')?.duration || 2));
      }
    }
  } satisfies ThiefCriticalHitDefinition)
});

// Turn a self-affecting Fury application into Assassin's Fury Might while
// enforcing its independent internal cooldown.
export function reactToThiefCoreBuff(context: ThiefResolverContext, event: ThiefResolverEvent): void {
  if (
    String(event.kind || '').toLowerCase() !== 'fury' ||
    event.affectsSelf === false ||
    !hasTrait(context.config, TRAIT.ASSASSINS_FURY)
  )
    return;
  const state = professionCoreState(context);
  const profile = thiefBalanceProfile(context, PROFILE.assassinsFury);
  const might = thiefBalanceProfileEffect(profile, 'boon');
  const readyAt = Number(state.traitProcReadyAt[TRAIT.ASSASSINS_FURY] || 0);
  if (!isInternalCooldownReady(event.at, readyAt)) return;
  state.traitProcReadyAt[TRAIT.ASSASSINS_FURY] = event.at + Number(profile?.internalCooldown || 2);
  queueThiefBoon(context, event, {
    traitId: TRAIT.ASSASSINS_FURY,
    traitName: "Assassin's Fury",
    boon: String(might?.boon || 'Might'),
    duration: Number(might?.duration || 8),
    stacks: Number(might?.stacks || 3)
  });
}

// Queue a non-critical life-siphon strike causally linked to the triggering
// Thief event.
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

// Spend one player-owned Spider Venom charge per qualifying strike, applying its
// poison and optional Leeching Venoms siphon through resolver-safe paths.
function applySpiderVenom(context: ThiefResolverContext, event: ThiefResolverEvent): void {
  if (event.actorType !== 'player' || !(Number(event.coefficient) > 0)) return;
  const state = professionCoreState(context);
  if (Number(state.spiderVenomCharges || 0) <= 0 || Number(state.spiderVenomExpiresAt || 0) <= event.at) return;
  state.spiderVenomCharges -= 1;
  const poison = traitEffect(context, PROFILE.spiderVenomProc, 'condition');
  context.applyCondition({
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
  if (hasTrait(context.config, TRAIT.LEECHING_VENOMS)) {
    const strike = traitEffect(context, PROFILE.leechingVenoms, 'strike');
    enqueueSiphon(context, event, {
      sourceId: TRAIT.LEECHING_VENOMS,
      name: 'Leeching Venoms',
      coefficient: Number(strike?.coefficient || 0.033)
    });
  }
}

// Add the ICD-bound Shadow Siphoning life steal only to resolved stealth-attack
// strikes, using catalog metadata rather than event naming alone.
function applyShadowSiphoning(context: ThiefResolverContext, event: ThiefResolverEvent): void {
  if (
    event.actorType !== 'player' ||
    !(Number(event.coefficient) > 0) ||
    !hasTrait(context.config, TRAIT.SHADOW_SIPHONING)
  )
    return;
  const skill = event.skillId == null ? undefined : context.helpers.skillsById?.get(event.skillId);
  const namedSkill = event.skillName == null ? undefined : context.helpers.skillsByName?.get(event.skillName);
  if (!(skill || namedSkill)?.stealthAttack) return;
  const state = professionCoreState(context);
  const profile = thiefBalanceProfile(context, PROFILE.shadowSiphoning);
  const readyAt = Number(state.traitProcReadyAt[TRAIT.SHADOW_SIPHONING] || 0);
  if (!isInternalCooldownReady(event.at, readyAt)) return;
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

// Trigger Panic Strike only after the target meets its condition-count threshold,
// reserving the ICD before applying the causally linked immobilize.
function applyPanicStrike(context: ThiefResolverContext, event: ThiefResolverEvent): void {
  if (
    event.actorType !== 'player' ||
    !(Number(event.coefficient) > 0) ||
    !hasTrait(context.config, TRAIT.PANIC_STRIKE) ||
    targetConditionCount(context, event.at) < Number(thiefBalanceProfile(context, PROFILE.panicStrike)?.threshold || 3)
  )
    return;
  const state = professionCoreState(context);
  const profile = thiefBalanceProfile(context, PROFILE.panicStrike);
  const immobilized = thiefBalanceProfileEffect(profile, 'condition', 0);
  const readyAt = Number(state.traitProcReadyAt[TRAIT.PANIC_STRIKE] || 0);
  if (!isInternalCooldownReady(event.at, readyAt)) return;
  state.traitProcReadyAt[TRAIT.PANIC_STRIKE] = event.at + Number(profile?.internalCooldown || 20);
  context.applyCondition({
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

export function reactToThiefCoreDamage(context: ThiefResolverContext, event: ThiefResolverEvent): void {
  // Derived strike conditions resolve immediately so their condition hooks run
  // before later same-timestamp damage reactions.
  applySpiderVenom(context, event);
  applyShadowSiphoning(context, event);
  applyPanicStrike(context, event);
}

// Route resolved conditions into their follow-up siphons, Panic Strike poison,
// and health-gated Unsuspecting Strike bonus without mutating the source packet.
export function reactToThiefCoreCondition(context: ThiefResolverContext, application: ThiefResolverEvent): void {
  if (
    application.condition === 'Poisoned' &&
    application.skillId === ID.SPIDER_VENOM &&
    application.triggeredByAlly &&
    hasTrait(context.config, TRAIT.LEECHING_VENOMS)
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
    hasTrait(context.config, TRAIT.PANIC_STRIKE)
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
      stacks: hasTrait(context.config, TRAIT.POTENT_POISON)
        ? Number(profile?.playerStacks || 2)
        : Number(poison?.stacks || 1),
      duration: Number(poison?.duration || 4),
      activationId: application.activationId || `panic-strike:${application.at}`,
      triggeredBy: application.skillName
    });
  }

  if (application.condition === 'Blindness' && hasTrait(context.config, TRAIT.CLOAKED_IN_SHADOW)) {
    const strike = traitEffect(context, PROFILE.cloakedInShadow, 'strike');
    enqueueSiphon(context, application, {
      sourceId: TRAIT.CLOAKED_IN_SHADOW,
      name: 'Cloaked in Shadow',
      coefficient: Number(strike?.coefficient || 0.04)
    });
  }

  if (application.condition === 'Bleeding' && Number(application.bonusAboveNinetyStacks || 0) > 0) {
    const maximum = Number(context.config?.target?.health || 0);
    const damage = combinedTargetDamage(context);
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
