import { MECHANIST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/engineer/specializations/mechanist/profiles.js';
import { EPSILON } from '#kernel/core/clock.js';
import { onResolvedCriticalHit } from '#gw2/platform/profession-definition/mechanics.js';
import { prepareGw2BuffCompanionCandidates } from '#gw2/platform/combat/state/allied-players.js';
import { castWasInterrupted, summonQuicknessCastTimeMs } from '#gw2/platform/skills/timing.js';
import type { RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';

import type { EngineerRuntimeState } from '#gw2/professions/engineer/types.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { mechanistState } from '#gw2/professions/engineer/specializations/mechanist/state.js';
import { MECHANIST_ATTACK_TIMING } from '#gw2/professions/engineer/specializations/mechanist/mechanics/constants.js';
import { mechanistRechargeWork } from '#gw2/professions/engineer/specializations/mechanist/mechanics/recharge.js';
import { mechanistCastAvailability } from '#gw2/professions/engineer/specializations/mechanist/mechanics/availability.js';
import {
  activateOverclockSignet,
  applyEngineerMechCastTraits,
  copyEngineerMechBoon,
  engineerMechHasQuickness,
  initializeEngineerMech,
  isEngineerMechCommand,
  prepareEngineerMechEvent,
  stepMechAttack
} from '#gw2/professions/engineer/specializations/mechanist/mechanics/mech.js';
import {
  mechanistCriticalHitDefinitions,
  mechanistResolverEventReactions
} from '#gw2/professions/engineer/specializations/mechanist/mechanics/mech-effects.js';

const critical = mechanistCriticalHitDefinitions.map(onResolvedCriticalHit);

/** Commands reserve the summon lane immediately; its autoattack phase resumes only after command recovery. */
export const mechanistHooks: Partial<RuntimeProfession<EngineerRuntimeState>> = {
  // Completed commands grant player Quickness; mech recovery and Overclock retain their lifecycle owner.
  traitTriggers: [
    {
      trait: TRAIT.MECH_CORE_JADE_DYNAMO,
      on: 'castComplete',
      when: (_runtime, cast) => isEngineerMechCommand(cast.skill),
      emit: PROFILE.jadeDynamo,
      effects: (effect) => effect.type === 'boon' && effect.name === 'quickness',
      attribution: { actorType: 'player', name: 'Jade Dynamo — quickness' }
    }
  ],
  initialize(runtime) {
    if (!runtime.combatStartPending) initializeEngineerMech(runtime);
  },
  onCombatStart(runtime) {
    if (runtime.hasExplicitCombatStart) initializeEngineerMech(runtime);
  },
  availability: mechanistCastAvailability,
  rechargeWork: mechanistRechargeWork,
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
  onCastComplete(runtime, cast) {
    if (castWasInterrupted(cast)) return;
    if (cast.skill.id === ID.OVERCLOCK_SIGNET) activateOverclockSignet(runtime, cast.skill);
    applyEngineerMechCastTraits(runtime, cast.skill);
  },
  tasks: {
    'engineer.mech-attack'(runtime, data) {
      const mech = mechanistState.from(runtime).mech;
      if (!mech.enabled || !mech.active) return;
      const phase = data as { phase: number };
      if (runtime.time < mech.busyUntil - EPSILON) {
        mech.nextAttackAt = mech.busyUntil;
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
      for (const reaction of critical) reaction.handler(runtime, event, details);
      mechanistResolverEventReactions.damage(runtime, event);
    }
  }
};
