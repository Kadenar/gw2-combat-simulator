import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type { RuntimeCast, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import { skillTaskAt } from '#gw2/platform/simulation/internal-work.js';
import type { SkillTask } from '#gw2/platform/engine/skills/types.js';
import type { MesmerRuntimeState } from '#gw2/professions/mesmer/types.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { completeMirageSkill } from '#gw2/professions/mesmer/specializations/mirage/traits/self-deception.js';
import { mirageEndurance } from '#gw2/professions/mesmer/specializations/mirage/mechanics/cloak-and-ambushes.js';
import { mirageAvailability } from '#gw2/professions/mesmer/specializations/mirage/mechanics/cloak-and-ambushes.js';
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
export const mirageHooks: Partial<RuntimeProfession<MesmerRuntimeState>> = {
  initialize: initializeMirageRuntime,
  endurance: mirageEndurance,
  availability: mirageAvailability,
  onCastStart(runtime, cast) {
    const skill = cast.skill as MesmerSkill;
    if (!skill.ambush || cast.cancelled) return;
    withMesmerCastEmission(runtime, cast, skill, () =>
      mirageControllerFor(mesmerMechanicsFor(runtime)).acceptPlayerAmbush(skill, cast.fullEnd, cast.start)
    );
  },
  onCastCommit(runtime, cast) {
    completeMirageSkill(runtime, cast);
    for (const trigger of cast.skill.tasks ?? [])
      if (trigger.type === 'mesmer.mirage.create-mirror') {
        // Readiness uses an actual queued creation deadline, without creating or spending a future mirror.
        mirageState.from(runtime).pendingMirrorAts.push(skillTaskAt(cast, trigger, runtime.time));
      }
  },
  tasks: {
    'mesmer.mirage.ambush-clone'(runtime, data) {
      const cast = (data as TriggerData).cast;
      const mechanics = mesmerMechanicsFor(runtime);
      mechanics.resources.queueResources(
        runtime.time,
        1,
        cast.skill.weapon || mechanics.activePrimaryWeapon(),
        cast.skill.name,
        { sourceSkillId: cast.skill.id }
      );
    },
    'mesmer.mirage.create-mirror'(runtime, data) {
      const { trigger } = data as TriggerData;
      const state = mirageState.from(runtime);
      state.pendingMirrorAts = state.pendingMirrorAts.filter((at) => at > runtime.time);
      mirageControllerFor(mesmerMechanicsFor(runtime)).createMirrors(runtime.time, trigger.count ?? 1);
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
        (data as TriggerData).cast.skill as MesmerSkill
      );
    },
    'mesmer.mirage.dodge'(runtime, data) {
      const { cast } = data as TriggerData;
      const mechanics = mesmerMechanicsFor(runtime);
      mirageControllerFor(mechanics).grantMirageCloak(runtime.time, cast.skill.name);
      if (hasTrait(runtime, TRAIT.DECEPTIVE_EVASION))
        mechanics.resources.queueResources(runtime.time, 1, mechanics.activePrimaryWeapon(), 'Deceptive Evasion', {
          traitId: TRAIT.DECEPTIVE_EVASION,
          traitName: 'Deceptive Evasion'
        });
    }
  }
};
