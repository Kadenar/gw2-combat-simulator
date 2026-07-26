import { enqueueOrdered } from "../../platform/engine/event-queue.js";
import {
  NECROMANCER_AUTOATTACK_CHAINS,
} from "./mechanics/autoattack-chains.js";
import {
  NECROMANCER_SKILL_IDS as ID,
  NECROMANCER_TRAIT_IDS as TRAIT,
} from "./data/ids.js";
import {
  advanceNecromancerState,
  finalizeNecromancerCast,
  gainNecromancerLifeForce,
  handleNecromancerChillEvent,
  handleNecromancerStateEvent,
  handleNecromancerSummonAttack,
} from "./mechanics/handlers.js";
import { hasNecromancerTrait } from "./state.js";

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

function hasTrait(context, traitId) {
  return hasNecromancerTrait(new Set([
    ...(context.traits || []),
    ...(context.config?.traitIds || []),
    ...(context.config?.selectedTraitIds || []),
    ...(context.config?.selectedTraits || []),
  ]), traitId);
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

function queueTraitDamage(context, event, {
  name,
  traitId,
  flatStrikeBase,
  flatStrikePowerCoeff,
}) {
  enqueueOrdered(context.queue, {
    type: "damage",
    at: event.at,
    name,
    skillName: name,
    coefficient: 0,
    flatStrikeBase,
    flatStrikePowerCoeff,
    hits: 1,
    hitIndex: 1,
    totalHits: 1,
    source: "Trait",
    sourceId: traitId,
    actorType: "effect",
    skillWeapon: "Unequipped",
    noCrit: true,
    damageKind: "life-steal",
    triggeredBy: event.skillName,
  });
  context.recordProc?.("trait", name, event.at, event.skillName);
}

function applyTraitCondition(details, context, event, {
  name,
  traitId,
  condition,
  stacks = 1,
  duration,
}) {
  const application = {
    type: "condition",
    at: event.at,
    name: `${name} — ${condition}`,
    skillName: name,
    condition,
    stacks,
    duration,
    source: "Trait",
    sourceId: traitId,
    actorType: "effect",
    triggeredBy: event.skillName,
  };
  if (details.applyCondition) {
    details.applyCondition(context, application);
  } else {
    enqueueOrdered(context.queue, application);
  }
  context.recordProc?.("trait", name, event.at, event.skillName);
}

function reactToNecromancerDamage(context, event, details = {}) {
  if (event.actorType === "effect" || !(Number(event.coefficient) > 0)) {
    return;
  }
  const skill = context.helpers.skillsById?.get(event.skillId);
  if (
    hasTrait(context, TRAIT.DHUUMFIRE)
    && skill?.shroudSlot === 1
  ) {
    applyTraitCondition(details, context, event, {
      name: "Dhuumfire",
      traitId: TRAIT.DHUUMFIRE,
      condition: "Burning",
      duration: 3,
    });
  }
  if (hasTrait(context, TRAIT.BARBED_PRECISION)) {
    context.profession.barbedPrecisionProgress +=
      Number(details.hitContext?.critical?.chance || 0) * 0.33;
    while (context.profession.barbedPrecisionProgress >= 1) {
      context.profession.barbedPrecisionProgress -= 1;
      applyTraitCondition(details, context, event, {
        name: "Barbed Precision",
        traitId: TRAIT.BARBED_PRECISION,
        condition: "Bleeding",
        duration: 2,
      });
    }
  }
  if (
    hasTrait(context, TRAIT.VAMPIRIC_PRESENCE)
    && event.at >= Number(context.profession.vampiricPresenceReadyAt || 0)
  ) {
    context.profession.vampiricPresenceReadyAt = event.at + 1;
    queueTraitDamage(context, event, {
      name: "Vampiric Presence",
      traitId: TRAIT.VAMPIRIC_PRESENCE,
      flatStrikeBase: 80,
      flatStrikePowerCoeff: 0.03,
    });
  }
}

function reactToNecromancerCondition(context, event, details = {}) {
  if (
    event.condition === "Torment"
    && hasTrait(context, TRAIT.DEMONIC_LORE)
    && event.at >= Number(context.profession.demonicLoreReadyAt || 0)
  ) {
    context.profession.demonicLoreReadyAt = event.at + 3;
    applyTraitCondition(details, context, event, {
      name: "Demonic Lore",
      traitId: TRAIT.DEMONIC_LORE,
      condition: "Burning",
      duration: 3,
    });
  }
  if (
    event.condition === "Chilled"
    && hasTrait(context, TRAIT.DEATHLY_CHILL)
  ) {
    applyTraitCondition(details, context, event, {
      name: "Deathly Chill",
      traitId: TRAIT.DEATHLY_CHILL,
      condition: "Bleeding",
      stacks: 3,
      duration: 8,
    });
  }
}

function reactToNecromancerBlind(context, event, details = {}) {
  if (!hasTrait(context, TRAIT.CHILLING_DARKNESS)) return;
  applyTraitCondition(details, context, event, {
    name: "Chilling Darkness",
    traitId: TRAIT.CHILLING_DARKNESS,
    condition: "Chilled",
    duration: 2,
  });
}

function reactToNecromancerControl(context, event, details = {}) {
  if (
    event.controlKind === "fear"
    || event.kind === "fear"
  ) {
    context.profession.dreadUntil = Math.max(
      Number(context.profession.dreadUntil || 0),
      event.at + 3,
    );
  }
  if (hasTrait(context, TRAIT.INSIDIOUS_DISRUPTION)) {
    applyTraitCondition(details, context, event, {
      name: "Insidious Disruption",
      traitId: TRAIT.INSIDIOUS_DISRUPTION,
      condition: "Torment",
      duration: 8,
    });
  }
}

export const necromancerCastRules = Object.freeze({
  validateCast: validateNecromancerCast,
});

export const necromancerSchedulerHooks = Object.freeze({
  advance: advanceNecromancerState,
  afterCast,
});

export const necromancerResolverHooks = Object.freeze({
  eventHandlers: Object.freeze({
    "necromancer.state": handleNecromancerStateEvent,
    "necromancer.chill": handleNecromancerChillEvent,
    "necromancer.summon-attack": handleNecromancerSummonAttack,
  }),
  eventReactions: Object.freeze({
    damage: reactToNecromancerDamage,
    condition: reactToNecromancerCondition,
    blind: reactToNecromancerBlind,
    control: reactToNecromancerControl,
  }),
});
