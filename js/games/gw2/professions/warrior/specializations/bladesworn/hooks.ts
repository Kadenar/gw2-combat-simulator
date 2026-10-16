import { resetAutoattackChains } from '#gw2/platform/execution/autoattack-chains.js';
import { composeRuntimeHooks, type RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { coreAdrenalinePolicy } from '#gw2/professions/warrior/core/mechanics/adrenaline.js';
import { dragonSlashCompleted, dragonSlashReleased } from '#gw2/professions/warrior/core/mechanics/combat.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import {
  bladeswornBuffPolicies,
  bladeswornEffectStates
} from '#gw2/professions/warrior/specializations/bladesworn/effect-state.js';
import {
  completeBladeswornAmmunition,
  prepareBladeswornAmmunition,
  reactToBladeswornExplosion
} from '#gw2/professions/warrior/specializations/bladesworn/mechanics/combat.js';
import {
  dragonChargesToAdrenalineSpent,
  dragonSlashRelease,
  dragonTriggerAvailability,
  dragonTriggerHooks,
  exitDragonTrigger
} from '#gw2/professions/warrior/specializations/bladesworn/mechanics/dragon-trigger.js';
import {
  bladeswornFlowPolicy,
  flowTasks,
  scheduleFlowTick
} from '#gw2/professions/warrior/specializations/bladesworn/mechanics/flow.js';
import {
  gunsaberAttackAvailability,
  gunsaberBarAvailability,
  swapGunsaber
} from '#gw2/professions/warrior/specializations/bladesworn/mechanics/gunsaber.js';
import {
  bladeswornSkillActions,
  bladeswornSkillTasks
} from '#gw2/professions/warrior/specializations/bladesworn/skills/index.js';
import { bladeswornState } from '#gw2/professions/warrior/specializations/bladesworn/state.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';

/** Native declarations own actual resources, bar transitions, completed ammunition rewards, and accepted explosions. */
export const bladeswornHooks: RuntimeHooks<WarriorRuntimeState, WarriorSkill> = composeRuntimeHooks([
  dragonTriggerHooks,
  {
    // Bladesworn disables adrenaline at initialization; authored rewards select its independent Flow pool.
    resources: { adrenaline: { ...coreAdrenalinePolicy, maximum: () => 0 }, flow: bladeswornFlowPolicy },
    buffPolicies: bladeswornBuffPolicies,
    observeEffects: bladeswornEffectStates,
    prepareDamageState(runtime, skill) {
      bladeswornState.from(runtime).gunsaberActive = Boolean(skill?.gunsaberSkill);
    },

    sideEffectHandlers: {
      ...bladeswornSkillActions,
      // Bar declarations invoke the shared transition, including recharge and entry trait observers.
      'warrior.gunsaber-enter'(runtime, context) {
        if (context.kind === 'cast') swapGunsaber(runtime, context.cast, true);
      },
      'warrior.gunsaber-exit'(runtime, context) {
        if (context.kind === 'cast') {
          exitDragonTrigger(runtime);
          swapGunsaber(runtime, context.cast, false);
        }
      }
    },
    // Like weapon swaps, Gunsaber transitions recharge instantly until combat begins.
    rechargeWork: (runtime, skill, work) =>
      (skill.id === ID.UNSHEATHE_GUNSABER || skill.id === ID.SHEATHE_GUNSABER) && !runtime.combatActive ? 0 : work,

    availability(runtime, skill, command) {
      const bar = gunsaberBarAvailability(runtime, skill);

      if (!bar.ready) return bar;

      const trigger = dragonTriggerAvailability(runtime, skill, command);

      if (!trigger.ready) return trigger;

      return gunsaberAttackAvailability(runtime, skill);
    },
    initialize(runtime) {
      scheduleFlowTick(runtime);
    },
    onCastStart(runtime, cast) {
      prepareBladeswornAmmunition(runtime, cast);

      if (!cast.skill.dragonSlash && cast.fullEnd > cast.start) exitDragonTrigger(runtime);
    },
    onCastCommit(runtime, cast) {
      completeBladeswornAmmunition(runtime, cast);

      const release = dragonSlashRelease(cast);

      if (release) {
        runtime.fireTrigger(dragonSlashReleased, { cast, flowSpent: release.flowSpent });

        runtime.fireTrigger(dragonSlashCompleted, {
          cast,
          adrenalineSpent: dragonChargesToAdrenalineSpent(release.charges)
        });
      }

      if (cast.skill.gunsaberSkill && !runtime.helpers.autoattackChainPositions.has(Number(cast.skill.id)))
        resetAutoattackChains(runtime);
    },
    tasks: {
      ...bladeswornSkillTasks,
      ...flowTasks
    },
    reactions: { 'damage.resolved': reactToBladeswornExplosion }
  }
]);
