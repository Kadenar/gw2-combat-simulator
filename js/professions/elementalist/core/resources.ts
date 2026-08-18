import type { ElementalistSchedulerContext } from '../types.js';
import type { ElementalistCoreState } from './state.js';
import { ENDURANCE_PER_SECOND } from './constants.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE, elementalistBalanceValue } from './profiles.js';

export function updateEndurance(
  context: ElementalistSchedulerContext,
  state: ElementalistCoreState,
  at: number,
  vigor: boolean
): void {
  const elapsed = Math.max(0, at - state.enduranceUpdatedAt);
  const maximum = elementalistBalanceValue(context, PROFILE.resources, 'maximumStacks', 100);
  const regeneration = elementalistBalanceValue(
    context,
    PROFILE.resources,
    'enduranceRegenerationPerSecond',
    ENDURANCE_PER_SECOND
  );
  const vigorMultiplier = elementalistBalanceValue(context, PROFILE.resources, 'vigorRegenerationMultiplier', 1.5);
  state.endurance = Math.min(maximum, state.endurance + elapsed * regeneration * (vigor ? vigorMultiplier : 1));
  state.enduranceUpdatedAt = at;
}
