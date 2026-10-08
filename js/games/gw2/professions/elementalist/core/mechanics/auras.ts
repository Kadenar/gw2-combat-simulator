import { resolverSourceSkill } from '#gw2/platform/effects/packet-builders.js';
import type { MechanicCombatContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { elementalistAuraDuration } from '#gw2/professions/elementalist/core/traits/fire/index.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';

export interface ElementalistAuraApplication {
  readonly at: number;
  readonly aura: string;
  readonly duration: number;
  readonly skillName: string;
  readonly sourceId: Skill['id'];
  readonly priority?: number;
}
export type ElementalistAuraApplier = (context: ElementalistRuntime, application: ElementalistAuraApplication) => void;

/** All profession producers submit authored durations here; Smothering Auras is applied exactly once. */
export function applyElementalistAura(context: MechanicCombatContext, application: ElementalistAuraApplication): void {
  context.effects.emit({
    kind: 'packet',
    event: {
      ...application,
      type: 'elementalist.aura',
      source: application.skillName,
      actorType: 'effect',
      duration: elementalistAuraDuration(context, application.duration)
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

/** Profession packets own their observation and publication; reactions never re-enter this handler. */
export function resolveElementalistAura(context: ElementalistRuntime, event: Gw2ResolverEvent): void {
  insertAura(context, event);
  context.observations.record(event);
  if (context.combatStartTime != null && event.at < context.combatStartTime) return;
  context.combat.react('aura.applied', event);
}

/** Combo auras arrive already observed and published by the resolver, with their materialized duration. */
export function acceptElementalistAuraReaction(context: ElementalistRuntime, event: Gw2ResolverEvent): boolean {
  if (event.type === 'aura') insertAura(context, event);
  return context.combatStartTime == null || event.at >= context.combatStartTime;
}
