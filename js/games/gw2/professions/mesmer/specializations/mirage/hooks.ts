/** Mirage actions grant cloak and admit skill-owned clone ambushes independently of Infinite Horizon. */
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { skillTaskAt } from '#gw2/platform/execution/cast-timing.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import type { SkillTask } from '#gw2/platform/skills/types.js';
import { mesmerCastDelivery } from '#gw2/professions/mesmer/core/execution/cast-lifecycle.js';
import { mesmerEvaded } from '#gw2/professions/mesmer/core/mechanics/trigger-points.js';
import { MESMER_CORE_CLONE_ATTACKS } from '#gw2/professions/mesmer/core/skills/weapons/clone-attacks.js';
import { MESMER_SKILL_IDS, MESMER_TRAIT_IDS } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { createMesmerIllusionRewards, mesmerActivePrimaryWeapon } from '#gw2/professions/mesmer/family-resources.js';
import { mirageBuffPolicies } from '#gw2/professions/mesmer/specializations/mirage/effect-state.js';
import {
  executeMirageCloneAmbushPackets,
  mirageAvailability,
  mirageEndurance
} from '#gw2/professions/mesmer/specializations/mirage/mechanics/cloak-and-ambushes.js';
import {
  createMirageMechanics,
  mesmerAmbushAttacks
} from '#gw2/professions/mesmer/specializations/mirage/mechanics/runtime.js';
import {
  mirageCastCommitted,
  mirageInitialized
} from '#gw2/professions/mesmer/specializations/mirage/mechanics/trigger-points.js';
import { mirageState } from '#gw2/professions/mesmer/specializations/mirage/state.js';
import type { MesmerRuntimeState } from '#gw2/professions/mesmer/types.js';

type TriggerData = { cast: RuntimeCast<MesmerSkill>; trigger: SkillTask };

/** Cloak, mirror pickup, and endurance execute at actual command and owned-task boundaries. */
export const mirageHooks: RuntimeHooks<MesmerRuntimeState, MesmerSkill> = {
  buffPolicies: mirageBuffPolicies,
  resolveInputControl(_context, skill) {
    // Walking through a mirror is simulated as a command, but adds no discrete key press.
    return skill.id === MESMER_SKILL_IDS.PICK_UP_MIRAGE_MIRROR ? null : undefined;
  },
  initialize(runtime) {
    runtime.fireTrigger(mirageInitialized);
  },
  endurance: mirageEndurance,
  availability: mirageAvailability,
  onCastStart(runtime, cast) {
    const skill = cast.skill;

    if (!skill.ambush || cast.cancelled) return;

    createMirageMechanics(runtime).acceptPlayerAmbush(skill, cast.fullEnd, cast.start, mesmerCastDelivery(cast, skill));
  },
  onCastCommit(runtime, cast) {
    // IA commands the existing clones before Self-Deception creates its replacement. At the clone cap,
    // replacement cancels the oldest owner's queued ambush, leaving the two surviving clones to attack.
    // Infinite Horizon separately commands clones through cloak and clone-gain reactions when selected.
    if (
      cast.skill.id === MESMER_SKILL_IDS.ILLUSIONARY_AMBUSH &&
      !hasTrait(runtime, MESMER_TRAIT_IDS.INFINITE_HORIZON)
    ) {
      executeMirageCloneAmbushPackets(runtime, {
        at: runtime.time,
        clones: [...professionCoreState(runtime).clones],
        weapon: mesmerActivePrimaryWeapon(runtime),
        delivery: mesmerCastDelivery(cast, cast.skill),
        ambushAttacks: mesmerAmbushAttacks(runtime),
        cloneAttacks: MESMER_CORE_CLONE_ATTACKS
      });
    }

    runtime.fireTrigger(mirageCastCommitted, {
      cast,
      at: runtime.time,
      currentResource: professionCoreState(runtime).clones.length,
      weapon: mesmerActivePrimaryWeapon(runtime)
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
      const { cast } = data as TriggerData;
      createMirageMechanics(runtime).grantMirageCloak(runtime.time, cast.skill.name);
    },
    'mesmer.mirage.pick-up-mirror'(runtime, data) {
      createMirageMechanics(runtime).pickUpMirror(runtime.time, (data as TriggerData).cast.skill);
    },
    'mesmer.mirage.dodge'(runtime, data) {
      const { cast } = data as TriggerData;
      createMirageMechanics(runtime).grantMirageCloak(runtime.time, cast.skill.name);
      runtime.fireTrigger(mesmerEvaded, {
        at: runtime.time
      });
    }
  }
};
