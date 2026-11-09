/** Own malice changes and accepted values so skills cannot change snapshot lifetimes or cycle rules. */
import type { ResourcePolicy } from '#gw2/platform/combat/resources/resource-policy.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { DEADEYE_STOLEN_SKILL_ID_SET } from '#gw2/professions/thief/data/stolen-skills.js';
import { maliceGained } from '#gw2/professions/thief/specializations/deadeye/mechanics/trigger-points.js';
import { deadeyeState } from '#gw2/professions/thief/specializations/deadeye/state.js';
import { initialMalice, maximumDeadeyeMalice } from '#gw2/professions/thief/specializations/deadeye/traits/behavior.js';
import type { ThiefRuntimeState, ThiefSkill } from '#gw2/professions/thief/types.js';

// Commitment actions read the original cast; delayed hits retain their activation's value for the whole run.
const markedMaliceByCast = new WeakMap<RuntimeCast<ThiefSkill>, number>();
const maliceSnapshots = new WeakMap<ThiefRuntime, Map<string, number>>();

/** Malice is earned through marks and accepted hits, with no passive recovery. */
const deadeyeMalice: ResourcePolicy<ThiefRuntime> = {
  kind: 'continuous',
  state: (runtime) => deadeyeState.from(runtime.profession).malice,
  maximum: maximumDeadeyeMalice,
  initial: () => 0,
  recovery: () => 0
};

/** Live eligibility requires an unexpired mark; detached modifier previews keep their own query. */
export function deadeyeMarked(runtime: ThiefRuntime): boolean {
  const state = deadeyeState.from(runtime.profession);
  return Boolean(state.markedTargetId) && state.markExpiresAt > runtime.time;
}

/** Gains notify cycle traits only after the resource controller has applied the selected capacity. */
export function grantDeadeyeMalice(
  runtime: ThiefRuntime,
  amount: number,
  cast: RuntimeCast<ThiefSkill> | null = null
): void {
  runtime.resourceController.grant('malice', amount);
  runtime.fireTrigger(maliceGained, { cast });
}

/** A fresh mark replaces progress and rearms the cycle before gain rewards. */
export function startDeadeyeMarkMalice(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  runtime.resourceController.replace('malice', initialMalice(runtime));
  deadeyeState.from(runtime.profession).maleficentSevenTriggered = false;
  runtime.fireTrigger(maliceGained, { cast });
}

/** Refreshing the same mark adds malice without rearming its earned cycle. */
export function refreshDeadeyeMarkMalice(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  grantDeadeyeMalice(runtime, initialMalice(runtime), cast);
}

/** Expiry and resource consumption rearm the cycle without granting malicious-attack spend rewards. */
export function resetDeadeyeMalice(runtime: ThiefRuntime): void {
  runtime.resourceController.replace('malice', 0);
  deadeyeState.from(runtime.profession).maleficentSevenTriggered = false;
}

/** Return Mercy's live balance for its refund after clearing the cycle, without firing maliceSpent. */
export function consumeDeadeyeMalice(runtime: ThiefRuntime): number {
  const malice = runtime.resourceController.value('malice');
  resetDeadeyeMalice(runtime);
  return malice;
}

/** Claim before trait rewards so nested gains cannot earn the same full-pool cycle twice. */
export function claimDeadeyeMaliceCycle(runtime: ThiefRuntime): boolean {
  const state = deadeyeState.from(runtime.profession);

  if (state.malice.value !== state.malice.maximum || state.maleficentSevenTriggered) return false;

  state.maleficentSevenTriggered = true;
  return true;
}

/** Skills read mark-qualified acceptance facts without owning their storage or cleanup. */
export function acceptedDeadeyeMarkedMalice(cast: RuntimeCast<ThiefSkill>): number {
  return markedMaliceByCast.get(cast) ?? 0;
}

/** Capture accepted malice before commitment and preserve it for later impacts. */
function captureDeadeyeMalice(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  const skill = cast.skill;

  if (!skill.malicious && !DEADEYE_STOLEN_SKILL_ID_SET.has(skill.id)) return;

  const malice = runtime.resourceController.value('malice');
  // Poison, quickness, and duration scaling apply only against a live mark and a hit target.
  markedMaliceByCast.set(cast, cast.command.offTarget !== true && deadeyeMarked(runtime) ? malice : 0);

  if (skill.malicious) {
    let snapshots = maliceSnapshots.get(runtime);

    if (!snapshots) maliceSnapshots.set(runtime, (snapshots = new Map()));

    snapshots.set(cast.id, malice);
  }
}

/** Attach the original cast's malice after its resource has been spent by an earlier hit. */
function deadeyeMaliceSnapshot(runtime: ThiefRuntime, event: Gw2ResolverEvent) {
  const snapshot = maliceSnapshots.get(runtime)?.get(String(event.activationId));
  return snapshot == null ? undefined : { deadeyeMaliceSnapshot: snapshot };
}

/** Register resource and snapshot lifetimes together; commitment cleanup never retires delayed-hit snapshots. */
export const deadeyeMaliceStateHooks = {
  resources: { malice: deadeyeMalice },
  prepareDamageState(runtime, _skill, inputs) {
    const state = deadeyeState.from(runtime.profession);
    const malice = Number(inputs.malice ?? 0);

    if (!Number.isInteger(malice) || malice < 0 || malice > state.malice.maximum)
      throw new RangeError('Malice exceeds the selected build maximum.');

    // Isolated occurrences set an assumed balance and mark without earning cycle rewards.
    runtime.resourceController.replace('malice', malice);
    state.markedTargetId = 'target';
    state.markExpiresAt = Infinity;
  },
  onCastStart: captureDeadeyeMalice,
  onCastCommit(_runtime, cast) {
    // Authored commitment actions have already read the original cast's accepted facts.
    markedMaliceByCast.delete(cast);
  },
  reactions: { 'damage.resolving': deadeyeMaliceSnapshot }
} satisfies RuntimeHooks<ThiefRuntimeState, ThiefSkill>;
