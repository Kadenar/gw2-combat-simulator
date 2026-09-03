/**
 * Owns Weaver dual-weapon state behavior for hammer orbs and pistol bullets.
 * The cataloged weapon fragments live in
 * `skills/weapons/hammer.ts`.
 */
import {
  balanceProfileEffectFromContext,
  balanceProfileValueFromContext
} from '#gw2/platform/combat/state/balance-profiles.js';
import { emitSkillBuff, emitSkillControl } from '#gw2/platform/scheduler/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { Skill } from '#gw2/platform/engine/types.js';
import type { ElementalistCastContext, ElementalistPrecastContext } from '#gw2/professions/elementalist/types.js';
import {
  ELEMENTALIST_ATTUNEMENTS,
  isElementalistAttunement,
  type ElementalistAttunement
} from '#gw2/professions/elementalist/core/state.js';
import { activeHammerOrbElements } from '#gw2/professions/elementalist/core/mechanics/hammer-orbs.js';
import {
  activeBuffEvents,
  emitProfiledBuff,
  emitProfiledCondition,
  skillWeapon
} from '#gw2/professions/elementalist/core/mechanics/effects.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as CORE_PROFILE } from '#gw2/professions/elementalist/core/profiles.js';
import { applyElementalistAura } from '#gw2/professions/elementalist/core/traits/index.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { WEAVER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/weaver/profiles.js';
import { weaverState } from '#gw2/professions/elementalist/specializations/weaver/state.js';

/** Parses canonical skill metadata for a valid pair of distinct Weaver attunements. */
export function weaverDualAttunements(skill: Skill): readonly [ElementalistAttunement, ElementalistAttunement] | null {
  const parts = String(skill.attunement || '').split('+');
  if (parts.length !== 2) return null;

  const [first, second] = parts;
  if (!isElementalistAttunement(first) || !isElementalistAttunement(second) || first === second) return null;
  return [first, second];
}

/** Creates and refreshes the two hammer orbs granted by a Weaver dual skill. */
export function applyWeaverHammerState(context: ElementalistCastContext, skill: Skill): void {
  if (skillWeapon(skill) !== 'Hammer') return;
  const elements = weaverDualAttunements(skill);
  if (!elements) return;
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  const orbDuration = balanceProfileValueFromContext(context, CORE_PROFILE.hammerOrbs, 'durationMultiplier', 15);
  // Any orb still alive is extended to the new full duration, including the
  // buff events already placed on the timeline.
  const previouslyActive = new Set(activeHammerOrbElements(state, at));
  for (const element of ELEMENTALIST_ATTUNEMENTS) {
    const expiresAt = state.hammerOrbs[element];
    if (expiresAt == null || expiresAt < at) continue;
    state.hammerOrbs[element] = at + orbDuration;
    for (const event of activeBuffEvents(context, `hammer ${element} orb`, at)) {
      context.replaceEvent(event, { duration: at + orbDuration - event.at });
    }
  }

  // The cast's own pair is (re)created and attributed to this activation; the
  // buff is only emitted for an element that was not already orbiting.
  for (const element of elements) {
    state.hammerOrbs[element] = at + orbDuration;
    state.hammerOrbGrantedBy[element] = skill.name;
    state.hammerOrbActivationIds[element] = context.reservationId;
    state.hammerOrbBuffUntil[element] = at + orbDuration;
    if (!previouslyActive.has(element)) {
      emitSkillBuff(context, skill, {
        at,
        source: skill.name,
        sourceId: skill.id,
        actorType: 'player',
        kind: `hammer ${element.toLowerCase()} orb`,
        stacks: 1,
        duration: orbDuration,
        skillName: skill.name
      });
    }
  }

  state.hammerOrbLastCastAt = at;
}

/** Checks the shared orb lockout and duplicate-orb restriction for Weaver dual skills. */
export function weaverHammerAvailability(
  context: ElementalistPrecastContext,
  skill: Skill
): { ready: boolean; retryAt?: number | null; code?: string; reason?: string } | null {
  if (skillWeapon(skill) !== 'Hammer') return null;
  const elements = weaverDualAttunements(skill);
  if (!elements) return null;
  const state = professionCoreState(context);
  // Every dual hammer skill shares one short lockout after the last orb cast.
  const retryAt =
    state.hammerOrbLastCastAt + balanceProfileValueFromContext(context, CORE_PROFILE.hammerOrbs, 'initialDelay', 0.48);
  if (retryAt > context.start + context.epsilon) {
    return {
      ready: false,
      retryAt,
      code: 'elementalist.hammer-orb-lockout',
      reason: `${skill.name} is unavailable - the shared orb lockout ends at ${retryAt.toFixed(3)}.`
    };
  }

  if (
    elements.some((element) => state.hammerOrbs[element] != null && Number(state.hammerOrbs[element]) >= context.start)
  ) {
    return {
      ready: false,
      retryAt: null,
      code: 'elementalist.hammer-orb-active',
      reason: `${skill.name} is unavailable - Grand Finale must consume the active orb first.`
    };
  }

  // Final gate: the skill's element pair must match the two attuned hands.
  const secondary = weaverState.from(context).secondaryAttunement || state.primaryAttunement;
  return elements.includes(state.primaryAttunement) && elements.includes(secondary)
    ? { ready: true }
    : {
        ready: false,
        retryAt: null,
        code: 'elementalist.weaver-attunement',
        reason: `${skill.name} is unavailable - requires its matching dual attunement.`
      };
}

/** Consumes and grants pistol bullets for Weaver's dual-attunement weapon skills. */
export function applyWeaverPistolState(context: ElementalistCastContext, skill: Skill): void {
  if (skillWeapon(skill) !== 'Pistol') return;
  const elements = weaverDualAttunements(skill);
  if (!elements) return;
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  // With no bullet loaded for either half of the pair, the dual skill loads one
  // for the current main-hand element instead of firing.
  const active = elements.filter((element) => state.pistolBullets[element]);
  if (!active.length) {
    state.pistolBullets[state.primaryAttunement] = true;
    return;
  }

  // Otherwise every matching bullet is consumed and adds the bonus effect that
  // this specific dual skill grants for that element.
  for (const element of active) {
    state.pistolBullets[element] = false;
    if (skill.id === ID.FROSTFIRE_FLURRY && element === 'Fire') {
      const aura = balanceProfileEffectFromContext(context, PROFILE.frostfireFlurry, 'buff', 0, 'Fire');
      applyElementalistAura(context, {
        at,
        aura: String(aura?.kind || 'Fire Aura'),
        duration: Number(aura?.duration ?? 3),
        skillName: skill.name,
        sourceId: skill.id
      });
    } else if (skill.id === ID.FROSTFIRE_FLURRY && element === 'Water') {
      emitProfiledCondition(context, at, PROFILE.frostfireFlurry, 'Water', 'Vulnerability', 4, 8, skill.name, skill.id);
    } else if (skill.id === ID.PURBLINDING_PLASMA && element === 'Fire') {
      emitProfiledCondition(context, at, PROFILE.purblindingPlasma, 'Fire', 'Burning', 3, 4, skill.name, skill.id);
    } else if (skill.id === ID.MOLTEN_METEOR && element === 'Earth') {
      emitProfiledCondition(context, at, PROFILE.moltenMeteor, 'Earth', 'Bleeding', 3, 8, skill.name, skill.id);
    } else if (skill.id === ID.FLOWING_FINESSE && element === 'Water') {
      const aura = balanceProfileEffectFromContext(context, PROFILE.flowingFinesse, 'buff', 0, 'Water');
      applyElementalistAura(context, {
        at,
        aura: String(aura?.kind || 'Frost Aura'),
        duration: Number(aura?.duration ?? 3),
        skillName: skill.name,
        sourceId: skill.id
      });
    } else if (skill.id === ID.FLOWING_FINESSE && element === 'Air') {
      emitProfiledBuff(context, at, PROFILE.flowingFinesse, 'Air', 'Superspeed', 1, 4, skill.name, skill.id);
    } else if (skill.id === ID.ENERVATING_EARTH && element === 'Air') {
      emitSkillControl(context, {
        at,
        source: skill.name,
        sourceId: skill.id,
        actorType: 'player',
        skillName: skill.name,
        skillId: skill.id,
        controlKind: 'crowd-control'
      });
    } else if (skill.id === ID.ENERVATING_EARTH && element === 'Earth') {
      emitProfiledCondition(context, at, PROFILE.enervatingEarth, 'Earth', 'Bleeding', 4, 8, skill.name, skill.id);
    }
  }
}
