import { isGw2NonWeaponEffectEvent } from '#gw2/platform/combat/state/event-ownership.js';
import {
  gw2BoonApplicationRecipients,
  gw2BuffApplicationRecipients
} from '#gw2/platform/combat/state/allied-players.js';
import { isStandardBoon } from '#gw2/platform/combat/state/boons.js';
import { prepareGw2ComboEvent } from '#gw2/platform/combos/events.js';
import { weaponStrengthProfileIdForEvent } from '#gw2/platform/equipment/weapons/strength.js';

import type { SchedulerContext } from '#gw2/platform/engine/execution/types.js';
import type { SimulationEventInput } from '#gw2/platform/engine/events/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';

export interface Gw2EventPreparer {
  prepare(context: SchedulerContext, event: SimulationEventInput): SimulationEventInput;
}

function isCoefficientBasedDamage(event: SimulationEventInput): boolean {
  return (
    event.type === 'damage' &&
    Number(event.coefficient) > 0 &&
    !Number.isFinite(event.flatDamage) &&
    !Number.isFinite(event.flatStrikeBase) &&
    !Number.isFinite(event.flatStrikePowerCoeff) &&
    event.independentSummonStrike !== true
  );
}

/**
 * Enriches scheduled action and coefficient-damage events with stable
 * activation ownership and weapon-strength profiles for resolver handoff.
 */
export function createGw2EventPreparer(): Readonly<Gw2EventPreparer> {
  const triggeredActivationIds = new Map<string, string>();

  const prepare = (context: SchedulerContext, event: SimulationEventInput): SimulationEventInput => {
    event = prepareGw2ComboEvent(event);
    if (event.type === 'buff' || event.audience) {
      // Resolve the request once so every later consumer reads the same selected audience.
      const resolver =
        event.type === 'buff' && !isStandardBoon(event.kind || event.boon)
          ? gw2BuffApplicationRecipients
          : gw2BoonApplicationRecipients;
      const resolvedAudience = resolver(context.config as Gw2Config, event);
      return {
        ...event,
        resolvedAudience
      };
    }

    const coefficientBasedDamage = isCoefficientBasedDamage(event);
    if (!coefficientBasedDamage && event.type !== 'action') return event;

    const skill =
      context.catalog?.skillsById?.get(event.skillId ?? event.sourceId) ||
      context.catalog?.skillsByName?.get(event.skillName || '') ||
      null;
    const profileId = Number.isFinite(event.weaponStrength)
      ? null
      : weaponStrengthProfileIdForEvent(event, {
          skill,
          state: context.state as unknown as Record<string, unknown>,
          config: context.config as Gw2Config
        });
    const triggeredEffect =
      coefficientBasedDamage &&
      String(event.activationId || '').startsWith('cast:') &&
      isGw2NonWeaponEffectEvent(event);

    let activationId = event.activationId;
    if (triggeredEffect) {
      const key = [activationId, event.sourceId, event.skillName || event.name, event.triggeredBy].join('|');
      activationId = triggeredActivationIds.get(key);
      if (!activationId) {
        activationId = context.createActivationId('effect');
        triggeredActivationIds.set(key, activationId);
      }
    } else if (coefficientBasedDamage && !activationId) {
      activationId = context.createActivationId(event.actorType === 'summon' ? 'summon-attack' : 'effect');
    }

    return {
      ...event,
      ...(activationId ? { activationId } : {}),
      ...(profileId ? { weaponStrengthProfileId: profileId } : {})
    };
  };

  return Object.freeze({ prepare });
}
