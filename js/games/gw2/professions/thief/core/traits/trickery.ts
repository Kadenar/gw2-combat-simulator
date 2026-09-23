import { emitThiefStateSnapshot } from '#gw2/professions/thief/family-state.js';
import { grantTimedStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumberFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import {
  emitSkillBuff,
  emitSkillCondition,
  emitSkillControl
} from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/execution/gw2-policy/policy.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { gainThiefInitiative } from '#gw2/professions/thief/core/mechanics/resource-events.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/core/profiles.js';
import type { ThiefCastContext, ThiefSkill } from '#gw2/professions/thief/types.js';

/** Applies Trickery's steal, initiative, and initiative-spend effects in dispatcher order. */
export function applyDeadlyAmbush(context: ThiefCastContext, at: number): void {
  if (!hasTrait(context.config, TRAIT.DEADLY_AMBUSH)) return;
  const deadlyAmbushProfile = requireBalanceProfileFromContext(context, PROFILE.deadlyAmbush);
  const bleeding = requireEffect(deadlyAmbushProfile, 'condition', 'Bleeding', context);
  // Explicit removal suppresses this packet without restoring baseline tuning.
  if (!bleeding) return;
  emitSkillCondition(context, {
    at,
    source: 'Trait',
    // Attribute the condition to its trait while retaining the triggering steal.
    skillId: TRAIT.DEADLY_AMBUSH,
    skillName: 'Deadly Ambush',
    triggeredBy: context.skill?.name,
    condition: String(bleeding.condition),
    duration: effectNumber(deadlyAmbushProfile, bleeding, 'duration', context),
    stacks: effectNumber(deadlyAmbushProfile, bleeding, 'stacks', context),
    name: 'Deadly Ambush — Bleeding'
  });
}

export function applyThrillOfTheCrime(context: ThiefCastContext, at: number): void {
  if (!hasTrait(context.config, TRAIT.THRILL_OF_THE_CRIME)) return;
  const thrillOfTheCrimeProfile = requireBalanceProfileFromContext(context, PROFILE.thrillOfTheCrime);
  for (const effect of (thrillOfTheCrimeProfile.effects || []).filter((entry) => entry.type === 'boon')) {
    const boon = String(effect.boon);
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
      duration: gw2SchedulerBoonDuration(
        context,
        context.skill,
        boon,
        effectNumber(thrillOfTheCrimeProfile, effect, 'duration', context)
      ),
      stacks: effectNumber(thrillOfTheCrimeProfile, effect, 'stacks', context)
    });
  }
}

export function applyBountifulTheft(context: ThiefCastContext, at: number): void {
  if (!hasTrait(context.config, TRAIT.BOUNTIFUL_THEFT)) return;
  // The boonless target grants both independent packets; removing either leaves its sibling intact.
  const bountifulTheftProfile = requireBalanceProfileFromContext(context, PROFILE.bountifulTheft);
  for (const name of ['Vigor', 'Might']) {
    const effect = requireEffect(bountifulTheftProfile, 'boon', name, context);
    if (!effect) continue;
    const boon = String(effect.boon);
    emitSkillBuff(context, {
      at,
      source: 'Trait',
      sourceId: `thief.steal.${boon}`,
      actorType: 'player',
      skillId: context.skill?.id ?? null,
      skillName: context.skill?.name ?? null,
      name: `Steal � ${boon}`,
      kind: boon,
      boon,
      duration: gw2SchedulerBoonDuration(
        context,
        context.skill,
        boon,
        effectNumber(bountifulTheftProfile, effect, 'duration', context)
      ),
      stacks: effectNumber(bountifulTheftProfile, effect, 'stacks', context)
    });
  }
}

export function applySleightOfHand(context: ThiefCastContext, at: number): void {
  if (!hasTrait(context.config, TRAIT.SLEIGHT_OF_HAND)) return;
  // The Daze packet is removable independently of the recharge scalar.
  const sleightOfHandProfile = requireBalanceProfileFromContext(context, PROFILE.sleightOfHand);
  const control = requireEffect(sleightOfHandProfile, 'control', 'daze', context);
  if (!control) return;
  emitSkillControl(context, {
    at,
    source: 'Trait',
    sourceId: TRAIT.SLEIGHT_OF_HAND,
    actorType: 'player',
    skillId: context.skill?.id,
    skillName: context.skill?.name,
    name: 'Sleight of Hand - Daze',
    effect: control.kind
  });
}

export function applyKleptomaniac(context: ThiefCastContext, at: number): void {
  if (!hasTrait(context.config, TRAIT.KLEPTOMANIAC)) return;
  gainThiefInitiative(
    context,
    balanceProfileNumberFromContext(context, PROFILE.kleptomaniac, 'resourceGain'),
    at,
    'kleptomaniac'
  );
}

export function applyLeadAttacks(context: ThiefCastContext, skill: ThiefSkill, at: number): void {
  const initiativeCost = Math.max(0, Number(skill.initiativeCost || 0));
  if (initiativeCost <= 0 || !hasTrait(context.config, TRAIT.LEAD_ATTACKS)) return;
  const state = professionCoreState(context);

  const leadAttacksProfile = requireBalanceProfileFromContext(context, PROFILE.leadAttacks);
  const maximumStacks = balanceProfileNumber(leadAttacksProfile, 'maximumStacks', context);
  // New initiative spending replaces the oldest stacks at the cap without refreshing the remaining stacks.
  const expirations = grantTimedStacks(state.leadAttackExpirations || [], {
    at,
    expiresAt: at + balanceProfileNumber(leadAttacksProfile, 'durationMultiplier', context),
    // A patched fractional cost has always granted a whole stack for its remainder, so round up here
    // rather than let the shared integer boundary truncate it.
    count: Math.ceil(initiativeCost),
    maximumStacks,
    retain: 'newest-grant'
  });

  state.leadAttackExpirations = expirations;
  state.leadAttacksStacks = expirations.length;

  // Include replacements so the capped chart retains every new stack's full duration.
  emitSkillBuff(context, skill, {
    at,
    source: 'Trait',
    sourceId: TRAIT.LEAD_ATTACKS,
    kind: 'lead-attacks',
    duration: balanceProfileNumber(leadAttacksProfile, 'durationMultiplier', context),
    stacks: Math.min(initiativeCost, maximumStacks)
  });

  emitThiefStateSnapshot(context, at, 'lead-attacks');
}
