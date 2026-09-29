import type { RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import { EPSILON } from '#kernel/core/clock.js';
/**
 * Owns Weaver dual-weapon state behavior for hammer orbs and pistol bullets.
 * The cataloged weapon fragments live in
 * `skills/weapons/hammer.ts`.
 */
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { denyCast, retryCast } from '#gw2/platform/engine/skills/availability.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import {
  emitElementalistBuff,
  emitElementalistControl,
  withElementalistCast
} from '#gw2/professions/elementalist/core/events.js';
import { emitProfiledCondition, skillWeapon } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as CORE_PROFILE } from '#gw2/professions/elementalist/core/profiles.js';
import { isElementalistAttunement, type ElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';
import { applyElementalistAura } from '#gw2/professions/elementalist/core/traits/dispatch.js';
import { WEAVER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/weaver/profiles.js';
import type { ElementalistRuntime, ElementalistRuntimeState } from '#gw2/professions/elementalist/types.js';

/** Parses canonical skill metadata for a valid pair of distinct Weaver attunements. */
export function weaverDualAttunements(skill: Skill): readonly [ElementalistAttunement, ElementalistAttunement] | null {
  const parts = String(skill.attunement || '').split('+');
  if (parts.length !== 2) return null;

  const [first, second] = parts;
  if (!isElementalistAttunement(first) || !isElementalistAttunement(second) || first === second) return null;
  return [first, second];
}

/** Slots 1–2 use the primary hand, 3 requires both elements, and 4–5 use the secondary; Unravel uses only primary. */
export function weaverWeaponAttunementAvailable(
  skill: Skill,
  primary: string,
  secondary: string,
  unravelActive: boolean
): boolean {
  const dual = weaverDualAttunements(skill);
  const required = dual || [String(skill.attunement)];
  const slot = Number(String(skill.slot || '').match(/(\d+)$/)?.[1] || 0);
  return unravelActive
    ? required.length === 1 && required[0] === primary
    : dual
      ? slot === 3 && required.every((element) => [primary, secondary].includes(element))
      : slot <= 2
        ? required[0] === primary
        : slot >= 4
          ? required[0] === secondary
          : primary === secondary && required[0] === primary;
}

/** Checks the shared orb lockout and duplicate-orb restriction for Weaver dual skills. */
export function weaverHammerAvailability(
  context: ElementalistRuntime,
  skill: Skill
): { ready: boolean; retryAt?: number | null; code?: string; reason?: string } | null {
  if (skillWeapon(skill) !== 'Hammer') return null;
  const elements = weaverDualAttunements(skill);
  if (!elements) return null;
  const state = professionCoreState(context);
  const hammerOrbsProfile = requireBalanceProfileFromContext(context, CORE_PROFILE.hammerOrbs);
  // Every dual hammer skill shares one short lockout after the last orb cast.
  const retryAt = state.hammerOrbLastCastAt + balanceProfileNumber(hammerOrbsProfile, 'initialDelay');
  if (retryAt > context.time + EPSILON) {
    return retryCast(
      retryAt,
      'elementalist.hammer-orb-lockout',
      `${skill.name} is unavailable - the shared orb lockout ends at ${retryAt.toFixed(3)}.`
    );
  }

  if (elements.some((element) => state.hammerOrbs[element] != null && state.hammerOrbs[element] >= context.time)) {
    return denyCast(
      'elementalist.hammer-orb-active',
      `${skill.name} is unavailable - Grand Finale must consume the active orb first.`
    );
  }

  // The shared Weaver availability ladder validates the hands and Unravel after these resource checks.
  return { ready: true };
}

/** Payload declarations run before this shared all-matching-bullets settlement. */
export const weaverPistolSideEffects: RuntimeProfession<ElementalistRuntimeState>['sideEffectHandlers'] = {
  'elementalist.weaver.pistol.settle'(context, trigger) {
    if (trigger.kind !== 'cast') throw new TypeError('Dual pistol settlement requires a cast trigger.');
    const state = professionCoreState(context);
    const active = weaverDualAttunements(trigger.skill)!.filter((element) => state.pistolBullets[element]);
    if (!active.length) state.pistolBullets[state.primaryAttunement] = true;
    else for (const element of active) state.pistolBullets[element] = false;
  },
  'elementalist.weaver.pistol.frostfire-fire'(context, trigger) {
    if (trigger.kind !== 'cast') throw new TypeError('Dual pistol bonuses require a cast trigger.');
    const { cast, skill } = trigger;
    const at = cast.effectiveEnd;
    withElementalistCast(context, cast, () => {
      const frostfireFlurryProfile = requireBalanceProfileFromContext(context, PROFILE.frostfireFlurry);
      const aura = requireEffect(frostfireFlurryProfile, 'buff', 'Fire');
      if (aura) {
        applyElementalistAura(context, {
          at,
          aura: String(aura.kind),
          duration: aura.duration,
          skillName: skill.name,
          sourceId: skill.id
        });
      }
    });
  },
  'elementalist.weaver.pistol.frostfire-water'(context, trigger) {
    if (trigger.kind !== 'cast') throw new TypeError('Dual pistol bonuses require a cast trigger.');
    const { cast, skill } = trigger;
    const at = cast.effectiveEnd;
    withElementalistCast(context, cast, () => {
      emitProfiledCondition(context, at, PROFILE.frostfireFlurry, 'Water', skill.name, skill.id);
    });
  },
  'elementalist.weaver.pistol.plasma-fire'(context, trigger) {
    if (trigger.kind !== 'cast') throw new TypeError('Dual pistol bonuses require a cast trigger.');
    const { cast, skill } = trigger;
    const at = cast.effectiveEnd;
    withElementalistCast(context, cast, () => {
      emitProfiledCondition(context, at, PROFILE.purblindingPlasma, 'Fire', skill.name, skill.id);
    });
  },
  'elementalist.weaver.pistol.meteor-earth'(context, trigger) {
    if (trigger.kind !== 'cast') throw new TypeError('Dual pistol bonuses require a cast trigger.');
    const { cast, skill } = trigger;
    const at = cast.effectiveEnd;
    withElementalistCast(context, cast, () => {
      emitProfiledCondition(context, at, PROFILE.moltenMeteor, 'Earth', skill.name, skill.id);
    });
  },
  'elementalist.weaver.pistol.finesse-water'(context, trigger) {
    if (trigger.kind !== 'cast') throw new TypeError('Dual pistol bonuses require a cast trigger.');
    const { cast, skill } = trigger;
    const at = cast.effectiveEnd;
    withElementalistCast(context, cast, () => {
      const flowingFinesseProfile = requireBalanceProfileFromContext(context, PROFILE.flowingFinesse);
      const aura = requireEffect(flowingFinesseProfile, 'buff', 'Water');
      if (aura) {
        applyElementalistAura(context, {
          at,
          aura: String(aura.kind),
          duration: aura.duration,
          skillName: skill.name,
          sourceId: skill.id
        });
      }
    });
  },
  'elementalist.weaver.pistol.finesse-air'(context, trigger) {
    if (trigger.kind !== 'cast') throw new TypeError('Dual pistol bonuses require a cast trigger.');
    const { cast, skill } = trigger;
    const at = cast.effectiveEnd;
    withElementalistCast(context, cast, () => {
      // Superspeed is a buff, so resolve its authored kind without treating it as a boon.
      const effect = requireEffect(requireBalanceProfileFromContext(context, PROFILE.flowingFinesse), 'buff', 'Air');
      if (effect)
        emitElementalistBuff(context, {
          skill,
          at,
          source: skill.name,
          sourceId: skill.id,
          kind: String(effect.kind),
          stacks: Number(effect.stacks),
          duration: effect.duration
        });
    });
  },
  'elementalist.weaver.pistol.enervating-air'(context, trigger) {
    if (trigger.kind !== 'cast') throw new TypeError('Dual pistol bonuses require a cast trigger.');
    const { cast, skill } = trigger;
    const at = cast.effectiveEnd;
    withElementalistCast(context, cast, () => {
      emitElementalistControl(context, {
        at,
        source: skill.name,
        sourceId: skill.id,
        actorType: 'player',
        skillName: skill.name,
        skillId: skill.id,
        controlKind: 'crowd-control'
      });
    });
  },
  'elementalist.weaver.pistol.enervating-earth'(context, trigger) {
    if (trigger.kind !== 'cast') throw new TypeError('Dual pistol bonuses require a cast trigger.');
    const { cast, skill } = trigger;
    const at = cast.effectiveEnd;
    withElementalistCast(context, cast, () => {
      emitProfiledCondition(context, at, PROFILE.enervatingEarth, 'Earth', skill.name, skill.id);
    });
  }
};
