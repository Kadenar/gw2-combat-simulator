import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill, SkillId } from '#gw2/platform/skills/types.js';
import { guardianTraitIcon } from '#gw2/professions/guardian/core/traits/metadata.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import type { GuardianRuntimeState, GuardianSkill } from '#gw2/professions/guardian/types.js';

// These child effects have packet identities but no player-selectable catalog entry.
export const symbols: Readonly<Record<SkillId, Skill>> = {
  [ID.LESSER_SYMBOL_OF_BLADES]: {
    id: ID.LESSER_SYMBOL_OF_BLADES,
    name: 'Lesser Symbol of Blades',
    weapon: 'Unequipped'
  },
  [ID.LESSER_SYMBOL_OF_PROTECTION]: {
    id: ID.LESSER_SYMBOL_OF_PROTECTION,
    name: 'Lesser Symbol of Protection',
    weapon: 'Unequipped'
  },
  [ID.LESSER_SYMBOL_OF_RESOLUTION]: {
    id: ID.LESSER_SYMBOL_OF_RESOLUTION,
    name: 'Lesser Symbol of Resolution',
    weapon: 'Unequipped'
  }
};

/** A triggered symbol owns a distinct activation and schedules only its surviving selected components. */
export function emitTraitSymbol(
  runtime: MechanicContext<GuardianRuntimeState, GuardianSkill>,
  trait: number,
  symbolId: SkillId,
  cause: Gw2ResolverEvent,
  options: { party?: boolean; fieldDuration?: (effect: SkillEffect) => number } = {}
): boolean {
  const profile = requireBalanceProfileFromContext(runtime, trait);
  const components = (profile.effects ?? []).filter((effect) => effect.type === 'strike' || effect.type === 'boon');
  if (!components.length) return false;
  const symbol = symbols[symbolId];
  const activationId = `guardian.symbol:${symbolId}:${cause.activationId ?? cause.eventOrder}:${runtime.time}`;
  for (const component of components) {
    if (component.type === 'strike' && !component.ticks?.length)
      throw new Error(`${profile.name} requires an explicit strike timeline.`);
    const effect = {
      ...component,
      ...(component.type === 'strike'
        ? { name: symbol.name, weapon: 'Unequipped', metadata: { ...component.metadata, guardianSymbol: true } }
        : {}),
      ...(options.party && component.type === 'boon' ? { audience: { recipients: 'party' as const } } : {})
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
        sourceId: trait,
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
        detail: profile.name,
        icon: guardianTraitIcon(trait)
      }
    });
  }

  return true;
}
