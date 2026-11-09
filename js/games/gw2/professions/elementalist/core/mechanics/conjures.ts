import { ACTOR } from '#gw2/platform/constants.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { requireSkill, skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import {
  CONJURE_PICKUP_WEAPONS,
  CONJURE_SKILLS,
  CONJURED_WEAPONS
} from '#gw2/professions/elementalist/core/constants.js';
import { conjureEquipped } from '#gw2/professions/elementalist/core/mechanics/trigger-points.js';
import type {
  ElementalistRuntime,
  ElementalistRuntimeState,
  ElementalistSkill
} from '#gw2/professions/elementalist/types.js';

// Ground copies and pickup actions resolve the same selected conjuring skill's lifetime.
const conjureSkillIds = new Map(Object.entries(CONJURE_SKILLS).map(([id, weapon]) => [weapon, Number(id)]));

function conjureDuration(context: ElementalistRuntime, weapon: string): number {
  return skillNumber(requireSkill(context.helpers, conjureSkillIds.get(weapon)!), 'duration');
}

/** A conjure creates independent equipped and one-use ground copies before its trait and swap events. */
function equipConjure(context: ElementalistRuntime, cast: RuntimeCast<ElementalistSkill>, skill: Skill): void {
  const state = professionCoreState(context.profession);
  const weapon = CONJURE_SKILLS[Number(skill.id)];
  state.conjureEquipped = weapon;
  state.conjurePickups[weapon] = cast.effectiveEnd + conjureDuration(context, weapon);
  context.fireTrigger(conjureEquipped, { cast });
  finishConjureSwap(context, cast, skill);
}

/** Dropping reports a swap only when a real equipped bundle was removed. */
function dropConjure(context: ElementalistRuntime, cast: RuntimeCast<ElementalistSkill>, skill: Skill): void {
  const state = professionCoreState(context.profession);

  if (!state.conjureEquipped) return;

  state.conjureEquipped = null;
  finishConjureSwap(context, cast, skill);
}

/** A successful pickup consumes the ground copy captured at acceptance, even if its deadline passed during the cast. */
export function pickUpConjure(context: ElementalistRuntime, cast: RuntimeCast<ElementalistSkill>, skill: Skill): void {
  const expiresAt = pickupWindows.get(cast);

  if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt) || expiresAt <= cast.start) return;

  const state = professionCoreState(context.profession);
  const weapon = CONJURE_PICKUP_WEAPONS[Number(skill.id)];
  state.conjureEquipped = weapon;
  delete state.conjurePickups[weapon];
  finishConjureSwap(context, cast, skill);
}

/** All real bundle swaps share lifetime scheduling, chain reset, and one sigil-swap notification. */
function finishConjureSwap(context: ElementalistRuntime, cast: RuntimeCast<ElementalistSkill>, skill: Skill): void {
  const state = professionCoreState(context.profession);
  const at = cast.effectiveEnd;
  state.conjureExpiresAt = state.conjureEquipped ? at + conjureDuration(context, state.conjureEquipped) : 0;
  context.schedule('elementalist.conjure-expire', state.conjureExpiresAt || at, null);
  for (const deadline of Object.values(state.conjurePickups))
    context.schedule('elementalist.conjure-expire', deadline, null);
  context.autoattackController.reset();
  context.effects.emit({
    kind: 'packet',
    event: {
      type: 'elementalist.conjure',
      at,
      source: skill.name,
      sourceId: skill.id,
      actorType: ACTOR.PLAYER,
      skillName: skill.name,
      conjureEquipped: state.conjureEquipped,
      conjureExpiresAt: state.conjureExpiresAt
    }
  });
  context.effects.emit({
    kind: 'packet',
    event: {
      type: 'sigil_swap',
      at,
      source: skill.name,
      sourceId: skill.id,
      actorType: ACTOR.PLAYER,
      skillName: skill.name
    }
  });
}

const pickupWindows = new WeakMap<RuntimeCast<ElementalistSkill>, number>();

/** Conjure actions and expiry share the equipped copy and accepted ground-pickup snapshots. */
export const elementalistConjureLifecycle = {
  sideEffectHandlers: {
    'elementalist.capture-conjure-pickup'(context, trigger) {
      if (trigger.kind !== 'cast') throw new TypeError('Conjure pickup requires a cast trigger.');

      captureConjurePickup(context, trigger.cast);
    },
    'elementalist.equip-conjure'(context, trigger) {
      if (trigger.kind !== 'cast') throw new TypeError('Conjures require a cast trigger.');

      equipConjure(context, trigger.cast, trigger.skill);
    },
    'elementalist.drop-conjure'(context, trigger) {
      if (trigger.kind !== 'cast') throw new TypeError('Dropping a conjure requires a cast trigger.');

      dropConjure(context, trigger.cast, trigger.skill);
    },
    'elementalist.pick-up-conjure'(context, trigger) {
      if (trigger.kind !== 'cast') throw new TypeError('Conjure pickup requires a cast trigger.');

      pickUpConjure(context, trigger.cast, trigger.skill);
    }
  },
  // Isolated conjure attacks assume their bundle is equipped for damage and attribute queries.
  prepareDamageState(runtime, skill) {
    if (skill?.weapon && CONJURED_WEAPONS.has(skill.weapon)) runtime.profession.core.conjureEquipped = skill.weapon;
  },
  tasks: {
    'elementalist.conjure-expire'(runtime) {
      const state = runtime.profession.core;

      if (state.conjureEquipped && state.conjureExpiresAt <= runtime.time) {
        state.conjureEquipped = null;
        state.conjureExpiresAt = 0;
        runtime.autoattackController.reset();
      }

      for (const [weapon, expiresAt] of Object.entries(state.conjurePickups))
        if (expiresAt <= runtime.time) delete state.conjurePickups[weapon];
    }
  }
} satisfies RuntimeHooks<ElementalistRuntimeState, ElementalistSkill>;

/** A pickup accepted before ground expiry retains that copy through its animation. */
export function captureConjurePickup(runtime: ElementalistRuntime, cast: RuntimeCast<ElementalistSkill>): void {
  const weapon = CONJURE_PICKUP_WEAPONS[Number(cast.skill.id)];

  if (weapon) pickupWindows.set(cast, runtime.profession.core.conjurePickups[weapon]);
}
