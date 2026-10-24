import { ACTOR, type AuraName } from '#gw2/platform/constants.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { balanceNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import { resolverSourceSkill } from '#gw2/platform/effects/packet-builders.js';
import type { MechanicCombatContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';

export interface ElementalistAuraApplication {
  readonly at: number;
  readonly aura: AuraName;
  readonly duration: number;
  readonly skillName: string;
  readonly sourceId: Skill['id'];
  readonly priority?: number;
}

export type ElementalistAuraApplier = (context: ElementalistRuntime, application: ElementalistAuraApplication) => void;

/** Procedural grants submit the same standard aura packet as declared skills and combo outcomes. */
export function applyElementalistAura(context: MechanicCombatContext, application: ElementalistAuraApplication): void {
  context.effects.emit({
    kind: 'packet',
    event: {
      ...application,
      type: 'aura',
      source: application.skillName,
      actorType: ACTOR.PLAYER
    }
  });
}

/** State and expiry share the accepted aura's clock, including applications before combat. */
function insertAura(context: ElementalistRuntime, event: Gw2ResolverEvent): void {
  const duration = Math.max(0, event.duration || 0);
  context.profession.core.activeAuras.push({
    type: String(event.aura || ''),
    appliedAt: event.at,
    expiresAt: event.at + duration,
    skillName: resolverSourceSkill(event)
  });
  context.schedule('elementalist.expire-state', event.at + duration, null);
}

/** Standard aura acceptance records profession state once without republishing the shared reaction. */
export function acceptElementalistAuraReaction(context: ElementalistRuntime, event: Gw2ResolverEvent): boolean {
  insertAura(context, event);
  context.observations.record(event);

  return context.engagement.startTime == null || event.at >= context.engagement.startTime;
}

/** Event preparation runs once per grant, so all aura sources share the trait's duration adjustment. */
export function prepareElementalistAura(context: unknown, event: SimulationEventBase): SimulationEventBase {
  return event.type === 'aura' && hasTrait(context, TRAIT.SMOTHERING_AURAS)
    ? {
        ...event,
        duration:
          Number(event.duration) * balanceNumberFromContext(context, TRAIT.SMOTHERING_AURAS, 'durationMultiplier')
      }
    : event;
}
