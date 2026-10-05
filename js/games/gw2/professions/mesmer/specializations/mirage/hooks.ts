import { mirageBuffPolicies } from '#gw2/professions/mesmer/specializations/mirage/effect-state.js';
import {
  createMesmerIllusionRewards,
  createMesmerActions,
  mesmerActivePrimaryWeapon
} from '#gw2/professions/mesmer/family-mechanics.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { SkillTask } from '#gw2/platform/skills/types.js';
import { skillTaskAt } from '#gw2/platform/execution/task-timing.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { mesmerCastDelivery } from '#gw2/professions/mesmer/core/execution/cast-lifecycle.js';
import { triggerDeceptiveEvasion } from '#gw2/professions/mesmer/core/traits/dueling.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import {
  mirageAvailability,
  mirageEndurance
} from '#gw2/professions/mesmer/specializations/mirage/mechanics/cloak-and-ambushes.js';
import { createMirageMechanics } from '#gw2/professions/mesmer/specializations/mirage/mechanics/runtime.js';
import { mirageState } from '#gw2/professions/mesmer/specializations/mirage/state.js';
import {
  completeMirageSkill,
  initializeMirageTraits
} from '#gw2/professions/mesmer/specializations/mirage/traits/behavior.js';
import type { MesmerRuntimeState } from '#gw2/professions/mesmer/types.js';

type TriggerData = { cast: RuntimeCast<MesmerSkill>; trigger: SkillTask };

/** Cloak, mirror pickup, and endurance execute at actual command and owned-task boundaries. */
export const mirageHooks: RuntimeHooks<MesmerRuntimeState, MesmerSkill> = {
  buffPolicies: mirageBuffPolicies,
  initialize: initializeMirageTraits,
  endurance: mirageEndurance,
  availability: mirageAvailability,
  onCastStart(runtime, cast) {
    const skill = cast.skill;
    if (!skill.ambush || cast.cancelled) return;
    createMirageMechanics(runtime).acceptPlayerAmbush(skill, cast.fullEnd, cast.start, mesmerCastDelivery(cast, skill));
  },
  onCastCommit(runtime, cast) {
    completeMirageSkill(runtime, cast, {
      currentResource: () => createMesmerActions(runtime).currentResource(),
      queueResources: (...args) => createMesmerIllusionRewards(runtime).queueResources(...args),
      activePrimaryWeapon: () => mesmerActivePrimaryWeapon(runtime)
    });
    for (const trigger of cast.skill.tasks ?? [])
      if (trigger.type === 'mesmer.mirage.create-mirror') {
        // Readiness uses an actual queued creation deadline, without creating or spending a future mirror.
        mirageState.from(runtime).pendingMirrorAts.push(skillTaskAt(cast, trigger, runtime.time));
      }
  },
  tasks: {
    'mesmer.mirage.ambush-clone'(runtime, data) {
      const cast = (data as TriggerData).cast;
      createMesmerIllusionRewards(runtime).queueResources(
        runtime.time,
        1,
        cast.skill.weapon || mesmerActivePrimaryWeapon(runtime),
        cast.skill.name,
        { sourceSkillId: cast.skill.id }
      );
    },
    'mesmer.mirage.create-mirror'(runtime, data) {
      const { trigger } = data as TriggerData;
      const state = mirageState.from(runtime);
      state.pendingMirrorAts = state.pendingMirrorAts.filter((at) => at > runtime.time);
      createMirageMechanics(runtime).createMirrors(runtime.time, trigger.count ?? 1);
    },
    'mesmer.mirage.grant-cloak'(runtime, data) {
      createMirageMechanics(runtime).grantMirageCloak(runtime.time, (data as TriggerData).cast.skill.name);
    },
    'mesmer.mirage.pick-up-mirror'(runtime, data) {
      createMirageMechanics(runtime).pickUpMirror(runtime.time, (data as TriggerData).cast.skill);
    },
    'mesmer.mirage.dodge'(runtime, data) {
      const { cast } = data as TriggerData;
      createMirageMechanics(runtime).grantMirageCloak(runtime.time, cast.skill.name);
      triggerDeceptiveEvasion(runtime, (...args) => createMesmerIllusionRewards(runtime).queueResources(...args));
    }
  }
};
