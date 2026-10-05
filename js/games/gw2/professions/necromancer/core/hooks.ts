import { torchLifecycle } from '#gw2/professions/necromancer/core/skills/weapons/torch.js';
import { skillForEvent } from '#gw2/platform/combat/query/runtime-query.js';
import { composeRuntimeHooks, type RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { emitVampirismPassive } from '#gw2/professions/necromancer/core/skills/slot-skills.js';
import { denySkillCast } from '#gw2/platform/execution/availability.js';
import { skillFlipReady } from '#gw2/platform/execution/skill-flips.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { sideEffectAmount } from '#gw2/platform/effects/action-dispatch.js';
import { damageInputEvent } from '#gw2/platform/skill-damage/occurrence-driver.js';
import { reactToNecromancerAxeHealth } from '#gw2/professions/necromancer/core/mechanics/axe.js';
import {
  completeNecromancerCorruption,
  necromancerConditionTasks,
  resolveNecromancerSkillConditions,
  resolveNecromancerTransfer,
  resolvePlagueSignetTransfer,
  scheduleBloodIsPowerLaunch,
  scheduleDevouringDarkness
} from '#gw2/professions/necromancer/core/mechanics/conditions.js';
import {
  enterLich,
  enterNecromancerShroud,
  exitLich,
  exitNecromancerShroud,
  necromancerFormTasks
} from '#gw2/professions/necromancer/core/mechanics/forms.js';
import { grantNecromancerLifeForce } from '#gw2/professions/necromancer/core/mechanics/life-force.js';
import {
  commandNecromancerMinion,
  necromancerMinionAvailability,
  necromancerMinionTasks,
  summonNecromancerHorrors,
  summonNecromancerMinion
} from '#gw2/professions/necromancer/core/mechanics/minions.js';
import {
  initializeNecromancerPassives,
  necromancerPassiveTasks
} from '#gw2/professions/necromancer/core/mechanics/passives.js';
import { necromancerLifeForce } from '#gw2/professions/necromancer/core/mechanics/resources.js';
import {
  necromancerSwordTasks,
  observeNecromancerAutoattackTransition
} from '#gw2/professions/necromancer/core/mechanics/sword-chain.js';
import {
  emitSoulShard,
  grantNecromancerSoulShards,
  necromancerWeaponTasks,
  perforate
} from '#gw2/professions/necromancer/core/mechanics/weapons.js';
import { NECROMANCER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/core/profiles.js';
import { NECROMANCER_LICH_SKILL_IDS } from '#gw2/professions/necromancer/core/skills/index.js';
import {
  necromancerLifeForceCostMultiplier,
  normalizedNecromancerLifeForceCost
} from '#gw2/professions/necromancer/core/state.js';
import { spitefulFortitudeLifeForce } from '#gw2/professions/necromancer/core/traits/behavior.js';
import {
  lingeringCurseAvailability,
  reactToNecromancerConditions
} from '#gw2/professions/necromancer/core/traits/conditions.js';
import {
  reactToTasteForBloodGrant,
  startNecromancerAlliedOpportunities
} from '#gw2/professions/necromancer/core/traits/life-steal.js';
import {
  reactToNecromancerCoreCondition,
  reactToNecromancerCoreControl,
  reactToNecromancerCoreDamage
} from '#gw2/professions/necromancer/core/traits/reactions.js';
import { applyFearOfDeath, soulMarksLifeForce } from '#gw2/professions/necromancer/core/traits/shroud.js';
import { NECROMANCER_SKILL_IDS as DAMAGE_SKILL } from '#gw2/professions/necromancer/data/ids.js';
import type {
  NecromancerRuntime,
  NecromancerRuntimeState,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';

/** Landed player packets own weapon gains and the post-hit half-health test; no predicted observation is replayed. */
function damage(runtime: NecromancerRuntime, event: Gw2ResolverEvent): void {
  if (!(Number(event.coefficient) > 0)) return;
  const skill = skillForEvent(runtime.helpers, event);
  if (!skill) return;
  if (event.actorType !== 'player') return;
  // Combine trait rewards before the shared conversion and pool refresh, ahead of condition transfers.
  grantNecromancerLifeForce(runtime, soulMarksLifeForce(runtime, skill, event) + spitefulFortitudeLifeForce(runtime));
}

/** Core mechanics share one live queue and resource owner with the active specialization. */
import { necromancerBuffPolicies, necromancerEffectStates } from '#gw2/professions/necromancer/core/effect-state.js';

const coreLifecycle: RuntimeHooks<NecromancerRuntimeState, NecromancerSkill> = {
  // Known damage payloads are invoked once without their activation requirements.
  damageEffects: [
    {
      id: 'vampirism-passive',
      name: 'Signet of Vampirism (passive)',
      source: 'Profession',
      unit: 'pulse',
      sourceIds: [DAMAGE_SKILL.SIGNET_OF_VAMPIRISM],
      emit: (runtime) => emitVampirismPassive(runtime)
    },
    {
      id: 'soul-shards',
      name: 'Soul Shards',
      source: 'Profession',
      unit: 'charge',
      sourceIds: [DAMAGE_SKILL.SOUL_SHARDS],
      emit: (runtime) => emitSoulShard(runtime, damageInputEvent(runtime))
    }
  ],

  /** Initialize only damage-relevant form and scaling state for one assumed occurrence. */
  prepareDamageState(runtime, skill, _inputs) {
    if (skill?.shroud) runtime.profession.core.activeShroud = skill.shroud;
  },

  buffPolicies: necromancerBuffPolicies,
  observeEffects: necromancerEffectStates,
  resources: { lifeForce: necromancerLifeForce },
  // Standard endurance recovery applies equally inside and outside shroud.
  endurance: {
    state: (runtime) => runtime.profession.core.endurance,
    maximum: () => 100,
    regenerationRate: (_runtime, vigor) => 5 * (vigor ? 1.5 : 1)
  },
  sideEffectHandlers: {
    'necromancer.corruption'(runtime, context) {
      if (context.kind === 'cast') completeNecromancerCorruption(runtime, context.cast);
    },
    'necromancer.blood-is-power-launch'(runtime, context) {
      if (context.kind === 'cast') scheduleBloodIsPowerLaunch(runtime, context.cast);
    },
    'necromancer.signet-transfer'(runtime, context) {
      if (context.kind === 'cast') resolvePlagueSignetTransfer(runtime, context.cast);
    },
    'necromancer.devouring-impact'(runtime, context) {
      if (context.kind === 'cast') scheduleDevouringDarkness(runtime, context.cast);
    },
    'necromancer.enter-shroud'(runtime, context) {
      if (context.kind === 'cast') enterNecromancerShroud(runtime, context.cast);
    },
    'necromancer.summon-minion'(runtime, context) {
      if (context.kind === 'cast') summonNecromancerMinion(runtime, context.cast);
    },
    'necromancer.command-minion'(runtime, context) {
      if (context.kind === 'cast') commandNecromancerMinion(runtime, context.cast);
    },
    'necromancer.summon-horrors'(runtime, context) {
      if (context.kind === 'cast') summonNecromancerHorrors(runtime, context.cast);
    },
    'necromancer.enter-lich'(runtime) {
      enterLich(runtime);
    },
    'necromancer.exit-lich'(runtime) {
      exitLich(runtime);
    },
    'necromancer.exit-shroud'(runtime) {
      exitNecromancerShroud(runtime);
    },
    // Weapon definitions select their window; its deadline stays anchored to the accepted recharge boundary.
    'necromancer.weapon-flip'(runtime, context) {
      if (context.kind !== 'cast') return;
      const { cast, skill } = context;
      runtime.armFlip(skill.flipSkillId!, {
        expiresAt: cast.rechargeStart + Math.max(1, skill.flipDuration ?? skill.cooldown ?? 5)
      });
    },
    // Scourge declarations spend the same normalized amount used by the shared affordability gate.
    'necromancer.life-force-cost'(runtime, context) {
      const cost = normalizedNecromancerLifeForceCost(runtime.profession.core, context.skill.lifeForceCost ?? 0);
      if (cost) runtime.resourceController.spend('lifeForce', cost);
    },

    'necromancer.axe-health'(runtime, context) {
      if (context.kind === 'effect') reactToNecromancerAxeHealth(runtime, context.trigger.event);
    },
    'necromancer.life-siphon'(runtime, context) {
      if (context.kind === 'effect')
        resolveNecromancerSkillConditions(runtime, context.trigger.event, PROFILE.lifeSiphonOnHit);
    },
    'necromancer.dark-pact'(runtime, context) {
      if (context.kind === 'effect')
        resolveNecromancerSkillConditions(runtime, context.trigger.event, PROFILE.darkPactOnHit);
    },
    'necromancer.transfer'(runtime, context) {
      if (context.kind === 'effect') resolveNecromancerTransfer(runtime, context.trigger.event);
    },
    'necromancer.perforate'(runtime, context) {
      if (context.kind === 'effect') perforate(runtime, context.trigger.event);
    },
    // Declared shard rewards reuse the hit-time grant owner so caps and refresh expiry stay identical.
    'necromancer.soul-shards'(runtime, _cast, action) {
      if (action.type !== 'necromancer.soul-shards' || action.amount == null)
        throw new TypeError('Soul shard grants require an amount.');
      grantNecromancerSoulShards(runtime, sideEffectAmount(runtime, action.amount));
    }
  },
  initialize(runtime) {
    runtime.profession.core.lifeForceCostMultiplier = necromancerLifeForceCostMultiplier(runtime.config, runtime);
    initializeNecromancerPassives(runtime);
  },
  onCombatStart(runtime) {
    if (runtime.hasExplicitCombatStart) startNecromancerAlliedOpportunities(runtime);
  },
  availability(runtime, skill) {
    const state = runtime.profession.core;
    const traitGate = lingeringCurseAvailability(runtime, skill);
    if (traitGate) return traitGate;
    const minionGate = necromancerMinionAvailability(runtime, skill);
    if (minionGate) return minionGate;
    if (
      skill.flipParentId != null &&
      !skill.shroudExit &&
      !runtime.helpers.autoattackChainPositions.has(Number(skill.id)) &&
      !skillFlipReady(state.availableFlips[skill.id], runtime.time)
    )
      return denySkillCast(skill, 'necromancer.flip-not-armed', 'not currently armed.');
    if (NECROMANCER_LICH_SKILL_IDS.includes(skill.id))
      return state.activeShroud === 'lich'
        ? { ready: true }
        : denySkillCast(skill, 'necromancer.not-in-lich', 'Lich Form is not active.');
    if (skill.shroudEntry) {
      if (state.activeShroud)
        return denySkillCast(skill, 'necromancer.in-shroud', `already in ${state.activeShroud} shroud.`);
      if ((skill.specialization || 'Core') !== (runtime.config.specialization || 'Core'))
        return denySkillCast(skill, 'necromancer.wrong-specialization', 'requires its matching specialization.');
      const minimum = (state.lifeForce.maximum * (skill.minimumShroudLifeForcePercent ?? 10)) / 100;
      if (runtime.resourceController.value('lifeForce') < minimum)
        return denySkillCast(
          skill,
          'necromancer.insufficient-life-force',
          'requires more life force.',
          runtime.resourceController.readyAt('lifeForce', minimum)
        );
    } else if (skill.shroudExit) {
      if (state.activeShroud !== skill.shroudExit)
        return denySkillCast(skill, 'necromancer.not-in-shroud', 'the matching shroud is not active.');
    } else if (skill.shroud && state.activeShroud !== skill.shroud)
      return denySkillCast(skill, 'necromancer.wrong-shroud', `requires ${skill.shroud} shroud.`);
    else if (!skill.shroud && state.activeShroud && !skill.usableInShroud)
      return denySkillCast(skill, 'necromancer.in-shroud', 'cannot cast in shroud.');
    const cost = normalizedNecromancerLifeForceCost(state, skill.lifeForceCost ?? 0);
    if (runtime.resourceController.value('lifeForce') < cost)
      return denySkillCast(
        skill,
        'necromancer.insufficient-life-force',
        'requires more life force.',
        runtime.resourceController.readyAt('lifeForce', cost)
      );
    return { ready: true };
  },
  // Recharge traits select work once at acceptance; the shared controller applies permanent Alacrity.
  // Rules scale accepted work; shroud entry and minion death still own their recharge anchors.

  rechargeWork: (_runtime, skill, work) => (skill.shroudEntry || skill.rechargeOnMinionDeath ? 0 : work),

  // Cast-derived attribution remains local to the declaration; balance profiles own all packets.

  onAutoattackChainTransition: observeNecromancerAutoattackTransition,
  onCooldownReset(runtime) {
    runtime.resourceController.grant('lifeForce', runtime.profession.core.lifeForce.maximum);
    runtime.profession.core.selfConditions = [];
  },
  // Minion autos and passive resource/allied loops remain ambient while an isolated cast settles.
  backgroundTasks: ['necromancer.minion-attack', ...Object.keys(necromancerPassiveTasks)],
  tasks: {
    ...necromancerSwordTasks,
    ...necromancerWeaponTasks,
    ...necromancerConditionTasks,
    ...necromancerMinionTasks,
    ...necromancerPassiveTasks,
    ...necromancerFormTasks
  },
  reactions: {
    'buff.applied'(runtime, event) {
      if (event.kind === 'taste-for-blood') reactToTasteForBloodGrant(runtime, event);
    },
    'damage.resolved'(runtime, event, details) {
      damage(runtime, event);
      reactToNecromancerConditions(runtime, event);
      reactToNecromancerCoreDamage(runtime, event, details);
    },
    'condition.applied'(runtime, event) {
      reactToNecromancerCoreCondition(runtime, event);
      applyFearOfDeath(runtime, event);
    },
    'control.resolved'(runtime, event) {
      reactToNecromancerCoreControl(runtime, event);
    }
  }
};

/** Compose the torch-owned impact action with the shared profession lifecycle. */
export const necromancerCoreHooks = composeRuntimeHooks<NecromancerRuntimeState, NecromancerSkill>([
  coreLifecycle,
  torchLifecycle
]);
