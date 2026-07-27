import {
  NECROMANCER_TRAIT_IDS as TRAIT,
} from "../data/ids.js";
import {
  advanceNecromancerState,
  finalizeNecromancerCast,
  gainNecromancerLifeForce,
} from "./specific/handlers.js";
import {
  isInternalCooldownReady,
} from "../../../platform/engine/internal-cooldown.js";
import {
  CHAIN_POSITION_BY_ID,
  EXIT_IDS,
  hasTrait,
  necromancerCastAvailability,
  requiredShroud,
  validateNecromancerBuild,
} from "./availability.js";

function updateNecromancerCastState(context, skill) {
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
        context.effectiveEnd
        + Math.max(1, Number(skill.cooldown || skill.recharge || 5));
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
  finalizeNecromancerCast(context, skill);
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
});
