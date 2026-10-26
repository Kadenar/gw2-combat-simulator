import { ENDURANCE, enduranceRegenerationRate } from '#gw2/platform/combat/resources/endurance-rules.js';
import { ACTOR, WEAPON, CONDITION } from '#gw2/platform/constants.js';
import { selectedSkillIdSet } from '#gw2/platform/builds/selected-skills.js';
import { criticalOpportunity } from '#gw2/platform/combat/procs/critical.js';
import { gw2CooldownReadyAt } from '#gw2/platform/combat/action-tick.js';
import { applySideEffect, sideEffectAmount } from '#gw2/platform/effects/action-dispatch.js';
import { weaponFlipBlock } from '#gw2/platform/execution/skill-flips.js';
import { composeRuntimeHooks, type RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import type { Gw2HitResolutionContext } from '#gw2/platform/resolver/hit-resolution.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import { skillNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { warriorBuffPolicies } from '#gw2/professions/warrior/core/effect-state.js';
import {
  beginWarriorBurst,
  completeWarriorBurst,
  coreAdrenalinePolicy,
  firstBurstHit,
  modifyWarriorBurstEffects,
  resetWarriorAdrenaline,
  warriorAdrenalineAvailability
} from '#gw2/professions/warrior/core/mechanics/adrenaline.js';
import { spendWarriorMagazine } from '#gw2/professions/warrior/core/mechanics/ammunition.js';
import {
  castStarting,
  controlAccepted,
  coreInitialized,
  critical,
  immobilized,
  strikeResourcesGranted,
  weaponSwapped
} from '#gw2/professions/warrior/core/mechanics/trigger-points.js';
import { combustiveShotFields } from '#gw2/professions/warrior/core/skills/profession-skills.js';
import { signetOfRageLifecycle } from '#gw2/professions/warrior/core/skills/slot-skills.js';
import { fierceBlowDamage } from '#gw2/professions/warrior/core/skills/weapons/hammer.js';
import { counterblowLifecycle } from '#gw2/professions/warrior/core/skills/weapons/mace.js';
import { swordFlipLifecycle } from '#gw2/professions/warrior/core/skills/weapons/sword.js';
import { resolveWarriorDualWieldSkill } from '#gw2/professions/warrior/data/dual-wielding.js';

import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import { grantWarriorResource } from '#gw2/professions/warrior/resource-rules.js';
import type { WarriorRuntime, WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';

/** Derive one opportunity for every critical trait so independent proc chances share the hit fact. */
function resolveCriticalOpportunity(
  runtime: WarriorRuntime,
  event: Gw2ResolverEvent,
  hit: Gw2HitResolutionContext,
  firstBurst: boolean
): void {
  const opportunity = criticalOpportunity(
    hit.critEligible ? hit.critical.chance : 0,
    hit.critical.didCrit,
    Math.max(1, event.hits ?? 1)
  );
  runtime.fireTrigger(critical, { event, opportunity, firstBurst });
}

/** Core dispatches shared burst packets through the burst rules selected by the Warrior family. */
const coreLifecycle: RuntimeHooks<WarriorRuntimeState, WarriorSkill> = {
  // Resolve against the active set before acceptance so all cast effects use the same cutoff.
  resolveCastSkill(runtime, skill) {
    return resolveWarriorDualWieldSkill(skill, runtime.config, runtime.activeWeaponSet);
  },
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
          actorType: ACTOR.PLAYER
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
    // The landed critical owns delivery; the selected skill owns the independently removable reward.
    'warrior.critical-might'(runtime, context) {
      if (context.kind !== 'effect') return;

      const action = requireSkillAction(context.skill, 'critical-might');
      runtime.effects.emit({
        kind: 'profile',
        profile: context.skill,
        effects: action.effects,
        cause: context.trigger.event,
        priority: 5,
        attribution: {
          source: context.skill.name,
          sourceId: context.skill.id,
          actorType: ACTOR.EFFECT,
          skillId: context.skill.id,
          skillName: context.skill.name
        }
      });
    },
    'warrior.grant-combat-resource'(runtime, _cast, action) {
      if (action.type !== 'warrior.grant-combat-resource' || action.amount == null)
        throw new TypeError('Combat resource grants require an amount.');

      grantWarriorResource(runtime, sideEffectAmount(runtime, action.amount));
    },
    'warrior.rifle-restock'(runtime, context) {
      for (const skill of runtime.helpers.skills) {
        if (skill.weapon === WEAPON.RIFLE && skill.ammo) runtime.cooldownController.restoreAmmo(skill, 1, runtime.time);
      }

      // Gun Flame exists only in Berserker's catalog; reset the available bursts through the shared action.
      applySideEffect(runtime, context, {
        type: 'rechargeReset',
        skillIds: [ID.KILL_SHOT, ID.GUN_FLAME].filter((id) => runtime.helpers.skillsById.has(id))
      });
    }
  },

  initialize(runtime) {
    runtime.fireTrigger(coreInitialized);
  },
  endurance: {
    state: (runtime) => runtime.profession.core.endurance,
    maximum: () => ENDURANCE.maximum,
    regenerationBoundaries: (runtime) => [
      gw2CooldownReadyAt(runtime.cooldownController.readyAt(ID.SIGNET_OF_STAMINA) ?? 0)
    ],
    regenerationRate(runtime, vigor, at) {
      // A ready, equipped signet adds to Vigor's regeneration bonus, subject to the shared 100% bonus cap.
      const stamina =
        selectedSkillIdSet(runtime.config.selectedSkillIds).has(ID.SIGNET_OF_STAMINA) &&
        at >= gw2CooldownReadyAt(runtime.cooldownController.readyAt(ID.SIGNET_OF_STAMINA) ?? 0)
          ? skillNumberFromContext(runtime, ID.SIGNET_OF_STAMINA, 'enduranceRegenerationBonus')
          : 0;
      return Math.min(ENDURANCE.maximumRegenerationPerSecond, enduranceRegenerationRate(vigor, stamina));
    }
  },

  rechargeWork: (_runtime, skill, work) => (skill.id === SHARED_SKILL_IDS.SWAP_WEAPONS ? Math.min(5, work) : work),

  availability(runtime, skill) {
    // Every weapon follow-up (Riposte, Impale, Counterblow) uses the shared bar-slot rule: the follow-up exists only
    // while its window is ready, and its parent stays hidden behind it for that window.
    const block = weaponFlipBlock(
      runtime.profession.core.availableFlips,
      runtime.helpers.skillsById,
      skill,
      runtime.time
    );

    if (block?.kind === 'closed')
      return {
        ready: false,
        retryAt: null,
        code: 'warrior.flip-inactive',
        reason: `${skill.name} requires an active ${block.parent.name}.`
      };

    if (block?.kind === 'open')
      return {
        ready: false,
        retryAt: null,
        code: 'warrior.flip-active',
        reason: `${skill.name} is replaced by its active follow-up.`
      };

    return warriorAdrenalineAvailability(runtime, skill);
  },
  onCastStart(runtime, cast) {
    runtime.fireTrigger(castStarting, { cast });

    beginWarriorBurst(runtime, cast);
  },
  modifyComboFields: combustiveShotFields,
  modifyEffects: modifyWarriorBurstEffects,
  onCastCommit(runtime, cast) {
    completeWarriorBurst(runtime, cast);

    if (cast.skill.inputCategory === 'weapon-swap') runtime.fireTrigger(weaponSwapped);
  },
  onCooldownReset: resetWarriorAdrenaline,
  reactions: {
    'damage.resolving': fierceBlowDamage,
    'damage.resolved'(runtime, event, details) {
      if (
        (event.actorType === ACTOR.PLAYER || event.canTriggerCriticalTraits === true) &&
        Number(event.coefficient) > 0
      ) {
        const firstBurst = firstBurstHit(runtime, event);
        resolveCriticalOpportunity(runtime, event, details.hitContext as Gw2HitResolutionContext, firstBurst);
      }

      // Only adrenaline builds gain resource from ordinary player or Sigil strikes.
      if (
        runtime.profession.specialization.kind !== 'Bladesworn' &&
        (event.actorType === ACTOR.PLAYER || event.source === 'Sigil') &&
        Number(event.coefficient) > 0
      )
        runtime.resourceController.grant('adrenaline', Math.max(1, event.hits ?? 1));

      runtime.fireTrigger(strikeResourcesGranted, { event });
    },

    'control.resolved'(runtime, event) {
      if (event.actorType === ACTOR.PLAYER) runtime.fireTrigger(controlAccepted, { event });
    },
    'condition.applied'(runtime, event) {
      if (event.condition === CONDITION.IMMOBILIZED) runtime.fireTrigger(immobilized, { event });
    }
  }
};

/** Install the complete skill lifecycle so new signet callbacks retain their owner automatically. */
export const warriorCoreHooks = composeRuntimeHooks<WarriorRuntimeState, WarriorSkill>([
  coreLifecycle,
  counterblowLifecycle,
  swordFlipLifecycle,
  signetOfRageLifecycle
]);
