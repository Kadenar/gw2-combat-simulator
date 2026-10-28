import { produceRuntimeCombos } from '#gw2/platform/combos/runtime.js';
import { ACTOR } from '#gw2/platform/constants.js';
import { denySkillCast } from '#gw2/platform/execution/availability.js';
import { armSkillFlip, consumeSkillFlip } from '#gw2/platform/execution/skill-flips.js';
import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { EngineerRuntimeState, EngineerSkill } from '#gw2/professions/engineer/types.js';

/** Definitions own cast-phase flips; the deployed generation owns automatic pulses and face expiry. */
const engineerTurretSideEffectHandlers: RuntimeProfession<EngineerRuntimeState, EngineerSkill>['sideEffectHandlers'] = {
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
const engineerTurretTasks: RuntimeProfession<EngineerRuntimeState, EngineerSkill>['tasks'] = {
  'engineer.turret-pulse'(runtime, data) {
    const skill = runtime.helpers.skillsById.get(ID.CLEANSING_BURST)!;
    const activationId = `${data}:cleansing-burst`;
    // Materialize the selected payload with its audience and generation lifetime, without replaying manual cast actions.
    runtime.effects.emit({
      kind: 'profile',
      profile: skill,
      owner: { id: 'engineer.turret', generation: runtime.profession.core.healingTurretGeneration },
      attribution: {
        source: 'engineer',
        sourceId: skill.id,
        actorType: ACTOR.PLAYER,
        skillId: skill.id,
        skillName: skill.name,
        activationId
      }
    });

    produceRuntimeCombos(runtime, runtime.helpers, {
      type: 'action',
      at: runtime.time,
      endsAt: runtime.time,
      source: 'engineer',
      sourceId: skill.id,
      actorType: ACTOR.PLAYER,
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

/** Turret deployment, its single-deployment gate, deferred recharge, and autonomous attacks share one owner. */
export const engineerTurretLifecycle = {
  sideEffectHandlers: engineerTurretSideEffectHandlers,
  tasks: engineerTurretTasks,
  // One turret exists at a time; the parent stays unavailable until detonation retires the deployed generation.
  availability(runtime, skill) {
    return skill.id === ID.HEALING_TURRET && runtime.profession.core.healingTurretActivationId
      ? denySkillCast(skill, 'engineer.healing-turret-active', 'the deployed turret must be detonated first.')
      : { ready: true };
  },
  // Deployment reserves no recharge; detonation starts the parent's recharge instead.
  reserveRecharge: (_runtime, skill, work) => (skill.id === ID.HEALING_TURRET ? 0 : work)
} satisfies RuntimeHooks<EngineerRuntimeState, EngineerSkill>;
