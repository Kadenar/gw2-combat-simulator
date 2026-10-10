import { autonomousActionsAllowed } from '#gw2/platform/combat/engagement.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { prepareGw2BuffCompanionCandidates } from '#gw2/platform/combat/state/allied-players.js';

import { summonQuicknessCastTimeMs } from '#gw2/platform/execution/cast-timing.js';
import { mechStruck } from '#gw2/professions/engineer/core/mechanics/mech-strikes.js';
import { engineerMechResolverEvent } from '#gw2/professions/engineer/specializations/mechanist/mechanics/mech-ownership.js';
import { overclockRechargeRules } from '#gw2/professions/engineer/specializations/mechanist/skills/signet-skills.js';

import { canonicalTime } from '#kernel/core/clock.js';

import { mechanistCastAvailability } from '#gw2/professions/engineer/specializations/mechanist/mechanics/availability.js';
import { MECHANIST_ATTACK_TIMING } from '#gw2/professions/engineer/specializations/mechanist/mechanics/constants.js';
import {
  activateOverclockSignet,
  completeEngineerMechCast,
  copyEngineerMechBoon,
  engineerMechHasQuickness,
  initializeEngineerMech,
  mechanistCombatReady,
  isEngineerMechCommand,
  prepareEngineerMechEvent,
  stepMechAttack,
  type MechAttackPayload
} from '#gw2/professions/engineer/specializations/mechanist/mechanics/mech.js';
import { mechanistState } from '#gw2/professions/engineer/specializations/mechanist/state.js';
import type { EngineerSkill, EngineerRuntimeState } from '#gw2/professions/engineer/types.js';

/** Commands reserve the summon lane immediately; its autoattack phase resumes only after command recovery. */
export const mechanistHooks: RuntimeHooks<EngineerRuntimeState, EngineerSkill> = {
  // Barrier tracks applications and expiry for trait reactions without modeling incoming damage or health.
  buffPolicies: () => [{ kind: 'barrier', maximumStacks: 1 }],
  // Completed commands grant player Quickness; mech recovery and Overclock retain their lifecycle owner.

  initialize(runtime) {
    // Preserve implicit-start admission before the autonomous mech lane starts.
    if (!runtime.combatStartPending) runtime.fireTrigger(mechanistCombatReady, {});
    initializeEngineerMech(runtime);
  },
  onCombatStart(runtime) {
    // Deferred explicit combat starts the same guarded producer, never a second renewal loop.
    if (runtime.hasExplicitCombatStart) runtime.fireTrigger(mechanistCombatReady, {});
    initializeEngineerMech(runtime);
  },
  availability: mechanistCastAvailability,
  rechargeRules: overclockRechargeRules,
  castDurationMs(runtime, skill, durationMs) {
    if (!isEngineerMechCommand(skill)) return durationMs;
    return engineerMechHasQuickness(runtime, runtime.time) ? summonQuicknessCastTimeMs(skill) : skill.castTimeMs || 0;
  },
  prepareEvent(runtime, event) {
    return prepareEngineerMechEvent(
      runtime,
      prepareGw2BuffCompanionCandidates(event, mechanistState.from(runtime).mech.active ? ['engineer.mech'] : [])
    );
  },
  onCastStart(runtime, cast) {
    const mech = mechanistState.from(runtime).mech;
    if (mech.active && isEngineerMechCommand(cast.skill) && cast.fullEnd > cast.start)
      mech.busyUntil = Math.max(mech.busyUntil, cast.effectiveEnd + MECHANIST_ATTACK_TIMING.commandRecovery);
  },
  sideEffectHandlers: {
    'engineer.overclock-signet'(runtime, context) {
      if (context.kind !== 'cast') throw new TypeError('Overclock requires a cast trigger.');
      activateOverclockSignet(runtime, context.skill);
    }
  },
  onCastCommit(runtime, cast) {
    completeEngineerMechCast(runtime, cast.skill);
  },
  // The mech's autonomous loop does not define the lifetime of a player skill or its reactions.
  backgroundTasks: ['engineer.mech-attack'],
  tasks: {
    'engineer.mech-attack'(runtime, data) {
      const mech = mechanistState.from(runtime).mech;
      if (!autonomousActionsAllowed(runtime) || !mech.enabled || !mech.active) return;
      const phase = data as MechAttackPayload;
      // The autonomous attack waits until the same canonical instant as lane release.
      if (runtime.time < canonicalTime(mech.busyUntil)) {
        runtime.schedule('engineer.mech-attack', mech.busyUntil, phase);
        return;
      }

      const next = stepMechAttack(runtime, runtime.time, phase);
      runtime.schedule('engineer.mech-attack', next.at, next.state);
    }
  },
  reactions: {
    'buff.applied': copyEngineerMechBoon,
    'damage.resolved'(runtime, event, details) {
      // Only positive mech strikes reach the mech-owned Firearms trackers and arm rewards.
      if (Number(event.coefficient) > 0 && engineerMechResolverEvent(runtime, event))
        runtime.fireTrigger(mechStruck, { cause: event, details });
    }
  }
};
