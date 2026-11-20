import { buffDeadlineActive, buffDeadlineReached } from '#gw2/platform/combat/buff-expiry.js';
import { gw2Time } from '#gw2/platform/combat/clock.js';
import { type Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { requireSkill, skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { commitThiefSteal, storeThiefStolenSkillChoices } from '#gw2/professions/thief/core/mechanics/steal.js';
import { thiefRuntimeSpecializationState } from '#gw2/professions/thief/core/state-queries.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import {
  refreshDeadeyeMarkMalice,
  resetDeadeyeMalice,
  startDeadeyeMarkMalice
} from '#gw2/professions/thief/specializations/deadeye/mechanics/malice.js';
import { markCompleted } from '#gw2/professions/thief/specializations/deadeye/mechanics/trigger-points.js';
import { deadeyeState } from '#gw2/professions/thief/specializations/deadeye/state.js';
import { stolenSkillGrant } from '#gw2/professions/thief/specializations/deadeye/traits/behavior.js';
import type { ThiefRuntimeState, ThiefSkill } from '#gw2/professions/thief/types.js';

/** Deadeye's Mark commits the target and stolen-skill transaction through its skill-owned action. */
export const DEADEYE_MARK_SKILLS: Readonly<Record<number, SkillDefinition<ThiefSkill>>> = {
  [ID.DEADEYES_MARK]: {
    name: "Deadeye's Mark",
    icon: 'https://render.guildwars2.com/file/3ECEA70D0DCDAF65E0069263D005507ADBF95A62/1770609.png',
    type: 'Profession',
    slot: 'Profession_1',
    // Intrinsic tuning follows this selected skill at its existing lifecycle boundary.
    duration: 30,
    stealTraitSkill: true,
    movementSkill: true,
    cooldown: 25,
    castTimeMs: 0,
    effects: [],
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.deadeyes-mark' } }]
  }
};

const DEADEYE_MARK_EXPIRY = 'thief.deadeye-mark-expire';
/** Re-marking a live target adds malice before Deadeye stores the new stolen choices. */
function applyDeadeyesMark(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  const state = deadeyeState.from(runtime.profession);
  const remarking = state.markedTargetId === 'primary-target' && buffDeadlineActive(state.markExpiresAt, runtime.time);
  const duration = skillNumber(requireSkill(runtime.helpers, ID.DEADEYES_MARK), 'duration');
  state.markedTargetId = duration > 0 ? 'primary-target' : null;
  state.markExpiresAt = gw2Time(runtime.time + Math.max(0, duration));
  // A refresh is a new mark lifetime even on the same target; older expiry tasks must not clear its malice.
  state.markGeneration += 1;

  // Malice cycle rewards precede stolen-skill acquisition and the mark's own completion rewards.
  if (remarking) refreshDeadeyeMarkMalice(runtime, cast);
  else startDeadeyeMarkMalice(runtime, cast);

  storeThiefStolenSkillChoices(runtime, stolenSkillGrant(runtime));
}

/** Mark expiry resets malice; a stale expiry from an earlier mark is ignored. */
function expireDeadeyesMark(runtime: ThiefRuntime, data: unknown): void {
  const state = deadeyeState.from(runtime.profession);

  if (
    (data as { generation: number }).generation !== state.markGeneration ||
    !buffDeadlineReached(state.markExpiresAt, runtime.time)
  )
    return;

  state.markedTargetId = null;
  state.markExpiresAt = 0;
  resetDeadeyeMalice(runtime);
}

/** A detached preview may omit expiry while a live zero deadline denotes an inactive mark. */
export function markedTarget(context: Gw2ModifierContext): boolean {
  const state = thiefRuntimeSpecializationState(context.runtime?.profession, 'Deadeye');
  return Boolean(state.markedTargetId) && buffDeadlineActive(state.markExpiresAt ?? Infinity, context.time);
}

/** Register actions beside the skills whose accepted casts select them. */
const deadeyesMarkActions: NonNullable<RuntimeHooks<ThiefRuntimeState, ThiefSkill>['sideEffectHandlers']> = {
  'thief.deadeyes-mark'(runtime, context) {
    if (context.kind !== 'cast') return;

    const { cast } = context;
    commitThiefSteal(runtime, cast, () => applyDeadeyesMark(runtime, cast));
    runtime.fireTrigger(markCompleted, { cast });
    const state = deadeyeState.from(runtime.profession);
    runtime.scheduleExpiry(DEADEYE_MARK_EXPIRY, state.markExpiresAt, { generation: state.markGeneration });
  }
};

/** Deadeye's Mark application and expiry share one owner. */
export const deadeyesMarkLifecycle = {
  sideEffectHandlers: deadeyesMarkActions,
  tasks: { [DEADEYE_MARK_EXPIRY]: expireDeadeyesMark }
} satisfies RuntimeHooks<ThiefRuntimeState, ThiefSkill>;
