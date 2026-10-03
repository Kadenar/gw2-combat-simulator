import {
  enterCloakedInShadow,
  enterShadowsRejuvenation,
  exitShadowsRejuvenation,
  hiddenKillerLinger
} from '#gw2/professions/thief/core/traits/behavior.js';
import { grantLeechingVenomCharges } from '#gw2/professions/thief/core/traits/leeching-venoms.js';

import type { SkillEffect } from '#gw2/platform/engine/skills/types.js';

import { thiefSkill } from '#gw2/professions/thief/core/events.js';

import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import type { ThiefSkill, ThiefStealthAttackChargeState } from '#gw2/professions/thief/types.js';

/** Optional stealth-attack charges live on the active specialization when it grants them. */
function thiefStealthAttackCharges(runtime: ThiefRuntime): Partial<ThiefStealthAttackChargeState> {
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
  return (charges.stealthAttackCharges || 0) > 0 && (charges.stealthAttackExpiresAt || 0) > at;
}

/**
 * Extends stealth up to its cap unless Revealed blocks entry. Enter-stealth traits fire only on a transition from an
 * unstealthed state.
 */
export function grantThiefStealth(runtime: ThiefRuntime, skill: ThiefSkill, duration: number, at = runtime.time): void {
  if (!(duration > 0)) return;
  const core = runtime.profession.core;
  if (core.revealedUntil > at) return;
  const entering = core.stealthStartedAt > at || core.stealthUntil <= at;
  if (entering) core.stealthStartedAt = at;
  core.stealthUntil = Math.min(at + 15, Math.max(at, core.stealthUntil) + duration);
  // Natural and forced exits use the same selected Hidden Killer linger.
  core.hiddenKillerUntil = core.stealthUntil + hiddenKillerLinger(runtime);
  if (!entering) return;
  enterShadowsRejuvenation(runtime);
  // Entry grants use the same selected charge count, lifetime and cap as forced exits.
  grantLeechingVenomCharges(runtime, at);

  enterCloakedInShadow(runtime, skill, at);
}

/** Removes active stealth, applies Revealed, and fires the traits shared by every attack that breaks stealth. */
function breakThiefStealth(runtime: ThiefRuntime, skill: ThiefSkill, at: number): boolean {
  const core = runtime.profession.core;
  if (!thiefStealthed(runtime, at)) return false;
  exitShadowsRejuvenation(runtime);
  grantLeechingVenomCharges(runtime, at);

  core.stealthStartedAt = at;
  core.stealthUntil = at;
  // Only a real stealth exit starts the linger; bonus attack charges do not.
  core.hiddenKillerUntil = at + hiddenKillerLinger(runtime);
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
  if (stealthGrantActivations.get(runtime)?.has(String(event.activationId))) return;
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
export function beginThiefStealthAttack(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  const core = runtime.profession.core;
  const skill = cast.skill;
  const charges = thiefStealthAttackCharges(runtime);
  if (!thiefStealthed(runtime) && thiefBonusStealthAttack(runtime))
    charges.stealthAttackCharges = (charges.stealthAttackCharges || 0) - 1;
  core.strikeBrokeStealthAt = null;
  if (breakThiefStealth(runtime, skill, runtime.time)) return;
  core.stealthStartedAt = runtime.time;
  core.stealthUntil = runtime.time;
  if (!skill.preservesStealth) core.revealedUntil = runtime.time + 3;
}

// Selected stealth packets are acceptance facts; one commit action owns both display and combat state.
const stealthPackets = new WeakMap<RuntimeCast<ThiefSkill>, readonly SkillEffect[]>();
const stealthGrantActivations = new WeakMap<ThiefRuntime, Set<string>>();
export function selectThiefStealth(
  runtime: ThiefRuntime,
  cast: RuntimeCast<ThiefSkill>,
  effects: readonly SkillEffect[]
): readonly SkillEffect[] {
  const stealth = effects.filter(
    (effect) => effect.type === 'buff' && effect.kind === 'stealth' && (!effect.when || effect.when(runtime, cast))
  );
  if (stealth.length) {
    stealthPackets.set(cast, stealth);
    // A variant-selected stealth grant protects its own strike; a rejected conditional packet does not.
    let activations = stealthGrantActivations.get(runtime);
    if (!activations) stealthGrantActivations.set(runtime, (activations = new Set()));
    activations.add(cast.id);
  }

  return effects.filter((effect) => effect.type !== 'buff' || effect.kind !== 'stealth');
}

/** A committed grant uses the selected duration and Revealed gate for both availability and its visible buff. */
export function commitThiefStealth(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  const effects = stealthPackets.get(cast) ?? [];
  stealthPackets.delete(cast);
  if (runtime.profession.core.revealedUntil > runtime.time) return;
  const duration = effects.reduce((sum, effect) => sum + Number(effect.duration || 0), 0);
  if (!(duration > 0)) return;
  grantThiefStealth(runtime, cast.skill, duration);
  runtime.effects.emit({
    kind: 'profile',
    profile: cast.skill,
    effects: effects.map((effect) => ({
      ...effect,
      duration: runtime.profession.core.stealthUntil - runtime.time,
      atMs: 0,
      timingAnchor: 'castStart' as const,
      when: undefined
    })),
    attribution: {
      source: 'thief',
      sourceId: cast.skill.id,
      actorType: 'player',
      skillId: cast.skill.id,
      skillName: cast.skill.name,
      activationId: cast.id
    }
  });
}
