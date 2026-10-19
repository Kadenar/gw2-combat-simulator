import { ACTOR } from '#gw2/platform/constants.js';

import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import {
  writOfPersistenceEffects,
  writOfPersistenceFields
} from '#gw2/professions/guardian/core/traits/honor/writ-of-persistence.js';
import { guardianTraitIcon, guardianTraitName } from '#gw2/professions/guardian/core/traits/metadata.js';
import type { GuardianRuntime } from '#gw2/professions/guardian/types.js';

/** A triggered symbol owns a distinct activation and schedules only its surviving selected components. */
export function emitTraitSymbol(
  runtime: GuardianRuntime,
  trait: number,
  symbolId: SkillId,
  cause: Gw2ResolverEvent
): boolean {
  const profile = runtime.helpers.skillsById.get(symbolId)!;
  // Triggered symbols take the same lifetime selection as cast symbols before any packet or field is emitted.
  const components = writOfPersistenceEffects(runtime, profile, profile.effects ?? []).filter(
    (effect) => effect.type === 'strike' || effect.type === 'boon'
  );
  const fields = writOfPersistenceFields(runtime, profile, profile.comboFields);
  // The symbol's declared field is placed once, by its first surviving strike.
  const fieldOwner = fields?.length ? components.find((effect) => effect.type === 'strike') : undefined;

  if (!components.length) return false;

  // A surviving symbol reserves its native skill recharge before any derived activation.
  if (runtime.cooldownController.isOnCooldown(symbolId, runtime.time)) return false;

  runtime.cooldownController.startRecharge(profile, runtime.time);
  const symbol = profile;
  const activationId = `guardian.symbol:${symbolId}:${cause.activationId ?? cause.eventOrder}:${runtime.time}`;
  for (const component of components) {
    // An instant symbol has no cast window to inherit, so each strike must carry its own pulse timing.
    if (component.type === 'strike' && !component.ticks?.length && component.atMs == null)
      throw new Error(`${profile.name} requires explicit strike timing.`);

    const effect = {
      ...component,
      ...(component.type === 'strike'
        ? { name: symbol.name, weapon: 'Unequipped', metadata: { ...component.metadata, guardianSymbol: true } }
        : {})
    };
    // Selected symbol components retain their field and activation while transport stays shared.
    runtime.effects.emit({
      kind: 'profile',
      profile: symbol,
      effects: [effect],
      cause,
      attribution: {
        source: 'Trait',
        sourceId: symbolId,
        actorType: ACTOR.PLAYER,
        skillId: symbolId,
        skillName: symbol.name,
        activationId
      },
      skillWeaponFallback: 'Unequipped',
      transform: (event) => ({
        ...event,
        triggeredBy: cause.skillName,
        ...(component === fieldOwner && event.type === 'damage' && event.hitIndex === 1 ? { comboFields: fields } : {})
      })
    });
  }

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

  return true;
}
