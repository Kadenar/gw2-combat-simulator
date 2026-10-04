import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import type { Gw2ResolvedStats } from '#gw2/platform/combat/query/combat-query.js';
import { eventSkill } from '#gw2/platform/combat/query/runtime-query.js';
import { activeStackCount, grantTimedStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { readProfessionCoreState } from '#gw2/platform/profession-definition/state.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { isFlatLifeStealPacket } from '#gw2/platform/resolver/packets.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { buildThiefBuff, buildThiefCondition } from '#gw2/professions/thief/core/events.js';
import {
  grantThiefEndurance,
  grantThiefInitiative,
  setThiefKneeling
} from '#gw2/professions/thief/core/mechanics/resources.js';
import { thiefRuntimeState } from '#gw2/professions/thief/core/modifiers.js';
import type { ThiefCoreState } from '#gw2/professions/thief/core/state.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import type { ThiefResolverContext, ThiefResolverEvent, ThiefSkill } from '#gw2/professions/thief/types.js';

/** Applies Cloaked in Shadow at its established mechanical boundary. */
export function enterCloakedInShadow(runtime: ThiefRuntime, skill: ThiefSkill, at: number): void {
  if (hasTrait(runtime, TRAIT.CLOAKED_IN_SHADOW))
    runtime.effects.emit({
      kind: 'packet',
      event: buildThiefCondition(skill, {
        at,
        source: 'Trait',
        sourceId: TRAIT.CLOAKED_IN_SHADOW,
        name: 'Cloaked in Shadow — Blindness',
        condition: 'Blindness',
        stacks: 1,
        duration: 5
      })
    });
}

/** Applies Fluid Strikes at its established mechanical boundary. */
export function applyFluidStrikes(runtime: ThiefRuntime): void {
  if (hasTrait(runtime, TRAIT.FLUID_STRIKES))
    runtime.profession.core.fluidStrikesUntil =
      runtime.time +
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.FLUID_STRIKES), 'durationMultiplier');
}

/** Applies Hard to Catch at its established mechanical boundary. */
export function applyHardToCatch(runtime: ThiefRuntime): void {
  if (hasTrait(runtime, TRAIT.HARD_TO_CATCH))
    grantThiefEndurance(
      runtime,
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.HARD_TO_CATCH), 'resourceGain')
    );
}

/** Natural expiry and forced exit share the selected patch's linger duration. */
export function hiddenKillerLinger(runtime: ThiefRuntime): number {
  return balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.HIDDEN_KILLER), 'duration');
}

/** Apply siphon-specific bonuses at impact because flat life steal bypasses ordinary strike modifiers. */
export function modifyThiefLifeSiphon(context: ThiefResolverContext, event: ThiefResolverEvent) {
  if (!isFlatLifeStealPacket(event) || !isGw2PlayerModifierOwnedEvent(event)) return;
  let multiplier = event.flatStrikeMultiplier ?? 1;
  // Vampiric Slash samples live Vulnerability for its siphon only, independently of the packet's label.
  if (
    event.metadata?.packetKind === 'thief.vampiric-slash-life-siphon' &&
    context.combat.targetHasCondition('Vulnerability', event.at)
  )
    multiplier *= 1.5;

  if (hasTrait(context.config, TRAIT.LEAD_ATTACKS)) {
    const state = readProfessionCoreState<ThiefCoreState>(context.profession);
    const leadAttacksProfile = requireBalanceProfileFromContext(context, TRAIT.LEAD_ATTACKS);
    // Stacks expire individually, so the siphon counts those active at its own impact.
    const stacks = Math.min(
      balanceProfileNumber(leadAttacksProfile, 'maximumStacks'),
      activeStackCount(state.leadAttackExpirations || [], event.at)
    );
    multiplier *= 1 + stacks * balanceProfileNumber(leadAttacksProfile, 'damageIncreasePerStack');
  }

  return { flatStrikeMultiplier: multiplier };
}

/** Initiative spent grants Lead Attacks stacks at completion, replacing the oldest at the cap. */
export function applyLeadAttacks(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  const skill = cast.skill;
  const cost = Math.max(0, skill.initiativeCost || 0);
  if (cost <= 0 || !hasTrait(runtime, TRAIT.LEAD_ATTACKS)) return;
  const core = runtime.profession.core;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.LEAD_ATTACKS);
  const maximumStacks = balanceProfileNumber(profile, 'maximumStacks');
  const duration = balanceProfileNumber(profile, 'durationMultiplier');
  // A patched fractional cost grants a whole stack for its remainder, so round up before the integer boundary.
  core.leadAttackExpirations = grantTimedStacks(core.leadAttackExpirations, {
    at: runtime.time,
    expiresAt: runtime.time + duration,
    count: Math.ceil(cost),
    maximumStacks,
    retain: 'newest-grant'
  });
  runtime.effects.emit({
    kind: 'packet',
    event: buildThiefBuff(skill, {
      at: runtime.time,
      source: 'Trait',
      sourceId: TRAIT.LEAD_ATTACKS,
      activationId: cast.id,
      kind: 'lead-attacks',
      duration,
      stacks: Math.min(cost, maximumStacks)
    })
  });
}

/** Additive Steal recharge retains each trait's independent reduction. */
export function leadAttacksRechargeReduction(runtime: MechanicQueriesOf<ThiefRuntime>): number {
  return (
    Number(hasTrait(runtime, TRAIT.LEAD_ATTACKS)) *
    (1 - balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.LEAD_ATTACKS), 'rechargeMultiplier'))
  );
}

/** Preview and runtime capacities use the same Preparedness branch. */
export function preparednessCapacityField(context: unknown): 'minimumStacks' | 'maximumStacks' {
  return hasTrait(context, TRAIT.PREPAREDNESS) ? 'minimumStacks' : 'maximumStacks';
}

/** Swapping weapons stands up; Quick Pockets grants in-combat initiative once per its cooldown. */
export function completeThiefWeaponSwap(runtime: ThiefRuntime): void {
  setThiefKneeling(runtime, false);
  if (
    !runtime.combatStartedAt() ||
    !hasTrait(runtime, TRAIT.QUICK_POCKETS) ||
    !runtime.procs.claim(TRAIT.QUICK_POCKETS, 'thief.core.quickPockets', runtime.time)
  )
    return;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.QUICK_POCKETS);
  grantThiefInitiative(runtime, balanceProfileNumber(profile, 'resourceGain'));
}

/** Reconcile this trait's live bonus at its original attribute phase. */
export function applyRevealedTrainingAttributes(
  context: Gw2ModifierContext,
  result: { -readonly [K in keyof Gw2ResolvedStats]: Gw2ResolvedStats[K] }
): void {
  const state = thiefRuntimeState(context);
  const staticRulesApplied = professionStaticRulesApplied(context.config);
  if (hasTrait(context, TRAIT.REVEALED_TRAINING)) {
    if (!staticRulesApplied) {
      const revealedTrainingProfile = requireBalanceProfileFromContext(context, TRAIT.REVEALED_TRAINING);
      result.power += balanceProfileNumber(revealedTrainingProfile, 'attributeBonus');
    }

    // A recalled Salvo is a later recall hit, not the stealth attack that applied Revealed.
    const revealingAttack = eventSkill(context)?.stealthAttack && context.event?.metadata?.recallSkillId == null;
    if ((state.revealedUntil || 0) > context.time && !revealingAttack) {
      const revealedTrainingProfile = requireBalanceProfileFromContext(context, TRAIT.REVEALED_TRAINING);
      result.power += balanceProfileNumber(revealedTrainingProfile, 'attributePerStack');
    }
  }
}

/** Applies Shadow's Rejuvenation at its established mechanical boundary. */
export function enterShadowsRejuvenation(runtime: ThiefRuntime): void {
  if (hasTrait(runtime, TRAIT.SHADOWS_REJUVENATION)) grantThiefInitiative(runtime, 2);
}

/** Applies Shadow's Rejuvenation at its established mechanical boundary. */
export function exitShadowsRejuvenation(runtime: ThiefRuntime): void {
  if (hasTrait(runtime, TRAIT.SHADOWS_REJUVENATION))
    grantThiefInitiative(
      runtime,
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.SHADOWS_REJUVENATION), 'resourceGain')
    );
}

// Signets of Power grants initiative at acceptance, even if the cast is later interrupted.
export const SIGNET_INITIATIVE: NonNullable<NonNullable<Skill['sideEffects']>> = [
  {
    on: 'castStart',
    when: (runtime) => hasTrait(runtime, TRAIT.SIGNETS_OF_POWER),
    do: {
      type: 'resourceGrant',
      resource: 'initiative',
      amount: { profile: TRAIT.SIGNETS_OF_POWER, field: 'resourceGain' }
    }
  }
];

/** Sundering Shade's Vulnerability follows the completed stealth attack. */
export function completeThiefStealthAttack(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  if (!hasTrait(runtime, TRAIT.SUNDERING_SHADE)) return;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.SUNDERING_SHADE);
  const vulnerability = requireEffect(profile, 'condition', 'Vulnerability');
  // Explicit removal suppresses this packet without restoring baseline tuning.
  if (!vulnerability) return;
  runtime.effects.emit({
    kind: 'packet',
    event: buildThiefCondition(cast.skill, {
      at: runtime.time,
      source: 'Trait',
      sourceId: TRAIT.SUNDERING_SHADE,
      activationId: cast.id,
      name: 'Sundering Shade — Vulnerability',
      condition: String(vulnerability.condition),
      duration: effectNumber(profile, vulnerability, 'duration'),
      stacks: effectNumber(profile, vulnerability, 'stacks')
    })
  });
}

/** Uncatchable's caltrop pulses are queued from the dodge's takeoff; the runtime has already paid its endurance. */
export function startThiefDodge(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  if (!hasTrait(runtime, TRAIT.UNCATCHABLE)) return;
  // Each condition's authored timing is authoritative; removing one component leaves its sibling's pulses intact.
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.UNCATCHABLE);
  const caltrops = runtime.helpers.skillsById.get(ID.LESSER_CALTROPS);
  runtime.effects.emit({
    kind: 'profile',
    profile: profile,
    effects: profile.effects?.filter(
      (effect) => effect.type === 'condition' && ['Bleeding', 'Crippled'].includes(String(effect.name))
    ),
    attribution: {
      source: 'Trait',
      sourceId: TRAIT.UNCATCHABLE,
      actorType: 'player',
      skillId: ID.LESSER_CALTROPS,
      skillName: 'Lesser Caltrops',
      triggeredBy: cast.skill.name,
      activationId: cast.id
    },
    transform: (event) => ({ ...event, icon: caltrops?.icon, name: 'Uncatchable \u2014 Lesser Caltrops' })
  });
}

/** Upper Hand claims its cooldown when a dodge completes, before its initiative can re-enter the trait. */
export function applyUpperHand(runtime: ThiefRuntime): void {
  if (!hasTrait(runtime, TRAIT.UPPER_HAND)) return;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.UPPER_HAND);
  if (runtime.procs.claimCooldown(TRAIT.UPPER_HAND, runtime.time, balanceProfileNumber(profile, 'internalCooldown')))
    grantThiefInitiative(runtime, balanceProfileNumber(profile, 'resourceGain'));
}
