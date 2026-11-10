import { ACTOR } from '#gw2/platform/constants.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { requireSkill, skillNumber, type SkillSource } from '#gw2/platform/skills/balance-profiles.js';
import type { CanonicalCatalog } from '#gw2/platform/skills/types.js';
import { conjureEquipped } from '#gw2/professions/elementalist/core/mechanics/trigger-points.js';
import type {
  ElementalistRuntime,
  ElementalistRuntimeState,
  ElementalistSkill
} from '#gw2/professions/elementalist/types.js';

/** Pickups and attacks resolve the originating conjure in the selected catalog. */
export function conjureSkill(
  source: SkillSource<ElementalistSkill>,
  skill: ElementalistSkill
): ElementalistSkill | undefined {
  return skill.conjureSourceId == null
    ? skill.conjureWeapon
      ? skill
      : undefined
    : requireSkill(source, skill.conjureSourceId);
}

/** Event attribution identifies bundle weapons through the selected conjuring declarations. */
export function isConjuredWeapon(source: Pick<CanonicalCatalog<ElementalistSkill>, 'skills'>, weapon: string): boolean {
  return source.skills.some((skill) => skill.conjureWeapon === weapon);
}

/** A conjure creates independent equipped and one-use ground copies before its trait and swap events. */
function equipConjure(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: ElementalistSkill
): void {
  const state = professionCoreState(context.profession);
  const weapon = skill.conjureWeapon!;
  state.conjureEquipped = weapon;
  state.conjurePickups[weapon] = cast.effectiveEnd + skillNumber(skill, 'duration');
  context.fireTrigger(conjureEquipped, { cast });
  finishConjureSwap(context, cast, skill);
}

/** Dropping reports a swap only when a real equipped bundle was removed. */
function dropConjure(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: ElementalistSkill
): void {
  const state = professionCoreState(context.profession);

  if (!state.conjureEquipped) return;

  state.conjureEquipped = null;
  finishConjureSwap(context, cast, skill);
}

/** A successful pickup consumes the ground copy captured at acceptance, even if its deadline passed during the cast. */
export function pickUpConjure(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: ElementalistSkill
): void {
  const expiresAt = pickupWindows.get(cast);

  if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt) || expiresAt <= cast.start) return;

  const state = professionCoreState(context.profession);
  const weapon = conjureSkill(context.helpers, skill)!.conjureWeapon!;
  state.conjureEquipped = weapon;
  delete state.conjurePickups[weapon];
  finishConjureSwap(context, cast, skill);
}

/** All real bundle swaps share lifetime scheduling, chain reset, and one sigil-swap notification. */
function finishConjureSwap(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: ElementalistSkill
): void {
  const state = professionCoreState(context.profession);
  const at = cast.effectiveEnd;
  state.conjureExpiresAt = state.conjureEquipped
    ? at + skillNumber(conjureSkill(context.helpers, skill)!, 'duration')
    : 0;
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
    if (skill?.type === 'Weapon' && skill.conjureSourceId != null)
      runtime.profession.core.conjureEquipped = conjureSkill(runtime.helpers, skill)!.conjureWeapon!;
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
  const weapon = conjureSkill(runtime.helpers, cast.skill)?.conjureWeapon;

  if (weapon) pickupWindows.set(cast, runtime.profession.core.conjurePickups[weapon]);
}
