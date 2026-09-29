import { prepareGw2BuffCompanionCandidates } from '#gw2/platform/combat/state/allied-players.js';
import { criticalProcHandler } from '#gw2/platform/profession-definition/mechanics.js';
import type { RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import { summonQuicknessCastTimeMs } from '#gw2/platform/skills/timing.js';
import { engineerMechCoreCriticalDefinitions } from '#gw2/professions/engineer/core/traits/critical-procs.js';
import { engineerMechResolverEvent } from '#gw2/professions/engineer/specializations/mechanist/mechanics/mech-ownership.js';
import { overclockRechargeRules } from '#gw2/professions/engineer/specializations/mechanist/skills/signet-skills.js';
import { reactToMechArmDamage } from '#gw2/professions/engineer/specializations/mechanist/traits/behavior.js';
import { EPSILON } from '#kernel/core/clock.js';

import { mechanistCastAvailability } from '#gw2/professions/engineer/specializations/mechanist/mechanics/availability.js';
import { MECHANIST_ATTACK_TIMING } from '#gw2/professions/engineer/specializations/mechanist/mechanics/constants.js';
import {
  activateOverclockSignet,
  completeEngineerMechCast,
  copyEngineerMechBoon,
  engineerMechHasQuickness,
  initializeEngineerMech,
  isEngineerMechCommand,
  prepareEngineerMechEvent,
  stepMechAttack
} from '#gw2/professions/engineer/specializations/mechanist/mechanics/mech.js';
import { mechanistState } from '#gw2/professions/engineer/specializations/mechanist/state.js';
import type { EngineerRuntimeState } from '#gw2/professions/engineer/types.js';

const critical = engineerMechCoreCriticalDefinitions(engineerMechResolverEvent).map(criticalProcHandler);

/** Commands reserve the summon lane immediately; its autoattack phase resumes only after command recovery. */
export const mechanistHooks: Partial<RuntimeProfession<EngineerRuntimeState>> = {
  // Completed commands grant player Quickness; mech recovery and Overclock retain their lifecycle owner.

  initialize(runtime) {
    if (!runtime.combatStartPending) initializeEngineerMech(runtime);
  },
  onCombatStart(runtime) {
    if (runtime.hasExplicitCombatStart) initializeEngineerMech(runtime);
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
  tasks: {
    'engineer.mech-attack'(runtime, data) {
      const mech = mechanistState.from(runtime).mech;
      if (!mech.enabled || !mech.active) return;
      const phase = data as { phase: number };
      if (runtime.time < mech.busyUntil - EPSILON) {
        runtime.schedule('engineer.mech-attack', mech.busyUntil, phase);
        return;
      }

      const next = stepMechAttack(runtime, runtime.time, phase);
      if (next) runtime.schedule('engineer.mech-attack', next.at, next.state);
    }
  },
  reactions: {
    'buff.applied': copyEngineerMechBoon,
    'damage.resolved'(runtime, event, details) {
      for (const reaction of critical) reaction(runtime, event, details);
      reactToMechArmDamage(runtime, event);
    }
  }
};
