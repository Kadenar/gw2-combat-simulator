/**
 * Owns Necromancer sword autoattack-chain retention and expiry scheduling.
 * Sword skill fragments remain in `skills/weapons/sword.ts`; the profession observes shared chain transitions here.
 */
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import {
  resetAutoattackChains,
  type AutoattackChainTransitionContext
} from '#gw2/platform/skills/autoattack-chains.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import type { ScheduledTask, SchedulerRecord } from '#gw2/platform/engine/execution/types.js';
import type { NecromancerCastContext, NecromancerSchedulerContext } from '#gw2/professions/necromancer/types.js';

const SWORD_AUTOATTACK_EXPIRY_OWNER = 'necromancer.sword-autoattack-chain';
const SWORD_AUTOATTACK_EXPIRY_TASK = 'necromancer.sword-autoattack-chain-expire';
const SWORD_AUTOATTACK_RETENTION_SECONDS = 3;

// Expires a sword continuation only if no newer transition has replaced the scheduled chain state.
function expireSwordAutoattackChain(context: NecromancerSchedulerContext, task: ScheduledTask<SchedulerRecord>): void {
  const root = Number(task.payload?.root);
  const next = Number(task.payload?.next);
  const state = professionCoreState(context);
  if (Number(state.autoattackChains[root]) === next) resetAutoattackChains(context, [root]);
}

/** Keeps the Necromancer sword's three-second continuation window aligned with shared chain transitions. */
export function observeNecromancerAutoattackTransition(transition: AutoattackChainTransitionContext): void {
  const sword = transition.result.transitions.find((change) => Number(change.chainRootId) === ID.ENERVATION_BLADE);
  if (!transition.result.committed || !sword || sword.decision === 'preserve') return;
  const context = transition.cast as unknown as NecromancerCastContext;
  context.tasks.cancelOwner(SWORD_AUTOATTACK_EXPIRY_OWNER);
  if (sword.decision !== 'advance' || sword.nextSkillId == null) return;
  context.tasks.schedule({
    type: SWORD_AUTOATTACK_EXPIRY_TASK,
    at: context.effectiveEnd + SWORD_AUTOATTACK_RETENTION_SECONDS,
    ownerId: SWORD_AUTOATTACK_EXPIRY_OWNER,
    payload: { root: sword.chainRootId, next: sword.nextSkillId }
  });
}

/** Exposes sword-owned scheduled callbacks to Core module composition. */
export const necromancerSwordTaskHandlers = Object.freeze({
  [SWORD_AUTOATTACK_EXPIRY_TASK]: expireSwordAutoattackChain
});
