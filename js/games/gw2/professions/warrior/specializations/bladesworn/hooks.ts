import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { composeRuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';
import { resetAutoattackChains } from '#gw2/platform/execution/autoattack-chains.js';
import { grantWarriorAdrenaline } from '#gw2/professions/warrior/core/mechanics/adrenaline.js';
import { warriorAmmunition } from '#gw2/professions/warrior/core/mechanics/ammunition.js';
import { berserkersPowerDragonSlash, burstMasteryDragonSlash } from '#gw2/professions/warrior/core/traits/behavior.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import {
  dragonChargesToAdrenalineSpent,
  dragonSlashRelease,
  dragonTriggerAvailability,
  dragonTriggerHooks,
  exitDragonTrigger
} from '#gw2/professions/warrior/specializations/bladesworn/mechanics/dragon-trigger.js';
import { flowTasks, scheduleFlowTick } from '#gw2/professions/warrior/specializations/bladesworn/mechanics/flow.js';
import {
  gunsaberAttackAvailability,
  gunsaberBarAvailability,
  swapGunsaber
} from '#gw2/professions/warrior/specializations/bladesworn/mechanics/gunsaber.js';
import { BLADESWORN_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/specializations/bladesworn/profiles.js';
import {
  bladeswornSkillActions,
  bladeswornSkillTasks,
  cartridgeExplosion
} from '#gw2/professions/warrior/specializations/bladesworn/skills/index.js';
import { bladeswornState } from '#gw2/professions/warrior/specializations/bladesworn/state.js';
import {
  ammoTraits,
  gunsAndGloryExplosion
} from '#gw2/professions/warrior/specializations/bladesworn/traits/behavior.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';

type Runtime = MechanicContext<WarriorRuntimeState, WarriorSkill>;

/** Only actual player explosions extend Glory or create cartridge Burning; neither derived condition can recurse. */
function explosion(runtime: Runtime, event: Gw2ResolverEvent): void {
  if (event.actorType !== 'player' || event.damageKind !== 'explosion' || !(Number(event.coefficient) > 0)) return;

  gunsAndGloryExplosion(runtime, event);

  cartridgeExplosion(runtime, event);
}

/** Native declarations own actual resources, bar transitions, completed ammunition rewards, and accepted explosions. */
export const bladeswornHooks: Partial<RuntimeProfession<WarriorRuntimeState, WarriorSkill>> = composeRuntimeHooks([
  dragonTriggerHooks,
  {
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
      const state = bladeswornState.from(runtime);
      state.maximumFlow = balanceProfileNumber(
        requireBalanceProfileFromContext(runtime, PROFILE.resources),
        'maximumStacks'
      );
      state.flow = Math.min(state.flow, state.maximumFlow);
      runtime.profession.core.adrenaline = 0;
      runtime.profession.core.maximumAdrenaline = 0;
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
      ammoTraits(runtime, cast);
      grantWarriorAdrenaline(runtime, cast.skill.flowGain ?? 0);
      const release = dragonSlashRelease(runtime, cast);
      if (release) {
        burstMasteryDragonSlash(runtime, cast, release);

        berserkersPowerDragonSlash(runtime, cast, dragonChargesToAdrenalineSpent(release.charges));
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
