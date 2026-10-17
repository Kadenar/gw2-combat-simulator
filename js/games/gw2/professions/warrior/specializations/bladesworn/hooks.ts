import { resetAutoattackChains } from '#gw2/platform/execution/autoattack-chains.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { composeRuntimeHooks, type RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { coreAdrenalinePolicy } from '#gw2/professions/warrior/core/mechanics/adrenaline.js';
import { warriorAmmunition } from '#gw2/professions/warrior/core/mechanics/ammunition.js';
import { dragonSlashCompleted, dragonSlashReleased } from '#gw2/professions/warrior/core/mechanics/trigger-points.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import {
  bladeswornBuffPolicies,
  bladeswornEffectStates
} from '#gw2/professions/warrior/specializations/bladesworn/effect-state.js';
import {
  ammunitionCommitted,
  explosionAccepted
} from '#gw2/professions/warrior/specializations/bladesworn/mechanics/trigger-points.js';
import {
  dragonChargesToAdrenalineSpent,
  dragonSlashRelease,
  dragonTriggerAvailability,
  dragonTriggerHooks,
  exitDragonTrigger
} from '#gw2/professions/warrior/specializations/bladesworn/mechanics/dragon-trigger.js';
import { bladeswornFlowLifecycle } from '#gw2/professions/warrior/specializations/bladesworn/mechanics/flow.js';
import {
  gunsaberAttackAvailability,
  gunsaberBarAvailability,
  swapGunsaber
} from '#gw2/professions/warrior/specializations/bladesworn/mechanics/gunsaber.js';
import {
  bladeswornSkillLifecycle,
  cartridgeExplosion
} from '#gw2/professions/warrior/specializations/bladesworn/skills/index.js';
import { bladeswornState } from '#gw2/professions/warrior/specializations/bladesworn/state.js';
import type { WarriorRuntime, WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';

/** Capture the magazine before the cast spends its ammunition so completion sees the accepted balance. */
function prepareBladeswornAmmunition(runtime: WarriorRuntime, cast: RuntimeCast<WarriorSkill>): void {
  if (cast.ammo) {
    const ammo = runtime.cooldownController.readAmmo(cast.skill.id)!;
    warriorAmmunition.set(cast, { rounds: 1, startedFull: ammo.charges >= ammo.maximum });
  }
}

/** Completed ammunition casts publish their captured spend before Dragon Slash and bar completion work. */
function completeBladeswornAmmunition(runtime: WarriorRuntime, cast: RuntimeCast<WarriorSkill>): void {
  // Successful ammunition commitment earns its reward even when the remaining animation is interrupted.
  const spent = warriorAmmunition.get(cast);

  if (spent) runtime.fireTrigger(ammunitionCommitted, { cast, spent });
}

/** Only actual player explosions extend Glory or create cartridge Burning; neither derived condition can recurse. */
function reactToBladeswornExplosion(runtime: WarriorRuntime, event: Gw2ResolverEvent): void {
  if (event.actorType !== 'player' || event.damageKind !== 'explosion' || !(Number(event.coefficient) > 0)) return;

  runtime.fireTrigger(explosionAccepted, { event });

  cartridgeExplosion(runtime, event);
}

/** Native declarations own actual resources, bar transitions, completed ammunition rewards, and accepted explosions. */
export const bladeswornHooks: RuntimeHooks<WarriorRuntimeState, WarriorSkill> = composeRuntimeHooks([
  dragonTriggerHooks,
  bladeswornSkillLifecycle,
  bladeswornFlowLifecycle,
  {
    // Bladesworn disables adrenaline at initialization; authored rewards select the Flow pool its lifecycle registers.
    resources: { adrenaline: { ...coreAdrenalinePolicy, maximum: () => 0 } },
    buffPolicies: bladeswornBuffPolicies,
    observeEffects: bladeswornEffectStates,
    prepareDamageState(runtime, skill) {
      bladeswornState.from(runtime).gunsaberActive = Boolean(skill?.gunsaberSkill);
    },

    sideEffectHandlers: {
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
      (skill.id === ID.UNSHEATHE_GUNSABER || skill.id === ID.SHEATHE_GUNSABER) && !runtime.engagement.active ? 0 : work,

    availability(runtime, skill, command) {
      const bar = gunsaberBarAvailability(runtime, skill);

      if (!bar.ready) return bar;

      const trigger = dragonTriggerAvailability(runtime, skill, command);

      if (!trigger.ready) return trigger;

      return gunsaberAttackAvailability(runtime, skill);
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
    reactions: { 'damage.resolved': reactToBladeswornExplosion }
  }
]);
