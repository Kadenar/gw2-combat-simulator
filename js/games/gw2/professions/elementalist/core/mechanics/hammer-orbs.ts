/**
 * Owns Core hammer orb state, availability, and consumption.
 *
 * Owns the orb timers the hammer attunement skills create and the Grand Finale
 * consumption that spends them, plus the queries availability uses to gate both.
 * Hammer skill effects, including Grand Finale's projectiles, live in `skills/weapons/hammer.ts`.
 */
import { ACTOR } from '#gw2/platform/constants.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { ReadonlyMechanicState } from '#gw2/platform/profession-definition/runtime-context.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { HAMMER_ORB_SKILLS } from '#gw2/professions/elementalist/core/constants.js';
import { elementalistBuffRequest } from '#gw2/professions/elementalist/core/events.js';
import { refreshElementalistBuffs } from '#gw2/professions/elementalist/core/mechanics/resolution-helpers.js';
import {
  ELEMENTALIST_ATTUNEMENTS,
  type ElementalistAttunement,
  type ElementalistCoreState
} from '#gw2/professions/elementalist/core/state.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type {
  ElementalistRuntime,
  ElementalistRuntimeState,
  ElementalistSkill
} from '#gw2/professions/elementalist/types.js';

/** Orb skills share a fixed admission delay independently of their authored lifetimes. */
export const HAMMER_ORB_REUSE_DELAY = 0.48;

/** Orb elements still live at `at`; shared by availability gating and the Weaver orb handler. */
export function activeHammerOrbElements(
  state: ReadonlyMechanicState<ElementalistCoreState>,
  at: number
): ElementalistAttunement[] {
  return ELEMENTALIST_ATTUNEMENTS.filter((element) => {
    const expiresAt = state.hammerOrbs[element];
    return expiresAt != null && expiresAt >= at;
  });
}

/** Core compatibility rule for spending an orb: only one matching the current primary attunement counts. */
export function hammerOrbMatchesAttunement(
  state: ReadonlyMechanicState<ElementalistCoreState>,
  element: ElementalistAttunement
): boolean {
  return element === state.primaryAttunement;
}

/** Core and Weaver refresh live orbs together, emitting buffs only for newly created elements. */
export function createHammerOrbs(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: Skill,
  elements: readonly ElementalistAttunement[]
): void {
  const state = professionCoreState(context.profession);
  const at = cast.effectiveEnd;
  const duration = skillNumber(skill, 'orbDuration');
  const previouslyActive = new Set(activeHammerOrbElements(state, at));
  for (const element of previouslyActive) {
    state.hammerOrbs[element] = at + duration;
    refreshElementalistBuffs(context, `hammer ${element} orb`, at, () => at + duration);
  }

  for (const element of elements) {
    state.hammerOrbs[element] = at + duration;
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

  context.schedule('elementalist.hammer-orb-expire', at + duration, null, undefined, 50);
  state.hammerOrbLastCastAt = at;
}

/** Orb actions, packet ownership, and expiry share one owner so Finale retires the correct activations. */
export const elementalistHammerOrbLifecycle = {
  sideEffectHandlers: {
    'elementalist.create-hammer-orbs'(context, trigger) {
      if (trigger.kind !== 'cast') throw new TypeError('Hammer orbs require a cast trigger.');

      createHammerOrbs(
        context,
        trigger.cast,
        trigger.skill,
        String(trigger.skill.attunement).split('+') as ElementalistAttunement[]
      );
    },
    'elementalist.cancel-hammer-orbits'(context) {
      for (const activation of Object.values(professionCoreState(context.profession).hammerOrbActivationIds))
        if (activation) context.cancelOwner({ id: activation, generation: 0 });
    },
    'elementalist.consume-hammer-orbs'(context, trigger) {
      if (trigger.kind !== 'cast') throw new TypeError('Grand Finale requires a cast trigger.');

      consumeHammerOrbs(context, trigger.cast);
    }
  },
  // Grand Finale previews consume the selected assumed orbs without creating live orb attacks.
  prepareDamageState(runtime, skill, inputs) {
    if (skill?.id === ID.GRAND_FINALE)
      for (const element of ELEMENTALIST_ATTUNEMENTS)
        runtime.profession.core.hammerOrbs[element] = inputs[`orb:${element}`] ? 3600 : null;
  },
  // Orb contact ownership is admission data; preparation waits until the surviving packet executes.
  effectOwner(_runtime, event) {
    if (HAMMER_ORB_SKILLS[Number(event.skillId)] && (event.type === 'damage' || event.type === 'condition'))
      return { id: String(event.activationId), generation: 0 };

    return undefined;
  },
  tasks: {
    'elementalist.hammer-orb-expire'(runtime) {
      const state = runtime.profession.core;
      for (const element of ELEMENTALIST_ATTUNEMENTS) {
        if (state.hammerOrbs[element] != null && state.hammerOrbs[element] <= runtime.time) {
          state.hammerOrbs[element] = null;
          state.hammerOrbActivationIds[element] = null;
        }
      }
    }
  }
} satisfies RuntimeHooks<ElementalistRuntimeState, ElementalistSkill>;

/** Finale consumes stored orbs while keeping their buffs alive through its last packet. */
function consumeHammerOrbs(context: ElementalistRuntime, cast: RuntimeCast<ElementalistSkill>): void {
  const state = professionCoreState(context.profession);
  const at = cast.effectiveEnd;
  const active = ELEMENTALIST_ATTUNEMENTS.filter((element) => {
    const expiresAt = state.hammerOrbs[element];
    return expiresAt != null && expiresAt >= cast.start;
  });
  for (const element of active) {
    refreshElementalistBuffs(context, `hammer ${element} orb`, at, () => at + 1);
    state.hammerOrbs[element] = null;
    state.hammerOrbActivationIds[element] = null;
  }
}
