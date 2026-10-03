import { criticalProcHandler } from '#gw2/platform/profession-definition/mechanics.js';
import type { RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import { sideEffectAmount } from '#gw2/platform/simulation/side-effects.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { reduceEngineerRecharge } from '#gw2/professions/engineer/core/mechanics/recharge.js';
import { handleAirBlast } from '#gw2/professions/engineer/core/skills/kits/flamethrower.js';
import { applyEngineerDodgeTraits } from '#gw2/professions/engineer/core/traits/toolbelt.js';

import { buildEngineerPackets } from '#gw2/professions/engineer/core/events.js';
import { engineerCoreCastAvailability } from '#gw2/professions/engineer/core/mechanics/availability.js';
import {
  handleConduitSurge,
  handleElectricArtillery,
  handleLightningRodPulse
} from '#gw2/professions/engineer/core/mechanics/event-handlers.js';
import { engineerEndurance } from '#gw2/professions/engineer/core/mechanics/resources.js';
import {
  applyEngineerCastTraits,
  reactToEngineerCondition,
  reactToEngineerDamage
} from '#gw2/professions/engineer/core/traits/dispatch.js';
import {
  engineerSpearSideEffectHandlers,
  engineerTurretSideEffectHandlers,
  engineerWeaponTasks
} from '#gw2/professions/engineer/core/mechanics/weapons.js';
import { engineerCoreCriticalHitDefinitions } from '#gw2/professions/engineer/core/traits/critical-procs.js';
import { applyEngineerToolbeltTraits } from '#gw2/professions/engineer/core/traits/toolbelt.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { EngineerRuntime, EngineerRuntimeState, EngineerSkill } from '#gw2/professions/engineer/types.js';

const critical = engineerCoreCriticalHitDefinitions.map(criticalProcHandler);
const customSpear = new Set<number>([ID.LIGHTNING_ROD, ID.CONDUIT_SURGE, ID.ELECTRIC_ARTILLERY]);

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
    applyEngineerToolbeltTraits(runtime, detonation, runtime.time);
  }
}

export const engineerCoreHooks: Partial<RuntimeProfession<EngineerRuntimeState, EngineerSkill>> = {
  endurance: engineerEndurance,
  availability: engineerCoreCastAvailability,
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
      else applyEngineerToolbeltTraits(runtime, runtime.helpers.skillsById.get(ID.DETONATE_MINE_FIELD)!, runtime.time);
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
  modifyEffects(_runtime, cast, effects) {
    return customSpear.has(Number(cast.skill.id)) ? [] : effects;
  },
  onCastStart(runtime, cast) {
    if (cast.skill.independentCast) applyEngineerToolbeltTraits(runtime, cast.skill, runtime.time);
    if (cast.skill.id !== SHARED_SKILL_IDS.DODGE) return;
    buildEngineerPackets('engineer.dodge', { at: runtime.time, activationId: cast.id }, cast.skill).forEach((packet) =>
      runtime.effects.emit({ kind: 'packet', event: packet })
    );
    applyEngineerDodgeTraits(runtime, cast);
  },
  onCastCommit(runtime, cast) {
    applyEngineerCastTraits(runtime, cast);
  },
  tasks: engineerWeaponTasks,
  eventHandlers: {
    'engineer.air-blast': handleAirBlast,
    'engineer.lightning-rod-pulse': handleLightningRodPulse,
    'engineer.conduit-surge': handleConduitSurge,
    'engineer.electric-artillery': handleElectricArtillery
  },
  reactions: {
    'damage.resolved'(runtime, event, details) {
      for (const reaction of critical) reaction(runtime, event, details);
      reactToEngineerDamage(runtime, event);
    },
    'condition.applied': reactToEngineerCondition
  }
};
