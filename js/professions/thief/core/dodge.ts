import { professionCoreState } from '../../../platform/engine/profession/state.js';
import { emitStateSnapshot } from '../../../platform/engine/events/state-snapshots.js';
import { emitSkillCondition } from '../../../platform/gw2/scheduler/skill-events.js';
import { THIEF_TRAIT_IDS as TRAIT } from '../data/ids.js';
import { snapshotThiefState } from './state.js';
import { hasThiefTrait } from './state.js';
import { gainThiefInitiative } from './shared.js';
import type { ThiefCastContext } from '../types.js';
import {
  thiefBalanceProfile,
  thiefBalanceProfileEffect,
  THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE
} from './profiles.js';

// Spend endurance at dodge start and materialize Uncatchable's delayed Lesser
// Caltrops pulses from the selected balance profile.
export function performThiefDodge(context: ThiefCastContext): void {
  const state = professionCoreState(context);
  const resources = thiefBalanceProfile(context, PROFILE.resources);
  state.endurance = Math.max(0, state.endurance - Number(resources?.resourceCost || 50));
  emitStateSnapshot(context, 'thief', context.start, 'dodge', snapshotThiefState(context.state.profession));
  if (hasThiefTrait(context.config, TRAIT.UNCATCHABLE)) {
    const profile = thiefBalanceProfile(context, PROFILE.uncatchable);
    const bleeding = thiefBalanceProfileEffect(profile, 'condition', 0);
    const crippled = thiefBalanceProfileEffect(profile, 'condition', 1);
    const applications = Math.max(0, Number(bleeding?.applications || 3));
    for (let pulse = 0; pulse < applications; pulse += 1) {
      const at = context.start + Number(profile?.initialDelay || 0.8) + pulse * Number(profile?.pulseInterval || 1);
      emitSkillCondition(context, {
        at,
        source: 'Trait',
        actorType: 'player',
        skillId: context.skill?.id ?? null,
        skillName: context.skill?.name ?? null,
        condition: String(bleeding?.condition || 'Bleeding'),
        duration: Number(bleeding?.duration || 5),
        stacks: Number(bleeding?.stacks || 1),
        sourceId: TRAIT.UNCATCHABLE,
        name: 'Uncatchable — Lesser Caltrops'
      });
      emitSkillCondition(context, {
        at,
        source: 'Trait',
        actorType: 'player',
        skillId: context.skill?.id ?? null,
        skillName: context.skill?.name ?? null,
        condition: String(crippled?.condition || 'Crippled'),
        duration: Number(crippled?.duration || 1),
        stacks: Number(crippled?.stacks || 1),
        sourceId: TRAIT.UNCATCHABLE,
        name: 'Uncatchable — Lesser Caltrops'
      });
    }
  }
}

// Grant Upper Hand's initiative at dodge completion only when its independent
// cooldown is ready.
export function completeThiefDodge(context: ThiefCastContext): void {
  if (!hasThiefTrait(context.config, TRAIT.UPPER_HAND)) return;
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  const profile = thiefBalanceProfile(context, PROFILE.upperHand);
  const readyAt = Number(state.traitProcReadyAt[TRAIT.UPPER_HAND] || 0);
  if (at + Number(context.epsilon || 0.0001) < readyAt) return;
  state.traitProcReadyAt[TRAIT.UPPER_HAND] = at + Number(profile?.internalCooldown || 2);
  gainThiefInitiative(context, Number(profile?.resourceGain || 1), at, 'upper-hand');
}
