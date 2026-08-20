import { professionCoreState } from '../../../platform/engine/profession.js';
import { WARRIOR_SKILL_IDS as ID } from '../data/ids.js';
import { warriorEnduranceReadyAt } from './resources.js';
import type { AvailabilityResult } from '../../../platform/engine/types.js';
import type { WarriorCastContext, WarriorSkill } from '../types.js';

export function warriorCastAvailability(context: WarriorCastContext, skill: WarriorSkill): AvailabilityResult {
  const state = professionCoreState(context);
  if (skill.id === ID.DODGE) {
    return state.endurance + context.epsilon >= 50
      ? { ready: true }
      : {
          ready: false,
          retryAt: warriorEnduranceReadyAt(context, 50),
          code: 'warrior.endurance',
          reason: 'Dodge requires 50 endurance.'
        };
  }

  const chain = context.catalog.autoattackChainPositions.get(Number(skill.id));
  if (chain) {
    const expected = state.autoattackChains[chain.root] || chain.root;
    if (expected !== skill.id) {
      const expectedSkill = context.catalog.skillsById.get(expected);
      return {
        ready: false,
        retryAt: null,
        code: 'warrior.autoattack-chain',
        reason: `Cast ${expectedSkill?.name || 'the earlier chain skill'} first.`
      };
    }
  }

  const cost = Number(skill.adrenalineCost || 0);
  if (cost > Number(state.adrenaline || 0) + context.epsilon) {
    const selectedSkills = context.config.selectedSkills || [];
    const selected = Array.isArray(selectedSkills) ? selectedSkills : Object.values(selectedSkills);
    const missing = cost - Number(state.adrenaline || 0);
    const passivePulses = Math.ceil(missing / 2);
    const signetCooldown = Number(context.state.cooldowns.get(ID.SIGNET_OF_RAGE) || 0);
    let passiveReadyAt: number | null = null;
    if (selected.map(String).includes('Signet of Rage') && state.signetOfRageNextAt > context.start) {
      const skippedPulses = Math.max(0, Math.ceil((signetCooldown - state.signetOfRageNextAt - context.epsilon) / 3));
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
