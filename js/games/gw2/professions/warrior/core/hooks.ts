import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { resourceAtLeast } from '#gw2/platform/combat/resources/pool.js';
import { applySideEffect, sideEffectAmount } from '#gw2/platform/effects/action-dispatch.js';
import { skillFlipReady } from '#gw2/platform/execution/skill-flips.js';
import { composeRuntimeHooks, type RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { Gw2HitResolutionContext } from '#gw2/platform/resolver/hit-resolution.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { warriorBuffPolicies } from '#gw2/professions/warrior/core/effect-state.js';
import {
  coreAdrenalinePolicy,
  warriorBurstSpends,
  warriorBurstTier
} from '#gw2/professions/warrior/core/mechanics/adrenaline.js';
import { spendWarriorMagazine } from '#gw2/professions/warrior/core/mechanics/ammunition.js';
import {
  burstCompleted,
  castStarting,
  controlAccepted,
  coreInitialized,
  firstBurstHit,
  immobilized,
  resolveCriticalOpportunity,
  strikeResourcesGranted,
  weaponSwapped
} from '#gw2/professions/warrior/core/mechanics/combat.js';
import { WARRIOR_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/core/profiles.js';
import { combustiveShotFields } from '#gw2/professions/warrior/core/skills/profession-skills.js';
import { signetOfRageLifecycle } from '#gw2/professions/warrior/core/skills/slot-skills.js';
import { fierceBlowDamage } from '#gw2/professions/warrior/core/skills/weapons/hammer.js';
import { counterblowActions } from '#gw2/professions/warrior/core/skills/weapons/mace.js';

import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import { grantWarriorResource, warriorBurstRules } from '#gw2/professions/warrior/resource-rules.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';

/** Core dispatches shared burst packets through the burst rules selected by the Warrior family. */
const coreLifecycle: RuntimeHooks<WarriorRuntimeState, WarriorSkill> = {
  /** Hold the passive disabled for Off and Active previews while preserving the equipped signet. */
  prepareDamageState(runtime, _skill, inputs) {
    if ('signetOfFury' in inputs && inputs.signetOfFury !== 'passive')
      runtime.cooldownController.setReadyAt(ID.SIGNET_OF_FURY, Infinity);
    // Emit an independent assumption so elite-owned initial buffs, such as cartridges, remain available.
    if (inputs.signetOfFury === 'active')
      runtime.effects.emit({
        kind: 'packet',
        event: {
          type: 'buff',
          kind: 'signet-of-fury-active',
          at: runtime.time,
          stacks: 1,
          duration: 3600,
          source: 'Signet of Fury',
          sourceId: 'assumption.signet-of-fury',
          actorType: 'player'
        }
      });
  },
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
        // The selected profile owns its ordinary payload; this side effect supplies only delivery priority.
        const trait = Number(context.skill.id);
        emitTraitProfile(runtime, trait, trait, context.trigger.event, {
          effects: (effect) => ['boon', 'buff', 'condition'].includes(effect.type),
          attribution: { priority: 5 }
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
    runtime.fireTrigger(coreInitialized, {});
  },
  endurance: {
    state: (runtime) => runtime.profession.core.endurance,
    maximum: () => 100,
    regenerationRate(runtime, vigor) {
      const profile = requireBalanceProfileFromContext(runtime, PROFILE.resources);
      return (
        balanceProfileNumber(profile, 'enduranceRegenerationPerSecond') *
        (vigor ? balanceProfileNumber(profile, 'vigorRegenerationMultiplier') : 1)
      );
    }
  },

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
    runtime.fireTrigger(castStarting, { cast });
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
    runtime.fireTrigger(burstCompleted, { cast, spent });
    if (cast.skill.inputCategory === 'weapon-swap') runtime.fireTrigger(weaponSwapped, {});
  },
  onCooldownReset(runtime) {
    if (warriorBurstRules(runtime).resetEligible)
      runtime.resourceController.grant('adrenaline', runtime.profession.core.adrenaline.maximum);
  },
  reactions: {
    'damage.resolving': fierceBlowDamage,
    'damage.resolved'(runtime, event, details) {
      if ((event.actorType === 'player' || event.canTriggerCriticalTraits === true) && Number(event.coefficient) > 0) {
        const firstBurst = firstBurstHit(runtime, event);
        resolveCriticalOpportunity(runtime, event, details.hitContext as Gw2HitResolutionContext, firstBurst);
      }

      // Only adrenaline builds gain resource from ordinary player or Sigil strikes.
      if (
        runtime.profession.specialization.kind !== 'Bladesworn' &&
        (event.actorType === 'player' || event.source === 'Sigil') &&
        Number(event.coefficient) > 0
      )
        runtime.resourceController.grant('adrenaline', Math.max(1, event.hits ?? 1));
      runtime.fireTrigger(strikeResourcesGranted, { event });
    },

    'control.resolved'(runtime, event) {
      if (event.actorType === 'player') runtime.fireTrigger(controlAccepted, { event });
    },
    'condition.applied'(runtime, event) {
      if (event.condition === 'Immobilized') runtime.fireTrigger(immobilized, { event });
    }
  }
};

/** Install the complete skill lifecycle so new signet callbacks retain their owner automatically. */
export const warriorCoreHooks = composeRuntimeHooks<WarriorRuntimeState, WarriorSkill>([
  coreLifecycle,
  signetOfRageLifecycle
]);
