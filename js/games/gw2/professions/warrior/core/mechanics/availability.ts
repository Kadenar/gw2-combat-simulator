import { EPSILON } from '#kernel/core/clock.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { selectedSkillNameSet } from '#gw2/platform/builds/selected-skills.js';
import { selectedSlotSkillAvailability } from '#gw2/professions/shared/availability.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import { warriorEnduranceReadyAt } from '#gw2/professions/warrior/core/mechanics/adrenaline-and-endurance.js';
import type { AvailabilityResult } from '#gw2/platform/engine/execution/types.js';
import type { WarriorCastContext, WarriorSkill } from '#gw2/professions/warrior/types.js';

// Gate Warrior casts by endurance and adrenaline while projecting a retry time
// from Signet of Rage's available passive pulses; shared code owns chain order.
export function warriorCastAvailability(context: WarriorCastContext, skill: WarriorSkill): AvailabilityResult {
  const selection = selectedSlotSkillAvailability(context, skill);
  if (selection) return selection;
  const state = professionCoreState(context);
  // Tactical Blow is a one-use follow-up to a live Counterblow channel, not a standalone attack.
  if (skill.id === ID.TACTICAL_BLOW && Number(state.availableFlips[ID.TACTICAL_BLOW] || 0) <= context.start) {
    return {
      ready: false,
      retryAt: null,
      reason: 'Tactical Blow requires an active Counterblow.',
      code: 'warrior.counterblow'
    };
  }

  if (skill.id === ID.DODGE) {
    return state.endurance + EPSILON >= 50
      ? { ready: true }
      : {
          ready: false,
          retryAt: warriorEnduranceReadyAt(context, 50),
          code: 'warrior.endurance',
          reason: 'Dodge requires 50 endurance.'
        };
  }

  const cost = Number(skill.adrenalineCost || 0);
  if (cost > Number(state.adrenaline || 0) + EPSILON) {
    const selected = selectedSkillNameSet(context.config.selectedSkills);
    const missing = cost - Number(state.adrenaline || 0);
    const passivePulses = Math.ceil(missing / 2);
    const signetCooldown = Number(context.state.cooldowns.get(ID.SIGNET_OF_RAGE) || 0);
    let passiveReadyAt: number | null = null;
    if (selected.has('Signet of Rage') && state.signetOfRageNextAt > context.start) {
      const skippedPulses = Math.max(0, Math.ceil((signetCooldown - state.signetOfRageNextAt - EPSILON) / 3));
      passiveReadyAt = state.signetOfRageNextAt + (skippedPulses + passivePulses - 1) * 3;
    }

    return {
      ready: false,
      retryAt: passiveReadyAt,
      code: 'warrior.adrenaline',
      reason: `${skill.name} requires ${cost} adrenaline.`
    };
  }

  return { ready: true };
}
