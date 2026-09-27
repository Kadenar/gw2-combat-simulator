import { completeNecromancerForm, necromancerFormTasks } from '#gw2/professions/necromancer/core/mechanics/forms.js';
import { reactToNecromancerAxeHealth } from '#gw2/professions/necromancer/core/mechanics/axe.js';
import { sideEffectAmount } from '#gw2/platform/simulation/side-effects.js';
import type { TraitTrigger } from '#gw2/platform/profession-definition/trigger-rules.js';
import { modifyNecromancerRechargeStart } from '#gw2/professions/necromancer/core/mechanics/recharge.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { remainingTargetHealthBelow } from '#gw2/platform/combat/state/target-health.js';
import { consumeSkillFlip, skillFlipReady } from '#gw2/platform/engine/skills/skill-flips.js';
import { requireEffect, requireBalanceProfileFromContext } from '#gw2/platform/engine/skills/balance-profiles.js';
import { denySkillCast } from '#gw2/platform/engine/skills/availability.js';
import {
  necromancerLifeForceCostMultiplier,
  normalizedNecromancerLifeForceCost
} from '#gw2/professions/necromancer/core/state.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { NECROMANCER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/core/profiles.js';
import type { RuntimeCast, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
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
  modifyNecromancerWeaponEffects,
  perforate,
  resolveNecromancerOppressiveCollapse,
  grantNecromancerSoulShards,
  necromancerWeaponTasks
} from '#gw2/professions/necromancer/core/mechanics/weapons.js';
import {
  scheduleNecromancerConditions,
  isCorruptionCompletionEffect,
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
  completeNecromancerMinion,
  necromancerMinionAvailability,
  necromancerMinionTasks,
  ownsNecromancerMinionSkill
} from '#gw2/professions/necromancer/core/mechanics/minions.js';
import {
  grantNecromancerLifeForce,
  grantNecromancerSkillLifeForce
} from '#gw2/professions/necromancer/core/mechanics/life-force.js';
import { necromancerLifeForce } from '#gw2/professions/necromancer/core/mechanics/resources.js';

const GRAVEDIGGER_RESET = 'necromancer.gravedigger-reset';

/** Landed player packets own weapon gains and the post-hit half-health test; no predicted observation is replayed. */
function damage(runtime: NecromancerRuntime, event: Gw2ResolverEvent): void {
  if (!(Number(event.coefficient) > 0)) return;
  const skill = runtime.helpers.skillsById.get(event.skillId ?? event.sourceId);
  if (!skill) return;
  // A command grants its resource only after its owned summon strike lands on a living target.
  if (event.actorType === 'summon' && Boolean(skill.minionKey)) {
    grantNecromancerLifeForce(runtime, Number(skill.lifeForceOnHit ?? 0));
    return;
  }

  if (event.actorType !== 'player') return;
  // Combine trait rewards before the shared conversion and pool refresh, ahead of condition transfers.
  grantNecromancerLifeForce(runtime, soulMarksLifeForce(runtime, skill, event) + spitefulFortitudeLifeForce(runtime));
}

function complete(runtime: NecromancerRuntime, cast: RuntimeCast): void {
  if (cast.cancelled) return;
  completeNecromancerMinion(runtime, cast);
  const skill = cast.skill as NecromancerSkill;
  const state = runtime.profession.core;
  // Follow-ups own exact completion-time windows; ordinary attack chains and dedicated summons/forms own their own state.
  const next = runtime.helpers.autoattackChainPositions.get(Number(skill.id))?.next;
  if (
    !skill.sideEffects?.some((effect) => effect.do.type === 'flipArm') &&
    skill.flipSkillId != null &&
    skill.flipSkillId !== next &&
    skill.flipSkillId !== skill.nextChainId &&
    !ownsNecromancerMinionSkill(skill) &&
    !skill.shroudEntry &&
    !skill.shroudExit &&
    skill.id !== ID.LICH_FORM &&
    skill.id !== ID.EXIT_LICH_FORM
  ) {
    const flip = runtime.helpers.skillsById.get(skill.flipSkillId);
    if (flip && flip.name !== skill.name && flip.flipParentId === skill.id)
      runtime.armFlip(flip.id, {
        expiresAt: cast.rechargeStart + Math.max(1, skill.flipDuration ?? skill.cooldown ?? 5)
      });
  }

  if (skill.flipParentId != null && !skill.shroudExit && !Boolean(skill.minionKey))
    consumeSkillFlip(state.availableFlips, skill.id);
  completeNecromancerForm(runtime, cast);
  applyDarkDefense(runtime, cast);
}

/** Core mechanics share one live queue and resource owner with the active specialization. */
export const necromancerCoreHooks: Partial<RuntimeProfession<NecromancerRuntimeState>> = {
  rechargeStart: (_runtime, cast, at) => modifyNecromancerRechargeStart(cast, at),
  resources: { lifeForce: necromancerLifeForce },
  sideEffectHandlers: {
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
  modifyEffects(runtime, cast, effects) {
    if (ownsNecromancerMinionSkill(cast.skill) || cast.skill.id === ID.DEVOURING_DARKNESS) return [];
    // Completion owns corruption self-effects; ordinary scheduling must not apply them to the target or twice.
    const selected = cast.skill.categories?.includes('Corruption')
      ? effects.filter((effect) => !isCorruptionCompletionEffect(effect))
      : effects;
    return modifyNecromancerWeaponEffects(runtime, cast, selected);
  },
  onCastStart(runtime, cast) {
    scheduleNecromancerConditions(runtime, cast);
    const cost = normalizedNecromancerLifeForceCost(runtime.profession.core, Number(cast.skill.lifeForceCost ?? 0));
    if (cost) runtime.resourceController.spend('lifeForce', cost);
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
  onCastCommit: complete,
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
    [GRAVEDIGGER_RESET](runtime) {
      if (remainingTargetHealthBelow(runtime.config, runtime, 0.5)) runtime.cooldownController.clear(ID.GRAVEDIGGER);
    },
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
