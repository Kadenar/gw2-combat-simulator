import { sideEffectAmount } from '#gw2/platform/effects/action-dispatch.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { damageInputEvent } from '#gw2/platform/skill-damage/occurrence-driver.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { engineerBuffPolicies } from '#gw2/professions/engineer/core/effect-state.js';
import { buildEngineerPackets } from '#gw2/professions/engineer/core/events.js';
import { engineerCoreCastAvailability } from '#gw2/professions/engineer/core/mechanics/availability.js';
import { reduceEngineerRecharge } from '#gw2/professions/engineer/core/mechanics/recharge.js';
import { engineerEndurance } from '#gw2/professions/engineer/core/mechanics/resources.js';
import {
  engineerSpearEffects,
  engineerSpearEventHandlers,
  engineerSpearSideEffectHandlers,
  engineerSpearTasks
} from '#gw2/professions/engineer/core/mechanics/spear.js';
import {
  engineerTurretSideEffectHandlers,
  engineerTurretTasks
} from '#gw2/professions/engineer/core/mechanics/turrets.js';
import { handleAirBlast } from '#gw2/professions/engineer/core/skills/kits/flamethrower.js';
import {
  emitAimAssistedRocket,
  emitExplosiveEntrance
} from '#gw2/professions/engineer/core/traits/explosives/explosions.js';
import { emitLesserGrenadeBarrage } from '#gw2/professions/engineer/core/skills/trait-skills.js';
import {
  notifyToolbeltActivation,
  notifyDodgeActivation
} from '#gw2/professions/engineer/core/mechanics/activations.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import type { EngineerRuntime, EngineerRuntimeState, EngineerSkill } from '#gw2/professions/engineer/types.js';

/** Precast mines retain activation ownership until the actual combat boundary permits detonation. */
function detonatePrecastMines(runtime: EngineerRuntime): void {
  const skill = runtime.helpers.skillsById.get(ID.MINE_FIELD)!;
  const detonation = runtime.helpers.skillsById.get(ID.DETONATE_MINE_FIELD)!;
  for (const activationId of runtime.profession.core.pendingMineFieldActivationIds.splice(0)) {
    runtime.effects.emit({
      kind: 'profile',
      profile: skill,
      attribution: {
        source: 'engineer',
        sourceId: skill.id,
        actorType: 'player',
        activationId,
        skillId: skill.id,
        skillName: skill.name
      }
    });
    notifyToolbeltActivation(runtime, detonation, runtime.time);
  }
}

export const engineerCoreHooks: RuntimeHooks<EngineerRuntimeState, EngineerSkill> = {
  damageEffects: [
    {
      id: 'engineer.lesser-grenade-barrage',
      name: 'Lesser Grenade Barrage',
      source: 'Trait',
      ownerId: TRAIT.GRENADIER,
      unit: 'occurrence',
      sourceIds: [ID.LESSER_GRENADE_BARRAGE],
      emit(runtime) {
        emitLesserGrenadeBarrage(runtime, { id: TRAIT.GRENADIER, name: 'Grenadier' }, runtime.time);
      }
    },
    {
      id: 'engineer.explosive-entrance',
      name: 'Explosive Entrance',
      source: 'Trait',
      ownerId: TRAIT.EXPLOSIVE_ENTRANCE,
      unit: 'occurrence',
      sourceIds: [TRAIT.EXPLOSIVE_ENTRANCE],
      emit(runtime) {
        emitExplosiveEntrance(runtime, damageInputEvent(runtime));
      }
    },
    ...([false, true] as const).map((orbital) => ({
      id: `engineer.rocket.${orbital ? 'orbital' : 'rocket'}`,
      name: orbital ? 'Orbital Command Strike' : 'Aim-Assisted Rocket',
      source: 'Trait' as const,
      ownerId: TRAIT.AIM_ASSISTED_ROCKET,
      unit: 'occurrence' as const,
      sourceIds: [orbital ? ID.ORBITAL_COMMAND_STRIKE : ID.AIM_ASSISTED_ROCKET_TRAIT_SKILL],
      emit(runtime: EngineerRuntime) {
        emitAimAssistedRocket(runtime, damageInputEvent(runtime), orbital);
      }
    }))
  ],
  /** Initialize only damage-relevant form and scaling state for one assumed occurrence. */
  prepareDamageState(runtime, skill, _inputs) {
    if (skill?.kitId != null) runtime.profession.core.activeKit = skill.kitId;
  },

  buffPolicies: engineerBuffPolicies,
  endurance: engineerEndurance,
  availability: engineerCoreCastAvailability,
  // The swap input leaves a kit first; only a subsequent precombat input changes equipped sets.
  resolveCastSkill(context, skill) {
    const kit = context.profession.core.activeKit;
    if (skill.id !== SHARED_SKILL_IDS.SWAP_WEAPONS || !kit) return skill;
    const stow = context.helpers.skills.find(
      (candidate) => candidate.kitTransition === 'stow' && candidate.kitId === kit
    );
    if (!stow) throw new Error('Active kit has no stow action.');
    return stow;
  },
  sideEffectHandlers: {
    ...engineerSpearSideEffectHandlers,
    ...engineerTurretSideEffectHandlers,
    'engineer.kit-transition'(runtime, context) {
      if (context.kind !== 'cast') throw new TypeError('Kit transitions require a cast trigger.');
      const { cast } = context;
      const skill = context.skill;
      // Persist bundle identity as the equip skill ID; labels belong to presentation.
      runtime.profession.core.activeKit = skill.kitTransition === 'equip' ? skill.id : null;
      buildEngineerPackets(
        'sigil_swap',
        { at: runtime.time, activationId: cast.id, weaponSet: runtime.activeWeaponSet },
        skill
      ).forEach((packet) => runtime.effects.emit({ kind: 'packet', event: packet }));
    },
    // Mine Field owns registration; the combat boundary still releases its pending activations.
    'engineer.mine-field'(runtime, context) {
      if (context.kind !== 'cast') throw new TypeError('Mine Field requires a cast trigger.');
      if (runtime.combatStartPending) runtime.profession.core.pendingMineFieldActivationIds.push(context.cast.id);
      else notifyToolbeltActivation(runtime, runtime.helpers.skillsById.get(ID.DETONATE_MINE_FIELD)!, runtime.time);
    },
    // Both sword finishers declare the reward while live cooldown selection and proc reporting share one owner.
    'engineer.sword-recharge'(runtime, context, action) {
      if (action.type !== 'engineer.sword-recharge' || action.amount == null)
        throw new TypeError('Sword recharge reductions require an amount.');
      if (context.kind !== 'cast') throw new TypeError('Sword recharge requires a cast trigger.');
      const { cast } = context;
      reduceEngineerRecharge(
        runtime,
        cast,
        (candidate) => candidate.type === 'Weapon' && candidate.weapon === 'Sword' && candidate.id !== cast.skill.id,
        sideEffectAmount(runtime, action.amount),
        cast.skill.id,
        'Gleam Saber \u2014 Sword Recharge'
      );
    }
  },
  reserveRecharge: (_runtime, skill, work) => (skill.id === ID.HEALING_TURRET ? 0 : work),
  onCombatStart: detonatePrecastMines,
  modifyEffects: engineerSpearEffects,
  onCastStart(runtime, cast) {
    if (cast.skill.independentCast) notifyToolbeltActivation(runtime, cast.skill, runtime.time);
    if (cast.skill.id !== SHARED_SKILL_IDS.DODGE) return;
    buildEngineerPackets('engineer.dodge', { at: runtime.time, activationId: cast.id }, cast.skill).forEach((packet) =>
      runtime.effects.emit({ kind: 'packet', event: packet })
    );
    notifyDodgeActivation(runtime, cast);
  },
  onCastCommit(runtime, cast) {
    // Independent commands notify at acceptance; ordinary toolbelt casts notify only on completion.
    if (!cast.skill.independentCast) notifyToolbeltActivation(runtime, cast.skill, runtime.time);
  },
  tasks: { ...engineerSpearTasks, ...engineerTurretTasks },
  eventHandlers: {
    'engineer.air-blast': handleAirBlast,
    ...engineerSpearEventHandlers
  }
};
