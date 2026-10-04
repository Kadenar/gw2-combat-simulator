import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { sideEffectAmount } from '#gw2/platform/effects/action-dispatch.js';
import {
  commitMesmerShatter,
  scheduleMesmerPhantasmEffects,
  startMesmerCast
} from '#gw2/professions/mesmer/core/execution/cast-lifecycle.js';
import type { MesmerPendingResource } from '#gw2/professions/mesmer/core/mechanics/resource-types.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import type { MesmerRuntimeState } from '#gw2/professions/mesmer/types.js';
import { boundedNumber } from '#kernel/core/numeric.js';

import {
  createMesmerResources,
  createMesmerCloneScheduler,
  mesmerActivePrimaryWeapon,
  mesmerShatters
} from '#gw2/professions/mesmer/family-mechanics.js';
import { mesmerResourceDefinition } from '#gw2/professions/mesmer/family-state.js';

/** Illusions share one resource transaction owner; tasks and cast selection travel with that lifecycle. */
export const mesmerIllusionHooks = {
  initialize(runtime) {
    const resourceDefinition = mesmerResourceDefinition(runtime.profession.specialization.kind, runtime);
    createMesmerResources(runtime).gainResources(
      0,
      boundedNumber(runtime.config.initialResource ?? 0, 0, 0, resourceDefinition.maximum),
      mesmerActivePrimaryWeapon(runtime),
      'initial',
      { kind: 'initial' }
    );
  },
  modifyEffects(runtime, cast, effects) {
    const skill = cast.skill;
    if (skill.phantasm)
      return effects.filter((effect) => effect.type === 'control' && effect.summonKind !== 'phantasm');
    if (mesmerShatters(runtime)[skill.id] || skill.id === ID.INSPIRING_IMAGERY) return [];
    return effects.filter((effect) => !(effect.type === 'buff' && effect.kind === 'clarity'));
  },
  onCastStart(runtime, cast) {
    const skill = cast.skill;
    startMesmerCast(runtime, cast, skill);
  },
  backgroundTasks: ['mesmer.clone-attack'],
  tasks: {
    'mesmer.clone-attack'(runtime, data) {
      const id = Number(data);
      const next = createMesmerCloneScheduler(runtime).handleTask(id, runtime.time);
      if (next != null)
        runtime.schedule('mesmer.clone-attack', next, id, { id: `mesmer.clone:${id}`, generation: 0 }, -50);
    },
    'mesmer.resource-gain'(runtime, data) {
      const { count, weapon, reason, cause } = data as MesmerPendingResource;
      createMesmerResources(runtime).gainResources(runtime.time, count, weapon, reason, cause);
    }
  },
  sideEffectHandlers: {
    'mesmer.shatter'(runtime, context) {
      if (context.kind === 'cast') commitMesmerShatter(runtime, context.cast);
    },
    'mesmer.summon-phantasm'(runtime, context) {
      if (context.kind === 'cast') scheduleMesmerPhantasmEffects(runtime, context.cast, context.skill);
    },
    // Impact-owned illusion gains use the same clone/blade/imagery resource owner as other skills.
    'mesmer.illusion-gain'(runtime, context, action) {
      if (action.type !== 'mesmer.illusion-gain') return;
      createMesmerResources(runtime).gainResources(
        runtime.time,
        sideEffectAmount(runtime, action.amount!),
        context.skill.weapon || mesmerActivePrimaryWeapon(runtime),
        context.skill.name,
        { kind: 'skill', sourceSkillId: context.skill.id }
      );
    }
  }
} satisfies RuntimeHooks<MesmerRuntimeState, MesmerSkill>;
