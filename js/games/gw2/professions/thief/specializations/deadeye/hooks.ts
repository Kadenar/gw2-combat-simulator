import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { Gw2HitResolutionContext } from '#gw2/platform/resolver/hit-resolution.js';
import { deferThiefCompletion } from '#gw2/professions/thief/core/events.js';
import { storeThiefStolenSkillChoices } from '#gw2/professions/thief/core/mechanics/steal.js';
import { deadeyeCastAvailability } from '#gw2/professions/thief/specializations/deadeye/mechanics/availability.js';
import { deadeyeCastCompleted } from '#gw2/professions/thief/specializations/deadeye/mechanics/boundaries.js';
import {
  captureDeadeyeMalice,
  deadeyeMalice,
  deadeyeMaliceSnapshot,
  reactDeadeyeMalice
} from '#gw2/professions/thief/specializations/deadeye/mechanics/malice.js';
import {
  DEADEYE_MARK_EXPIRY,
  deadeyesMarkActions,
  expireDeadeyesMark
} from '#gw2/professions/thief/specializations/deadeye/skills/deadeyes-mark.js';
import { maliciousAttackActions } from '#gw2/professions/thief/specializations/deadeye/skills/malicious-attacks.js';
import { deadeyeSlotActions } from '#gw2/professions/thief/specializations/deadeye/skills/slot-skills.js';
import { deadeyeCastFacts, deadeyeState } from '#gw2/professions/thief/specializations/deadeye/state.js';
import { stolenSkillGrant } from '#gw2/professions/thief/specializations/deadeye/traits/behavior.js';
import type { ThiefConfig, ThiefRuntimeState, ThiefSkill } from '#gw2/professions/thief/types.js';

const DEADEYE_COMPLETE = 'thief.deadeye-complete';

/** Deadeye hooks: the mark and malice, malicious attacks, stolen skills, Mercy, Shadow Flare, and cantrip traits. */
export const deadeyeHooks: RuntimeHooks<ThiefRuntimeState, ThiefSkill> = {
  // Pre-steal grants the selected stolen-skill pool without marking a target, gaining malice, or firing steal traits.
  initialize(runtime) {
    if ((runtime.config as ThiefConfig).initialPreSteal !== 1) return;

    storeThiefStolenSkillChoices(runtime, stolenSkillGrant(runtime));
  },
  // Malice has no passive recovery; only accepted mark and hit transactions earn its cycle rewards.
  resources: { malice: deadeyeMalice },
  /** Initialize only damage-relevant form and scaling state for one assumed occurrence. */
  prepareDamageState(runtime, _skill, inputs) {
    const state = deadeyeState.from(runtime);
    const malice = Number(inputs.malice ?? 0);

    if (!Number.isInteger(malice) || malice < 0 || malice > state.malice.maximum)
      throw new RangeError('Malice exceeds the selected build maximum.');

    runtime.resourceController.replace('malice', malice);
    state.markedTargetId = 'target';
    state.markExpiresAt = Infinity;
  },

  sideEffectHandlers: { ...deadeyeSlotActions, ...deadeyesMarkActions, ...maliciousAttackActions },

  availability: (runtime, skill) =>
    deadeyeCastAvailability(runtime.profession.core.availableFlips, skill, runtime.time),
  onCastStart: captureDeadeyeMalice,
  onCastCommit(runtime, cast) {
    // Completion carries the accepted malice and stealth facts across the detached cast-task boundary.
    deferThiefCompletion(runtime, DEADEYE_COMPLETE, cast);
    deadeyeCastFacts.delete(cast);
  },
  reactions: {
    'damage.resolving': deadeyeMaliceSnapshot,
    'damage.resolved'(runtime, event, details) {
      reactDeadeyeMalice(runtime, event, (details as { hitContext?: Gw2HitResolutionContext }).hitContext);
    }
  },
  tasks: {
    [DEADEYE_COMPLETE](runtime, data) {
      const { cast } = data as { cast: RuntimeCast<ThiefSkill> };
      runtime.fireTrigger(deadeyeCastCompleted, { cast });
    },
    [DEADEYE_MARK_EXPIRY]: expireDeadeyesMark
  }
};
