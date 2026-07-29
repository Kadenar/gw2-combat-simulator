import {
  THIEF_SKILL_IDS as ID,
  THIEF_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import { hasThiefTrait } from "../../state.js";
import { pilferArtifacts } from "./artifacts.js";
import {
  emitThiefCondition,
  emitThiefState,
  gainThiefEndurance,
  gainThiefInitiative,
} from "./shared.js";

const STOLEN_ID_BY_CHOICE = Object.freeze({
  "throw-gunk": ID.THROW_GUNK,
  "consume-plasma": ID.CONSUME_PLASMA,
  "whirling-axe": ID.WHIRLING_AXE,
});
const DEADEYE_STOLEN_ID_BY_CHOICE = Object.freeze({
  "steal-time": ID.STEAL_TIME,
  "steal-warmth": ID.STEAL_WARMTH,
  "steal-resistance": ID.STEAL_RESISTANCE,
  "steal-precision": ID.STEAL_PRECISION,
  "steal-health": ID.STEAL_HEALTH,
  "steal-strength": ID.STEAL_STRENGTH,
  "steal-durability": ID.STEAL_DURABILITY,
  "steal-defenses": ID.STEAL_DEFENSES,
  "steal-mobility": ID.STEAL_MOBILITY,
});

function selectedStolenSkill(context) {
  const specialization = String(context.config.specialization || "Core");
  if (specialization === "Deadeye") {
    const choice =
      context.config.deterministicChoices?.deadeyeStolenSkillChoice
      || "steal-time";
    return DEADEYE_STOLEN_ID_BY_CHOICE[choice] || ID.STEAL_TIME;
  }
  if (!["Core", "Daredevil"].includes(specialization)) return null;
  const choice =
    context.config.deterministicChoices?.stolenSkillChoice
    || "throw-gunk";
  return STOLEN_ID_BY_CHOICE[choice] || ID.THROW_GUNK;
}

export function emitStealTraitEffects(context) {
  const at = context.effectiveEnd;
  if (hasThiefTrait(context.config, TRAIT.SERPENTS_TOUCH)) {
    emitThiefCondition(context, {
      at,
      condition: "Poisoned",
      duration: 6,
      stacks: 2,
      sourceId: TRAIT.SERPENTS_TOUCH,
      name: "Serpent's Touch — Poison",
    });
  }
  if (hasThiefTrait(context.config, TRAIT.EVEN_THE_ODDS)) {
    emitThiefCondition(context, {
      at,
      condition: "Vulnerability",
      duration: 10,
      stacks: 5,
      sourceId: TRAIT.EVEN_THE_ODDS,
      name: "Even the Odds — Vulnerability",
    });
  }
  if (hasThiefTrait(context.config, TRAIT.DEADLY_AMBUSH)) {
    emitThiefCondition(context, {
      at,
      condition: "Bleeding",
      duration: 8,
      stacks: 3,
      sourceId: TRAIT.DEADLY_AMBUSH,
      name: "Deadly Ambush — Bleeding",
    });
  }
}

export function completeSteal(context, skill) {
  const state = context.state.profession;
  const at = context.effectiveEnd;
  state.storedStolenSkillId = selectedStolenSkill(context);
  if (skill.id === ID.DEADEYES_MARK) {
    state.markedTargetId = "primary-target";
    state.malice = hasThiefTrait(
      context.config,
      TRAIT.MALICIOUS_INTENT,
    ) ? 1 : 0;
    state.maleficentSevenTriggered = false;
  }
  if (skill.id === ID.SIPHON) {
    state.shadowForce = Math.min(
      state.maximumShadowForce,
      state.shadowForce + (
        hasThiefTrait(context.config, TRAIT.AMPLIFIED_SIPHONING)
          ? 35
          : 25
      ),
    );
  }
  if (hasThiefTrait(context.config, TRAIT.KLEPTOMANIAC)) {
    gainThiefInitiative(context, 2, at, "kleptomaniac");
  }
  if (hasThiefTrait(context.config, TRAIT.ENDURANCE_THIEF)) {
    gainThiefEndurance(context, 25, at, "endurance-thief");
  }
  emitThiefState(context, at, "steal");
}

export function completeSkrittSwipe(context) {
  const at = context.effectiveEnd;
  pilferArtifacts(context, at);
  if (hasThiefTrait(context.config, TRAIT.KLEPTOMANIAC)) {
    gainThiefInitiative(context, 2, at, "kleptomaniac");
  }
}

export function consumeStoredStolenSkill(context) {
  context.state.profession.storedStolenSkillId = null;
  emitThiefState(context, context.effectiveEnd, "stolen-skill-used");
}
