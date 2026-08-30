/** Registers scheduler-phase skill activations for this module. */
import { augmentSkillHandler } from '#gw2/platform/engine/skills/handlers.js';
import { applyWarriorSkillResource } from '#gw2/content/professions/warrior/resources.js';
import { warriorBalanceProfile, warriorBalanceProfileEffect } from '#gw2/content/professions/warrior/core/profiles.js';
import { SPELLBREAKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/warrior/specializations/spellbreaker/profiles.js';
import { spellbreakerState } from '#gw2/content/professions/warrior/specializations/spellbreaker/state.js';
import type { WarriorCastContext, WarriorSkill } from '#gw2/content/professions/warrior/types.js';

function fullCounter(context: WarriorCastContext, skill: WarriorSkill): void {
  applyWarriorSkillResource(context, skill);
  const effect = warriorBalanceProfileEffect(warriorBalanceProfile(context, PROFILE.fullCounter), 'buff');
  spellbreakerState.from(context).fullCounterActiveUntil = context.effectiveEnd + Number(effect?.duration ?? 1);
}

export const spellbreakerSkillHandlers = Object.freeze({
  'warrior.full-counter': augmentSkillHandler(fullCounter)
});
