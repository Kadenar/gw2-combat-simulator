import { prepareGw2BuffCompanionCandidates } from '#gw2/platform/combat/state/allied-players.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { criticalProcHandler } from '#gw2/platform/profession-definition/mechanics.js';
import { OBSERVABLE_EVENT_HANDLER } from '#gw2/platform/resolver/handler-registry.js';
import type { RuntimeCast, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { rangerEvent } from '#gw2/professions/ranger/core/events.js';
import { rangerCoreCastAvailability } from '#gw2/professions/ranger/core/mechanics/availability.js';
import {
  handleRangerBloodThirst,
  handleRangerPoisonousStrikes,
  handleRangerSharpeningStone
} from '#gw2/professions/ranger/core/mechanics/event-handlers.js';
import {
  grantMaulAttackOfOpportunity,
  reactToRangerGreatswordDamage
} from '#gw2/professions/ranger/core/mechanics/greatsword.js';
import {
  beginRangerPetCommand,
  prepareRangerPetEvent,
  rangerPetCompanionId,
  rangerPetCastDurationMs,
  rangerPetTasks,
  startRangerPet
} from '#gw2/professions/ranger/core/mechanics/pets.js';
import { reactToRangerCoreDamage } from '#gw2/professions/ranger/core/mechanics/reactions.js';
import { rangerEndurance } from '#gw2/professions/ranger/core/mechanics/resources.js';
import { triggerStalkersStrike } from '#gw2/professions/ranger/core/mechanics/skill-reactions.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/core/profiles.js';
import { swapRangerPets } from '#gw2/professions/ranger/core/skills/actions.js';
import {
  activateSicEm,
  copyHealingBoons,
  emitSunSpiritBurning,
  prepareFrostTrapEvent,
  releaseFrostTrap
} from '#gw2/professions/ranger/core/skills/slot-skills.js';
import { synchronizePathOfScarsRecharge } from '#gw2/professions/ranger/core/skills/weapons/axe.js';
import { synchronizeHammerRecharge } from '#gw2/professions/ranger/core/skills/weapons/hammer.js';
import {
  armHuntersProwess,
  consumeSpearOpportunity,
  synchronizeSpearRecharge
} from '#gw2/professions/ranger/core/skills/weapons/spear.js';
import {
  applyRangerDodgeTraits,
  applyRangerWeaponSwapTraits,
  handleRangerBeastSkillUsed,
  rangerCoreCriticalReactions,
  reactToRangerCoreBuff
} from '#gw2/professions/ranger/core/traits/behavior.js';
import { applyRangerPetSwapTraits, completeRangerTraits } from '#gw2/professions/ranger/core/traits/dispatch.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { RangerRuntime, RangerRuntimeState } from '#gw2/professions/ranger/types.js';

const critical = criticalProcHandler(rangerCoreCriticalReactions);

/** Charges are granted only at their actual activation boundary and consumed by resolved-hit owners. */
function grantSkillCharges(runtime: RangerRuntime, cast: RuntimeCast, type: string, profileId: number | string): void {
  const profile = requireBalanceProfileFromContext(runtime, profileId);
  runtime.emit(
    rangerEvent(
      {
        at: runtime.time,
        skillId: cast.skill.id,
        skillName: cast.skill.name,
        activationId: cast.id,
        charges: balanceProfileNumber(profile, 'playerStacks'),
        duration: balanceProfileNumber(profile, 'durationMultiplier')
      },
      type
    )
  );
}

/** Commit and cancellation both synchronize the recharge already started by the runtime. */
function completeWeapon(runtime: RangerRuntime, cast: RuntimeCast): void {
  synchronizeHammerRecharge(runtime, cast);
  synchronizeSpearRecharge(runtime, cast);
  synchronizePathOfScarsRecharge(runtime, cast);
}

export const rangerCoreHooks: Partial<RuntimeProfession<RangerRuntimeState>> = {
  sideEffectHandlers: {
    // Declarations choose the phase and payload; queued grants preserve same-time hit ordering.
    'ranger.sharpening-stone'(runtime, context) {
      if (context.kind === 'cast')
        grantSkillCharges(runtime, context.cast, 'ranger.sharpening-stone', PROFILE.sharpeningStone);
    },
    'ranger.poisonous-strikes'(runtime, context) {
      if (context.kind === 'cast')
        grantSkillCharges(runtime, context.cast, 'ranger.poisonous-strikes', PROFILE.poisonousStrikes);
    },
    'ranger.blood-thirst'(runtime, context) {
      if (context.kind === 'cast') grantSkillCharges(runtime, context.cast, 'ranger.blood-thirst', PROFILE.bloodThirst);
    },
    'ranger.winter-bite'(runtime) {
      runtime.profession.core.winterBiteReady = true;
    },
    'ranger.sun-spirit'(runtime, context) {
      emitSunSpiritBurning(runtime, context.skill);
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
  endurance: rangerEndurance,
  availability: rangerCoreCastAvailability,
  castDurationMs: rangerPetCastDurationMs,
  prepareEvent(runtime, event) {
    const state = runtime.profession.core;
    const skill = runtime.helpers.skillsById.get(event.skillId!);
    // The pet lane publishes its action only when the command actually starts in the current generation.
    if (event.type === 'action' && skill?.petSkill && event.actorType !== 'summon') return null;
    if (!prepareFrostTrapEvent(runtime, event)) return null;

    return prepareRangerPetEvent(
      runtime,
      prepareGw2BuffCompanionCandidates(event, state.petActive ? [rangerPetCompanionId(runtime)] : [])
    );
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
    'ranger.blood-thirst': handleRangerBloodThirst,
    'ranger.beast-skill-used': handleRangerBeastSkillUsed,
    'ranger.poisonous-strikes': handleRangerPoisonousStrikes,
    'ranger.sharpening-stone': handleRangerSharpeningStone
  },
  reactions: {
    'damage.resolved'(runtime, event, details) {
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
      if (event.kind === 'stealth' && event.resolvedAudience?.includesSelf && state.revealedUntil <= runtime.time)
        runtime.schedule('ranger.stealth', runtime.time, event.duration || 0, undefined, 10);
    }
  }
};
