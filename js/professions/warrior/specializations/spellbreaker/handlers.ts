import { augmentSkillHandler } from '../../../../platform/engine/skill-handlers.js';
import { applyWarriorSkillResource } from '../../core/resources.js';
import { warriorBalanceProfile, warriorBalanceProfileEffect } from '../../core/profiles.js';
import { SPELLBREAKER_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';
import { spellbreakerState } from './state.js';
import type { WarriorCastContext, WarriorSkill } from '../../types.js';

function fullCounter(context: WarriorCastContext, skill: WarriorSkill): void {
  applyWarriorSkillResource(context, skill);
  const effect = warriorBalanceProfileEffect(warriorBalanceProfile(context, PROFILE.fullCounter), 'buff');
  spellbreakerState.from(context).fullCounterActiveUntil = context.effectiveEnd + Number(effect?.duration ?? 1);
}

export const spellbreakerSkillHandlers = Object.freeze({
  'warrior.full-counter': augmentSkillHandler(fullCounter)
});
