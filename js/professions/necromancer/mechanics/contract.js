import {
  NECROMANCER_SKILL_IDS as ID,
  NECROMANCER_TRAIT_IDS as TRAIT,
} from "../data/ids.js";
import {
  advanceNecromancerState,
  finalizeNecromancerCast,
  gainNecromancerLifeForce,
} from "./specific/handlers.js";
import {
  transferNecromancerSelfConditions,
} from "./specific/conditions.js";
import {
  addCarapace,
  emitBuff,
  emitCondition,
  emitDamage,
} from "./specific/shared.js";
import {
  isInternalCooldownReady,
} from "../../../platform/engine/internal-cooldown.js";
import {
  necromancerWeaponTaskHandlers,
} from "./specific/weapons.js";
import {
  CHAIN_POSITION_BY_ID,
  EXIT_IDS,
  hasTrait,
  necromancerCastAvailability,
  requiredShroud,
  validateNecromancerBuild,
} from "./availability.js";

function reduceReaperShroudCooldowns(context, at) {
  for (const candidate of context.catalog.skills || []) {
    if (candidate.shroud !== "reaper") continue;
    const readyAt = Number(context.state.cooldowns.get(candidate.id) || 0);
    if (!(readyAt > at + context.epsilon)) continue;
    const reduced = Math.max(at, readyAt - 1);
    if (reduced <= at + context.epsilon) {
      context.state.cooldowns.delete(candidate.id);
    } else {
      context.state.cooldowns.set(candidate.id, reduced);
    }
  }
}

function updateNecromancerCastState(context, skill) {
  if (
    skill.id === ID.LIFE_REAP
    && hasTrait(context, TRAIT.REAPERS_ONSLAUGHT)
  ) {
    // Life Reap lands halfway through its activation. Its hit still commits
    // when the trailing aftercast is cancelled, as in the benchmark rotation.
    const hitAt = context.start + (context.fullEnd - context.start) / 2;
    if (context.effectiveEnd >= hitAt - context.epsilon) {
      reduceReaperShroudCooldowns(context, hitAt);
    }
  }
  if (context.effectiveEnd < context.fullEnd - context.epsilon) return;
  const state = context.state.profession;
  const chain = CHAIN_POSITION_BY_ID.get(skill.id);
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
    skill.flipSkillId != null
    && skill.flipSkillId !== skill.nextChainId
  ) {
    const flip = context.catalog.skillsById.get(skill.flipSkillId);
    if (flip && flip.name !== skill.name && flip.flipParentId === skill.id) {
      state.availableFlips[flip.id] =
        context.rechargeStart
        + Math.max(
          1,
          Number(
            skill.flipDuration
            ?? skill.cooldown
            ?? skill.recharge
            ?? 5,
          ),
        );
    }
  }
  if (skill.flipParentId != null && !EXIT_IDS.has(skill.id)) {
    delete state.availableFlips[skill.id];
  }

  const control = (skill.effects || []).find(effect =>
    effect.type === "control");
  if (
    control?.metadata?.controlKind === "fear"
    && hasTrait(context, TRAIT.FEAR_OF_DEATH)
    && isInternalCooldownReady(
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
  if (
    hasTrait(context, TRAIT.CHILLING_VICTORY)
    && requiredShroud(skill) === "reaper"
    && isInternalCooldownReady(
      context.effectiveEnd,
      Number(state.traitProcReadyAt.chillingVictory || 0),
    )
    && context.config?.target?.conditions?.Chilled
  ) {
    gainNecromancerLifeForce(
      context,
      1,
      context.effectiveEnd,
      "chilling-victory",
    );
    state.traitProcReadyAt.chillingVictory = context.effectiveEnd + 1;
  }
}

function afterCast(context, skill) {
  updateNecromancerCastState(context, skill);
  if (
    skill.id === ID.DARK_BARRAGE &&
    hasTrait(context, TRAIT.DEATHLY_HASTE)
  ) {
    context.emit({
      type: "buff",
      at: context.effectiveEnd,
      source: "Trait",
      sourceId: TRAIT.DEATHLY_HASTE,
      actorType: "player",
      skillId: skill.id,
      skillName: skill.name,
      kind: "quickness",
      duration: 4,
      stacks: 1,
    });
    context.emit({
      type: "buff",
      at: context.effectiveEnd,
      source: "Trait",
      sourceId: TRAIT.DEATHLY_HASTE,
      actorType: "player",
      skillId: skill.id,
      skillName: skill.name,
      kind: "fury",
      duration: 4,
      stacks: 1,
    });
  }
  const state = context.state.profession;
  if (
    skill.type === "Heal" &&
    hasTrait(context, TRAIT.DARK_DEFENSE) &&
    context.effectiveEnd >=
      Number(state.traitProcReadyAt.darkDefense || 0)
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
    skill.categories?.includes("Shout") &&
    hasTrait(context, TRAIT.AUGURY_OF_DEATH)
  ) {
    emitDamage(context, skill, 0, {
      name: "Augury of Death",
      source: "Trait",
      sourceId: TRAIT.AUGURY_OF_DEATH,
      actorType: "effect",
      skillWeapon: "Unequipped",
      metadata: {
        flatStrikeBase: 276,
        flatStrikePowerCoeff: 0.02,
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
    context.effectiveEnd >=
      Number(state.traitProcReadyAt.maliciousSwarm || 0)
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
  if (
    skill.shroudSlot === 4 &&
    hasTrait(context, TRAIT.TRANSFUSION)
  ) {
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

function onEventScheduled(context, event) {
  const state = context.state.profession;
  if (
    event.type === "condition" &&
    event.condition === "Burning" &&
    hasTrait(context, TRAIT.NOURISHING_ASHES) &&
    event.at >= Number(state.traitProcReadyAt.nourishingAshes || 0)
  ) {
    state.traitProcReadyAt.nourishingAshes = event.at + 3;
    gainNecromancerLifeForce(
      context,
      5,
      event.at,
      "nourishing-ashes",
    );
  }
  if (
    event.type === "buff" &&
    event.actorType === "player" &&
    event.kind !== "target-vulnerability" &&
    hasTrait(context, TRAIT.BLIGHTERS_BOON)
  ) {
    gainNecromancerLifeForce(
      context,
      1,
      event.at,
      "blighters-boon",
    );
  }
  if (
    !state.plagueSendingArmed ||
    event.type !== "damage" ||
    event.actorType !== "player" ||
    !(Number(event.coefficient) > 0)
  ) return;
  const skill = context.catalog.skillsById.get(event.skillId);
  if (!skill) return;
  state.plagueSendingArmed = false;
  transferNecromancerSelfConditions(context, skill, 2, event.at);
}

function onCastComplete(context, skill) {
  if (skill.id !== ID.GRAVEDIGGER) return;
  const targetBelowHalfAt = Number(
    context.config._schedulerFeedback?.targetBelowHalfAt,
  );
  // The threshold timestamp is the packet that pushed the target below 50%.
  // Gravedigger must land after it, because its own hit checks pre-hit health.
  if (
    Number.isFinite(targetBelowHalfAt)
    && context.effectiveEnd > targetBelowHalfAt + context.epsilon
  ) {
    context.state.cooldowns.delete(ID.GRAVEDIGGER);
  }
}

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

export const necromancerSchedulerHooks = Object.freeze({
  advance: advanceNecromancerState,
  afterCast,
  onCastComplete,
  onEventScheduled,
  taskHandlers: necromancerWeaponTaskHandlers,
});
