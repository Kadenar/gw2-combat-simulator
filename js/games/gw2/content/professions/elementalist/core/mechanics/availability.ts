/**
 * Core Elementalist cast availability.
 *
 * One ordered gate ladder covering attunement swaps, endurance, conjure bundles,
 * equipped slot skills, weapon-specific resources, and attunement-locked skills.
 * A denial without a retry timestamp rejects the rotation command outright; a
 * denial carrying one asks the scheduler to retry the same command at that time.
 */
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { AvailabilityResult, Skill } from '#gw2/platform/engine/types.js';
import { selectedSkillNameSet } from '#gw2/platform/builds/selected-skills.js';
import { enduranceReadyAt } from '#gw2/platform/combat/resources/endurance.js';
import { denySkillCast as unavailable } from '#gw2/content/professions/lib/availability.js';
import type {
  ElementalistPrecastContext as ElementalistCastContext,
  ElementalistSchedulerContext
} from '#gw2/content/professions/elementalist/types.js';
import {
  ELEMENTALIST_ATTUNEMENTS,
  type ElementalistCoreState
} from '#gw2/content/professions/elementalist/core/state.js';
import {
  AURA_TRANSMUTE_SKILLS,
  CONJURED_WEAPONS,
  DODGE_ENDURANCE_COST,
  HAMMER_ORB_SKILLS
} from '#gw2/content/professions/elementalist/core/constants.js';
import { elementalistElementalAvailability } from '#gw2/content/professions/elementalist/core/skills/elementals.js';
import {
  projectedFreshAirReadyAt,
  targetAttunement
} from '#gw2/content/professions/elementalist/core/mechanics/attunements.js';
import {
  activeHammerOrbElements,
  hammerOrbMatchesAttunement
} from '#gw2/content/professions/elementalist/core/skills/hammer.js';
import { activeAura, etchingChain, skillWeapon } from '#gw2/content/professions/elementalist/core/mechanics/effects.js';
import {
  elementalistEnduranceRegenerationRate,
  updateEndurance
} from '#gw2/content/professions/elementalist/core/mechanics/endurance.js';
import {
  activeSecondaryAttunement,
  isSelectedSlotSkill,
  weaponAttunementAvailable
} from '#gw2/content/professions/elementalist/core/mechanics/weapon-state.js';
import {
  ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE,
  elementalistBalanceValue
} from '#gw2/content/professions/elementalist/core/profiles.js';

function ready(): AvailabilityResult {
  return { ready: true };
}

/**
 * First-match availability gate for every Core Elementalist skill: returns ready,
 * a permanent denial, or a denial carrying the time the command is worth retrying.
 */
export function elementalistCoreAvailability(context: ElementalistCastContext, skill: Skill): AvailabilityResult {
  // Glyph summons and elemental command skills answer through their own gate first.
  const elementalAvailability = elementalistElementalAvailability(context, skill);
  if (elementalAvailability) return elementalAvailability;
  const state = professionCoreState(context);
  // Pistol's finisher needs one stored bullet of every element.
  if (
    skill.name === 'Elemental Explosion' &&
    !ELEMENTALIST_ATTUNEMENTS.every((element) => state.pistolBullets[element])
  ) {
    return unavailable(skill, 'elementalist.pistol-bullets', 'requires all four elemental bullets.');
  }

  // Attunement swaps: permanently denied while already attuned, otherwise retried
  // when the target attunement recharges (Fresh Air may pull Air in earlier).
  const target = targetAttunement(skill);
  if (target) {
    const secondaryAttunement = activeSecondaryAttunement(context);
    if (target === state.primaryAttunement && (!secondaryAttunement || target === secondaryAttunement)) {
      return unavailable(skill, 'elementalist.same-attunement', `already attuned to ${target}.`);
    }

    const naturalReadyAt = Number(state.attunementReadyAt[target] || 0);
    const freshAirReadyAt = target === 'Air' ? projectedFreshAirReadyAt(context, naturalReadyAt) : null;
    const readyAt = freshAirReadyAt == null ? naturalReadyAt : Math.min(naturalReadyAt, freshAirReadyAt);
    return readyAt > context.start + context.epsilon
      ? unavailable(skill, 'elementalist.attunement-recharge', `${target} recharges at ${readyAt.toFixed(3)}.`, readyAt)
      : ready();
  }

  // Dodge settles endurance up to the current instant, then either passes or
  // reports the time regeneration covers the cost.
  if (skill.name === 'Dodge') {
    updateEndurance(
      context as unknown as ElementalistSchedulerContext,
      state,
      context.start,
      Boolean(context.config.boons?.vigor)
    );
    const enduranceCost = elementalistBalanceValue(context, PROFILE.resources, 'resourceCost', DODGE_ENDURANCE_COST);
    return state.endurance + context.epsilon >= enduranceCost
      ? ready()
      : unavailable(
          skill,
          'elementalist.endurance',
          `requires ${enduranceCost} endurance.`,
          enduranceReadyAt(
            state.endurance,
            enduranceCost,
            context.start,
            elementalistEnduranceRegenerationRate(
              context as unknown as ElementalistSchedulerContext,
              Boolean(context.config.boons?.vigor)
            ),
            context.epsilon
          )
        );
  }

  // Synthetic bundle commands: dropping needs an equipped conjure, and picking one
  // up needs a ground pickup that has not expired.
  if (skill.name === '__drop_bundle') {
    return state.conjureEquipped
      ? ready()
      : unavailable(skill, 'elementalist.no-bundle', 'no conjured weapon is equipped.');
  }

  if (skill.name.startsWith('__pickup_')) {
    const weapon = skill.name.slice('__pickup_'.length);
    const expiresAt = Number(state.conjurePickups[weapon] || 0);
    return expiresAt >= context.start
      ? ready()
      : unavailable(skill, 'elementalist.conjure-pickup', `the ${weapon} pickup is unavailable or expired.`);
  }

  // Slot skills must be equipped; a chain follow-up qualifies through its root.
  if (['Heal', 'Utility', 'Elite'].includes(String(skill.type))) {
    const selected = selectedSkillNameSet(context.config.selectedSkills);
    // Flipped skills remain selectable through the equipped root without naming specialization-owned chains here.
    const selectedChainSkill = [...selected].some(
      (selectedName) => context.catalog.skillsByName.get(selectedName)?.nextChainId === skill.id
    );
    if (!isSelectedSlotSkill(skill, selected) && !selectedChainSkill) {
      return unavailable(skill, 'elementalist.not-equipped', 'the skill is not equipped.');
    }
  }

  // Transmute skills consume a matching aura that must currently be active.
  const aura = AURA_TRANSMUTE_SKILLS[Number(skill.id)];
  if (aura && !activeAura(state, aura, context.start)) {
    return unavailable(skill, 'elementalist.aura-transmute', `requires an active ${aura}.`);
  }

  // Hurl and Rock Barrier share one barrier: Hurl needs it live, while a second
  // Rock Barrier waits for the current one to be thrown or to expire.
  if (skill.name === 'Hurl' && state.rockBarrierExpiresAt <= context.start + context.epsilon) {
    return unavailable(skill, 'elementalist.rock-barrier', 'requires an active Rock Barrier.');
  }

  if (skill.name === 'Rock Barrier' && state.rockBarrierExpiresAt > context.start + context.epsilon) {
    return unavailable(
      skill,
      'elementalist.rock-barrier-active',
      'Hurl or wait for the current barrier to expire.',
      state.rockBarrierExpiresAt
    );
  }

  // Spear etchings unlock their lesser and full payoffs by chain stage, which only
  // other casts can advance, so these denials are never retried on a timer.
  const chain = etchingChain(skill.name);
  if (chain && skill.name !== chain.etching) {
    const progress = state.etchings[chain.etching];
    const requiredStage = skill.name === chain.lesser ? 'lesser' : 'full';
    if (progress?.stage !== requiredStage) {
      return unavailable(
        skill,
        'elementalist.spear-etching',
        requiredStage === 'lesser'
          ? `cast ${chain.etching} first.`
          : `cast three other skills after ${chain.etching} first.`
      );
    }
  }

  // Hammer orbs: a short shared lockout after any orb cast (retryable) plus a flat
  // denial while that element's orb is still floating and unconsumed.
  const skillId = Number(skill.id);
  const hammerElements = HAMMER_ORB_SKILLS[skillId] ? [HAMMER_ORB_SKILLS[skillId]] : null;
  if (hammerElements) {
    const retryAt =
      state.hammerOrbLastCastAt + elementalistBalanceValue(context, PROFILE.hammerOrbs, 'initialDelay', 0.48);
    if (retryAt > context.start + context.epsilon) {
      return unavailable(
        skill,
        'elementalist.hammer-orb-lockout',
        `the shared orb lockout ends at ${retryAt.toFixed(3)}.`,
        retryAt
      );
    }

    if (
      hammerElements.some((element) => {
        const expiresAt = state.hammerOrbs[element];
        return expiresAt != null && expiresAt >= context.start;
      })
    ) {
      return unavailable(
        skill,
        'elementalist.hammer-orb-active',
        'Grand Finale must consume the active orb before it can be created again.'
      );
    }
  }

  // Grand Finale needs at least one floating orb matching the current attunement.
  if (skill.name === 'Grand Finale') {
    const compatible = activeHammerOrbElements(state, context.start).some((element) =>
      hammerOrbMatchesAttunement(context, state, element)
    );
    if (!compatible) {
      return unavailable(
        skill,
        'elementalist.hammer-orbs',
        'requires an active orb compatible with the current attunement.'
      );
    }
  }

  // A conjure replaces the weapon bar, so bundle skills and normal weapon skills
  // exclude each other; otherwise the weapon skill is gated on its attunement.
  if (skill.type === 'Weapon') {
    const weapon = skillWeapon(skill);
    if (CONJURED_WEAPONS.has(weapon)) {
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

  // Single-element utilities require that attunement to be the active one.
  if (skill.attunement && !String(skill.attunement).includes('+') && skill.type !== 'Profession') {
    return String(skill.attunement) === state.primaryAttunement
      ? ready()
      : unavailable(skill, 'elementalist.attuned-utility', `requires ${String(skill.attunement)} attunement.`);
  }

  return ready();
}
