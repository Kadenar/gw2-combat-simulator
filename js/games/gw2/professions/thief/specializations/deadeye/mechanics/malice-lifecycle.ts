/** Compose malice lifetimes with hit rewards while skill declarations depend only on the malice state owner. */
import { claimActivation } from '#gw2/platform/combat/procs/activation-claims.js';
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
import { maliceSpent } from '#gw2/professions/thief/specializations/deadeye/mechanics/trigger-points.js';
import { refundMaliciousTacticalStrike } from '#gw2/professions/thief/specializations/deadeye/skills/malicious-attacks.js';
import { deadeyeState } from '#gw2/professions/thief/specializations/deadeye/state.js';
import type { ThiefRuntimeState, ThiefSkill } from '#gw2/professions/thief/types.js';

/** First marked hits spend once; initiative hits and critical hits claim their separate activation rewards. */
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
    if (!claimActivation(state.deadeyeActivationClaims, 'thief.deadeye.malice-spend', event.activationId)) return;

    refundMaliciousTacticalStrike(runtime, event);
    resetDeadeyeMalice(runtime);
    runtime.fireTrigger(maliceSpent);
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

/** One contribution installs capture, resource policy, commitment cleanup, and ordered hit reactions. */
export const deadeyeMaliceLifecycle = composeRuntimeHooks<ThiefRuntimeState, ThiefSkill>([
  deadeyeMaliceStateHooks,
  {
    reactions: {
      'damage.resolved'(runtime, event, details) {
        reactDeadeyeMalice(runtime, event, details.hitContext);
      }
    }
  }
]);
