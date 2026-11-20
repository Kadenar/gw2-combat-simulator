// Private deadlines use the same 40 ms clock as scheduled events.
import { gw2Time } from '#gw2/platform/combat/clock.js';
import { gw2TimerDeadline } from '#gw2/platform/combat/effect-timing.js';
import {
  createStealthLifecycle,
  endStealth,
  isStealthGrantingImpact,
  revealedActive,
  stealthActive
} from '#gw2/platform/combat/stealth.js';
import { ACTOR, STATUS } from '#gw2/platform/constants.js';
import type { ActionContext } from '#gw2/platform/effects/actions.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { thiefSkill } from '#gw2/professions/thief/core/events.js';
import type { BonusStealthAttackCharges } from '#gw2/professions/thief/core/mechanics/bonus-stealth-attacks.js';
import { stealthEntered, stealthExited } from '#gw2/professions/thief/core/mechanics/trigger-points.js';
import { hiddenKillerLinger } from '#gw2/professions/thief/core/traits/critical-strikes/index.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import { DEADEYE_STOLEN_SKILL_ID_SET } from '#gw2/professions/thief/data/stolen-skills.js';
import type { ThiefRuntimeState, ThiefSkill } from '#gw2/professions/thief/types.js';
import { claimActivation } from '#kernel/execution/activation-claims.js';

/** Accepted native, combo, and external grants share entry rewards and the concurrent-strike policy. */
function reactToStealthGrant(runtime: ThiefRuntime, event: Gw2ResolverEvent, entering: boolean): void {
  const at = runtime.time;
  const core = runtime.profession.core;
  // Natural and forced exits use the same selected Hidden Killer linger.
  core.hiddenKillerUntil = gw2Time(core.stealthUntil + hiddenKillerLinger(runtime));

  if (!entering) return;

  // External grants need not belong to this profession's catalog; their packet still owns attribution.
  const skill = thiefSkill(runtime, event.skillId) ?? {
    id: event.skillId ?? event.sourceId,
    name: event.skillName ?? event.source
  };
  // Entry grants use the same selected charge count, lifetime and cap as forced exits.
  runtime.fireTrigger(stealthEntered, { skill, at });
  // Quantized concurrent impacts reveal the new stealth even when an older field's packet ran first in the queue.
  const concurrent = core.lastStealthBreakingStrike;

  if (concurrent?.at === at) {
    const revealingSkill = thiefSkill(runtime, concurrent.skillId);

    if (revealingSkill && breakThiefStealth(runtime, revealingSkill, at)) core.strikeBrokeStealthAt = at;
  }
}

export const thiefStealthLifecycle = createStealthLifecycle<ThiefRuntimeState, ThiefSkill>({
  onGranted: reactToStealthGrant
});

/** Removes active stealth, applies Revealed, and fires the traits shared by every attack that breaks stealth. */
function breakThiefStealth(runtime: ThiefRuntime, skill: ThiefSkill, at: number): boolean {
  const core = runtime.profession.core;

  if (!stealthActive(core, at)) return false;

  runtime.fireTrigger(stealthExited, { skill, at });

  endStealth(core, at);
  // Only a real stealth exit starts the linger; bonus attack charges do not.
  const linger = hiddenKillerLinger(runtime);
  core.hiddenKillerUntil = gw2TimerDeadline(at, linger);

  return true;
}

/** Only Death's Judgment leaves stealth before its strike lands. */
function revealsOnCastStart(skill: ThiefSkill): boolean {
  return skill.id === ID.DEATHS_JUDGMENT || skill.id === ID.MALICIOUS_DEATHS_JUDGMENT;
}

/** The first landed stealth-attack packet owns its exit; later channel hits cannot restart Revealed. */
export function reactThiefStealthBreakingStrike(runtime: ThiefRuntime, event: Gw2ResolverEvent): void {
  if (event.actorType !== ACTOR.PLAYER) return;

  const skill = thiefSkill(runtime, event.skillId);

  if (!skill) return;

  if (skill.stealthAttack) {
    if (revealsOnCastStart(skill) || event.offTarget || !(Number(event.coefficient) > 0)) return;

    // Recalled axes retain their original skill identity but are not a new stealth attack.
    if (event.metadata?.recallSkillId != null) return;

    if (
      event.activationId &&
      !claimActivation(runtime.profession.core.activationClaims, 'thief.stealth-exit', event.activationId)
    )
      return;

    // Resolve the revealing strike before applying Revealed Training and leave-stealth rewards.
    if (
      !breakThiefStealth(runtime, skill, runtime.time) &&
      !skill.spearStealthAttack &&
      !revealedActive(runtime.profession.core, runtime.time)
    )
      // Bonus attacks cannot refresh existing Revealed; spear bonus attacks do not apply it.
      endStealth(runtime.profession.core, runtime.time);

    return;
  }

  const grant = stealthPackets.get(runtime)?.get(String(event.activationId));

  if (grant === 'granted' || grant?.effects.some((effect) => !effect.when || effect.when(runtime, grant.cast))) return;

  if (isStealthGrantingImpact(runtime.profession.core, event)) return;

  runtime.profession.core.lastStealthBreakingStrike = { at: runtime.time, skillId: skill.id };

  if (breakThiefStealth(runtime, skill, runtime.time)) runtime.profession.core.strikeBrokeStealthAt = runtime.time;
}

/** The same-instant strike allowance: one stealth attack may still claim stealth broken at this exact instant. */
export function thiefSameInstantStealthBreak(runtime: MechanicQueriesOf<ThiefRuntime>): boolean {
  return runtime.profession.core.strikeBrokeStealthAt === runtime.time;
}

/**
 * Claims any required bonus attack charge at cast start. Only Death's Judgment exits stealth here;
 * every other stealth attack defers its exit and any Revealed application until its first landed strike.
 */
export function beginThiefStealthAttack(
  runtime: ThiefRuntime,
  cast: RuntimeCast<ThiefSkill>,
  charges: BonusStealthAttackCharges | undefined
): void {
  const core = runtime.profession.core;
  const skill = cast.skill;

  // Check stealth before Death's Judgment can reveal the player.
  charges?.spend(runtime.profession, runtime.time, stealthActive(core, runtime.time));

  core.strikeBrokeStealthAt = null;

  if (!revealsOnCastStart(skill)) return;

  if (breakThiefStealth(runtime, skill, runtime.time)) return;

  endStealth(core, runtime.time);
}

// Selected stealth packets belong to their activation so either commitment or a landed hit can consume them once.
type StealthGrant = { cast: RuntimeCast<ThiefSkill>; effects: readonly SkillEffect[] } | 'granted';
const stealthPackets = new WeakMap<ThiefRuntime, Map<string, StealthGrant>>();

/** Stolen skills check malice at the grant. Other skills preserve the stealth variant selected at cast start. */
export function selectThiefStealth(
  runtime: ThiefRuntime,
  cast: RuntimeCast<ThiefSkill>,
  effects: readonly SkillEffect[]
): readonly SkillEffect[] {
  const stolen = DEADEYE_STOLEN_SKILL_ID_SET.has(cast.skill.id);
  const stealth = effects.flatMap((effect) => {
    if (effect.type !== 'buff' || effect.kind !== STATUS.STEALTH) return [];

    if (stolen || !effect.when) return [effect];

    return effect.when(runtime, cast) ? [{ ...effect, when: undefined }] : [];
  });

  if (stealth.length) {
    let packets = stealthPackets.get(runtime);

    if (!packets) stealthPackets.set(runtime, (packets = new Map()));

    packets.set(cast.id, { cast, effects: stealth });
  }

  return effects.filter((effect) => effect.type !== 'buff' || effect.kind !== STATUS.STEALTH);
}

/** A grant uses the accepted duration at its actual trigger; later damage can reveal the thief during aftercast. */
export function commitThiefStealth(runtime: ThiefRuntime, context: ActionContext<ThiefSkill>): void {
  const activationId = context.kind === 'cast' ? context.cast.id : String(context.trigger.event.activationId);
  const packets = stealthPackets.get(runtime);
  const grant = packets?.get(activationId);

  if (!packets || !grant || grant === 'granted') return;

  // Claim the grant before checking Revealed: a blocked attempt cannot be replayed later by the other trigger.
  packets.delete(activationId);

  if (revealedActive(runtime.profession.core, runtime.time)) return;

  const effects = grant.effects.filter((effect) => !effect.when || effect.when(runtime, grant.cast));
  const duration = effects.reduce((sum, effect) => sum + (('duration' in effect && effect.duration) || 0), 0);

  if (!(duration > 0)) return;

  // The strike belonging to this successful grant can land after stealth has been applied.
  packets.set(activationId, 'granted');
  runtime.effects.emit({
    kind: 'profile',
    // Native hit/commit timing admits the packet now; the common buff listener alone mutates stealth state.
    settlement: 'reaction',
    profile: context.skill,
    effects: effects.map((effect) => ({
      ...effect,
      atMs: 0,
      timingAnchor: 'castStart' as const,
      when: undefined
    })),
    attribution: {
      source: 'thief',
      sourceId: context.skill.id,
      actorType: ACTOR.PLAYER,
      skillId: context.skill.id,
      skillName: context.skill.name,
      activationId
    }
  });
}
