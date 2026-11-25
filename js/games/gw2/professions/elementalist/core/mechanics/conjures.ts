// Private deadlines use the same 40 ms clock as scheduled events.
import { gw2Time } from '#gw2/platform/combat/clock.js';
import { ACTOR } from '#gw2/platform/constants.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { professionCoreState, readProfessionCoreState } from '#gw2/platform/profession-definition/state.js';
import { requireSkill, skillNumber, type SkillSource } from '#gw2/platform/skills/balance-profiles.js';
import type { CanonicalCatalog } from '#gw2/platform/skills/types.js';
import { conjureEquipped } from '#gw2/professions/elementalist/core/mechanics/trigger-points.js';
import type { ElementalistCoreState } from '#gw2/professions/elementalist/core/state.js';
import type {
  ElementalistModifierContext,
  ElementalistRuntime,
  ElementalistRuntimeState,
  ElementalistSkill
} from '#gw2/professions/elementalist/types.js';

/** Real equips and isolated previews start the same held lifetime from the selected conjure skill. */
export function heldConjure(
  source: ElementalistSkill,
  at: number
): Pick<ElementalistCoreState, 'conjureEquipped' | 'conjureExpiresAt'> {
  return { conjureEquipped: source.conjureWeapon!, conjureExpiresAt: gw2Time(at + skillNumber(source, 'duration')) };
}

/** Held bonuses follow the weapon at the hit or attribute sample, applies to hits and attribute samples before expiry; delayed hits after expiry lose it. */
export function wieldedConjure(context: ElementalistModifierContext): string | null {
  const state = readProfessionCoreState<ElementalistCoreState>(context.runtime?.profession);
  return (state.conjureExpiresAt ?? 0) > context.time ? (state.conjureEquipped ?? null) : null;
}

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

const conjuredWeapons = new WeakMap<readonly ElementalistSkill[], Set<string>>();

/** Damage events share a weapon-name index for the selected catalog, including its patch overrides. */
export function isConjuredWeapon(
  { skills }: Pick<CanonicalCatalog<ElementalistSkill>, 'skills'>,
  weapon: string
): boolean {
  let names = conjuredWeapons.get(skills);

  if (!names) {
    names = new Set();
    for (const skill of skills) if (skill.conjureWeapon != null) names.add(skill.conjureWeapon);
    conjuredWeapons.set(skills, names);
  }

  return names.has(weapon);
}

/**
 * A conjure creates independent equipped and one-use ground copies before its trait and swap events. Both copies
 * appear together, so the ground copy shares the held copy's deadline on the 40 ms clock.
 */
function equipConjure(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: ElementalistSkill
): void {
  const state = professionCoreState(context.profession);
  Object.assign(state, heldConjure(skill, cast.effectiveEnd));
  state.conjurePickups[skill.conjureWeapon!] = state.conjureExpiresAt;
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
  state.conjureExpiresAt = 0;
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
  const source = conjureSkill(context.helpers, skill)!;
  Object.assign(state, heldConjure(source, cast.effectiveEnd));
  delete state.conjurePickups[source.conjureWeapon!];
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
  // Only a bundle attack starts with a held copy. Preview preparation has no ground copy or equip rewards.
  prepareDamageState(runtime, skill) {
    if (skill?.type === 'Weapon' && skill.conjureSourceId != null)
      Object.assign(runtime.profession.core, heldConjure(conjureSkill(runtime.helpers, skill)!, runtime.time));
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
