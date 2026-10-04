import { armSkillFlip, consumeSkillFlip } from '#gw2/platform/execution/skill-flips.js';
import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';
import type { EngineerSkill, EngineerRuntimeState } from '#gw2/professions/engineer/types.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import { buildEngineerPackets } from '#gw2/professions/engineer/core/events.js';
import { produceRuntimeCombos } from '#gw2/platform/combos/runtime.js';
/** Definitions own cast-phase flips; the deployed generation owns automatic pulses and face expiry. */
export const engineerTurretSideEffectHandlers: RuntimeProfession<
  EngineerRuntimeState,
  EngineerSkill
>['sideEffectHandlers'] = {
  'engineer.retire-turret'(runtime) {
    const state = runtime.profession.core;
    runtime.cancelOwner({ id: 'engineer.turret', generation: state.healingTurretGeneration++ });
  },
  'engineer.deploy-turret'(runtime, context) {
    if (context.kind !== 'cast') throw new TypeError('Turret deployment requires a cast trigger.');
    const state = runtime.profession.core;
    const owner = { id: 'engineer.turret', generation: state.healingTurretGeneration };
    state.healingTurretActivationId = context.cast.id;
    runtime.cooldownController.setReadyAt(ID.DETONATE_HEALING_TURRET, runtime.time + 0.5);
    runtime.schedule('engineer.turret-pulse', runtime.time + 0.24, context.cast.id, owner);
    runtime.schedule('engineer.turret-flip', runtime.time + 10.24, undefined, owner);
  },
  'engineer.detonate-turret'(runtime) {
    runtime.profession.core.healingTurretActivationId = '';
    runtime.cooldownController.startRecharge(runtime.helpers.skillsById.get(ID.HEALING_TURRET)!, runtime.time);
  },
  'engineer.overcharge-turret'(runtime) {
    runtime.schedule('engineer.turret-flip', runtime.time + 10, undefined, {
      id: 'engineer.turret',
      generation: runtime.profession.core.healingTurretGeneration
    });
  }
};

/** The deployed turret generation owns its pulse and flip deadlines. */
export const engineerTurretTasks: RuntimeProfession<EngineerRuntimeState, EngineerSkill>['tasks'] = {
  'engineer.turret-pulse'(runtime, data) {
    const skill = runtime.helpers.skillsById.get(ID.CLEANSING_BURST)!;
    const activationId = `${data}:cleansing-burst`;
    for (const effect of skill.effects ?? [])
      if (effect.type === 'boon' || effect.type === 'buff') {
        buildEngineerPackets(
          'buff',
          {
            at: runtime.time,
            activationId,
            kind: String(effect.boon ?? effect.kind),
            stacks: Number(effect.stacks),
            duration: effect.duration
          },
          skill
        ).forEach((packet) => runtime.effects.emit({ kind: 'packet', event: packet }));
      }

    produceRuntimeCombos(runtime, runtime.helpers, {
      type: 'action',
      at: runtime.time,
      endsAt: runtime.time,
      source: 'engineer',
      sourceId: skill.id,
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      activationId,
      comboFields: skill.comboFields
    });
  },
  'engineer.turret-flip'(runtime) {
    consumeSkillFlip(runtime.profession.core.availableFlips, ID.DETONATE_HEALING_TURRET);
    armSkillFlip(runtime.profession.core.availableFlips, ID.CLEANSING_BURST, runtime.time);
  }
};
