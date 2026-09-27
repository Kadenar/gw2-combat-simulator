import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { emitEffects } from '#gw2/platform/simulation/procedural-emission.js';
import { grantTimedStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { onResolvedCriticalHit } from '#gw2/platform/profession-definition/mechanics.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/core/profiles.js';
import { applyActiveVenoms } from '#gw2/professions/thief/core/mechanics/venoms.js';
import {
  noQuarterCriticalReaction,
  unrelentingStrikesCriticalReaction
} from '#gw2/professions/thief/core/traits/critical-strikes.js';
import {
  applyDeadlyAmbition,
  applyLotusPoison,
  applyPanicStrike,
  applyPanicStrikePoison
} from '#gw2/professions/thief/core/traits/deadly-arts.js';
import { applyAlliedLeechingVenoms, applyLeechingVenoms } from '#gw2/professions/thief/core/traits/shadow-arts.js';
import { emitThiefBuff } from '#gw2/professions/thief/core/events.js';
import { grantThiefEndurance, grantThiefInitiative } from '#gw2/professions/thief/core/mechanics/resources.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import type { ThiefResolverContext, ThiefSkill } from '#gw2/professions/thief/types.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';

const unrelentingStrikes = onResolvedCriticalHit(unrelentingStrikesCriticalReaction);
const noQuarter = onResolvedCriticalHit(noQuarterCriticalReaction);

function resolverContext(runtime: ThiefRuntime): ThiefResolverContext {
  return runtime;
}

/** Uncatchable's caltrop pulses are queued from the dodge's takeoff; the runtime has already paid its endurance. */
export function startThiefDodge(runtime: ThiefRuntime, cast: RuntimeCast): void {
  if (!hasTrait(runtime, TRAIT.UNCATCHABLE)) return;
  // Each condition's authored timing is authoritative; removing one component leaves its sibling's pulses intact.
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.uncatchable);
  const caltrops = runtime.helpers.skillsById.get(ID.LESSER_CALTROPS);
  emitEffects(runtime, {
    owner: profile,
    effects: profile.effects?.filter(
      (effect) => effect.type === 'condition' && ['Bleeding', 'Crippled'].includes(String(effect.name))
    ),
    baseEvent: {
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
function upperHand(runtime: ThiefRuntime): void {
  if (!hasTrait(runtime, TRAIT.UPPER_HAND)) return;
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.upperHand);
  if (runtime.procs.claimCooldown(TRAIT.UPPER_HAND, runtime.time, balanceProfileNumber(profile, 'internalCooldown')))
    grantThiefInitiative(runtime, balanceProfileNumber(profile, 'resourceGain'));
}

/** Initiative spent grants Lead Attacks stacks at completion, replacing the oldest at the cap. */
function leadAttacks(runtime: ThiefRuntime, cast: RuntimeCast): void {
  const skill = cast.skill as ThiefSkill;
  const cost = Math.max(0, skill.initiativeCost || 0);
  if (cost <= 0 || !hasTrait(runtime, TRAIT.LEAD_ATTACKS)) return;
  const core = runtime.profession.core;
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.leadAttacks);
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
  if (cast.skill.id === SHARED_SKILL_IDS.DODGE) upperHand(runtime);
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
  unrelentingStrikes.handler(context, event, resolved);
  noQuarter.handler(context, event, resolved);
  applyDeadlyAmbition(context, event);
  // Multiple venom types consume their charges but share one siphon per player strike.
  if (applyActiveVenoms(context, event) > 0) applyLeechingVenoms(context, event);
  applyPanicStrike(context, event);
}

/** Applied conditions drive Lotus Poison, allied Leeching Venoms, Panic Strike, Cloaked in Shadow, then the skill bonus. */
export function reactThiefCoreCondition(runtime: ThiefRuntime, application: Gw2ResolverEvent): void {
  const context = resolverContext(runtime);
  applyLotusPoison(context, application);
  applyAlliedLeechingVenoms(context, application);
  applyPanicStrikePoison(context, application);
}
