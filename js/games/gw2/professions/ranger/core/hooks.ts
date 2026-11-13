import {
  createStealthLifecycle,
  endStealth,
  isStealthGrantingImpact,
  stealthActive
} from '#gw2/platform/combat/stealth.js';
import { ACTOR, RECIPIENT } from '#gw2/platform/constants.js';
import { composeRuntimeHooks, type RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { OBSERVABLE_EVENT_HANDLER } from '#gw2/platform/resolver/handler-registry.js';
import { skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { rangerBuffPolicies } from '#gw2/professions/ranger/core/effect-state.js';
import { buildRangerPacket } from '#gw2/professions/ranger/core/events.js';
import { rangerCoreCastAvailability } from '#gw2/professions/ranger/core/mechanics/availability.js';
import { rangerPetLifecycle, startRangerPet } from '#gw2/professions/ranger/core/mechanics/pets.js';
import { reactToRangerCoreDamage } from '#gw2/professions/ranger/core/mechanics/reactions.js';
import { isBeastSkill } from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
import { rangerEndurance } from '#gw2/professions/ranger/core/mechanics/resources.js';
import {
  beastSkillUsed,
  buffApplied,
  castCompleted,
  criticalResolved,
  petSwapped,
  rangerInitialized,
  weaponSwapped
} from '#gw2/professions/ranger/core/mechanics/trigger-points.js';
import { petSwapLifecycle } from '#gw2/professions/ranger/core/skills/actions.js';
import { armPetSharpenSpines, consumePetSharpenSpines } from '#gw2/professions/ranger/core/skills/pets/bristleback.js';
import { armParalyzingVenom, consumeParalyzingVenom } from '#gw2/professions/ranger/core/skills/pets/spider.js';
import {
  prepareFrostTrapEvent,
  releaseFrostTrap,
  sharpeningStoneLifecycle,
  sicEmLifecycle,
  spiritLifecycle,
  weHealAsOneLifecycle
} from '#gw2/professions/ranger/core/skills/slot-skills.js';
import { axeLifecycle } from '#gw2/professions/ranger/core/skills/weapons/axe.js';
import {
  poisonousStrikesLifecycle,
  stalkersStrikeLifecycle
} from '#gw2/professions/ranger/core/skills/weapons/dagger.js';
import {
  maulLifecycle,
  reactToRangerGreatswordDamage
} from '#gw2/professions/ranger/core/skills/weapons/greatsword.js';
import { hammerLifecycle } from '#gw2/professions/ranger/core/skills/weapons/hammer.js';
import { huntersShotLifecycle } from '#gw2/professions/ranger/core/skills/weapons/longbow.js';
import { maceLifecycle } from '#gw2/professions/ranger/core/skills/weapons/mace.js';
import { bloodThirstLifecycle } from '#gw2/professions/ranger/core/skills/weapons/shortbow.js';
import { spearLifecycle } from '#gw2/professions/ranger/core/skills/weapons/spear.js';
import { rangerMerged } from '#gw2/professions/ranger/core/state.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { RangerRuntimeState, RangerSkill } from '#gw2/professions/ranger/types.js';

const coreLifecycle: RuntimeHooks<RangerRuntimeState, RangerSkill> = {
  buffPolicies: rangerBuffPolicies,
  sideEffectHandlers: {
    'ranger.strength-of-the-pack'(runtime, context) {
      runtime.effects.emit({
        kind: 'packet',
        event: buildRangerPacket(
          {
            at: runtime.time,
            skillId: context.skill.id,
            skillName: context.skill.name,
            kind: 'strength-of-the-pack',
            duration: skillNumber(context.skill, 'duration'),
            stacks: 1
          },
          'buff'
        )
      });
      // Bind the damage grant to the current pet, or to the player when cast in Beastmode.
      const pet = runtime.profession.core.pet;
      const merged = rangerMerged(runtime.profession);

      if (pet || merged)
        runtime.effects.emit({
          kind: 'packet',
          event: buildRangerPacket(
            {
              at: runtime.time,
              skillId: context.skill.id,
              skillName: context.skill.name,
              kind: merged ? 'strength-of-the-pack-merged' : 'strength-of-the-pack-pet',
              duration: skillNumber(context.skill, 'duration'),
              stacks: 1,
              audience: merged
                ? { recipients: RECIPIENT.SELF }
                : {
                    recipients: RECIPIENT.SUMMONS,
                    affectsSelf: false,
                    maximumRecipients: 1,
                    eligibleCompanionIds: [pet!.id]
                  }
            },
            'buff'
          )
        });
    },
    'ranger.paralyzing-venom'(runtime, context) {
      if (context.kind === 'effect') armParalyzingVenom(runtime, context.trigger.event);
    },
    'ranger.sharpen-spines'(runtime, context) {
      if (context.kind === 'effect') armPetSharpenSpines(runtime, context.trigger.event);
    }
  },
  endurance: rangerEndurance,
  availability: rangerCoreCastAvailability,
  prepareEvent: prepareFrostTrapEvent,
  initialize(runtime) {
    // The pet lifecycle registers the companion before traits grant rewards; cadence starts afterward.
    runtime.fireTrigger(rangerInitialized);
    startRangerPet(runtime);
  },
  onCombatStart(runtime) {
    releaseFrostTrap(runtime);
  },
  onCastCommit(runtime, cast) {
    const skill = cast.skill;

    if (skill.id === ID.PET_SWAP) runtime.fireTrigger(petSwapped, { skill });

    if (skill.id === SHARED_SKILL_IDS.SWAP_WEAPONS) runtime.fireTrigger(weaponSwapped, { skill, at: runtime.time });

    runtime.fireTrigger(castCompleted, { skill, at: runtime.time });

    // Completed pet commands grant Rejuvenation and Wolfsong rewards.
    if (isBeastSkill(skill)) runtime.fireTrigger(beastSkillUsed, { skill });
  },
  eventHandlers: {
    // This is an executed transition fact for presentation; the completion owner already changed the pet.
    'ranger.pet-swapped': OBSERVABLE_EVENT_HANDLER
  },
  reactions: {
    'damage.resolved'(runtime, event, details) {
      consumeParalyzingVenom(runtime, event);
      consumePetSharpenSpines(runtime, event);
      reactToRangerGreatswordDamage(runtime, event);
      reactToRangerCoreDamage(runtime, event);
      runtime.fireTrigger(criticalResolved, { event, details });
      const state = runtime.profession.core;

      if (
        (event.actorType === ACTOR.PLAYER || event.ownerActorType === ACTOR.PLAYER) &&
        !isStealthGrantingImpact(state, event) &&
        stealthActive(state, runtime.time)
      ) {
        endStealth(state, runtime.time);
      }
    },
    'buff.applied'(runtime, event) {
      runtime.fireTrigger(buffApplied, { event });
    }
  }
};

/**
 * Skill owners register their side effects and grants; the shared damage dispatcher above preserves cross-skill and
 * trait ordering. Weapon recharge synchronization precedes Core's completion triggers on every commit and cancel.
 */
export const rangerCoreHooks = composeRuntimeHooks<RangerRuntimeState, RangerSkill>([
  createStealthLifecycle<RangerRuntimeState, RangerSkill>({ preserveOnGrantTimestamp: true }),
  huntersShotLifecycle,
  hammerLifecycle,
  maceLifecycle,
  spearLifecycle,
  axeLifecycle,
  // Pet admission precedes Frost Trap preparation; combat cadence precedes trap release.
  rangerPetLifecycle,
  coreLifecycle,
  petSwapLifecycle,
  maulLifecycle,
  stalkersStrikeLifecycle,
  spiritLifecycle,
  sicEmLifecycle,
  weHealAsOneLifecycle,
  sharpeningStoneLifecycle,
  poisonousStrikesLifecycle,
  bloodThirstLifecycle
]);
