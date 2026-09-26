import { tryConsumeProcCooldown } from '#gw2/platform/combat/procs.js';
import { grantTimedStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import { targetHealthLoss } from '#gw2/platform/combat/state/target-health.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { onResolvedCriticalHit } from '#gw2/platform/profession-definition/mechanics.js';
import { buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/core/profiles.js';
import { applyActiveVenoms } from '#gw2/professions/thief/core/mechanics/venoms.js';
import {
  applyAssassinsFury,
  noQuarterCriticalReaction,
  unrelentingStrikesCriticalReaction
} from '#gw2/professions/thief/core/traits/critical-strikes.js';
import {
  applyDeadlyAmbition,
  applyLotusPoison,
  applyPanicStrike,
  applyPanicStrikePoison
} from '#gw2/professions/thief/core/traits/deadly-arts.js';
import {
  applyAlliedLeechingVenoms,
  applyCloakedInShadow,
  applyLeechingVenoms,
  applyShadowSiphoning
} from '#gw2/professions/thief/core/traits/shadow-arts.js';
import { emitThiefBuff, emitThiefCondition } from '#gw2/professions/thief/core/events.js';
import { grantThiefEndurance, grantThiefInitiative } from '#gw2/professions/thief/core/mechanics/resources.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import type { ThiefResolverContext, ThiefResolverEvent, ThiefSkill } from '#gw2/professions/thief/types.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';

const unrelentingStrikes = onResolvedCriticalHit(unrelentingStrikesCriticalReaction);
const noQuarter = onResolvedCriticalHit(noQuarterCriticalReaction);

function resolverContext(runtime: ThiefRuntime): ThiefResolverContext {
  return runtime as unknown as ThiefResolverContext;
}

/** Dodges spend endurance at takeoff; Uncatchable's caltrop pulses are queued from the same instant. */
export function startThiefDodge(runtime: ThiefRuntime, cast: RuntimeCast): void {
  const resources = requireBalanceProfileFromContext(runtime, PROFILE.resources);
  runtime.endurance.spend(balanceProfileNumber(resources, 'resourceCost'));
  if (!hasTrait(runtime, TRAIT.UNCATCHABLE)) return;
  // Each surviving condition owns its pulses; deleting Bleeding cannot remove Crippled.
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.uncatchable);
  const initialDelay = balanceProfileNumber(profile, 'initialDelay');
  const pulseInterval = balanceProfileNumber(profile, 'pulseInterval');
  const caltrops = runtime.helpers.skillsById.get(ID.LESSER_CALTROPS);
  for (const name of ['Bleeding', 'Crippled']) {
    const effect = requireEffect(profile, 'condition', name);
    if (!effect) continue;
    const duration = effectNumber(profile, effect, 'duration');
    const stacks = effectNumber(profile, effect, 'stacks');
    for (let pulse = 0; pulse < effectNumber(profile, effect, 'applications'); pulse += 1)
      emitThiefCondition(runtime, null, {
        at: runtime.time + initialDelay + pulse * pulseInterval,
        source: 'Trait',
        sourceId: TRAIT.UNCATCHABLE,
        skillId: ID.LESSER_CALTROPS,
        skillName: 'Lesser Caltrops',
        icon: caltrops?.icon,
        triggeredBy: cast.skill.name,
        activationId: cast.id,
        name: 'Uncatchable — Lesser Caltrops',
        condition: String(effect.condition),
        duration,
        stacks
      });
  }
}

/** Upper Hand claims its cooldown when a dodge completes, before its initiative can re-enter the trait. */
function upperHand(runtime: ThiefRuntime): void {
  if (!hasTrait(runtime, TRAIT.UPPER_HAND)) return;
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.upperHand);
  if (
    tryConsumeProcCooldown(
      runtime.profession.core.traitProcReadyAt,
      TRAIT.UPPER_HAND,
      runtime.time,
      balanceProfileNumber(profile, 'internalCooldown')
    )
  )
    grantThiefInitiative(runtime, balanceProfileNumber(profile, 'resourceGain'));
}

/** Initiative spent grants Lead Attacks stacks at completion, replacing the oldest at the cap. */
function leadAttacks(runtime: ThiefRuntime, cast: RuntimeCast): void {
  const skill = cast.skill as ThiefSkill;
  const cost = Math.max(0, Number(skill.initiativeCost || 0));
  if (cost <= 0 || !hasTrait(runtime, TRAIT.LEAD_ATTACKS)) return;
  const core = runtime.profession.core;
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.leadAttacks);
  const maximumStacks = balanceProfileNumber(profile, 'maximumStacks');
  const duration = balanceProfileNumber(profile, 'durationMultiplier');
  // A patched fractional cost grants a whole stack for its remainder, so round up before the integer boundary.
  core.leadAttackExpirations = grantTimedStacks(core.leadAttackExpirations || [], {
    at: runtime.time,
    expiresAt: runtime.time + duration,
    count: Math.ceil(cost),
    maximumStacks,
    retain: 'newest-grant'
  });
  emitThiefBuff(runtime, skill, {
    at: runtime.time,
    source: 'Trait',
    sourceId: TRAIT.LEAD_ATTACKS,
    activationId: cast.id,
    kind: 'lead-attacks',
    duration,
    stacks: Math.min(cost, maximumStacks)
  });
}

/** Movement skills open Fluid Strikes' window and grant Hard to Catch's endurance. */
function movementTraits(runtime: ThiefRuntime): void {
  if (hasTrait(runtime, TRAIT.FLUID_STRIKES))
    runtime.profession.core.fluidStrikesUntil =
      runtime.time +
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.fluidStrikes), 'durationMultiplier');
  if (hasTrait(runtime, TRAIT.HARD_TO_CATCH))
    grantThiefEndurance(
      runtime,
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.hardToCatch), 'resourceGain')
    );
}

/** Completion-time trait state: dodge, initiative-spend, and movement traits. */
export function completeThiefCastTraits(runtime: ThiefRuntime, cast: RuntimeCast, committed: boolean): void {
  if (!committed) return;
  if (cast.skill.id === ID.DODGE) upperHand(runtime);
  leadAttacks(runtime, cast);
  if ((cast.skill as ThiefSkill).movementSkill) movementTraits(runtime);
}

/** Landed strikes drive critical Fury traits, Deadly Arts, venoms, and Shadow Arts siphons in their established order. */
export function reactThiefCoreDamage(
  runtime: ThiefRuntime,
  event: Gw2ResolverEvent,
  details: Record<string, unknown>
): void {
  const context = resolverContext(runtime);
  const resolved = details as unknown as NativeResolvedDamageDetails;
  unrelentingStrikes.handler(context, event as ThiefResolverEvent, resolved);
  noQuarter.handler(context, event as ThiefResolverEvent, resolved);
  applyDeadlyAmbition(context, event as ThiefResolverEvent);
  // Multiple venom types consume their charges but share one siphon per player strike.
  if (applyActiveVenoms(context, event as ThiefResolverEvent) > 0)
    applyLeechingVenoms(context, event as ThiefResolverEvent);
  applyShadowSiphoning(context, event as ThiefResolverEvent);
  applyPanicStrike(context, event as ThiefResolverEvent);
}

/**
 * Unsuspecting Strike's Bleeding adds a fresh bonus application while the target is above ninety percent health. The
 * bonus keeps the original skill identity and cannot trigger itself.
 */
function unsuspectingStrikeBonus(runtime: ThiefRuntime, application: Gw2ResolverEvent): void {
  if (
    application.skillId !== ID.UNSUSPECTING_STRIKE ||
    application.condition !== 'Bleeding' ||
    application.actorType !== 'player' ||
    application.name === 'Unsuspecting Strike - Bonus Bleeding'
  )
    return;
  const maximum = Number(runtime.config?.target?.health || 0);
  if (maximum > 0 && targetHealthLoss(runtime.config, runtime) / maximum >= 0.1) return;
  runtime.emitDerived(
    application,
    buildResolverCondition({
      at: runtime.time,
      source: application.source,
      sourceId: application.sourceId,
      actorType: application.actorType,
      ownerActorType: application.ownerActorType,
      skillId: application.skillId,
      skillName: application.skillName,
      activationId: application.activationId,
      triggeredBy: application.triggeredBy,
      fixedDuration: application.fixedDuration,
      name: 'Unsuspecting Strike - Bonus Bleeding',
      condition: application.condition,
      duration: Number(application.duration || 0),
      stacks: 3
    })
  );
}

/** Applied conditions drive Lotus Poison, allied Leeching Venoms, Panic Strike, Cloaked in Shadow, then the skill bonus. */
export function reactThiefCoreCondition(runtime: ThiefRuntime, application: Gw2ResolverEvent): void {
  const context = resolverContext(runtime);
  applyLotusPoison(context, application as ThiefResolverEvent);
  applyAlliedLeechingVenoms(context, application as ThiefResolverEvent);
  applyPanicStrikePoison(context, application as ThiefResolverEvent);
  applyCloakedInShadow(context, application as ThiefResolverEvent);
  unsuspectingStrikeBonus(runtime, application);
}

/** Applied self Fury drives Assassin's Fury. */
export function reactThiefCoreBuff(runtime: ThiefRuntime, event: Gw2ResolverEvent): void {
  applyAssassinsFury(resolverContext(runtime), event as ThiefResolverEvent);
}
