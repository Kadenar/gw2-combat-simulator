/** Typed transition facts keep deferred mechanics independent of their public observations. */
import { ACTOR } from '#gw2/platform/constants.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { ElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';

interface AttunementEntry {
  readonly at: number;
  readonly sourceId: SkillId;
  readonly source: string;
  readonly to: ElementalistAttunement;
}

export interface ElementalistAttunementSwap extends AttunementEntry {
  readonly kind: 'swap';
  readonly from: ElementalistAttunement;
  readonly secondaryAttunement: ElementalistAttunement | null;
  readonly readyAtBefore: Readonly<Record<ElementalistAttunement, number>>;
}

export interface ElementalistAttunementReentry extends AttunementEntry {
  readonly kind: 'reentry';
}

export type ElementalistEntryTransition = ElementalistAttunementSwap | ElementalistAttunementReentry;

export type ElementalistTransition =
  | ElementalistEntryTransition
  | {
      readonly kind: 'fresh-air';
      readonly at: number;
      readonly sourceSkill?: string;
    };

export interface ElementalistTransitionDelivery<T extends ElementalistTransition = ElementalistTransition> {
  readonly transition: T;
  readonly cause: SimulationEvent;
}

export const ELEMENTALIST_TRANSITION_TASK = 'elementalist.attunement-transition';

/** Submit the observation first and retain its receipt for attribution; deferred mechanics run even if it is rejected. */
export function queueElementalistTransition(
  runtime: ElementalistRuntime,
  transition: ElementalistTransition,
  triggeringEvent?: SimulationEvent
): void {
  const priority = transition.kind === 'swap' ? -20 : 0;
  const event =
    transition.kind === 'fresh-air'
      ? {
          type: 'elementalist.fresh-air',
          at: transition.at,
          source: 'Fresh Air',
          sourceId: 'Fresh Air',
          actorType: ACTOR.EFFECT,
          skillName: 'Fresh Air',
          sourceSkill: transition.sourceSkill
        }
      : {
          type: transition.kind === 'swap' ? 'elementalist.attunement' : 'elementalist.attunement-enter',
          at: transition.at,
          priority,
          source: transition.source,
          sourceId: transition.sourceId,
          actorType: ACTOR.PLAYER,
          skillId: transition.sourceId,
          skillName: transition.source,
          to: transition.to,
          ...(transition.kind === 'swap'
            ? { from: transition.from, secondaryAttunement: transition.secondaryAttunement }
            : {})
        };
  // Fresh Air belongs to the triggering critical hit's activation as well as its causal chain.
  const cause = runtime.effects.emit({
    kind: 'packet',
    event,
    cause: triggeringEvent,
    receipt: true
  });
  runtime.schedule(ELEMENTALIST_TRANSITION_TASK, transition.at, { transition, cause }, undefined, priority);
}
