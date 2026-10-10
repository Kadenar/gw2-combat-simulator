import { activeChargeCount, consumeCharge } from '#gw2/platform/combat/resources/charges.js';
import type { ActionContext } from '#gw2/platform/effects/actions.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { thiefSkill } from '#gw2/professions/thief/core/events.js';
import { hiddenKillerLinger } from '#gw2/professions/thief/core/traits/critical-strikes/index.js';
import { stealthEntered, stealthExited } from '#gw2/professions/thief/core/mechanics/boundaries.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';

/** Stealth is active from its entry instant until its expiry, unless Revealed blocks it. */
export function thiefStealthed(runtime: MechanicQueriesOf<ThiefRuntime>, at = runtime.time): boolean {
  const core = runtime.profession.core;
  return core.stealthStartedAt <= at && core.stealthUntil > at && core.revealedUntil <= at;
}

/** A specialization-granted stealth-attack charge is usable outside stealth until it expires. */
export function thiefBonusStealthAttack(runtime: MechanicQueriesOf<ThiefRuntime>, at = runtime.time): boolean {
  const elite = runtime.profession.specialization;
  return (
    (elite.kind === 'Deadeye' || elite.kind === 'Antiquary') &&
    activeChargeCount(elite.state.bonusStealthAttack, at) > 0
  );
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
  // Entry grants use the same selected charge count, lifetime and cap as forced exits.
  runtime.fireTrigger(stealthEntered, { skill, at });
  // Quantized concurrent impacts reveal the new stealth even when an older field's packet ran first in the queue.
  const concurrent = core.lastStealthBreakingStrike;
  if (concurrent?.at === at) {
    const revealingSkill = thiefSkill(runtime, concurrent.skillId);
    if (revealingSkill && breakThiefStealth(runtime, revealingSkill, at)) core.strikeBrokeStealthAt = at;
  }
}

/** Removes active stealth, applies Revealed, and fires the traits shared by every attack that breaks stealth. */
function breakThiefStealth(runtime: ThiefRuntime, skill: ThiefSkill, at: number): boolean {
  const core = runtime.profession.core;
  if (!thiefStealthed(runtime, at)) return false;
  runtime.fireTrigger(stealthExited, { skill, at });

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
  runtime.profession.core.lastStealthBreakingStrike = { at: runtime.time, skillId: skill.id };
  if (breakThiefStealth(runtime, skill, runtime.time)) runtime.profession.core.strikeBrokeStealthAt = runtime.time;
}

/** The same-instant strike allowance: one stealth attack may still claim stealth broken at this exact instant. */
export function thiefSameInstantStealthBreak(runtime: MechanicQueriesOf<ThiefRuntime>): boolean {
  return runtime.profession.core.strikeBrokeStealthAt === runtime.time;
}

/**
 * Consumes either active stealth or a specialization-granted attack charge, then applies leave-stealth traits and
 * Revealed from one cast-start transition.
 */
export function beginThiefStealthAttack(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  const core = runtime.profession.core;
  const skill = cast.skill;
  const elite = runtime.profession.specialization;
  // Actual stealth supplies the attack first; only the active owner can spend a bonus entitlement.
  if (!thiefStealthed(runtime) && (elite.kind === 'Deadeye' || elite.kind === 'Antiquary'))
    consumeCharge(elite.state.bonusStealthAttack, runtime.time);
  core.strikeBrokeStealthAt = null;
  if (breakThiefStealth(runtime, skill, runtime.time)) return;
  core.stealthStartedAt = runtime.time;
  core.stealthUntil = runtime.time;
  if (!skill.preservesStealth) core.revealedUntil = runtime.time + 3;
}

// Selected stealth packets belong to their activation so either commitment or a landed hit can consume them once.
const stealthPackets = new WeakMap<ThiefRuntime, Map<string, readonly SkillEffect[]>>();
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
    let packets = stealthPackets.get(runtime);
    if (!packets) stealthPackets.set(runtime, (packets = new Map()));
    packets.set(cast.id, stealth);
    // A variant-selected stealth grant protects its own strike; a rejected conditional packet does not.
    let activations = stealthGrantActivations.get(runtime);
    if (!activations) stealthGrantActivations.set(runtime, (activations = new Set()));
    activations.add(cast.id);
  }

  return effects.filter((effect) => effect.type !== 'buff' || effect.kind !== 'stealth');
}

/** A grant uses the accepted duration at its actual trigger; later damage can reveal the thief during aftercast. */
export function commitThiefStealth(runtime: ThiefRuntime, context: ActionContext<ThiefSkill>): void {
  const activationId = context.kind === 'cast' ? context.cast.id : String(context.trigger.event.activationId);
  const effects = stealthPackets.get(runtime)?.get(activationId) ?? [];
  stealthPackets.get(runtime)?.delete(activationId);
  if (runtime.profession.core.revealedUntil > runtime.time) return;
  const duration = effects.reduce((sum, effect) => sum + Number(effect.duration || 0), 0);
  if (!(duration > 0)) return;
  grantThiefStealth(runtime, context.skill, duration);
  runtime.effects.emit({
    kind: 'profile',
    profile: context.skill,
    effects: effects.map((effect) => ({
      ...effect,
      duration: runtime.profession.core.stealthUntil - runtime.time,
      atMs: 0,
      timingAnchor: 'castStart' as const,
      when: undefined
    })),
    attribution: {
      source: 'thief',
      sourceId: context.skill.id,
      actorType: 'player',
      skillId: context.skill.id,
      skillName: context.skill.name,
      activationId
    }
  });
}
