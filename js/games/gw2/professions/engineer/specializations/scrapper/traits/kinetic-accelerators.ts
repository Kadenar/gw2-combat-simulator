import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileEffectFromContext,
  balanceProfileValue,
  balanceProfileValueFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { SCRAPPER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/engineer/specializations/scrapper/profiles.js';
import { scrapperState } from '#gw2/professions/engineer/specializations/scrapper/state.js';
import type { EngineerResolverContext, EngineerSchedulerContext } from '#gw2/professions/engineer/types.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';

/** Share grants and the Whirl-only claim while each phase retains its own state and boon application. */
export function kineticAcceleratorBoons(
  context: EngineerSchedulerContext | EngineerResolverContext,
  event: SimulationEvent
) {
  if (
    !hasTrait(context, TRAIT.KINETIC_ACCELERATORS) ||
    event.type !== 'combo' ||
    !['Blast', 'Leap', 'Whirl'].includes(String(event.finisherType))
  )
    return [];
  if (event.finisherType === 'Whirl') {
    const state = scrapperState.from(context);
    if (!isInternalCooldownReady(event.at, state.kineticAcceleratorsWhirlReadyAt)) return [];
    state.kineticAcceleratorsWhirlReadyAt =
      event.at + balanceProfileValueFromContext(context, PROFILE.kineticAccelerators, 'internalCooldown', 3);
  }

  return ['quickness', 'might'].map((kind, index) => {
    const effect = balanceProfileEffectFromContext(context, PROFILE.kineticAccelerators, 'boon', index);
    return {
      type: 'buff' as const,
      at: event.at,
      priority: Number(event.priority || 0),
      activationId: event.activationId,
      comboId: event.comboId,
      source: 'Trait',
      sourceId: TRAIT.KINETIC_ACCELERATORS,
      actorType: 'effect' as const,
      skillId: event.skillId,
      skillName: event.skillName,
      name: `Kinetic Accelerators — ${kind}`,
      kind,
      duration: balanceProfileValue(effect, 'duration', index === 0 ? 3 : 10),
      stacks: balanceProfileValue(effect, 'stacks', index === 0 ? 1 : 3),
      audience: { recipients: 'party' as const }
    };
  });
}
