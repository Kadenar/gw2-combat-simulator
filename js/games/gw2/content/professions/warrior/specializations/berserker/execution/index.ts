/** Registers scheduler-phase skill activations for this module. */
import { balanceProfileFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { augmentSkillHandler } from '#gw2/platform/engine/skills/handlers.js';
import { emitSkillBuff } from '#gw2/platform/scheduler/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/content/professions/warrior/data/ids.js';
import { syncWarriorAdrenaline } from '#gw2/content/professions/warrior/core/mechanics/adrenaline-and-endurance.js';
import { applyWarriorSkillResource } from '#gw2/content/professions/warrior/resources.js';

import type { WarriorCastContext, WarriorSkill } from '#gw2/content/professions/warrior/types.js';
import { berserkerState } from '#gw2/content/professions/warrior/specializations/berserker/state.js';
import {
  applyBerserkEntryTraits,
  berserkEntryDuration
} from '#gw2/content/professions/warrior/specializations/berserker/traits/index.js';
import { BERSERKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/warrior/specializations/berserker/profiles.js';

function enterBerserk(context: WarriorCastContext, skill: WarriorSkill): void {
  applyWarriorSkillResource(context, skill);
  const core = professionCoreState(context);
  // Berserk mode collapses the three adrenaline bars into one slot of ten.
  core.maximumAdrenaline = Number(balanceProfileFromContext(context, PROFILE.resources)?.maximumStacks ?? 10);
  syncWarriorAdrenaline(context);
  const state = berserkerState.from(context);
  state.berserkActive = true;
  state.berserkUntil = context.effectiveEnd + berserkEntryDuration(context);
  // Publish the newly opened Berserk window directly through the canonical status emitter.
  emitSkillBuff(context, {
    at: context.effectiveEnd,
    source: 'Berserker',
    sourceId: ID.BERSERK,
    actorType: 'effect',
    skillId: skill.id,
    skillName: skill.name,
    name: 'Berserk',
    kind: 'berserk',
    stacks: 1,
    duration: Math.max(0, state.berserkUntil - context.effectiveEnd)
  });
  applyBerserkEntryTraits(context, skill);
}

function useBloodReckoning(context: WarriorCastContext, skill: WarriorSkill): void {
  applyWarriorSkillResource(context, skill);
  for (const candidate of context.catalog.skills) {
    if (candidate.primalBurst) context.state.cooldowns.delete(candidate.id);
  }
}

export const berserkerSkillHandlers = Object.freeze({
  'warrior.berserk': augmentSkillHandler(enterBerserk),
  'warrior.blood-reckoning': augmentSkillHandler(useBloodReckoning)
});
