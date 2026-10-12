import type { SkillEffect } from '#gw2/platform/effects/types.js';

import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import { guardianTraitIcon, guardianTraitName } from '#gw2/professions/guardian/core/traits/metadata.js';
import type { GuardianRuntime } from '#gw2/professions/guardian/types.js';

/** A triggered symbol owns a distinct activation and schedules only its surviving selected components. */
export function emitTraitSymbol(
  runtime: GuardianRuntime,
  trait: number,
  symbolId: SkillId,
  cause: Gw2ResolverEvent,
  options: { fieldDuration?: (effect: SkillEffect) => number } = {}
): boolean {
  const profile = runtime.helpers.skillsById.get(symbolId)!;
  const components = (profile.effects ?? []).filter((effect) => effect.type === 'strike' || effect.type === 'boon');
  if (!components.length) return false;
  // A surviving symbol reserves its native skill recharge before any derived activation.
  if (runtime.cooldownController.isOnCooldown(symbolId, runtime.time)) return false;
  runtime.cooldownController.startRecharge(profile, runtime.time);
  const symbol = profile;
  const activationId = `guardian.symbol:${symbolId}:${cause.activationId ?? cause.eventOrder}:${runtime.time}`;
  for (const component of components) {
    if (component.type === 'strike' && !component.ticks?.length)
      throw new Error(`${profile.name} requires an explicit strike timeline.`);
    const effect = {
      ...component,
      ...(component.type === 'strike'
        ? { name: symbol.name, weapon: 'Unequipped', metadata: { ...component.metadata, guardianSymbol: true } }
        : {})
    };
    // Selected symbol components retain their field and activation while transport stays shared.
    const fieldDuration = options.fieldDuration?.(component) ?? 0;
    runtime.effects.emit({
      kind: 'profile',
      profile: symbol,
      effects: [effect],
      cause,
      attribution: {
        source: 'Trait',
        sourceId: symbolId,
        actorType: 'player',
        skillId: symbolId,
        skillName: symbol.name,
        activationId
      },
      skillWeaponFallback: 'Unequipped',
      transform: (event) => ({
        ...event,
        triggeredBy: cause.skillName,
        ...(event.type === 'damage' && event.hitIndex === 1 && fieldDuration > 0
          ? { comboFields: [{ ownerId: 'guardian', fieldType: 'Light' as const, duration: fieldDuration }] }
          : {})
      })
    });
  }

  {
    runtime.effects.emit({
      kind: 'announcement',
      announcement: {
        type: 'trait',
        name: symbol.name,
        at: runtime.time,
        sourceSkill: cause.skillName,
        detail: guardianTraitName(trait),
        icon: guardianTraitIcon(trait)
      }
    });
  }

  return true;
}
