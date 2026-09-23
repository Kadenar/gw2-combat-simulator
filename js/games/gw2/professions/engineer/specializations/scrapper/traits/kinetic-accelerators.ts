import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber,
  requireEffect
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
    const kineticAcceleratorsProfile = requireBalanceProfileFromContext(context, PROFILE.kineticAccelerators);
    state.kineticAcceleratorsWhirlReadyAt =
      event.at + balanceProfileNumber(kineticAcceleratorsProfile, 'internalCooldown');
  }

  return ['quickness', 'might'].flatMap((kind) => {
    const kineticAcceleratorsProfile = requireBalanceProfileFromContext(context, PROFILE.kineticAccelerators);
    const effect = requireEffect(kineticAcceleratorsProfile, 'boon', kind);
    if (!effect) return [];
    return [
      {
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
        duration: Number(effect.duration),
        stacks: Number(effect.stacks),
        audience: { recipients: 'party' as const }
      }
    ];
  });
}
