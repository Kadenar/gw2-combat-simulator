import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { skillFlipReady } from '#gw2/platform/engine/skills/skill-flips.js';
import type { Gw2HitResolutionContext } from '#gw2/platform/resolver/hit-resolution.js';
import type { RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import { applySideEffect, sideEffectAmount } from '#gw2/platform/simulation/side-effects.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import {
  burstAdrenalineSpend,
  grantWarriorAdrenaline,
  warriorBurstSpends,
  warriorBurstTier
} from '#gw2/professions/warrior/core/mechanics/adrenaline.js';
import { spendWarriorMagazine } from '#gw2/professions/warrior/core/mechanics/ammunition.js';
import { traitEffects } from '#gw2/professions/warrior/core/mechanics/emission.js';
import { WARRIOR_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/core/profiles.js';
import { combustiveShotFields } from '#gw2/professions/warrior/core/skills/profession-skills.js';
import { signetOfRageLifecycle } from '#gw2/professions/warrior/core/skills/slot-skills.js';
import { fierceBlowDamage } from '#gw2/professions/warrior/core/skills/weapons/hammer.js';
import { counterblowActions } from '#gw2/professions/warrior/core/skills/weapons/mace.js';
import {
  reactToWarriorDamage,
  triggerOpportunist,
  burstMasteryCommit,
  completeTraits,
  reactToWarriorBuff,
  startTraits,
  initializeEmpowerAllies,
  controlTraits,
  firstBurstHit,
  criticalTraits,
  weaponSwapTraits
} from '#gw2/professions/warrior/core/traits/behavior.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';
import { boundedNumber } from '#kernel/core/numeric.js';

/** Core resources and burst packets execute in the Core hooks; elite behavior composes at the family boundary. */
export const warriorCoreHooks: Partial<RuntimeProfession<WarriorRuntimeState, WarriorSkill>> = {
  // Custom verbs keep specialization-dependent resource conversion and catalog-matched targets in their owner.
  sideEffectHandlers: {
    'warrior.spend-magazine'(runtime, context) {
      if (context.kind === 'cast') spendWarriorMagazine(runtime, context.cast);
    },
    ...counterblowActions,
    // Reuse existing delivery priority and labels; the skill declaration owns eligibility and its profile owns tuning.
    'warrior.critical-might'(runtime, context) {
      if (context.kind === 'effect') traitEffects(runtime, context.trigger.event, Number(context.skill.id));
    },
    'warrior.adrenaline'(runtime, _cast, action) {
      if (action.type !== 'warrior.adrenaline' || action.amount == null)
        throw new TypeError('Adrenaline grants require an amount.');
      grantWarriorAdrenaline(runtime, sideEffectAmount(runtime, action.amount));
    },
    'warrior.rifle-restock'(runtime, context) {
      for (const skill of runtime.helpers.skills) {
        if (skill.weapon === 'Rifle' && skill.ammo)
          runtime.cooldownController.restoreAmmo(skill, 1, runtime.time, 'reset');
      }

      // Gun Flame exists only in Berserker's catalog; reset the available bursts through the shared action.
      applySideEffect(runtime, context, {
        type: 'rechargeReset',
        skillIds: [ID.KILL_SHOT, ID.GUN_FLAME].filter((id) => runtime.helpers.skillsById.has(id))
      });
    }
  },

  initialize(runtime) {
    // Select the Core pool before elite initialization replaces its resource policy.
    const state = runtime.profession.core;
    state.maximumAdrenaline = balanceProfileNumber(
      requireBalanceProfileFromContext(runtime, PROFILE.resources),
      'maximumStacks'
    );
    state.adrenaline = boundedNumber(runtime.config.initialResource ?? 0, 0, 0, state.maximumAdrenaline);
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
    // Berserker owns re-entry readiness while its active mode temporarily reduces the resource cap.
    if (
      skill.id === ID.BERSERK &&
      runtime.profession.specialization.kind === 'Berserker' &&
      runtime.profession.specialization.state.berserkActive
    )
      return { ready: true };
    // Bladesworn's own availability rejects weapon bursts and checks its Flow/charge state.
    if (runtime.profession.specialization.kind === 'Bladesworn') return { ready: true };
    const cost = skill.adrenalineCost ?? 0;
    if (state.adrenaline < cost)
      return {
        ready: false,
        retryAt:
          cost <= state.maximumAdrenaline &&
          state.nextSignetPulseAt > runtime.time &&
          Number.isFinite(state.nextSignetPulseAt)
            ? state.nextSignetPulseAt
            : null,
        code: 'warrior.adrenaline',
        reason: `${skill.name} requires ${cost} adrenaline.`
      };
    return { ready: true };
  },
  onCastStart(runtime, cast) {
    startTraits(runtime, cast);
    if (cast.skill.burst && !cast.skill.dragonSlash) {
      const state = runtime.profession.core;
      const spent = burstAdrenalineSpend(runtime, cast.skill);
      warriorBurstSpends.set(cast, spent);
      state.adrenaline -= spent;
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

    completeTraits(runtime, cast);
    if (cast.skill.inputCategory === 'weapon-swap') weaponSwapTraits(runtime);
  },
  onCooldownReset(runtime) {
    runtime.profession.core.adrenaline = runtime.profession.core.maximumAdrenaline;
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

      if (
        runtime.profession.specialization.kind !== 'Bladesworn' &&
        (event.actorType === 'player' || event.source === 'Sigil') &&
        Number(event.coefficient) > 0
      )
        grantWarriorAdrenaline(runtime, Math.max(1, event.hits ?? 1));
      reactToWarriorDamage(runtime, event);
    },
    'buff.applied': reactToWarriorBuff,
    'control.resolved': controlTraits,
    'condition.applied'(runtime, event) {
      if (event.condition === 'Immobilized') triggerOpportunist(runtime, event);
    }
  }
};
