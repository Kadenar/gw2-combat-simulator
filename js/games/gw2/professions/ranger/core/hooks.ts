import { prepareGw2BuffCompanionCandidates } from '#gw2/platform/combat/state/allied-players.js';
import { composeRuntimeHooks, type RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { OBSERVABLE_EVENT_HANDLER } from '#gw2/platform/resolver/handler-registry.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { rangerBuffPolicies } from '#gw2/professions/ranger/core/effect-state.js';
import { rangerCoreCastAvailability } from '#gw2/professions/ranger/core/mechanics/availability.js';
import {
  rangerInitialized,
  beastSkillUsed,
  buffApplied,
  castCompleted,
  criticalResolved,
  dodged,
  petSwapped,
  weaponSwapped
} from '#gw2/professions/ranger/core/mechanics/trigger-points.js';
import { rangerPetCompanionId } from '#gw2/professions/ranger/core/mechanics/pet-attributes.js';
import { isRangerPetInstanceId } from '#gw2/professions/ranger/core/mechanics/pet-state.js';
import {
  beginRangerPetCommand,
  prepareRangerPetEvent,
  rangerPetLifecycle,
  startRangerPet
} from '#gw2/professions/ranger/core/mechanics/pets.js';
import { reactToRangerCoreDamage } from '#gw2/professions/ranger/core/mechanics/reactions.js';
import { isBeastSkill } from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
import { rangerEndurance } from '#gw2/professions/ranger/core/mechanics/resources.js';
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
import { maceLifecycle } from '#gw2/professions/ranger/core/skills/weapons/mace.js';
import { bloodThirstLifecycle } from '#gw2/professions/ranger/core/skills/weapons/shortbow.js';
import { spearLifecycle } from '#gw2/professions/ranger/core/skills/weapons/spear.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { RangerRuntimeState, RangerSkill } from '#gw2/professions/ranger/types.js';

const coreLifecycle: RuntimeHooks<RangerRuntimeState, RangerSkill> = {
  buffPolicies: rangerBuffPolicies,
  endurance: rangerEndurance,
  availability: rangerCoreCastAvailability,
  // Pet recharge belongs to the incarnation accepting the command, not whichever pet is active later.
  rechargeCompanionId: (runtime, skill) => (skill.petSkill ? rangerPetCompanionId(runtime) : undefined),
  // Pet packets and delayed field creation end with their caster; existing fields and ranger-stat packets survive.
  effectOwner(_context, event) {
    if (event.actorType === 'summon' && isRangerPetInstanceId(event.summonOwner))
      return { id: event.summonOwner, generation: 0 };

    return undefined;
  },
  prepareEvent(runtime, event) {
    const state = runtime.profession.core;

    // A surviving ranger-stat effect cannot create new pet-owned children after that pet is removed.
    if (
      event.actorType === 'summon' &&
      typeof event.summonOwner === 'string' &&
      runtime.time >= (runtime.combat.companionRetiredAt(event.summonOwner) ?? Infinity)
    )
      return null;

    const skill = runtime.helpers.skillsById.get(event.skillId!);

    // The pet lane publishes its action only when the command actually starts in the current generation.
    if (event.type === 'action' && skill?.petSkill && event.actorType !== 'summon') return null;

    if (!prepareFrostTrapEvent(runtime, event)) return null;

    return prepareRangerPetEvent(
      runtime,
      prepareGw2BuffCompanionCandidates(event, state.pet ? [rangerPetCompanionId(runtime)] : [])
    );
  },
  initialize(runtime) {
    const pet = runtime.profession.core.pet;

    if (pet) runtime.combat.registerCompanion(pet.id, pet.effects);

    runtime.fireTrigger(rangerInitialized, {});
    startRangerPet(runtime);
  },
  onCombatStart(runtime) {
    startRangerPet(runtime);
    releaseFrostTrap(runtime);
  },
  modifyEffects(_runtime, cast, effects) {
    if (cast.skill.petSkill) return [];

    return effects;
  },
  onCastStart(runtime, cast) {
    beginRangerPetCommand(runtime, cast);

    if (cast.skill.evades) runtime.fireTrigger(dodged, { at: runtime.time });
  },
  onCastCommit(runtime, cast) {
    const skill = cast.skill;

    if (skill.id === ID.PET_SWAP) runtime.fireTrigger(petSwapped, { skill, at: runtime.time });

    if (skill.id === SHARED_SKILL_IDS.SWAP_WEAPONS) runtime.fireTrigger(weaponSwapped, { skill, at: runtime.time });

    if (skill.id === SHARED_SKILL_IDS.DODGE) runtime.fireTrigger(dodged, { at: runtime.time });

    runtime.fireTrigger(castCompleted, { skill, at: runtime.time });

    // Completed pet commands grant Rejuvenation and Wolfsong rewards.
    if (isBeastSkill(skill)) runtime.fireTrigger(beastSkillUsed, { skill, at: runtime.time });
  },
  tasks: {
    'ranger.stealth'(runtime, duration) {
      const state = runtime.profession.core;

      if (state.revealedUntil <= runtime.time)
        state.stealthUntil = Math.min(runtime.time + 15, Math.max(runtime.time, state.stealthUntil) + Number(duration));
    }
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

      if ((event.actorType === 'player' || event.ownerActorType === 'player') && state.stealthUntil > runtime.time) {
        state.stealthUntil = runtime.time;
        state.revealedUntil = runtime.time + 3;
      }
    },
    'buff.applied'(runtime, event) {
      runtime.fireTrigger(buffApplied, { event });
      const state = runtime.profession.core;
      armPetSharpenSpines(runtime, event);
      armParalyzingVenom(runtime, event);

      if (event.kind === 'stealth' && event.resolvedAudience?.includesSelf && state.revealedUntil <= runtime.time)
        runtime.schedule('ranger.stealth', runtime.time, event.duration || 0, undefined, 10);
    }
  }
};

/**
 * Skill owners register their side effects and grants; the shared damage dispatcher above preserves cross-skill and
 * trait ordering. Weapon recharge synchronization precedes Core's completion triggers on every commit and cancel.
 */
export const rangerCoreHooks = composeRuntimeHooks<RangerRuntimeState, RangerSkill>([
  hammerLifecycle,
  maceLifecycle,
  spearLifecycle,
  axeLifecycle,
  coreLifecycle,
  rangerPetLifecycle,
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
