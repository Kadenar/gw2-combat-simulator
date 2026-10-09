import { prepareGw2BuffCompanionCandidates } from '#gw2/platform/combat/state/allied-players.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { criticalProcHandler } from '#gw2/platform/profession-definition/critical-proc-handler.js';
import { composeRuntimeHooks, type RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { OBSERVABLE_EVENT_HANDLER } from '#gw2/platform/resolver/handler-registry.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { rangerBuffPolicies } from '#gw2/professions/ranger/core/effect-state.js';
import { rangerCoreCastAvailability } from '#gw2/professions/ranger/core/mechanics/availability.js';
import {
  grantMaulAttackOfOpportunity,
  reactToRangerGreatswordDamage
} from '#gw2/professions/ranger/core/mechanics/greatsword.js';
import { rangerPetCompanionId } from '#gw2/professions/ranger/core/mechanics/pet-attributes.js';
import {
  beginRangerPetCommand,
  consumeParalyzingVenom,
  prepareRangerPetEvent,
  rangerBoonDuration,
  rangerPetCastDurationMs,
  rangerPetTasks,
  startRangerPet
} from '#gw2/professions/ranger/core/mechanics/pets.js';
import { reactToRangerCoreDamage } from '#gw2/professions/ranger/core/mechanics/reactions.js';
import { rangerEndurance } from '#gw2/professions/ranger/core/mechanics/resources.js';
import { triggerStalkersStrike } from '#gw2/professions/ranger/core/mechanics/skill-reactions.js';
import { swapRangerPets } from '#gw2/professions/ranger/core/skills/actions.js';
import {
  activateSicEm,
  copyHealingBoons,
  emitStormSpiritSlam,
  emitSunSpiritBurning,
  prepareFrostTrapEvent,
  RANGER_SPIRIT_SLAM_DELAY_MS,
  releaseFrostTrap,
  sharpeningStoneLifecycle
} from '#gw2/professions/ranger/core/skills/slot-skills.js';
import { synchronizePathOfScarsRecharge } from '#gw2/professions/ranger/core/skills/weapons/axe.js';
import { poisonousStrikesLifecycle } from '#gw2/professions/ranger/core/skills/weapons/dagger.js';
import { synchronizeHammerRecharge } from '#gw2/professions/ranger/core/skills/weapons/hammer.js';
import { bloodThirstLifecycle } from '#gw2/professions/ranger/core/skills/weapons/shortbow.js';
import {
  armHuntersProwess,
  consumeSpearOpportunity,
  synchronizeSpearRecharge
} from '#gw2/professions/ranger/core/skills/weapons/spear.js';
import { applyRangerPetSwapTraits, completeRangerTraits } from '#gw2/professions/ranger/core/traits/dispatch.js';
import { reactToRangerCoreBuff } from '#gw2/professions/ranger/core/traits/marksmanship/opening-strike.js';
import { rangerCoreCriticalReactions } from '#gw2/professions/ranger/core/traits/skirmishing/index.js';
import {
  applyRangerDodgeTraits,
  applyRangerWeaponSwapTraits
} from '#gw2/professions/ranger/core/traits/skirmishing/movement.js';
import { handleRangerBeastSkillUsed } from '#gw2/professions/ranger/core/traits/wilderness-survival/poison.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { RangerRuntime, RangerRuntimeState, RangerSkill } from '#gw2/professions/ranger/types.js';

const critical = criticalProcHandler(rangerCoreCriticalReactions);

/** Commit and cancellation both synchronize the recharge already started by the runtime. */
function completeWeapon(runtime: RangerRuntime, cast: RuntimeCast<RangerSkill>): void {
  synchronizeHammerRecharge(runtime, cast);
  synchronizeSpearRecharge(runtime, cast);
  synchronizePathOfScarsRecharge(runtime, cast);
}

const coreLifecycle: RuntimeHooks<RangerRuntimeState, RangerSkill> = {
  buffPolicies: rangerBuffPolicies,
  sideEffectHandlers: {
    'ranger.winter-bite'(runtime) {
      runtime.profession.core.winterBiteReady = true;
    },
    'ranger.sun-spirit'(runtime, context) {
      // Solar Flare lands with the first shake, after the same summon delay as every other spirit.
      emitSunSpiritBurning(runtime, context.skill, runtime.time + RANGER_SPIRIT_SLAM_DELAY_MS / 1000);
    },
    'ranger.storm-spirit'(runtime, context) {
      // Spirit damage is an independent child, so later pet swaps cannot cancel its slam.
      if (context.kind === 'cast')
        emitStormSpiritSlam(runtime, context.cast, runtime.time + RANGER_SPIRIT_SLAM_DELAY_MS / 1000);
    },
    'ranger.sic-em'(runtime, context) {
      activateSicEm(runtime, context.skill);
    },
    'ranger.copy-healing-boons'(runtime, context) {
      if (context.kind === 'cast') copyHealingBoons(runtime, context.cast);
    },
    'ranger.hunters-prowess': armHuntersProwess,
    'ranger.spear-opportunity': consumeSpearOpportunity,
    'ranger.swap-pets'(runtime, context) {
      swapRangerPets(runtime, context.skill);
    },
    'ranger.stalkers-poison'(runtime, context) {
      if (context.kind === 'effect') triggerStalkersStrike(runtime, context.trigger.event);
    },
    // Queue the merged grant before observers consume the old charge; application still follows consumption.
    'ranger.maul-player'(runtime, context) {
      if (context.kind === 'effect') grantMaulAttackOfOpportunity(runtime, context.trigger.event, 'player');
    },
    'ranger.maul-pet'(runtime, context) {
      if (context.kind === 'effect') grantMaulAttackOfOpportunity(runtime, context.trigger.event, 'pet');
    }
  },
  boonDuration: rangerBoonDuration,
  endurance: rangerEndurance,
  availability: rangerCoreCastAvailability,
  castDurationMs: rangerPetCastDurationMs,
  // Pet recharge belongs to the incarnation accepting the command, not whichever pet is active later.
  rechargeCompanionId: (runtime, skill) => (skill.petSkill ? rangerPetCompanionId(runtime) : undefined),
  // Pet packets and delayed field creation end with their caster; existing fields and ranger-stat packets survive.
  effectOwner(_context, event) {
    if (
      event.actorType === 'summon' &&
      typeof event.summonOwner === 'string' &&
      event.summonOwner.startsWith('ranger-pet:')
    )
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
      prepareGw2BuffCompanionCandidates(event, state.petActive ? [rangerPetCompanionId(runtime)] : [])
    );
  },
  initialize: startRangerPet,
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
    if (cast.skill.evades) applyRangerDodgeTraits(runtime);
  },
  // Cancelled variants still synchronize their shared weapon recharge.
  onCastCancel: completeWeapon,
  onCastCommit(runtime, cast) {
    completeWeapon(runtime, cast);
    const skill = cast.skill;
    if (skill.id === ID.PET_SWAP) applyRangerPetSwapTraits(runtime, skill);

    if (skill.id === SHARED_SKILL_IDS.SWAP_WEAPONS) applyRangerWeaponSwapTraits(runtime, skill);
    if (skill.id === SHARED_SKILL_IDS.DODGE) applyRangerDodgeTraits(runtime);
    completeRangerTraits(runtime, skill);
  },
  // Autonomous pet attacks keep running during combat but cannot prolong the player's isolated damage preview.
  backgroundTasks: Object.keys(rangerPetTasks),
  tasks: {
    ...rangerPetTasks,
    'ranger.stealth'(runtime, duration) {
      const state = runtime.profession.core;
      if (state.revealedUntil <= runtime.time)
        state.stealthUntil = Math.min(runtime.time + 15, Math.max(runtime.time, state.stealthUntil) + Number(duration));
    }
  },
  eventHandlers: {
    // This is an executed transition fact for presentation; the completion owner already changed the pet.
    'ranger.pet-swapped': OBSERVABLE_EVENT_HANDLER,
    'ranger.beast-skill-used': handleRangerBeastSkillUsed
  },
  reactions: {
    'damage.resolved'(runtime, event, details) {
      consumeParalyzingVenom(runtime, event);
      reactToRangerGreatswordDamage(runtime, event);
      reactToRangerCoreDamage(runtime, event);
      critical(runtime, event, details);
      const state = runtime.profession.core;
      if ((event.actorType === 'player' || event.ownerActorType === 'player') && state.stealthUntil > runtime.time) {
        state.stealthUntil = runtime.time;
        state.revealedUntil = runtime.time + 3;
      }
    },
    'buff.applied'(runtime, event) {
      reactToRangerCoreBuff(runtime, event);
      const state = runtime.profession.core;
      // Only the currently active pet can arm its next-hit venom; stale launched buffs cannot arm a replacement.
      if (
        event.kind === 'paralyzing-venom' &&
        event.sourceId === ID.PARALYZING_VENOM &&
        state.petActive &&
        event.summonOwner === rangerPetCompanionId(runtime)
      )
        state.paralyzingVenomUntil = runtime.time + Number(event.duration);
      if (event.kind === 'stealth' && event.resolvedAudience?.includesSelf && state.revealedUntil <= runtime.time)
        runtime.schedule('ranger.stealth', runtime.time, event.duration || 0, undefined, 10);
    }
  }
};

/** Skill owners register their grants; the shared damage dispatcher preserves cross-skill and trait ordering. */
export const rangerCoreHooks = composeRuntimeHooks<RangerRuntimeState, RangerSkill>([
  coreLifecycle,
  sharpeningStoneLifecycle,
  poisonousStrikesLifecycle,
  bloodThirstLifecycle
]);
