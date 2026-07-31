import { professionCoreState } from "../../../platform/engine/profession.js";
/**
 * @fileoverview Composes Necromancer cast validation, shroud and weapon state,
 * trait reactions, cooldown feedback, and typed tasks into the shared
 * scheduler contract.
 */

import {
  NECROMANCER_SKILL_IDS as ID,
  NECROMANCER_TRAIT_IDS as TRAIT,
} from "../data/ids.js";
import {
  advanceNecromancerState,
  finalizeNecromancerCast,
} from "./life-force.js";
import { gainNecromancerLifeForce } from "./shared.js";
import { transferNecromancerSelfConditions } from "./conditions.js";
import {
  addCarapace,
  emitBuff,
  emitCondition,
  emitDamage,
  hasTrait,
} from "./shared.js";
import { isInternalCooldownReady } from "../../../platform/engine/internal-cooldown.js";
import { necromancerWeaponTaskHandlers } from "./weapons.js";
import { necromancerMinionTaskHandlers } from "./minions.js";
import {
  EXIT_IDS,
  necromancerCastAvailability,
  requiredShroud,
  validateNecromancerBuild,
} from "../mechanics/availability.js";
import type {
  NecromancerCastContext,
  NecromancerSchedulerContext,
  NecromancerSimulationEvent,
  NecromancerSkill,
} from "../types.js";

/**
 * Updates autoattack chains, flip availability, and completion-gated Core
 * life-force traits for one cast.
 *
 * @param {object} context Scheduler after-cast context.
 * @param {object} skill Completed or interrupted skill.
 * @returns {void}
 */
function updateNecromancerCastState(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
): void {
  if (context.effectiveEnd < context.fullEnd - context.epsilon) return;
  const state = professionCoreState(context);
  const chain = context.catalog.autoattackChainPositions.get(Number(skill.id));
  if (chain) {
    if (chain.next == null) {
      delete state.autoattackChains[chain.root];
    } else {
      state.autoattackChains[chain.root] = chain.next;
    }
  } else if (skill.type === "Weapon" || requiredShroud(skill)) {
    state.autoattackChains = {};
  }

  if (
    skill.flipSkillId != null &&
    skill.flipSkillId !== skill.nextChainId &&
    skill.handlerId !== "necromancer.minion"
  ) {
    const flip = context.catalog.skillsById.get(skill.flipSkillId);
    if (flip && flip.name !== skill.name && flip.flipParentId === skill.id) {
      state.availableFlips[flip.id] =
        context.rechargeStart +
        Math.max(
          1,
          Number(skill.flipDuration ?? skill.cooldown ?? skill.recharge ?? 5),
        );
    }
  }
  if (
    skill.flipParentId != null &&
    !EXIT_IDS.has(skill.id) &&
    skill.handlerId !== "necromancer.minion-command"
  ) {
    delete state.availableFlips[skill.id];
  }

  const control = (skill.effects || []).find(
    (effect) => effect.type === "control",
  );
  if (
    control?.metadata?.controlKind === "fear" &&
    hasTrait(context, TRAIT.FEAR_OF_DEATH) &&
    isInternalCooldownReady(
      context.effectiveEnd,
      Number(state.fearOfDeathReadyAt || 0),
    )
  ) {
    gainNecromancerLifeForce(
      context,
      15,
      context.effectiveEnd,
      "fear-of-death",
    );
    state.fearOfDeathReadyAt = context.effectiveEnd + 4;
  }
}

/**
 * Applies all Necromancer after-cast state transitions and trait effects, then
 * lets the profession handler finalize the skill.
 *
 * @param {object} context Scheduler after-cast context.
 * @param {object} skill Completed or interrupted skill.
 * @returns {void}
 */
function afterCast(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
): void {
  updateNecromancerCastState(context, skill);
  const state = professionCoreState(context);
  if (
    skill.type === "Heal" &&
    hasTrait(context, TRAIT.DARK_DEFENSE) &&
    context.effectiveEnd >= Number(state.traitProcReadyAt.darkDefense || 0)
  ) {
    state.traitProcReadyAt.darkDefense = context.effectiveEnd + 5;
    addCarapace(state, 10, context.effectiveEnd);
    emitBuff(context, skill, "protection", 3);
  }
  if (
    skill.categories?.includes("Signet") &&
    hasTrait(context, TRAIT.SIGNETS_OF_SUFFERING)
  ) {
    emitDamage(context, skill, 0, {
      name: "Signets of Suffering",
      source: "Trait",
      sourceId: TRAIT.SIGNETS_OF_SUFFERING,
      actorType: "effect",
      skillWeapon: "Unequipped",
      metadata: {
        flatStrikeBase: 1413,
        noCrit: true,
        damageKind: "life-steal",
      },
    });
  }
  if (
    skill.type === "Weapon" &&
    skill.weapon === "Dagger" &&
    hasTrait(context, TRAIT.OVERFLOWING_THIRST)
  ) {
    emitBuff(context, skill, "taste-for-blood", 10);
  }
  if (
    skill.type === "Heal" &&
    hasTrait(context, TRAIT.MALICIOUS_SWARM) &&
    context.effectiveEnd >= Number(state.traitProcReadyAt.maliciousSwarm || 0)
  ) {
    state.traitProcReadyAt.maliciousSwarm = context.effectiveEnd + 15;
    emitDamage(context, skill, 1, {
      name: "Lesser Signet of the Locust",
      source: "Trait",
      sourceId: TRAIT.MALICIOUS_SWARM,
      actorType: "effect",
      skillWeapon: "Unequipped",
    });
  }
  if (skill.shroudSlot === 4 && hasTrait(context, TRAIT.TRANSFUSION)) {
    emitDamage(context, skill, 1.8, {
      name: "Lesser Chilblains",
      source: "Trait",
      sourceId: TRAIT.TRANSFUSION,
      actorType: "effect",
      skillWeapon: "Unequipped",
    });
    emitCondition(context, skill, "Poisoned", 2, 4, {
      source: "Trait",
      sourceId: TRAIT.TRANSFUSION,
      actorType: "effect",
    });
    context.emit({
      type: "necromancer.chill",
      at: context.effectiveEnd,
      source: "Trait",
      sourceId: TRAIT.TRANSFUSION,
      actorType: "effect",
      skillId: skill.id,
      skillName: "Lesser Chilblains",
      duration: 2,
    });
  }
  finalizeNecromancerCast(context, skill);
}

/**
 * Reacts to newly scheduled player-damage events for Plague Sending.
 *
 * @param {object} context Scheduler event-observer context.
 * @param {object} event Newly scheduled event.
 * @returns {void}
 */
function onEventScheduled(
  context: NecromancerSchedulerContext,
  event: NecromancerSimulationEvent,
): void {
  const state = professionCoreState(context);
  if (
    event.type === "condition" &&
    event.condition === "Burning" &&
    hasTrait(context, TRAIT.NOURISHING_ASHES) &&
    event.at >= Number(state.traitProcReadyAt.nourishingAshes || 0)
  ) {
    state.traitProcReadyAt.nourishingAshes = event.at + 3;
    gainNecromancerLifeForce(context, 5, event.at, "nourishing-ashes");
  }
  if (
    !state.plagueSendingArmed ||
    event.type !== "damage" ||
    event.actorType !== "player" ||
    !(Number(event.coefficient) > 0)
  )
    return;
  const skill = event.skillId == null
    ? undefined
    : context.catalog.skillsById.get(event.skillId);
  if (!skill) return;
  if (
    Number(state.plagueSendingEntrySkillId) === Number(event.skillId)
  ) return;
  const transferred = transferNecromancerSelfConditions(
    context,
    skill,
    2,
    event.at,
    { latestApplications: true },
  );
  if (!transferred) return;
  state.plagueSendingArmed = false;
  state.plagueSendingEntrySkillId = null;
}

/**
 * Resets Gravedigger when its completed strike lands after the target crossed
 * the below-half-health threshold. This remains Core because Weaponmaster
 * Training makes greatsword available to every specialization.
 */
function onCastComplete(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
): void {
  if (skill.id !== ID.GRAVEDIGGER) return;
  const schedulerFeedback = context.config._schedulerFeedback as
    | { readonly targetBelowHalfAt?: number }
    | undefined;
  const targetBelowHalfAt = Number(schedulerFeedback?.targetBelowHalfAt);
  if (
    Number.isFinite(targetBelowHalfAt) &&
    context.effectiveEnd > targetBelowHalfAt + context.epsilon
  ) {
    context.state.cooldowns.delete(ID.GRAVEDIGGER);
  }
}

/**
 * Necromancer resource/form availability and build-validation rules.
 */
export const necromancerCastRules = Object.freeze({
  availability: {
    id: "necromancer.cast-state",
    order: 10,
    handler: necromancerCastAvailability,
  },
  validateCast: {
    id: "necromancer.build",
    order: 10,
    handler: validateNecromancerBuild,
  },
});

/**
 * Necromancer scheduler lifecycle hooks and weapon task dispatch table.
 */
export const necromancerSchedulerHooks = Object.freeze({
  advance: advanceNecromancerState,
  afterCast,
  onCastComplete,
  /**
   * Clears simulated self-conditions after a global cooldown reset.
   *
   * @param {object} context Scheduler cooldown-reset context.
   * @returns {void}
   */
  onCooldownReset: (context: NecromancerSchedulerContext): void => {
    professionCoreState(context).selfConditions = [];
  },
  onEventScheduled,
  taskHandlers: Object.freeze({
    ...necromancerWeaponTaskHandlers,
    ...necromancerMinionTaskHandlers,
  }),
});
