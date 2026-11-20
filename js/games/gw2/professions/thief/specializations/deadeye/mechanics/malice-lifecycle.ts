/** Compose malice lifetimes with hit rewards while skill declarations depend only on the malice state owner. */
import { criticalOpportunity } from '#gw2/platform/combat/procs/critical.js';
import { ACTOR } from '#gw2/platform/constants.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import { composeRuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { Gw2HitResolutionContext } from '#gw2/platform/resolver/hit-resolution.js';
import { balanceProfileNumber, requireBalanceProfile } from '#gw2/platform/skills/balance-profiles.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { thiefInitiativeCost } from '#gw2/professions/thief/core/mechanics/resources.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import {
  deadeyeMaliceStateHooks,
  deadeyeMarked,
  grantDeadeyeMalice,
  resetDeadeyeMalice
} from '#gw2/professions/thief/specializations/deadeye/mechanics/malice.js';
import { markedStealthAttackResolved } from '#gw2/professions/thief/specializations/deadeye/mechanics/trigger-points.js';
import { deadeyeState } from '#gw2/professions/thief/specializations/deadeye/state.js';
import type { ThiefRuntimeState, ThiefSkill } from '#gw2/professions/thief/types.js';
import { claimActivation } from '#kernel/execution/activation-claims.js';

// Keep each open channel eligible until its final same-time hits and poison applications settle.
const channelHits = new WeakMap<ThiefRuntime, Map<string, { landed: boolean; ended: boolean; expiresAt: number }>>();
const expireChannel = 'thief.expire-malice-channel';
const finishChannel = 'thief.finish-malice-channel';

function spendAttackMalice(runtime: ThiefRuntime): void {
  resetDeadeyeMalice(runtime);
  runtime.fireTrigger(markedStealthAttackResolved);
}

/** Marked hits qualify a malicious attack for spending and award initiative attacks their malice. */
function reactDeadeyeMalice(runtime: ThiefRuntime, event: Gw2ResolverEvent, hit: Gw2HitResolutionContext): void {
  if (event.actorType !== ACTOR.PLAYER || !(Number(event.coefficient) > 0) || typeof event.activationId !== 'string')
    return;

  if (event.offTarget === true || !deadeyeMarked(runtime)) return;

  // A returned axe belongs to its recall activation and must not spend malice as a new stealth attack.
  const skill = runtime.helpers.skillsById.get(
    Number(event.metadata?.recallSkillId ?? event.skillId ?? event.sourceId)
  );

  if (!skill) return;

  const initiativeAttack = skill.type === 'Weapon' && thiefInitiativeCost(skill) > 0 && !skill.stealthAttack;

  if (!skill.malicious && !initiativeAttack) return;

  const state = deadeyeState.from(runtime.profession);

  if (skill.malicious) {
    if (skill.malicious.spend === 'channel-end') {
      const channels = channelHits.get(runtime);
      const channel = channels?.get(event.activationId);

      if (!channels || !channel) return;

      if (channel.ended) {
        channels.delete(event.activationId);
        spendAttackMalice(runtime);
      } else channel.landed = true;

      return;
    }

    if (!claimActivation(state.deadeyeActivationClaims, 'thief.deadeye.malice-spend', event.activationId)) return;

    skill.malicious.onMarkedImpact?.(runtime, event.activationId, Number(event.deadeyeMaliceSnapshot ?? 0));
    spendAttackMalice(runtime);
    return;
  }

  const criticals = criticalOpportunity(
    hit.critEligible ? hit.critical.chance : 0,
    hit.critical.didCrit
  ).sampledCriticals;
  const firstHit = claimActivation(state.deadeyeActivationClaims, 'thief.deadeye.malice-hit', event.activationId);
  const firstCritical =
    criticals > 0 &&
    claimActivation(state.deadeyeActivationClaims, 'thief.deadeye.malice-critical', event.activationId);

  if (!firstHit && !firstCritical) return;

  const resources = requireBalanceProfile(runtime.helpers, TRAIT.DEADEYES_GAZE);
  grantDeadeyeMalice(
    runtime,
    (firstHit ? balanceProfileNumber(resources, 'resourceGain') : 0) +
      (firstCritical ? balanceProfileNumber(resources, 'playerStacks') : 0)
  );
}

/** One contribution installs the resource policy, strike-time malice reads, channel-end spending, and hit reactions. */
export const deadeyeMaliceLifecycle = composeRuntimeHooks<ThiefRuntimeState, ThiefSkill>([
  deadeyeMaliceStateHooks,
  {
    onCastStart(runtime, cast) {
      if (cast.skill.malicious?.spend !== 'channel-end') return;

      let channels = channelHits.get(runtime);

      if (!channels) channelHits.set(runtime, (channels = new Map()));

      const expiresAt = cast.effectiveEnd + (cast.command.impactDelayMs ?? 0) / 1000;
      channels.set(cast.id, { landed: false, ended: false, expiresAt });
      // effectiveEnd includes interruptions. A strike on that boundary receives its malice bonus before the spend.
      runtime.schedule(finishChannel, cast.effectiveEnd, cast.id, undefined, 20);
    },
    tasks: {
      [finishChannel](runtime, payload) {
        const channels = channelHits.get(runtime);
        const id = String(payload);
        const channel = channels?.get(id);

        if (!channels || !channel) return;

        // A fired bullet can reach the mark after the channel has ended.
        if (!channel.landed && channel.expiresAt > runtime.time) {
          channel.ended = true;
          runtime.schedule(expireChannel, channel.expiresAt, id, undefined, 20);
          return;
        }

        channels.delete(id);

        if (channel.landed && deadeyeMarked(runtime)) spendAttackMalice(runtime);
      },
      [expireChannel](runtime, payload) {
        channelHits.get(runtime)?.delete(String(payload));
      }
    },
    reactions: {
      'damage.resolved'(runtime, event, details) {
        reactDeadeyeMalice(runtime, event, details.hitContext);
      }
    }
  }
]);
