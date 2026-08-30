import { professionCoreState } from '../../../../../platform/engine/profession/state.js';
import type { AvailabilityResult, Skill } from '../../../../../platform/engine/types.js';
import { selectedSkillNameSet } from '../../../../../platform/builds/selected-skills.js';
import { enduranceReadyAt } from '../../../../../platform/combat/resources/endurance.js';
import { denySkillCast as unavailable } from '../../../lib/availability.js';
import type {
  ElementalistPrecastContext as ElementalistCastContext,
  ElementalistSchedulerContext
} from '../../types.js';
import { ELEMENTALIST_ATTUNEMENTS, type ElementalistCoreState } from '../state.js';
import { AURA_TRANSMUTE_SKILLS, CONJURED_WEAPONS, DODGE_ENDURANCE_COST, HAMMER_ORB_SKILLS } from '../constants.js';
import { elementalistElementalAvailability } from '../skills/elementals.js';
import { projectedFreshAirReadyAt, targetAttunement } from './attunements.js';
import { activeHammerOrbElements, hammerOrbMatchesAttunement } from '../skills/hammer.js';
import { activeAura, etchingChain, skillWeapon } from './effects.js';
import { elementalistEnduranceRegenerationRate, updateEndurance } from './endurance.js';
import { activeSecondaryAttunement, isSelectedSlotSkill, weaponAttunementAvailable } from './weapon-state.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE, elementalistBalanceValue } from '../profiles.js';

function ready(): AvailabilityResult {
  return { ready: true };
}

export function elementalistCoreAvailability(context: ElementalistCastContext, skill: Skill): AvailabilityResult {
  const elementalAvailability = elementalistElementalAvailability(context, skill);
  if (elementalAvailability) return elementalAvailability;
  const state = professionCoreState(context);
  if (
    skill.name === 'Elemental Explosion' &&
    !ELEMENTALIST_ATTUNEMENTS.every((element) => state.pistolBullets[element])
  ) {
    return unavailable(skill, 'elementalist.pistol-bullets', 'requires all four elemental bullets.');
  }

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

  const aura = AURA_TRANSMUTE_SKILLS[Number(skill.id)];
  if (aura && !activeAura(state, aura, context.start)) {
    return unavailable(skill, 'elementalist.aura-transmute', `requires an active ${aura}.`);
  }

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

  if (skill.attunement && !String(skill.attunement).includes('+') && skill.type !== 'Profession') {
    return String(skill.attunement) === state.primaryAttunement
      ? ready()
      : unavailable(skill, 'elementalist.attuned-utility', `requires ${String(skill.attunement)} attunement.`);
  }

  return ready();
}
