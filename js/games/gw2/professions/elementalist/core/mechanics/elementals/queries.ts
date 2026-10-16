import { selectedSkillIdSet } from '#gw2/platform/builds/selected-skills.js';
import {
  denyCast,
  retryCast,
  selectedSlotSkillAvailability,
  type AvailabilityResult
} from '#gw2/platform/execution/availability.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import type { SkillId, Skill } from '#gw2/platform/skills/types.js';
import {
  EARTH_ELEMENTAL_EVTC_PROFILE,
  FIRE_ELEMENTAL_EVTC_PROFILE
} from '#gw2/professions/elementalist/core/mechanics/elementals/profiles.js';
import { elementalistLoadoutIdentity } from '#gw2/professions/elementalist/core/mechanics/selection-policy.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';

export type ElementalKind = 'Fire' | 'Earth';

export const FLAME_BARRAGE_ID = FIRE_ELEMENTAL_EVTC_PROFILE.flameBarrage.skillId;

export const STOMP_ID = EARTH_ELEMENTAL_EVTC_PROFILE.stomp.skillId;

/** Converts selected skill IDs into the one elemental profile the controller should run. */
export function selectedElementalFromSkills(selected: ReadonlySet<SkillId>): ElementalKind | null {
  if (selected.has(ID.GLYPH_OF_ELEMENTALS_EARTH)) return 'Earth';

  return selected.has(ID.GLYPH_OF_ELEMENTALS) ? 'Fire' : null;
}

export function elementalForGlyphId(skillId: number | string): ElementalKind | null {
  if (skillId === ID.GLYPH_OF_ELEMENTALS_EARTH) return 'Earth';

  return skillId === ID.GLYPH_OF_ELEMENTALS ? 'Fire' : null;
}

export function elementalRuntimeProfile(element: ElementalKind) {
  return element === 'Earth' ? EARTH_ELEMENTAL_EVTC_PROFILE : FIRE_ELEMENTAL_EVTC_PROFILE;
}

function ready(): AvailabilityResult {
  return { ready: true };
}

function unavailable(reason: string, retryAt?: number): AvailabilityResult {
  return retryAt == null
    ? denyCast('elementalist.summoned-elemental', reason)
    : retryCast(retryAt, 'elementalist.summoned-elemental', reason);
}

// Which elemental the loadout has slotted (drives auto-summon). Bare "Glyph of
// Elementals" is treated as the Fire variant.
export function selectedElemental(context: MechanicQueriesOf<ElementalistRuntime>): ElementalKind | null {
  return selectedElementalFromSkills(selectedSkillIdSet(context.config.selectedSkillIds));
}

// Resolves the catalog skill that owns an element, so auto-summon and post-expiry recharge
// can act on the glyph even when it was never explicitly cast.
export function glyphSkillForElement(
  context: MechanicQueriesOf<ElementalistRuntime>,
  element: ElementalKind
): Skill | null {
  return (
    context.helpers.skillsById.get(element === 'Earth' ? ID.GLYPH_OF_ELEMENTALS_EARTH : ID.GLYPH_OF_ELEMENTALS) || null
  );
}

/**
 * Stable per-summon actor identity, so every strike and effect the elemental produces
 * attributes to the right companion instead of bleeding across re-summons.
 */
export function elementalistElementalCompanionId(summonGeneration: number): string {
  return `elementalist-elemental:${summonGeneration}`;
}

// True if the given summon generation is still the live elemental at time `at`.
// Already queued impacts may land exactly at expiry, before the priority-50 teardown.
export function activeElemental(
  context: MechanicQueriesOf<ElementalistRuntime>,
  summonGeneration: number,
  at: number
): boolean {
  const elemental = professionCoreState(context).summonedElemental;
  return (
    (elemental.element === 'Fire' || elemental.element === 'Earth') &&
    elemental.summonGeneration === summonGeneration &&
    elemental.activeUntil >= at
  );
}

/**
 * Availability gate for this subsystem. Command flips (Flame Barrage / Stomp) are usable when
 * the matching elemental is active — or its automatic opener has not yet spawned; the glyphs themselves are
 * blocked (with a retry time) while their elemental lives. Returns null for unrelated skills.
 */
export function elementalistElementalAvailability(
  context: MechanicQueriesOf<ElementalistRuntime>,
  skill: Skill
): AvailabilityResult | null {
  const elemental = professionCoreState(context).summonedElemental;

  if (skill.id === FLAME_BARRAGE_ID) {
    const active = elemental.element === 'Fire' && elemental.activeUntil > context.time;
    return active || (elemental.summonGeneration === 0 && selectedElemental(context) === 'Fire')
      ? ready()
      : unavailable('an active Fire Elemental is required.');
  }

  if (skill.id === STOMP_ID) {
    const active = elemental.element === 'Earth' && elemental.activeUntil > context.time;
    return active || (elemental.summonGeneration === 0 && selectedElemental(context) === 'Earth')
      ? ready()
      : unavailable('an active Earth Elemental is required.');
  }

  if (!elementalForGlyphId(skill.id)) return null;

  // Summon glyphs require an equipped slot before readiness or retry; command flips use the live elemental above.
  if (
    selectedSlotSkillAvailability({ config: context.config, catalog: context.helpers }, skill, {
      identity: elementalistLoadoutIdentity,
      omittedLoadout: 'deny'
    })
  ) {
    return denyCast('elementalist.not-equipped', 'the skill is not equipped.');
  }

  return elemental.activeUntil > context.time
    ? unavailable(`the ${elemental.element || 'summoned'} elemental is still active.`, elemental.activeUntil)
    : ready();
}
