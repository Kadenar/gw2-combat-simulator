/** Own Core and Weaver hammer orb admission, expiry, packet cancellation, and Finale consumption. */
import { ACTOR } from '#gw2/platform/constants.js';
import { denySkillCast, type AvailabilityResult } from '#gw2/platform/execution/availability.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { ReadonlyMechanicState } from '#gw2/platform/profession-definition/runtime-context.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { elementalistBuffRequest } from '#gw2/professions/elementalist/core/events.js';
import {
  ELEMENTALIST_ATTUNEMENTS,
  isElementalistAttunement,
  type ElementalistAttunement,
  type ElementalistCoreState
} from '#gw2/professions/elementalist/core/state.js';
import type {
  ElementalistRuntime,
  ElementalistRuntimeState,
  ElementalistSkill
} from '#gw2/professions/elementalist/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

/** Orb skills share a fixed admission delay independently of their authored lifetimes. */
const HAMMER_ORB_REUSE_DELAY = 0.48;

/** Refresh and consumption select the same live orb set. */
function activeHammerOrbElements(
  state: ReadonlyMechanicState<ElementalistCoreState>,
  at: number
): ElementalistAttunement[] {
  return ELEMENTALIST_ATTUNEMENTS.filter((element) => hammerOrbActiveAt(state, element, at));
}

/** Read orb eligibility without consuming it; Finale evaluates this query at cast acceptance. */
function hammerOrbActiveAt(
  state: ReadonlyMechanicState<ElementalistCoreState>,
  element: ElementalistAttunement,
  at: number
): boolean {
  const expiresAt = state.hammerOrbs[element];
  return expiresAt != null && expiresAt > at;
}

/** Only declared orb creators own orb resources and pending contacts. */
function createsHammerOrbs(skill: Skill): boolean {
  return !!skill.sideEffects?.some((effect) => effect.do.type === 'elementalist.create-hammer-orbs');
}

/** Read validated elements only from a skill that declares orb creation, including selected patches. */
export function hammerOrbElements(skill: ElementalistSkill): readonly ElementalistAttunement[] | null {
  if (!createsHammerOrbs(skill)) return null;

  const elements = (skill.attunement || '').split('+');

  if (elements.length > 2 || !elements.every(isElementalistAttunement) || new Set(elements).size !== elements.length)
    return null;

  return elements;
}

/** Admission and preview recognize the same declared spender as execution. */
function consumesHammerOrbs(skill: Skill): boolean {
  return !!skill.sideEffects?.some((effect) => effect.do.type === 'elementalist.consume-hammer-orbs');
}

/** Both creators check the shared retry deadline before denying an already active element. */
function creationAvailability(
  context: MechanicQueriesOf<ElementalistRuntime>,
  skill: Skill,
  elements: readonly ElementalistAttunement[]
): AvailabilityResult | null {
  const state = professionCoreState(context.profession);
  const retryAt = Number.isFinite(state.hammerOrbLastCastAt)
    ? canonicalTime(state.hammerOrbLastCastAt + HAMMER_ORB_REUSE_DELAY)
    : state.hammerOrbLastCastAt;

  if (retryAt > context.time)
    return denySkillCast(
      skill,
      'elementalist.hammer-orb-lockout',
      `the shared orb lockout ends at ${retryAt.toFixed(3)}.`,
      retryAt
    );

  return elements.some((element) => hammerOrbActiveAt(state, element, context.time))
    ? denySkillCast(
        skill,
        'elementalist.hammer-orb-active',
        'Grand Finale must consume the active orb before it can be created again.'
      )
    : null;
}

/** Core checks single-orb creation and Finale before its weapon-bar restrictions. */
export function coreHammerOrbAvailability(
  context: MechanicQueriesOf<ElementalistRuntime>,
  skill: Skill
): AvailabilityResult | null {
  const elements = hammerOrbElements(skill);

  if (elements?.length === 1) return creationAvailability(context, skill, elements);

  const state = professionCoreState(context.profession);

  if (consumesHammerOrbs(skill) && !hammerOrbActiveAt(state, state.primaryAttunement, context.time))
    return denySkillCast(
      skill,
      'elementalist.hammer-orbs',
      'requires an active orb compatible with the current attunement.'
    );

  return null;
}

/** Weaver checks dual-orb resources before its hand and Unravel restrictions. */
export function dualHammerOrbAvailability(
  context: MechanicQueriesOf<ElementalistRuntime>,
  skill: Skill
): AvailabilityResult | null {
  const elements = hammerOrbElements(skill);
  return elements?.length === 2 ? creationAvailability(context, skill, elements) : null;
}

/** Core and Weaver refresh live orbs together, emitting buffs only for newly created elements. */
function createHammerOrbs(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: ElementalistSkill
): void {
  const elements = hammerOrbElements(skill);

  if (!elements) throw new TypeError(`Invalid hammer orb attunements for ${skill.name}.`);

  const state = professionCoreState(context.profession);
  const at = cast.effectiveEnd;
  const duration = skillNumber(skill, 'orbDuration');
  const expiresAt = canonicalTime(at + duration);
  const previouslyActive = new Set(activeHammerOrbElements(state, at));
  for (const element of previouslyActive) {
    state.hammerOrbs[element] = expiresAt;
    // Residual Finale buffs can overlap a new orb; refresh only the currently owned application.
    context.combat.reviseBuffExpiry(
      `hammer ${element.toLowerCase()} orb`,
      (application) =>
        application.event?.activationId === state.hammerOrbActivationIds[element] &&
        application.at <= at &&
        application.expiresAt > at,
      () => expiresAt
    );
  }

  for (const element of elements) {
    state.hammerOrbs[element] = expiresAt;
    state.hammerOrbActivationIds[element] = cast.id;

    if (!previouslyActive.has(element)) {
      context.effects.emit(
        elementalistBuffRequest(
          {
            skill,
            at,
            source: skill.name,
            sourceId: skill.id,
            actorType: ACTOR.PLAYER,
            kind: `hammer ${element.toLowerCase()} orb`,
            stacks: 1,
            duration,
            skillName: skill.name
          },
          { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
        )
      );
    }
  }

  context.schedule('elementalist.hammer-orb-expire', expiresAt, null, undefined, 50);
  state.hammerOrbLastCastAt = at;
}

/** Capture both selection and activation identity so later grants cannot change Finale's accepted orbs. */
interface FinaleOrb {
  element: ElementalistAttunement;
  activationId: string | null;
}
const finaleOrbs = new WeakMap<RuntimeCast<ElementalistSkill>, readonly FinaleOrb[]>();

/** Projectile selection and consumption use the same cast-start snapshot. */
export function hammerFinaleHasOrb(cast: RuntimeCast<ElementalistSkill>, element: ElementalistAttunement): boolean {
  return !!finaleOrbs.get(cast)?.some((orb) => orb.element === element);
}

/** Orb actions, packet ownership, and expiry share one owner so Finale retires the correct activations. */
export const elementalistHammerOrbLifecycle = {
  sideEffectHandlers: {
    'elementalist.create-hammer-orbs'(context, trigger) {
      if (trigger.kind !== 'cast') throw new TypeError('Hammer orbs require a cast trigger.');

      createHammerOrbs(context, trigger.cast, trigger.skill);
    },
    'elementalist.prepare-hammer-finale'(context, trigger) {
      if (trigger.kind !== 'cast') throw new TypeError('Grand Finale requires a cast trigger.');

      const cast = trigger.cast;

      if (cast.cancelledBeforeCommit) return;

      const state = context.profession.core;
      const selected = activeHammerOrbElements(state, cast.start).map((element) => ({
        element,
        activationId: state.hammerOrbActivationIds[element]
      }));
      finaleOrbs.set(cast, selected);
      for (const { element, activationId } of selected) {
        if (!activationId) continue;

        context.cancelOwner({ id: activationId, generation: 0 });
        // Extend only this orb's application before any intervening hits resolve; never resurrect earlier Finale buffs.
        context.combat.reviseBuffExpiry(
          `hammer ${element.toLowerCase()} orb`,
          (application) =>
            application.event?.activationId === activationId &&
            application.at <= cast.start &&
            application.expiresAt > cast.start,
          () => canonicalTime(cast.effectiveEnd + 1)
        );
      }
    },
    'elementalist.consume-hammer-orbs'(context, trigger) {
      if (trigger.kind !== 'cast') throw new TypeError('Grand Finale requires a cast trigger.');

      consumeHammerOrbs(context, trigger.cast);
    }
  },
  // Grand Finale previews consume the selected assumed orbs without creating live orb attacks.
  prepareDamageState(runtime, skill, inputs) {
    if (skill && consumesHammerOrbs(skill))
      for (const element of ELEMENTALIST_ATTUNEMENTS)
        runtime.profession.core.hammerOrbs[element] = inputs[`orb:${element}`] ? 3600 : null;
  },
  // Orb contact ownership is admission data; preparation waits until the surviving packet executes.
  effectOwner(runtime, event) {
    if (event.type !== 'damage' && event.type !== 'condition') return undefined;

    // Proc and combo payloads may copy the causing skill ID without belonging to its cast lifetime.
    if (
      typeof event.activationId !== 'string' ||
      !event.activationId.length ||
      event.actorType === ACTOR.EFFECT ||
      event.procType
    )
      return undefined;

    const skill = runtime.skillFor(event.sourceId);
    return skill && createsHammerOrbs(skill) ? { id: event.activationId, generation: 0 } : undefined;
  },
  tasks: {
    'elementalist.hammer-orb-expire'(runtime) {
      const state = runtime.profession.core;
      const expired = new Set<string>();
      for (const element of ELEMENTALIST_ATTUNEMENTS) {
        if (state.hammerOrbs[element] != null && state.hammerOrbs[element] <= runtime.time) {
          const activation = state.hammerOrbActivationIds[element];

          if (activation) expired.add(activation);

          state.hammerOrbs[element] = null;
          state.hammerOrbActivationIds[element] = null;
        }
      }

      for (const activation of expired)
        if (!Object.values(state.hammerOrbActivationIds).includes(activation))
          runtime.cancelOwner({ id: activation, generation: 0 });
    }
  }
} satisfies RuntimeHooks<ElementalistRuntimeState, ElementalistSkill>;

/** Consume only the accepted activations; their modifier windows were extended prospectively at cast start. */
function consumeHammerOrbs(context: ElementalistRuntime, cast: RuntimeCast<ElementalistSkill>): void {
  const state = professionCoreState(context.profession);
  const active = finaleOrbs.get(cast);

  if (!active) throw new TypeError('Grand Finale requires its accepted orb snapshot.');

  finaleOrbs.delete(cast);
  for (const { element, activationId } of active) {
    if (state.hammerOrbActivationIds[element] !== activationId) continue;

    state.hammerOrbs[element] = null;
    state.hammerOrbActivationIds[element] = null;
  }
}
