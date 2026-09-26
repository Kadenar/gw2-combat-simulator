import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/core/profiles.js';
import { addVenomCharges } from '#gw2/professions/thief/core/mechanics/venoms.js';
import { emitThiefCondition, thiefSkill } from '#gw2/professions/thief/core/live-events.js';
import { grantThiefInitiative } from '#gw2/professions/thief/core/live-resources.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import type { ThiefSkill, ThiefStealthAttackChargeState } from '#gw2/professions/thief/types.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/live-events.js';

/** Optional stealth-attack charges live on the active specialization when it grants them. */
export function thiefStealthAttackCharges(runtime: ThiefRuntime): Partial<ThiefStealthAttackChargeState> {
  return runtime.profession.specialization.state as Partial<ThiefStealthAttackChargeState>;
}

/** Stealth is active from its entry instant until its expiry, unless Revealed blocks it. */
export function thiefStealthed(runtime: ThiefRuntime, at = runtime.time): boolean {
  const core = runtime.profession.core;
  return core.stealthStartedAt <= at && core.stealthUntil > at && core.revealedUntil <= at;
}

/** A specialization-granted stealth-attack charge is usable outside stealth until it expires. */
export function thiefBonusStealthAttack(runtime: ThiefRuntime, at = runtime.time): boolean {
  const charges = thiefStealthAttackCharges(runtime);
  return Number(charges.stealthAttackCharges || 0) > 0 && Number(charges.stealthAttackExpiresAt || 0) > at;
}

/**
 * Extends stealth up to its cap unless Revealed blocks entry. Enter-stealth traits fire only on a transition from an
 * unstealthed state.
 */
export function grantThiefStealth(
  runtime: ThiefRuntime,
  skill: ThiefSkill,
  explicitDuration?: number,
  at = runtime.time
): void {
  const duration =
    explicitDuration ??
    (skill.effects || [])
      .filter((effect) => effect.type === 'buff' && effect.kind === 'stealth')
      .reduce((sum, effect) => sum + Number(effect.duration || 0), 0);
  if (!(duration > 0)) return;
  const core = runtime.profession.core;
  if (core.revealedUntil > at) return;
  const entering = core.stealthStartedAt > at || core.stealthUntil <= at;
  if (entering) core.stealthStartedAt = at;
  core.stealthUntil = Math.min(at + 15, Math.max(at, core.stealthUntil) + duration);
  // Natural stealth expiry also grants Hidden Killer's four-second linger.
  core.hiddenKillerUntil = core.stealthUntil + 4;
  if (!entering) return;
  if (hasTrait(runtime, TRAIT.SHADOWS_REJUVENATION)) grantThiefInitiative(runtime, 2);
  if (hasTrait(runtime, TRAIT.LEECHING_VENOMS)) addVenomCharges(core, ID.SPIDER_VENOM, at, 3, 24, 6);
  if (hasTrait(runtime, TRAIT.CLOAKED_IN_SHADOW))
    emitThiefCondition(runtime, skill, {
      at,
      source: 'Trait',
      sourceId: TRAIT.CLOAKED_IN_SHADOW,
      name: 'Cloaked in Shadow — Blindness',
      condition: 'Blindness',
      stacks: 1,
      duration: 5
    });
}

/** Removes active stealth, applies Revealed, and fires the traits shared by every attack that breaks stealth. */
function breakThiefStealth(runtime: ThiefRuntime, skill: ThiefSkill, at: number): boolean {
  const core = runtime.profession.core;
  if (!thiefStealthed(runtime, at)) return false;
  if (hasTrait(runtime, TRAIT.SHADOWS_REJUVENATION))
    grantThiefInitiative(
      runtime,
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.shadowsRejuvenation), 'resourceGain')
    );
  if (hasTrait(runtime, TRAIT.LEECHING_VENOMS)) {
    const leeching = requireBalanceProfileFromContext(runtime, PROFILE.leechingVenoms);
    addVenomCharges(
      core,
      ID.SPIDER_VENOM,
      at,
      balanceProfileNumber(leeching, 'resourceGain'),
      balanceProfileNumber(leeching, 'durationMultiplier'),
      balanceProfileNumber(leeching, 'maximumStacks')
    );
  }

  core.stealthStartedAt = at;
  core.stealthUntil = at;
  // Only a real stealth exit starts the linger; bonus attack charges do not.
  core.hiddenKillerUntil =
    at + balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.HIDDEN_KILLER), 'duration');
  if (!skill.preservesStealth) core.revealedUntil = at + 3;
  return true;
}

/**
 * A landed player strike from a skill that neither is a stealth attack nor grants stealth ends stealth at its impact.
 * The instant is recorded so a stealth attack commanded at the same instant can still claim the window it was queued
 * against.
 */
export function reactThiefStealthBreakingStrike(runtime: ThiefRuntime, event: Gw2ResolverEvent): void {
  if (event.actorType !== 'player') return;
  const skill = thiefSkill(runtime, event.skillId);
  if (!skill || skill.stealthAttack) return;
  if (skill.effects?.some((effect) => effect.type === 'buff' && effect.kind === 'stealth')) return;
  if (breakThiefStealth(runtime, skill, runtime.time)) runtime.profession.core.strikeBrokeStealthAt = runtime.time;
}

/** The same-instant strike allowance: one stealth attack may still claim stealth broken at this exact instant. */
export function thiefSameInstantStealthBreak(runtime: ThiefRuntime): boolean {
  return runtime.profession.core.strikeBrokeStealthAt === runtime.time;
}

/**
 * Consumes either active stealth or a specialization-granted attack charge, then applies leave-stealth traits and
 * Revealed from one cast-start transition.
 */
export function beginThiefStealthAttack(runtime: ThiefRuntime, cast: RuntimeCast): void {
  const core = runtime.profession.core;
  const skill = cast.skill as ThiefSkill;
  const charges = thiefStealthAttackCharges(runtime);
  if (!thiefStealthed(runtime) && thiefBonusStealthAttack(runtime))
    charges.stealthAttackCharges = Number(charges.stealthAttackCharges || 0) - 1;
  core.strikeBrokeStealthAt = null;
  if (breakThiefStealth(runtime, skill, runtime.time)) return;
  core.stealthStartedAt = runtime.time;
  core.stealthUntil = runtime.time;
  if (!skill.preservesStealth) core.revealedUntil = runtime.time + 3;
}

/** Sundering Shade's Vulnerability follows the completed stealth attack. */
export function completeThiefStealthAttack(runtime: ThiefRuntime, cast: RuntimeCast): void {
  if (!hasTrait(runtime, TRAIT.SUNDERING_SHADE)) return;
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.sunderingShade);
  const vulnerability = requireEffect(profile, 'condition', 'Vulnerability');
  // Explicit removal suppresses this packet without restoring baseline tuning.
  if (!vulnerability) return;
  emitThiefCondition(runtime, cast.skill as ThiefSkill, {
    at: runtime.time,
    source: 'Trait',
    sourceId: TRAIT.SUNDERING_SHADE,
    activationId: cast.id,
    name: 'Sundering Shade — Vulnerability',
    condition: String(vulnerability.condition),
    duration: effectNumber(profile, vulnerability, 'duration'),
    stacks: effectNumber(profile, vulnerability, 'stacks')
  });
}
