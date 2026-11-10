import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { gw2CooldownReadyAt } from '#gw2/platform/combat/action-tick.js';
import {
  selectedSlotSkillAvailability,
  denySkillCast as unavailable,
  type AvailabilityResult
} from '#gw2/platform/execution/availability.js';
import { skillFlipReady } from '#gw2/platform/execution/skill-flips.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { targetAttunement } from '#gw2/professions/elementalist/core/mechanics/attunements.js';
import { conjureSkill } from '#gw2/professions/elementalist/core/mechanics/conjures.js';
import { activeAura } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import { elementalistElementalAvailability } from '#gw2/professions/elementalist/core/mechanics/elementals/queries.js';
import { coreHammerOrbAvailability } from '#gw2/professions/elementalist/core/mechanics/hammer-orbs.js';
import { elementalExplosionAvailability } from '#gw2/professions/elementalist/core/mechanics/pistol.js';
import { elementalistSlotSelectionPolicy } from '#gw2/professions/elementalist/core/mechanics/selection-policy.js';
import { elementalistEtchingAvailability } from '#gw2/professions/elementalist/core/mechanics/spear.js';
import { weaponAttunementAvailable } from '#gw2/professions/elementalist/core/mechanics/weapon-state.js';
import {
  ELEMENTALIST_ATTUNEMENT_SKILL_IDS,
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
import { elementalistAttunementPolicy } from '#gw2/professions/elementalist/family-state.js';
import type { ElementalistRuntime, ElementalistSkill } from '#gw2/professions/elementalist/types.js';

function ready(): AvailabilityResult {
  return { ready: true };
}

/** Attunement swaps preserve same-element denials and Fresh Air retry deadlines. */
function attunementAvailability(
  context: MechanicQueriesOf<ElementalistRuntime>,
  skill: ElementalistSkill
): AvailabilityResult | null {
  const state = professionCoreState(context.profession);
  // Attunement swaps: permanently denied while already attuned, otherwise retried
  // when the target attunement recharges (Fresh Air may pull Air in earlier).
  const target = targetAttunement(skill);

  if (target) {
    const { secondaryAttunement } = elementalistAttunementPolicy(context);

    if (target === state.primaryAttunement && (!secondaryAttunement || target === secondaryAttunement)) {
      return unavailable(skill, 'elementalist.same-attunement', `already attuned to ${target}.`);
    }

    const naturalReadyAt = gw2CooldownReadyAt(
      context.cooldownController.readyAt(ELEMENTALIST_ATTUNEMENT_SKILL_IDS[target]) || 0
    );
    const freshAirReadyAt = target === 'Air' ? projectedFreshAirReadyAt(context, naturalReadyAt) : null;
    const readyAt = freshAirReadyAt == null ? naturalReadyAt : Math.min(naturalReadyAt, freshAirReadyAt);
    return readyAt > context.time
      ? unavailable(skill, 'elementalist.attunement-recharge', `${target} recharges at ${readyAt.toFixed(3)}.`, readyAt)
      : ready();
  }

  return null;
}

/** Bundle commands require an equipped conjure or a live ground pickup. */
function conjureCommandAvailability(
  context: MechanicQueriesOf<ElementalistRuntime>,
  skill: ElementalistSkill
): AvailabilityResult | null {
  const state = professionCoreState(context.profession);

  // Synthetic bundle commands: dropping needs an equipped conjure, and picking one
  // up needs a ground pickup that has not expired.
  if (Number(skill.id) === ID.DROP_BUNDLE) {
    return state.conjureEquipped
      ? ready()
      : unavailable(skill, 'elementalist.no-bundle', 'no conjured weapon is equipped.');
  }

  const pickupWeapon =
    skill.type === 'Action' && skill.conjureSourceId != null
      ? conjureSkill(context.helpers, skill)!.conjureWeapon
      : undefined;

  if (pickupWeapon) {
    const weapon = pickupWeapon;
    // Missing or invalid ground copies must not become available at time zero.
    const expiresAt = state.conjurePickups[weapon];
    return Number.isFinite(expiresAt) && expiresAt > context.time
      ? ready()
      : unavailable(skill, 'elementalist.conjure-pickup', `the ${weapon} pickup is unavailable or expired.`);
  }

  return null;
}

/** Equipment selection follows elemental, attunement, and bundle command gates. */
function slotAvailability(
  context: MechanicQueriesOf<ElementalistRuntime>,
  skill: ElementalistSkill
): AvailabilityResult | null {
  // Keep selection here so elemental, attunement, and bundle denials retain precedence.
  if (
    selectedSlotSkillAvailability(
      { config: context.config, catalog: context.helpers },
      skill,
      elementalistSlotSelectionPolicy
    )
  ) {
    return unavailable(skill, 'elementalist.not-equipped', 'the skill is not equipped.');
  }

  return null;
}

/** Transmutes require their matching live aura. */
function auraAvailability(
  context: MechanicQueriesOf<ElementalistRuntime>,
  skill: ElementalistSkill
): AvailabilityResult | null {
  const state = professionCoreState(context.profession);
  // Transmute skills consume a matching aura that must currently be active.
  const aura = skill.transmuteAura;

  if (aura && !activeAura(state, aura, context.time)) {
    return unavailable(skill, 'elementalist.aura-transmute', `requires an active ${aura}.`);
  }

  return null;
}

/** Rock Barrier and Hurl share one live flip window and its expiry. */
function rockBarrierAvailability(
  context: MechanicQueriesOf<ElementalistRuntime>,
  skill: ElementalistSkill
): AvailabilityResult | null {
  // Hurl and Rock Barrier share one barrier: Hurl needs it live, while a second
  // Rock Barrier waits for the current one to be thrown or to expire.
  if (Number(skill.id) === ID.HURL && !skillFlipReady(context.flips[ID.HURL], context.time)) {
    return unavailable(skill, 'elementalist.rock-barrier', 'requires an active Rock Barrier.');
  }

  if (Number(skill.id) === ID.ROCK_BARRIER && skillFlipReady(context.flips[ID.HURL], context.time)) {
    return unavailable(
      skill,
      'elementalist.rock-barrier-active',
      'Hurl or wait for the current barrier to expire.',
      context.flips[ID.HURL].expiresAt
    );
  }

  return null;
}

/** Conjures replace the weapon bar before ordinary weapon attunement checks. */
function weaponAvailability(
  context: MechanicQueriesOf<ElementalistRuntime>,
  skill: ElementalistSkill
): AvailabilityResult | null {
  const state = professionCoreState(context.profession);

  // A conjure replaces the weapon bar, so bundle skills and normal weapon skills
  // exclude each other; otherwise the weapon skill is gated on its attunement.
  if (skill.type === 'Weapon') {
    const weapon = conjureSkill(context.helpers, skill)?.conjureWeapon;

    if (weapon) {
      if (state.conjureEquipped !== weapon) {
        return unavailable(skill, 'elementalist.conjure-required', `requires the ${weapon} bundle.`);
      }
    } else if (state.conjureEquipped) {
      return unavailable(
        skill,
        'elementalist.bundle-equipped',
        `drop ${state.conjureEquipped} before using normal weapon skills.`
      );
    }

    return weaponAttunementAvailable(context, skill, state);
  }

  return null;
}

/** Single-element utilities require the current primary attunement. */
function utilityAttunementAvailability(
  context: MechanicQueriesOf<ElementalistRuntime>,
  skill: ElementalistSkill
): AvailabilityResult | null {
  const state = professionCoreState(context.profession);

  // Single-element utilities require that attunement to be the active one.
  if (skill.attunement && !skill.attunement.includes('+') && skill.type !== 'Profession') {
    return skill.attunement === state.primaryAttunement
      ? ready()
      : unavailable(skill, 'elementalist.attuned-utility', `requires ${skill.attunement} attunement.`);
  }

  return null;
}

/** Preserve the first matching result, including ready short circuits and retry deadlines. */
export function elementalistCoreAvailability(
  context: MechanicQueriesOf<ElementalistRuntime>,
  skill: ElementalistSkill
): AvailabilityResult {
  return (
    elementalistElementalAvailability(context, skill) ??
    elementalExplosionAvailability(context, skill) ??
    attunementAvailability(context, skill) ??
    conjureCommandAvailability(context, skill) ??
    slotAvailability(context, skill) ??
    auraAvailability(context, skill) ??
    rockBarrierAvailability(context, skill) ??
    elementalistEtchingAvailability(context, skill) ??
    coreHammerOrbAvailability(context, skill) ??
    weaponAvailability(context, skill) ??
    utilityAttunementAvailability(context, skill) ??
    ready()
  );
}

/** Pending damage supplies a wake, never a predicted resource or critical result. */
export function projectedFreshAirReadyAt(context: MechanicQueriesOf<ElementalistRuntime>, upTo: number): number | null {
  if (!hasTrait(context, TRAIT.FRESH_AIR)) return null;

  const core = context.profession.core;

  if (core.primaryAttunement === 'Air') return null;

  // Readiness queries ignore elapsed wakes without pruning the live scheduler's candidates.
  const times = core.freshAirCandidates.filter((at) => at > context.time && at <= upTo);
  return times.length ? Math.min(...times) : null;
}
