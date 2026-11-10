import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { gw2EffectExpiresAt } from '#gw2/platform/combat/effect-timing.js';
import { ACTOR, type AuraName } from '#gw2/platform/constants.js';
import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { MechanicCombatContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { BalanceProfileSource } from '#gw2/platform/skills/balance-profiles.js';
import { balanceNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import type {
  ElementalistRuntime,
  ElementalistRuntimeState,
  ElementalistSkill
} from '#gw2/professions/elementalist/types.js';

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

/** Aura state and cleanup use the shared action-tick expiry, including applications before combat. */
function insertAura(context: ElementalistRuntime, event: Gw2ResolverEvent): void {
  const expiresAt = gw2EffectExpiresAt(event.at, event.duration || 0);
  context.profession.core.activeAuras.push({
    type: String(event.aura || ''),
    expiresAt
  });
  context.schedule('elementalist.aura-expire', expiresAt, null);
}

/** Standard aura acceptance records profession state once without republishing the shared reaction. */
export function acceptElementalistAuraReaction(context: ElementalistRuntime, event: Gw2ResolverEvent): boolean {
  insertAura(context, event);
  context.observations.record(event);

  return context.engagement.startTime == null || event.at >= context.engagement.startTime;
}

/** Aura transmutation and expiry retire applications through the same mechanic owner. */
export const elementalistAuraLifecycle = {
  sideEffectHandlers: {
    'elementalist.transmute-aura'(context, trigger) {
      if (trigger.kind !== 'cast') throw new TypeError('Aura transmutation requires a cast trigger.');

      const aura = trigger.skill.transmuteAura;
      const state = context.profession.core;
      state.activeAuras = state.activeAuras.filter(
        (candidate) => candidate.type !== aura || candidate.expiresAt <= trigger.cast.effectiveEnd
      );
    }
  },
  tasks: {
    'elementalist.aura-expire'(runtime) {
      runtime.profession.core.activeAuras = runtime.profession.core.activeAuras.filter(
        (aura) => aura.expiresAt > runtime.time
      );
    }
  }
} satisfies RuntimeHooks<ElementalistRuntimeState, ElementalistSkill>;

/** Event preparation runs once per grant, so all aura sources share the trait's duration adjustment. */
export function prepareElementalistAura(
  source: BalanceProfileSource,
  context: unknown,
  event: SimulationEventBase
): SimulationEventBase {
  return event.type === 'aura' && hasTrait(context, TRAIT.SMOTHERING_AURAS)
    ? {
        ...event,
        duration: Number(event.duration) * balanceNumber(source, TRAIT.SMOTHERING_AURAS, 'durationMultiplier')
      }
    : event;
}
