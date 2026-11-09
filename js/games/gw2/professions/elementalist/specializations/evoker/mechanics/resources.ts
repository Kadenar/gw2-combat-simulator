/** Define public charge clocks, weapon charge amounts, and resource readings for the familiar lifecycle. */
import type { ResourcePolicy } from '#gw2/platform/combat/resources/resource-policy.js';
import { ACTOR, WEAPON } from '#gw2/platform/constants.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { BalanceProfileSource } from '#gw2/platform/skills/balance-profiles.js';
import { balanceNumber, balanceProfileNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill, SkillId } from '#gw2/platform/skills/types.js';
// Use Core's bundle names so conjure availability and familiar-charge exclusions agree.
import { CONJURED_WEAPONS } from '#gw2/professions/elementalist/core/constants.js';
import {
  ELEMENTALIST_TRAIT_IDS as EVOKER_TRAIT,
  ELEMENTALIST_SKILL_IDS as ID
} from '#gw2/professions/elementalist/data/ids.js';
import { evokerState, type EvokerState } from '#gw2/professions/elementalist/specializations/evoker/state.js';
import { evokerChargeProfile } from '#gw2/professions/elementalist/specializations/evoker/traits/attunement-policy.js';
import type { ElementalistRuntime, ElementalistSkill } from '#gw2/professions/elementalist/types.js';
import { boundedNumber } from '#kernel/core/numeric.js';

/** Weapon skills exempted from familiar charge generation despite sitting in slots 2-5. */
const EVOKER_NO_CHARGE_SKILLS: ReadonlySet<SkillId> = new Set([
  ID.TRANSMUTE_EARTH,
  ID.HURL,
  ID.TRANSMUTE_FROST,
  ID.TRANSMUTE_LIGHTNING,
  ID.TRANSMUTE_FIRE,
  ID.GRAND_FINALE
]);

/** Lesser and completed spear etchings excluded from charge generation. */
const EVOKER_NO_CHARGE_SPEAR_SKILLS: ReadonlySet<SkillId> = new Set([
  ID.LESSER_VOLCANO,
  ID.VOLCANO,
  ID.LESSER_JO_KULHLAUP,
  ID.JO_KULHLAUP,
  ID.LESSER_DERECHO,
  ID.DERECHO,
  ID.LESSER_HABOOB,
  ID.HABOOB
]);

/** Familiar pools have no passive recovery; traits select capacity before any initialization hooks run. */
export const familiarChargePolicy: ResourcePolicy<ElementalistRuntime> = {
  kind: 'continuous',
  state: (context) => evokerState.from(context.profession).familiarCharges,
  maximum: (context) => balanceProfileNumber(evokerChargeProfile(context.helpers, context), 'maximumStacks'),
  initial: (context, maximum) => boundedNumber(context.config.initialEvokerCharges ?? maximum, maximum, 0, maximum),
  recovery: () => 0
};

/** Empowered progress is earned only by completed basic conversions, independently of familiar charge capacity. */
export const empoweredChargePolicy: ResourcePolicy<ElementalistRuntime> = {
  kind: 'continuous',
  state: (context) => evokerState.from(context.profession).empoweredCharges,
  maximum: (context) => balanceNumber(context.helpers, EVOKER_TRAIT.EVOCATION, 'minimumStacks'),
  initial: (context, maximum) => boundedNumber(context.config.initialEvokerEmpowered ?? 0, 0, 0, maximum),
  recovery: () => 0
};

/** Publishes the current charge and empowered totals as an absolute reading at the cast's end. */
export function emitResource(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: Skill,
  state: EvokerState
): void {
  context.effects.emit({
    kind: 'packet',
    event: {
      type: 'resource',
      at: cast.effectiveEnd,
      source: skill.name,
      sourceId: skill.id,
      actorType: ACTOR.PLAYER,
      skillName: skill.name,
      kind: 'evoker-charges',
      value: state.familiarCharges.value,
      maximum: state.familiarCharges.maximum,
      empowered: state.empoweredCharges.value
    }
  });
}

/**
 * Charges a single weapon skill is worth: zero for anything outside weapon slots
 * 2-5, conjures, exempt skills, and lesser or completed spear etchings;
 * otherwise the matching-element amount when the skill shares the selected
 * element, and the smaller off-element amount when it does not.
 */
export function weaponSkillChargeGain(
  source: BalanceProfileSource,
  context: unknown,
  skill: ElementalistSkill,
  state: Pick<EvokerState, 'element'>
): number {
  const slot = /^Weapon_(\d)$/.exec(String(skill.slot || ''));

  if (
    skill.type !== 'Weapon' ||
    !slot ||
    Number(slot[1]) < 2 ||
    Number(slot[1]) > 5 ||
    CONJURED_WEAPONS.has(skill.skillWeapon || skill.weapon || '') ||
    EVOKER_NO_CHARGE_SKILLS.has(skill.id) ||
    (skill.weapon === WEAPON.SPEAR && EVOKER_NO_CHARGE_SPEAR_SKILLS.has(skill.id))
  ) {
    return 0;
  }

  // Split-attunement skills gain the matching-element amount; Specialized
  // Elements raises that amount from two charges to three.
  return (skill.attunement || '').split('+').includes(state.element)
    ? balanceProfileNumber(evokerChargeProfile(source, context), 'playerStacks')
    : balanceNumber(source, EVOKER_TRAIT.EVOCATION, 'allyStacks');
}
