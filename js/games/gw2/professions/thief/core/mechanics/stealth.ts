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
import { ACTOR } from '#gw2/platform/constants.js';
import type { ActionContext, CustomSideEffectAction, SkillSideEffect } from '#gw2/platform/effects/actions.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { thiefSkill } from '#gw2/professions/thief/core/events.js';
import type { BonusStealthAttackCharges } from '#gw2/professions/thief/core/mechanics/bonus-stealth-attacks.js';
import { stealthEntered, stealthExited } from '#gw2/professions/thief/core/mechanics/trigger-points.js';
import { findThiefStealthGrant, stealthGrantBuffs } from '#gw2/professions/thief/core/skills/stealth-grant.js';
import { hiddenKillerLinger } from '#gw2/professions/thief/core/traits/critical-strikes/index.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
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

export const thiefStealthLifecycle = {
  ...createStealthLifecycle<ThiefRuntimeState, ThiefSkill>({ onGranted: reactToStealthGrant }),
  // A variant can replace the granting strike, so record the grant from the selected effects. Effects pass through.
  modifyEffects(runtime, cast, effects) {
    const grant = findThiefStealthGrant(cast.skill, effects);

    if (grant && (grant.commit || !cast.command.offTarget)) {
      let packets = stealthPackets.get(runtime);

      if (!packets) stealthPackets.set(runtime, (packets = new Map()));

      packets.set(cast.id, { cast, commit: grant.commit });
    }

    return effects;
  },
  onCastCommit: discardPendingCommitGrant,
  // A cancelled cast grants nothing, so its strikes lose protection.
  onCastCancel(runtime, cast) {
    const packets = stealthPackets.get(runtime);

    if (packets?.get(cast.id) !== 'granted') packets?.delete(cast.id);
  },
  sideEffectHandlers: { 'thief.stealth': commitThiefStealth }
} satisfies RuntimeHooks<ThiefRuntimeState, ThiefSkill>;

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

  if (grant === 'granted' || (grant && (!grant.commit?.when || grant.commit.when(runtime.queries, grant.cast)))) return;

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

// Strikes can precede their grant or land after it. Each activation tracks its own eligibility.
type StealthGrant = { cast: RuntimeCast<ThiefSkill>; commit?: SkillSideEffect } | 'granted';
const stealthPackets = new WeakMap<ThiefRuntime, Map<string, StealthGrant>>();

/** A failed commit predicate skips the grant. Later strikes lose its protection. */
function discardPendingCommitGrant(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  const packets = stealthPackets.get(runtime);
  const grant = packets?.get(cast.id);

  if (grant && grant !== 'granted' && grant.commit) packets?.delete(cast.id);
}

/** Only the authored trigger can spend this activation's grant. Revealed blocks it at that instant. */
function commitThiefStealth(
  runtime: ThiefRuntime,
  context: ActionContext<ThiefSkill>,
  action: CustomSideEffectAction
): void {
  const activationId = context.kind === 'cast' ? context.cast.id : context.trigger.event.activationId;

  if (!activationId) return;

  const packets = stealthPackets.get(runtime);
  const grant = packets?.get(activationId);

  if (!packets || !grant || grant === 'granted') return;

  // Read the dispatched action so a patch to the payload changes the applied duration.
  const effects = stealthGrantBuffs(action);

  if (!effects.length || revealedActive(runtime.profession.core, runtime.time)) {
    packets.delete(activationId);
    return;
  }

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
