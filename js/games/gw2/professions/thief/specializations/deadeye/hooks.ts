import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { composeRuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { deferThiefCompletion } from '#gw2/professions/thief/core/events.js';
import { storeThiefStolenSkillChoices } from '#gw2/professions/thief/core/mechanics/steal.js';
import { deadeyeCastAvailability } from '#gw2/professions/thief/specializations/deadeye/mechanics/availability.js';
import { deadeyeMaliceLifecycle } from '#gw2/professions/thief/specializations/deadeye/mechanics/malice-lifecycle.js';
import { deadeyeCastCompleted } from '#gw2/professions/thief/specializations/deadeye/mechanics/trigger-points.js';
import { deadeyesMarkLifecycle } from '#gw2/professions/thief/specializations/deadeye/skills/deadeyes-mark.js';
import { maliciousAttackLifecycle } from '#gw2/professions/thief/specializations/deadeye/skills/malicious-attacks.js';
import { deadeyeSlotLifecycle } from '#gw2/professions/thief/specializations/deadeye/skills/slot-skills.js';
import { stolenSkillGrant } from '#gw2/professions/thief/specializations/deadeye/traits/behavior.js';
import type { ThiefConfig, ThiefRuntimeState, ThiefSkill } from '#gw2/professions/thief/types.js';

const DEADEYE_COMPLETE = 'thief.deadeye-complete';

/** Deadeye hooks: the mark and malice, malicious attacks, stolen skills, Mercy, Shadow Flare, and cantrip traits. */
export const deadeyeHooks = composeRuntimeHooks<ThiefRuntimeState, ThiefSkill>([
  deadeyeSlotLifecycle,
  deadeyesMarkLifecycle,
  maliciousAttackLifecycle,
  {
    // Pre-steal grants the selected stolen-skill pool without marking a target, gaining malice, or firing steal traits.
    initialize(runtime) {
      if ((runtime.config as ThiefConfig).initialPreSteal !== 1) return;

      storeThiefStolenSkillChoices(runtime, stolenSkillGrant(runtime));
    },
    availability: (runtime, skill) => deadeyeCastAvailability(runtime.flips, skill, runtime.time),
    onCastCommit(runtime, cast) {
      // Finishing hits precede the deferred stolen-skill, dodge, and cantrip trait rewards.
      deferThiefCompletion(runtime, DEADEYE_COMPLETE, cast);
    },
    tasks: {
      [DEADEYE_COMPLETE](runtime, data) {
        const { cast } = data as { cast: RuntimeCast<ThiefSkill> };
        runtime.fireTrigger(deadeyeCastCompleted, { cast });
      }
    }
  },
  deadeyeMaliceLifecycle
]);
