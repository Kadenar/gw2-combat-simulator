import { resetAutoattackChains } from '#gw2/platform/execution/autoattack-chains.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { composeRuntimeHooks, type RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { coreAdrenalinePolicy } from '#gw2/professions/warrior/core/mechanics/adrenaline.js';
import { warriorAmmunition } from '#gw2/professions/warrior/core/mechanics/ammunition.js';
import { dragonSlashCompleted, dragonSlashReleased } from '#gw2/professions/warrior/core/mechanics/combat.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import {
  bladeswornBuffPolicies,
  bladeswornEffectStates
} from '#gw2/professions/warrior/specializations/bladesworn/effect-state.js';
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
  bladeswornSkillTasks,
  cartridgeExplosion
} from '#gw2/professions/warrior/specializations/bladesworn/skills/index.js';
import { bladeswornState } from '#gw2/professions/warrior/specializations/bladesworn/state.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';

type Runtime = MechanicContext<WarriorRuntimeState, WarriorSkill>;

/** Only actual player explosions extend Glory or create cartridge Burning; neither derived condition can recurse. */
function explosion(runtime: Runtime, event: Gw2ResolverEvent): void {
  if (event.actorType !== 'player' || event.damageKind !== 'explosion' || !(Number(event.coefficient) > 0)) return;

  runtime.fireTrigger(explosionAccepted, { event });

  cartridgeExplosion(runtime, event);
}

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
      if (cast.ammo) {
        const ammo = runtime.cooldownController.readAmmo(cast.skill.id)!;
        warriorAmmunition.set(cast, { rounds: 1, startedFull: ammo.charges >= ammo.maximum });
      }

      if (!cast.skill.dragonSlash && cast.fullEnd > cast.start) exitDragonTrigger(runtime);
    },
    onCastCommit(runtime, cast) {
      // Successful ammunition commitment earns its reward even when the remaining animation is interrupted.
      const spent = warriorAmmunition.get(cast);
      if (spent) runtime.fireTrigger(ammunitionCommitted, { cast, spent });
      const release = dragonSlashRelease(runtime, cast);
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
    reactions: { 'damage.resolved': explosion }
  }
]);

/** Completed ammunition rewards use the spend captured before the magazine transaction. */
export const ammunitionCommitted = defineTriggerPoint<{
  readonly cast: RuntimeCast<WarriorSkill>;
  readonly spent: { readonly rounds: number; readonly startedFull: boolean };
}>('warrior.ammunition-committed', [TRAIT.FIERCE_AS_FIRE, TRAIT.LUSH_FOREST]);
/** Explosion Glory extends before cartridge effects inspect the accepted strike. */
export const explosionAccepted = defineTriggerPoint<{ readonly event: Gw2ResolverEvent }>(
  'warrior.explosion-accepted',
  [TRAIT.GUNS_AND_GLORY]
);
