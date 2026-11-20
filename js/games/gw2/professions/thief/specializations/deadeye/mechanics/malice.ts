/** Own the malice pool and capture its value when a strike resolves. */
import { buffDeadlineActive } from '#gw2/platform/combat/buff-expiry.js';
import type { ResourcePolicy } from '#gw2/platform/combat/resources/resource-policy.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import { maliceGained } from '#gw2/professions/thief/specializations/deadeye/mechanics/trigger-points.js';
import { deadeyeState, type DeadeyeState } from '#gw2/professions/thief/specializations/deadeye/state.js';
import { initialMalice, maximumDeadeyeMalice } from '#gw2/professions/thief/specializations/deadeye/traits/behavior.js';
import type { ThiefRuntimeState, ThiefSkill } from '#gw2/professions/thief/types.js';

const maliceSnapshots = new WeakMap<Partial<DeadeyeState>, Map<string, number>>();

/** Salvo's poison uses the malice from its own outgoing strike, even after Malicious Intent grants new stacks. */
export function outgoingSalvoMalice(
  state: Partial<DeadeyeState>,
  activationId: Gw2ResolverEvent['activationId']
): number {
  return maliceSnapshots.get(state)?.get(String(activationId)) ?? 0;
}

function recordAttackMalice(runtime: ThiefRuntime, activationId: string, malice: number): void {
  const state = deadeyeState.from(runtime.profession);
  let snapshots = maliceSnapshots.get(state);

  if (!snapshots) maliceSnapshots.set(state, (snapshots = new Map()));

  snapshots.set(activationId, malice);
}

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
  return Boolean(state.markedTargetId) && buffDeadlineActive(state.markExpiresAt, runtime.time);
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

function readsMaliceOnStrike(skillId: Gw2ResolverEvent['skillId']): boolean {
  return (
    skillId === ID.MALICIOUS_HOOK_STRIKE ||
    skillId === ID.MALICIOUS_SNEAK_ATTACK ||
    skillId === ID.MALICIOUS_BACKSTAB ||
    skillId === ID.MALICIOUS_DEATHS_JUDGMENT ||
    skillId === ID.MALICIOUS_TACTICAL_STRIKE
  );
}

/** Sample live strike bonuses before hit reactions spend malice or grant Malicious Intent. */
function deadeyeMaliceSnapshot(runtime: ThiefRuntime, event: Gw2ResolverEvent) {
  if (
    event.skillId === ID.MALICIOUS_CUNNING_SALVO &&
    event.actorType === 'player' &&
    !event.procType &&
    event.metadata?.recallSkillId == null &&
    typeof event.activationId === 'string'
  ) {
    const malice = deadeyeMarked(runtime) && !event.offTarget ? runtime.resourceController.value('malice') : 0;
    recordAttackMalice(runtime, event.activationId, malice);
    return { deadeyeMaliceSnapshot: malice };
  }

  if (readsMaliceOnStrike(event.skillId) && event.actorType === 'player')
    return { deadeyeMaliceSnapshot: runtime.resourceController.value('malice') };
}

/** Sample malice at strike resolution for both rotation and isolated damage calculations. */
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
  reactions: { 'damage.resolving': deadeyeMaliceSnapshot }
} satisfies RuntimeHooks<ThiefRuntimeState, ThiefSkill>;
