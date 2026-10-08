import { sideEffectAmount } from '#gw2/platform/effects/action-dispatch.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import {
  commitMesmerShatter,
  scheduleMesmerPhantasmEffects,
  startMesmerCast
} from '#gw2/professions/mesmer/core/execution/cast-lifecycle.js';
import { buildMesmerPacket, mesmerPacketOwner } from '#gw2/professions/mesmer/core/mechanics/packets.js';
import type { MesmerPendingResource } from '#gw2/professions/mesmer/core/mechanics/resource-types.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { mesmerShatterDefinition } from '#gw2/professions/mesmer/family-mechanics.js';
import {
  createMesmerCloneScheduler,
  createMesmerIllusionRewards,
  mesmerActivePrimaryWeapon
} from '#gw2/professions/mesmer/family-resources.js';
import { mesmerResourceDefinition, mesmerResourceKind } from '#gw2/professions/mesmer/family-state.js';
import type { MesmerRuntimeState } from '#gw2/professions/mesmer/types.js';
import { boundedNumber } from '#kernel/core/numeric.js';

/** Illusions share one resource transaction owner; tasks and cast selection travel with that lifecycle. */
export const mesmerIllusionHooks = {
  initialize(runtime) {
    const resourceDefinition = mesmerResourceDefinition(runtime.profession.specialization.kind, runtime);
    const kind = mesmerResourceKind(runtime.profession.specialization.kind);
    // Numeric policies already seeded their clocks; observe the seed without granting it or earning rewards again.
    if (kind !== 'clones') {
      const value = runtime.resourceController.value(kind);
      if (value > 0) {
        const packet = buildMesmerPacket({
          type: 'resource',
          at: 0,
          amount: value,
          value,
          maximum: resourceDefinition.maximum,
          resource: kind,
          reason: 'initial',
          created: []
        });
        runtime.effects.emit({
          kind: 'packet',
          event: packet,
          owner: mesmerPacketOwner(packet),
          priority: Number(packet.priority ?? 0)
        });
      }

      return;
    }

    createMesmerIllusionRewards(runtime).gainResources(
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
    if (mesmerShatterDefinition(runtime, skill.id) || skill.id === ID.INSPIRING_IMAGERY) return [];
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
      createMesmerIllusionRewards(runtime).gainResources(runtime.time, count, weapon, reason, cause);
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
      createMesmerIllusionRewards(runtime).gainResources(
        runtime.time,
        sideEffectAmount(runtime, action.amount!),
        context.skill.weapon || mesmerActivePrimaryWeapon(runtime),
        context.skill.name,
        { kind: 'skill', sourceSkillId: context.skill.id }
      );
    }
  }
} satisfies RuntimeHooks<MesmerRuntimeState, MesmerSkill>;
