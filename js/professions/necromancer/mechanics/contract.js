import {
  NECROMANCER_AUTOATTACK_CHAINS,
} from "./autoattack-chains.js";
import {
  NECROMANCER_SKILL_IDS as ID,
  NECROMANCER_TRAIT_IDS as TRAIT,
} from "../data/ids.js";
import {
  advanceNecromancerState,
  finalizeNecromancerCast,
  gainNecromancerLifeForce,
} from "./handlers.js";

const ENTRY_SHROUD_BY_ID = Object.freeze({
  [ID.DEATH_SHROUD]: "death",
  [ID.REAPERS_SHROUD]: "reaper",
  [ID.HARBINGER_SHROUD]: "harbinger",
  [ID.RITUALISTS_SHROUD]: "ritualist",
});
const EXIT_IDS = new Set([
  ID.END_DEATH_SHROUD,
  ID.EXIT_REAPERS_SHROUD,
  ID.EXIT_HARBINGER_SHROUD,
  ID.EXIT_RITUALISTS_SHROUD,
]);
const LICH_SKILL_IDS = new Set([
  ID.DEATHLY_CLAWS,
  ID.LICHS_GAZE,
  ID.RIPPLE_OF_HORROR,
  ID.MARCH_OF_UNDEATH,
  ID.SUMMON_MADNESS,
  ID.GRIM_SPECTER,
  ID.EXIT_LICH_FORM,
]);
const SHROUD_FOR_SPECIALIZATION = Object.freeze({
  Core: "death",
  Reaper: "reaper",
  Harbinger: "harbinger",
  Ritualist: "ritualist",
});
const INNERVATE_SPIRIT = new Map([
  [ID.INNERVATE_ANGUISH, "anguish"],
  [ID.INNERVATE_WANDERLUST, "wanderlust"],
  [ID.INNERVATE_PRESERVATION, "preservation"],
]);
const CHAIN_POSITION_BY_ID = new Map();
for (const chain of NECROMANCER_AUTOATTACK_CHAINS) {
  chain.forEach((skillId, index) => {
    CHAIN_POSITION_BY_ID.set(skillId, {
      root: chain[0],
      next: chain[index + 1] ?? null,
    });
  });
}

function hasTrait(context, id) {
  if (context.traits?.has(id) || context.traits?.has(String(id))) return true;
  return [
    ...(context.config?.traitIds || []),
    ...(context.config?.selectedTraitIds || []),
    ...(context.config?.selectedTraits || []),
  ].some(value => value === id || String(value) === String(id));
}

function specialization(context) {
  return context.config?.specialization || "Core";
}

function requiredShroud(skill) {
  return String(skill.shroud || "");
}

function validateNecromancerCast(context, skill) {
  if (!skill.implemented || skill.simulatorExcluded) return false;
  const state = context.state.profession;
  const activeShroud = String(state.activeShroud || "");
  const spec = specialization(context);

  if (skill.specialization && skill.specialization !== spec) return false;
  if (skill.id === ID.DEVOURING_DARKNESS) {
    return hasTrait(context, TRAIT.LINGERING_CURSE) && !activeShroud;
  }
  if (
    skill.id === ID.FEAST_OF_CORRUPTION
    && hasTrait(context, TRAIT.LINGERING_CURSE)
  ) return false;
  if (skill.id === ID.SANDSTORM_SHROUD) {
    if (!hasTrait(context, TRAIT.HERALD_OF_SORROW)) return false;
  }
  if (
    skill.id === ID.DESERT_SHROUD
    && hasTrait(context, TRAIT.HERALD_OF_SORROW)
  ) return false;
  if (ENTRY_SHROUD_BY_ID[skill.id]) {
    if (activeShroud) return false;
    const expected = SHROUD_FOR_SPECIALIZATION[spec] || "death";
    if (ENTRY_SHROUD_BY_ID[skill.id] !== expected) return false;
    return (
      spec === "Harbinger"
      || Number(state.lifeForce || 0) >= 10
    );
  }
  if (EXIT_IDS.has(skill.id)) {
    return activeShroud === requiredShroud(
      context.catalog.skillsById.get(skill.flipParentId),
    ) || Number(state.availableFlips[skill.id] || 0) > context.start;
  }
  if (skill.id === ID.LICH_FORM) return !activeShroud;
  if (LICH_SKILL_IDS.has(skill.id)) return activeShroud === "lich";
  if (requiredShroud(skill)) {
    if (activeShroud !== requiredShroud(skill)) return false;
    const chain = CHAIN_POSITION_BY_ID.get(skill.id);
    if (!chain) return true;
    const expected = state.autoattackChains[chain.root] || chain.root;
    return expected === skill.id;
  }
  const spirit = INNERVATE_SPIRIT.get(skill.id);
  if (spirit) {
    return (
      activeShroud === "ritualist"
      && Boolean(state.activeSpirits?.[spirit])
    );
  }
  if (activeShroud) return false;
  if (
    skill.lifeForceCost
    && Number(state.lifeForce || 0) < Number(skill.lifeForceCost)
  ) return false;
  if (
    skill.flipParentId != null
    && !(Number(state.availableFlips[skill.id] || 0) > context.start)
  ) return false;
  const chain = CHAIN_POSITION_BY_ID.get(skill.id);
  if (chain) {
    const expected = state.autoattackChains[chain.root] || chain.root;
    if (expected !== skill.id) return false;
  }
  return true;
}

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
    && context.effectiveEnd >= Number(state.fearOfDeathReadyAt || 0)
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
    && context.effectiveEnd >= Number(state.traitProcReadyAt.chillingVictory || 0)
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
  validateCast: validateNecromancerCast,
});

export const necromancerSchedulerHooks = Object.freeze({
  advance: advanceNecromancerState,
  afterCast,
});
