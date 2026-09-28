import {
  enterLich,
  exitLich,
  enterNecromancerShroud,
  exitNecromancerShroud,
  necromancerFormTasks
} from '#gw2/professions/necromancer/core/mechanics/forms.js';
import { reactToNecromancerAxeHealth } from '#gw2/professions/necromancer/core/mechanics/axe.js';
import { sideEffectAmount } from '#gw2/platform/simulation/side-effects.js';
import type { TraitTrigger } from '#gw2/platform/profession-definition/trigger-rules.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { skillFlipReady } from '#gw2/platform/engine/skills/skill-flips.js';
import { requireEffect, requireBalanceProfileFromContext } from '#gw2/platform/engine/skills/balance-profiles.js';
import { denySkillCast } from '#gw2/platform/engine/skills/availability.js';
import {
  necromancerLifeForceCostMultiplier,
  normalizedNecromancerLifeForceCost
} from '#gw2/professions/necromancer/core/state.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { NECROMANCER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/core/profiles.js';
import type { RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type {
  NecromancerRuntime,
  NecromancerRuntimeState,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  applyOverflowingThirstCast,
  reactToTasteForBloodGrant
} from '#gw2/professions/necromancer/core/traits/blood-magic.js';
import { applyDarkDefense } from '#gw2/professions/necromancer/core/traits/death-magic.js';
import { applyFearOfDeath, soulMarksLifeForce } from '#gw2/professions/necromancer/core/traits/soul-reaping.js';
import { spitefulFortitudeLifeForce } from '#gw2/professions/necromancer/core/traits/spite.js';
import {
  perforate,
  resolveNecromancerOppressiveCollapse,
  grantNecromancerSoulShards,
  necromancerWeaponTasks
} from '#gw2/professions/necromancer/core/mechanics/weapons.js';
import {
  completeNecromancerCorruption,
  scheduleBloodIsPowerLaunch,
  resolvePlagueSignetTransfer,
  scheduleDevouringDarkness,
  reactToNecromancerConditions,
  resolveNecromancerSkillConditions,
  resolveNecromancerTransfer,
  necromancerConditionTasks
} from '#gw2/professions/necromancer/core/mechanics/conditions.js';
import { NECROMANCER_LICH_SKILL_IDS } from '#gw2/professions/necromancer/core/skills/index.js';
import {
  observeNecromancerAutoattackTransition,
  necromancerSwordTasks
} from '#gw2/professions/necromancer/core/mechanics/sword-chain.js';
import {
  initializeNecromancerPassives,
  startNecromancerAlliedOpportunities,
  necromancerPassiveTasks
} from '#gw2/professions/necromancer/core/mechanics/passives.js';
import {
  reactToNecromancerCoreDamage,
  reactToNecromancerCoreCondition,
  reactToNecromancerCoreControl,
  reactToNecromancerBlind
} from '#gw2/professions/necromancer/core/traits/index.js';
import {
  summonNecromancerMinion,
  commandNecromancerMinion,
  summonNecromancerHorrors,
  necromancerMinionAvailability,
  necromancerMinionTasks
} from '#gw2/professions/necromancer/core/mechanics/minions.js';
import {
  grantNecromancerLifeForce,
  grantNecromancerSkillLifeForce
} from '#gw2/professions/necromancer/core/mechanics/life-force.js';
import { necromancerLifeForce } from '#gw2/professions/necromancer/core/mechanics/resources.js';

/** Landed player packets own weapon gains and the post-hit half-health test; no predicted observation is replayed. */
function damage(runtime: NecromancerRuntime, event: Gw2ResolverEvent): void {
  if (!(Number(event.coefficient) > 0)) return;
  const skill = runtime.helpers.skillsById.get(event.skillId ?? event.sourceId);
  if (!skill) return;
  if (event.actorType !== 'player') return;
  // Combine trait rewards before the shared conversion and pool refresh, ahead of condition transfers.
  grantNecromancerLifeForce(runtime, soulMarksLifeForce(runtime, skill, event) + spitefulFortitudeLifeForce(runtime));
}

/** Core mechanics share one live queue and resource owner with the active specialization. */
export const necromancerCoreHooks: Partial<RuntimeProfession<NecromancerRuntimeState>> = {
  resources: { lifeForce: necromancerLifeForce },
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
      const cost = normalizedNecromancerLifeForceCost(
        runtime.profession.core,
        Number(context.skill.lifeForceCost ?? 0)
      );
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
    'necromancer.skill-life-force'(runtime, context) {
      if (context.kind === 'effect') grantNecromancerSkillLifeForce(runtime, context.skill, context.trigger.event);
    },
    // Declarations own amounts and eligibility; this handler applies the shared percentage conversion.
    'necromancer.life-force'(runtime, _context, action) {
      if (action.type !== 'necromancer.life-force' || action.amount == null)
        throw new TypeError('Life-force grants require an amount.');
      grantNecromancerLifeForce(runtime, sideEffectAmount(runtime, action.amount));
    },
    'necromancer.perforate'(runtime, context) {
      if (context.kind === 'effect') perforate(runtime, context.trigger.event);
    },
    'necromancer.oppressive-collapse'(runtime, context) {
      if (context.kind === 'effect') resolveNecromancerOppressiveCollapse(runtime, context.trigger.event);
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
  availability(runtime, rawSkill) {
    const skill = rawSkill as NecromancerSkill;
    const state = runtime.profession.core;
    if (skill.id === ID.DEVOURING_DARKNESS && !hasTrait(runtime, TRAIT.LINGERING_CURSE))
      return denySkillCast(skill, 'necromancer.trait-locked', 'requires Lingering Curse.');
    if (skill.id === ID.FEAST_OF_CORRUPTION && hasTrait(runtime, TRAIT.LINGERING_CURSE))
      return denySkillCast(
        skill,
        'necromancer.trait-replacement',
        'Devouring Darkness replaces it while Lingering Curse is selected.'
      );
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
  rechargeRules: [
    {
      trait: TRAIT.MASTER_OF_CORRUPTION,
      when: (_runtime, skill) => Boolean(skill.categories?.includes('Corruption')),
      multiplier: { profile: TRAIT.MASTER_OF_CORRUPTION, field: 'rechargeMultiplier' }
    },
    {
      trait: TRAIT.SINISTER_SHROUD,
      when: (_runtime, skill) => Boolean(skill.shroud),
      multiplier: { profile: PROFILE.sinisterShroud, field: 'rechargeMultiplier' }
    }
  ],
  rechargeWork: (_runtime, skill, work) => (skill.shroudEntry || skill.rechargeOnMinionDeath ? 0 : work),
  onCastStart(runtime, cast) {
    applyOverflowingThirstCast(runtime, cast);
  },
  // Cast-derived attribution remains local to the declaration; balance profiles own all packets.
  traitTriggers: [
    {
      trait: TRAIT.MALICIOUS_SWARM,
      on: 'castCommit',
      emit: TRAIT.MALICIOUS_SWARM,
      icd: 'profile',
      when: (runtime, cast) =>
        cast.skill.type === 'Heal' &&
        Boolean(requireEffect(requireBalanceProfileFromContext(runtime, TRAIT.MALICIOUS_SWARM), 'strike', 'Strike')),
      effects: (effect) => effect.type === 'strike' && effect.name === 'Strike',
      attribution: (_runtime, cast) => ({
        skillId: undefined,
        skillName: 'Lesser Signet of the Locust',
        name: 'Lesser Signet of the Locust',
        skillWeapon: 'Unequipped',
        triggeredBy: cast.skill.name,
        offTarget: cast.command.offTarget
      })
    },
    {
      trait: TRAIT.SIGNETS_OF_SUFFERING,
      on: 'castCommit',
      when: (_runtime, cast) => Boolean(cast.skill.categories?.includes('Signet')),
      emit: TRAIT.SIGNETS_OF_SUFFERING,
      effects: (effect) => effect.type === 'strike' && effect.name === 'Strike',
      attribution: (_runtime, cast) => ({
        skillId: undefined,
        skillName: 'Signets of Suffering',
        name: 'Signets of Suffering',
        triggeredBy: cast.skill.name,
        offTarget: cast.command.offTarget,
        skillWeapon: 'Unequipped'
      })
    },
    ...(['Strike', 'Poisoned', 'Chilled'] as const).map<
      Extract<TraitTrigger<NecromancerRuntimeState>, { on: 'castCommit' }>
    >((name) => ({
      trait: TRAIT.TRANSFUSION,
      on: 'castCommit' as const,
      when: (_runtime, cast) => cast.skill.shroudSlot === 4,
      emit: TRAIT.TRANSFUSION,
      effects: (effect) => effect.type === (name === 'Strike' ? 'strike' : 'condition') && effect.name === name,
      attribution: (runtime, cast) => ({
        skillId: ID.LESSER_CHILBLAINS,
        skillName: 'Lesser Chilblains',
        name: name === 'Strike' ? 'Lesser Chilblains' : `Lesser Chilblains — ${name}`,
        parentSkillName: cast.skill.name,
        icon: runtime.helpers.skillsById.get(ID.CHILLBLAINS)?.icon,
        triggeredBy: cast.skill.name,
        offTarget: cast.command.offTarget,
        skillWeapon: 'Unequipped'
      })
    }))
  ],
  onCastCommit: applyDarkDefense,
  onAutoattackChainTransition: observeNecromancerAutoattackTransition,
  onCooldownReset(runtime) {
    runtime.resourceController.grant('lifeForce', runtime.profession.core.lifeForce.maximum);
    runtime.profession.core.selfConditions = [];
  },
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
    },
    'control.resolved'(runtime, event) {
      applyFearOfDeath(runtime, event);
      reactToNecromancerCoreControl(runtime, event);
    },
    'blind.resolved': reactToNecromancerBlind
  }
};
