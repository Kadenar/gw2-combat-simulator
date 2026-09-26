import type { RuntimeCast, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import { canonicalTime } from '#kernel/core/clock.js';
import type { SkillTask } from '#gw2/platform/engine/skills/types.js';
import type { MesmerRuntimeState } from '#gw2/professions/mesmer/types.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { cancelledBeforeInterruptCommit } from '#gw2/platform/execution/effect-adapter.js';
import {
  completeMirageSkill,
  mirageAvailability,
  mirageEndurance
} from '#gw2/professions/mesmer/specializations/mirage/mechanics/ambush-rules.js';
import {
  initializeMirageRuntime,
  mirageControllerFor
} from '#gw2/professions/mesmer/specializations/mirage/mechanics/runtime.js';
import { mirageState } from '#gw2/professions/mesmer/specializations/mirage/state.js';
import { mesmerMechanicsFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import { withMesmerCastEmission } from '#gw2/professions/mesmer/core/execution/cast-lifecycle.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';

type TriggerData = { cast: RuntimeCast; trigger: SkillTask };

/** Cloak, mirror pickup, and endurance execute at actual command and owned-task boundaries. */
export const mirageLive: Partial<RuntimeProfession<MesmerRuntimeState>> = {
  initialize: initializeMirageRuntime,
  endurance: mirageEndurance,
  availability: mirageAvailability,
  modifyEffects(_runtime, cast, effects) {
    return cast.skill.ambush ? effects.filter((effect) => effect.type === 'control') : effects;
  },
  onCastStart(runtime, cast) {
    const skill = cast.skill as MesmerSkill;
    if (!skill.ambush || cancelledBeforeInterruptCommit(skill, cast.start, cast.fullEnd, cast.effectiveEnd)) return;
    withMesmerCastEmission(runtime, cast, skill, () =>
      mirageControllerFor(mesmerMechanicsFor(runtime)).executePlayerAmbush(skill, cast.fullEnd, cast.start)
    );
  },
  onCastComplete(runtime, cast) {
    completeMirageSkill(runtime, cast);
    if (cancelledBeforeInterruptCommit(cast.skill, cast.start, cast.fullEnd, cast.effectiveEnd)) return;
    for (const trigger of (cast.skill as MesmerSkill).mesmerTasks ?? [])
      if (trigger.type === 'mesmer.mirage.create-mirror') {
        // Readiness uses an actual queued creation deadline, without creating or spending a future mirror.
        mirageState
          .from(runtime)
          .pendingMirrorAts.push(
            canonicalTime(
              (trigger.timingAnchor === 'castStart' ? cast.start : cast.fullEnd) + Number(trigger.atMs ?? 0) / 1000
            )
          );
      }
  },
  tasks: {
    'mesmer.mirror-expire'(runtime) {
      const state = mirageState.from(runtime);
      state.mirrors = state.mirrors.filter((mirror) => mirror.expiresAt > runtime.time);
    },
    'mesmer.mirage.create-mirror'(runtime, data) {
      const { cast, trigger } = data as TriggerData;
      const state = mirageState.from(runtime);
      state.pendingMirrorAts = state.pendingMirrorAts.filter((at) => at > runtime.time);
      state.mirrors = state.mirrors.filter((mirror) => mirror.expiresAt > runtime.time);
      mirageControllerFor(mesmerMechanicsFor(runtime)).createMirrors(runtime.time, trigger.count ?? 1, cast.skill.name);
    },
    'mesmer.mirage.grant-cloak'(runtime, data) {
      mirageControllerFor(mesmerMechanicsFor(runtime)).grantMirageCloak(
        runtime.time,
        (data as TriggerData).cast.skill.name
      );
    },
    'mesmer.mirage.pick-up-mirror'(runtime, data) {
      mirageControllerFor(mesmerMechanicsFor(runtime)).pickUpMirror(
        runtime.time,
        (data as TriggerData).cast.skill.name
      );
    },
    'mesmer.mirage.dodge'(runtime, data) {
      const { cast } = data as TriggerData;
      runtime.endurance.spend(Number(cast.skill.resourceCost ?? 50));
      const mechanics = mesmerMechanicsFor(runtime);
      mirageControllerFor(mechanics).grantMirageCloak(runtime.time, cast.skill.name);
      if (mechanics.traits.has(TRAIT.DECEPTIVE_EVASION))
        mechanics.resources.queueResources(runtime.time, 1, mechanics.activePrimaryWeapon(), 'Deceptive Evasion', {
          traitId: TRAIT.DECEPTIVE_EVASION,
          traitName: 'Deceptive Evasion'
        });
    }
  }
};
