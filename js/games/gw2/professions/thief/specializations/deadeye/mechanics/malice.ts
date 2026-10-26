import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { ACTOR } from '#gw2/platform/constants.js';
import { claimActivation } from '#gw2/platform/combat/procs/activation-claims.js';
import { criticalOpportunity } from '#gw2/platform/combat/procs/critical.js';
import type { ResourcePolicy } from '#gw2/platform/combat/resources/resource-policy.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { Gw2HitResolutionContext } from '#gw2/platform/resolver/hit-resolution.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { maliceGained, maliceSpent } from '#gw2/professions/thief/specializations/deadeye/mechanics/trigger-points.js';
import { deadeyeMarked } from '#gw2/professions/thief/specializations/deadeye/skills/deadeyes-mark.js';
import { refundMaliciousTacticalStrike } from '#gw2/professions/thief/specializations/deadeye/skills/malicious-attacks.js';
import { STOLEN_SKILLS } from '#gw2/professions/thief/specializations/deadeye/skills/stolen-skills.js';
import { deadeyeCastFacts, deadeyeState } from '#gw2/professions/thief/specializations/deadeye/state.js';
import { maximumDeadeyeMalice } from '#gw2/professions/thief/specializations/deadeye/traits/behavior.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';

// A malicious attack's damage bonus uses the malice it was cast with, even after its first hit spends it.
const maliceSnapshots = new WeakMap<object, Map<string, number>>();

/** Malice is earned through marks and accepted hits, with no passive recovery. */
export const deadeyeMalice: ResourcePolicy<ThiefRuntime> = {
  kind: 'continuous',
  state: (runtime) => deadeyeState.from(runtime).malice,
  maximum: maximumDeadeyeMalice,
  initial: () => 0,
  recovery: () => 0
};

/**
 * Malicious attacks spend once on their first marked hit. Initiative attacks earn separate once-per-activation
 * grants for a marked hit and a marked critical hit, so a later strike can still earn the critical bonus.
 */
export function reactDeadeyeMalice(
  runtime: ThiefRuntime,
  event: Gw2ResolverEvent,
  hit?: Gw2HitResolutionContext
): void {
  if (event.actorType !== ACTOR.PLAYER || !(Number(event.coefficient) > 0) || typeof event.activationId !== 'string')
    return;

  if (event.offTarget === true || !deadeyeMarked(runtime)) return;

  // A returned axe belongs to the recall activation; it must never consume malice as a new stealth attack.
  const skill = runtime.helpers.skillsById.get(
    Number(event.metadata?.recallSkillId ?? event.skillId ?? event.sourceId)
  );

  if (!skill) return;

  const initiativeAttack = skill.type === 'Weapon' && (skill.initiativeCost || 0) > 0 && !skill.stealthAttack;

  if (!skill.malicious && !initiativeAttack) return;

  const state = deadeyeState.from(runtime);

  if (skill.malicious) {
    if (!claimActivation(state.deadeyeActivationClaims, 'thief.deadeye.malice-spend', event.activationId)) return;

    refundMaliciousTacticalStrike(runtime, event);
    runtime.resourceController.replace('malice', 0);
    state.maleficentSevenTriggered = false;
    runtime.fireTrigger(maliceSpent);

    return;
  }

  const criticals = hit
    ? criticalOpportunity(hit.critEligible ? hit.critical.chance : 0, hit.critical.didCrit).sampledCriticals
    : 0;
  const firstHit = claimActivation(state.deadeyeActivationClaims, 'thief.deadeye.malice-hit', event.activationId);
  const firstCritical =
    criticals > 0 &&
    claimActivation(state.deadeyeActivationClaims, 'thief.deadeye.malice-critical', event.activationId);

  if (!firstHit && !firstCritical) return;

  const resources = requireBalanceProfileFromContext(runtime, TRAIT.DEADEYES_GAZE);
  runtime.resourceController.grant(
    'malice',
    (firstHit ? balanceProfileNumber(resources, 'resourceGain') : 0) +
      (firstCritical ? balanceProfileNumber(resources, 'playerStacks') : 0)
  );
  runtime.fireTrigger(maliceGained, { cast: null });
}

/** Capture accepted malice before commitment and preserve it for later impacts. */
export function captureDeadeyeMalice(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  const skill = cast.skill;

  if (!skill.malicious && !STOLEN_SKILLS.has(skill.id)) return;

  const malice = runtime.resourceController.value('malice');
  deadeyeCastFacts.set(cast, {
    // Poison, quickness, and duration scaling apply only against a live mark and a hit target.
    markedMalice: cast.command.offTarget !== true && deadeyeMarked(runtime) ? malice : 0
  });

  if (skill.malicious) {
    let snapshots = maliceSnapshots.get(runtime);

    if (!snapshots) maliceSnapshots.set(runtime, (snapshots = new Map()));

    snapshots.set(cast.id, malice);
  }
}

/** Attach the original cast's malice after its resource has been spent by an earlier hit. */
export function deadeyeMaliceSnapshot(runtime: ThiefRuntime, event: Gw2ResolverEvent) {
  const snapshot = maliceSnapshots.get(runtime)?.get(String(event.activationId));
  return snapshot == null ? undefined : { deadeyeMaliceSnapshot: snapshot };
}
