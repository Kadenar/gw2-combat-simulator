import { signetOfRage } from '#gw2/professions/warrior/core/traits/index.js';
import { skillFlipReady } from '#gw2/platform/engine/skills/skill-flips.js';
import { EPSILON } from '#kernel/core/clock.js';
import { gw2CooldownReadyAt } from '#gw2/platform/skills/timing.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { selectedSkillNameSet } from '#gw2/platform/builds/selected-skills.js';
import { selectedSlotSkillAvailability } from '#gw2/professions/shared/availability.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import { warriorEnduranceReadyAt } from '#gw2/professions/warrior/core/mechanics/adrenaline-and-endurance.js';
import type { AvailabilityResult } from '#gw2/platform/execution/types.js';
import type { WarriorCastContext, WarriorSkill } from '#gw2/professions/warrior/types.js';

// Gate Warrior casts by endurance and adrenaline while projecting a retry time
// from Signet of Rage's available passive pulses; shared code owns chain order.
export function warriorCastAvailability(context: WarriorCastContext, skill: WarriorSkill): AvailabilityResult {
  const selection = selectedSlotSkillAvailability(context, skill);
  if (selection) return selection;
  const state = professionCoreState(context);
  // Tactical Blow is a one-use follow-up to a live Counterblow channel, not a standalone attack.
  if (skill.id === ID.TACTICAL_BLOW && !skillFlipReady(state.availableFlips[ID.TACTICAL_BLOW], context.start)) {
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
    const nextPulseAt = signetOfRage.nextAt(context);
    let passiveReadyAt: number | null = null;
    if (selected.has('Signet of Rage') && Number.isFinite(nextPulseAt) && nextPulseAt > context.start) {
      const skippedPulses = Math.max(0, Math.ceil((signetCooldown - nextPulseAt - EPSILON) / 3));
      // Passive adrenaline funds the queued skill on the tick that detects the final required pulse.
      passiveReadyAt = gw2CooldownReadyAt(nextPulseAt + (skippedPulses + passivePulses - 1) * 3);
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
