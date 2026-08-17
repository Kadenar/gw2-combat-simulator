import { augmentSkillHandler } from "../../../../platform/engine/skill-handlers.js";
import { professionCoreState } from "../../../../platform/engine/profession.js";
import {
  applyWarriorSkillResource,
  syncWarriorAdrenaline,
} from "../../core/resources.js";
import { warriorBalanceProfile } from "../../core/profiles.js";
import type { WarriorCastContext, WarriorSkill } from "../../types.js";
import { emitBerserkMarker } from "./mechanics.js";
import { berserkerState } from "./state.js";
import { applyBerserkEntryTraits, berserkEntryDuration } from "./traits.js";
import { BERSERKER_BALANCE_PROFILE_IDS as PROFILE } from "./profiles.js";

function enterBerserk(context: WarriorCastContext, skill: WarriorSkill): void {
  applyWarriorSkillResource(context, skill);
  const core = professionCoreState(context);
  // Berserk mode collapses the three adrenaline bars into one slot of ten.
  core.maximumAdrenaline = Number(
    warriorBalanceProfile(context, PROFILE.resources)?.maximumStacks ?? 10,
  );
  syncWarriorAdrenaline(context);
  const state = berserkerState.from(context);
  state.berserkActive = true;
  state.berserkUntil = context.effectiveEnd + berserkEntryDuration(context);
  emitBerserkMarker(context, skill);
  applyBerserkEntryTraits(context, skill);
}

function useBloodReckoning(
  context: WarriorCastContext,
  skill: WarriorSkill,
): void {
  applyWarriorSkillResource(context, skill);
  for (const candidate of context.catalog.skills) {
    if (candidate.primalBurst) context.state.cooldowns.delete(candidate.id);
  }
}

export const berserkerSkillHandlers = Object.freeze({
  "warrior.berserk": augmentSkillHandler(enterBerserk),
  "warrior.blood-reckoning": augmentSkillHandler(useBloodReckoning),
});
