import { resourceAtLeast } from '#gw2/platform/combat/resources/pool.js';
import { applySideEffect, sideEffectAmount } from '#gw2/platform/effects/action-dispatch.js';
import { skillFlipReady } from '#gw2/platform/execution/skill-flips.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { Gw2HitResolutionContext } from '#gw2/platform/resolver/hit-resolution.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import {
  coreAdrenalinePolicy,
  warriorBurstSpends,
  warriorBurstTier
} from '#gw2/professions/warrior/core/mechanics/adrenaline.js';
import { spendWarriorMagazine } from '#gw2/professions/warrior/core/mechanics/ammunition.js';
import { grantWarriorResource, warriorBurstRules } from '#gw2/professions/warrior/resource-rules.js';

import { WARRIOR_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/core/profiles.js';
import { combustiveShotFields } from '#gw2/professions/warrior/core/skills/profession-skills.js';
import { signetOfRageLifecycle } from '#gw2/professions/warrior/core/skills/slot-skills.js';
import { fierceBlowDamage } from '#gw2/professions/warrior/core/skills/weapons/hammer.js';
import { counterblowActions } from '#gw2/professions/warrior/core/skills/weapons/mace.js';
import { signetMasteryDamage, triggerOpportunist } from '#gw2/professions/warrior/core/traits/arms.js';
import {
  controlTraits,
  criticalTraits,
  firstBurstHit,
  weaponSwapTraits
} from '#gw2/professions/warrior/core/traits/behavior.js';
import { burstMasteryCommit } from '#gw2/professions/warrior/core/traits/discipline.js';
import {
  braveStrideCommit,
  peakPerformanceBuff,
  peakPerformanceStart
} from '#gw2/professions/warrior/core/traits/strength.js';
import { initializeEmpowerAllies } from '#gw2/professions/warrior/core/traits/tactics.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';

import { warriorBuffPolicies } from '#gw2/professions/warrior/core/effect-state.js';

/** Core dispatches shared burst packets through the burst rules selected by the Warrior family. */
export const warriorCoreHooks: RuntimeHooks<WarriorRuntimeState, WarriorSkill> = {
  resources: { adrenaline: coreAdrenalinePolicy },
  buffPolicies: warriorBuffPolicies,
  // Custom verbs keep specialization-dependent resource conversion and catalog-matched targets in their owner.
  sideEffectHandlers: {
    'warrior.spend-magazine'(runtime, context) {
      if (context.kind === 'cast') spendWarriorMagazine(runtime, context.cast);
    },
    ...counterblowActions,
    // Reuse existing delivery priority and labels; the skill declaration owns eligibility and its profile owns tuning.
    'warrior.critical-might'(runtime, context) {
      if (context.kind === 'effect') {
        const traitProfile = requireBalanceProfileFromContext(runtime, Number(context.skill.id));
        runtime.effects.emit({
          kind: 'profile',
          profile: traitProfile,
          effects: traitProfile.effects?.filter((effect) => ['boon', 'buff', 'condition'].includes(effect.type)),
          attribution: {
            source: 'Trait',
            sourceId: Number(context.skill.id),
            actorType: 'effect',
            skillId: context.trigger.event.skillId,
            skillName: context.trigger.event.skillName
          },
          cause: context.trigger.event,
          transform: (packet) => ({
            ...packet,
            priority: 5,
            name: traitProfile.name,
            stacks: 1 * Number(packet.stacks)
          })
        });
      }
    },
    'warrior.grant-combat-resource'(runtime, _cast, action) {
      if (action.type !== 'warrior.grant-combat-resource' || action.amount == null)
        throw new TypeError('Combat resource grants require an amount.');
      grantWarriorResource(runtime, sideEffectAmount(runtime, action.amount));
    },
    'warrior.rifle-restock'(runtime, context) {
      for (const skill of runtime.helpers.skills) {
        if (skill.weapon === 'Rifle' && skill.ammo) runtime.cooldownController.restoreAmmo(skill, 1, runtime.time);
      }

      // Gun Flame exists only in Berserker's catalog; reset the available bursts through the shared action.
      applySideEffect(runtime, context, {
        type: 'rechargeReset',
        skillIds: [ID.KILL_SHOT, ID.GUN_FLAME].filter((id) => runtime.helpers.skillsById.has(id))
      });
    }
  },

  initialize(runtime) {
    initializeEmpowerAllies(runtime);
  },
  endurance: {
    state: (runtime) => runtime.profession.core,
    maximum: () => 100,
    regenerationRate(runtime, vigor) {
      const profile = requireBalanceProfileFromContext(runtime, PROFILE.resources);
      return (
        balanceProfileNumber(profile, 'enduranceRegenerationPerSecond') *
        (vigor ? balanceProfileNumber(profile, 'vigorRegenerationMultiplier') : 1)
      );
    }
  },
  onCombatStart: signetOfRageLifecycle.onCombatStart,
  // Preserve the signet owner's distinction between its active cast and recurring passive work.
  backgroundTasks: signetOfRageLifecycle.backgroundTasks,

  rechargeWork: (_runtime, skill, work) => (skill.id === SHARED_SKILL_IDS.SWAP_WEAPONS ? Math.min(5, work) : work),

  availability(runtime, skill) {
    const state = runtime.profession.core;
    if (skill.id === ID.TACTICAL_BLOW && !skillFlipReady(state.availableFlips[ID.TACTICAL_BLOW], runtime.time))
      return {
        ready: false,
        retryAt: null,
        code: 'warrior.counterblow',
        reason: 'Tactical Blow requires an active Counterblow.'
      };
    const rules = warriorBurstRules(runtime);
    const cost = rules.required(runtime, skill);
    // Readiness and strict spending share the same tolerance for fractional trait rewards.
    if (!rules.bypass(runtime, skill) && !resourceAtLeast(runtime.resourceController.value('adrenaline'), cost))
      return {
        ready: false,
        retryAt: runtime.resourceController.readyAt('adrenaline', cost),
        code: 'warrior.adrenaline',
        reason: `${skill.name} requires ${cost} adrenaline.`
      };
    return { ready: true };
  },
  onCastStart(runtime, cast) {
    peakPerformanceStart(runtime, cast);
    if (cast.skill.burst && !cast.skill.dragonSlash) {
      const spent = warriorBurstRules(runtime).spend(runtime, cast.skill);
      runtime.resourceController.spend('adrenaline', spent);
      warriorBurstSpends.set(cast, spent);
    }
  },
  modifyComboFields: combustiveShotFields,
  modifyEffects(runtime, cast, effects) {
    if (!cast.skill.burst || cast.skill.dragonSlash) return effects;
    const spent = warriorBurstSpends.get(cast)!;
    const tier = warriorBurstTier(runtime, spent);

    return effects.map((effect) => ({
      ...effect,
      metadata: { ...effect.metadata, warriorAdrenalineSpent: spent, warriorBurstTier: tier }
    }));
  },
  onCastCommit(runtime, cast) {
    // Successful bursts refund the captured spend at completion, independently of target acceptance.
    const spent = warriorBurstSpends.get(cast) ?? 0;
    burstMasteryCommit(runtime, cast, spent);

    braveStrideCommit(runtime, cast);
    if (cast.skill.inputCategory === 'weapon-swap') weaponSwapTraits(runtime);
  },
  onCooldownReset(runtime) {
    if (warriorBurstRules(runtime).resetEligible)
      runtime.resourceController.grant('adrenaline', runtime.profession.core.adrenaline.maximum);
  },
  tasks: {
    ...signetOfRageLifecycle.tasks
  },
  reactions: {
    'damage.resolving': fierceBlowDamage,
    'damage.resolved'(runtime, event, details) {
      if ((event.actorType === 'player' || event.canTriggerCriticalTraits === true) && Number(event.coefficient) > 0) {
        const firstBurst = firstBurstHit(runtime, event);
        criticalTraits(runtime, event, details.hitContext as Gw2HitResolutionContext, firstBurst);
      }

      // Only adrenaline builds gain resource from ordinary player or Sigil strikes.
      if (
        runtime.profession.specialization.kind !== 'Bladesworn' &&
        (event.actorType === 'player' || event.source === 'Sigil') &&
        Number(event.coefficient) > 0
      )
        runtime.resourceController.grant('adrenaline', Math.max(1, event.hits ?? 1));
      signetMasteryDamage(runtime, event);
    },
    'buff.applied': peakPerformanceBuff,
    'control.resolved': controlTraits,
    'condition.applied'(runtime, event) {
      if (event.condition === 'Immobilized') triggerOpportunist(runtime, event);
    }
  }
};
