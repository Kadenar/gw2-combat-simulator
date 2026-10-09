import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { buildRangerPacket } from '#gw2/professions/ranger/core/events.js';
import { isPetStrike, isPlayerStrike } from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import type { RangerRuntime, RangerSkill } from '#gw2/professions/ranger/types.js';

/** Owns Child of Earth's live tuning and trait behavior. */
export const childOfEarth = defineTrait({
  id: TRAIT.CHILD_OF_EARTH,
  name: 'Child of Earth',
  balance: {
    // This produced skill recharges with the player's Alacrity; ordinary trait ICDs remain fixed.
    cooldownPolicy: 'playerRecharge',
    cooldown: 20,
    pulseInterval: 2,
    maximumStacks: 5,
    effects: [
      {
        name: 'Immobilized',
        type: 'condition',
        condition: 'Immobilized',
        duration: 1,
        stacks: 1
      },
      { name: 'Crippled', type: 'condition', condition: 'Crippled', duration: 2, stacks: 1 },
      { name: 'Slow', type: 'condition', condition: 'Slow', duration: 1, stacks: 1 }
    ]
  }
});

/** Owns Poison Master's live tuning and trait behavior. */
export const poisonMaster = defineTrait({
  id: TRAIT.POISON_MASTER,
  name: 'Poison Master',
  balance: {
    effects: [{ name: 'Poisoned', type: 'condition', condition: 'Poisoned', duration: 8, stacks: 2 }]
  },
  modifierRules: [
    {
      order: 13,
      id: 'ranger.poison-master',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'multiply',
      factor: 1.25,
      // The damage bonus is Ranger-owned; the separately triggered pet attack also resolves from Ranger stats.
      when: (context) => context.condition === 'Poisoned' && isGw2PlayerModifierOwnedEvent(context.event)
    }
  ]
});

/** Owns Arachnophobia's live tuning and trait behavior. */
export const arachnophobia = defineTrait({
  id: TRAIT.ARACHNOPHOBIA,
  name: 'Arachnophobia',
  balance: {
    // Torment belongs to the triggering spider/devourer pet; pet damage is excluded from this preview.
    damagePreviewAttribution: 'summon',
    attributeBonus: 150,
    weaponAttributeBonus: 225,
    effects: [{ name: 'Torment', type: 'condition', condition: 'Torment', duration: 3, stacks: 1 }]
  },
  buildAttributes: traitAttributeEffects(TRAIT.ARACHNOPHOBIA, [
    { kind: 'flat', to: 'Expertise', field: 'attributeBonus', feedsConversions: false }
  ])
});

/** Owns Carnivore's live tuning and trait behavior. */
export const carnivore = defineTrait({
  id: TRAIT.CARNIVORE,
  name: 'Carnivore',
  balance: {
    internalCooldown: 0.25,
    // Resolve and display the siphon separately, using base damage plus Power without weapon or armor scaling.
    effects: [
      {
        name: 'Strike',
        type: 'strike',
        coefficient: 0,
        flatStrikeBase: 3255,
        flatStrikePowerCoeff: 0.05,
        damageBreakdownName: 'Life Siphon - Carnivore',
        hits: 1,
        canCrit: false,
        damageKind: 'life-steal'
      }
    ]
  },
  triggers: [
    {
      order: 0,
      emit: TRAIT.CARNIVORE,
      on: 'control.resolved',
      cooldown: 'profile',
      when: (runtime, event) =>
        (isPlayerStrike(event) || isPetStrike(event)) &&
        Boolean(requireEffect(requireBalanceProfileFromContext(runtime, TRAIT.CARNIVORE), 'strike', 'Strike')),
      effects: (effect) => effect.type === 'strike' && effect.name === 'Strike',
      attribution: (_runtime, event) => ({
        skillId: TRAIT.CARNIVORE,
        skillName: 'Carnivore',
        name: 'Carnivore',
        skillWeapon: 'Unequipped',
        triggeredBy: event.skillName
      })
    }
  ]
});

/** Owns Natural Vigor's live tuning and trait behavior. */
export const naturalVigor = defineTrait({
  id: TRAIT.NATURAL_VIGOR,
  name: 'Natural Vigor',
  balance: {
    vigorRegenerationMultiplier: 0.25
  }
});

/** Owns Ambidexterity's live tuning and trait behavior. */
export const ambidexterity = defineTrait({
  id: TRAIT.AMBIDEXTERITY,
  name: 'Ambidexterity',
  balance: {
    weaponAttributeBonus: 240,
    attributeBonus: 120,
    rechargeMultiplier: 0.8
  },
  rechargeRules: [
    {
      order: 4,
      when: (_runtime, skill) => ['Dagger', 'Torch'].includes(String(skill.weapon)),
      multiplier: { profile: TRAIT.AMBIDEXTERITY, field: 'rechargeMultiplier' }
    }
  ],
  buildAttributes: (_common, { balanceContext: profileContext, build, weaponSet }) => {
    const profile = requireBalanceProfileFromContext(profileContext, TRAIT.AMBIDEXTERITY);
    const weapons = (weaponSet === 2 ? build.alternateWeapons : build.weapons) || [];
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Condition Damage',
          amount: balanceProfileNumber(
            profile,
            weapons.some((weapon) => ['Dagger', 'Mace', 'Torch'].includes(weapon))
              ? 'weaponAttributeBonus'
              : 'attributeBonus'
          ),
          feedsConversions: false
        }
      ]
    };
  }
});

/** Owns Survival Instincts's live tuning and trait behavior. */
export const survivalInstincts = defineTrait({
  id: TRAIT.SURVIVAL_INSTINCTS,
  name: 'Survival Instincts',
  modifierRules: [
    {
      order: 14,
      id: 'ranger.survival-instincts',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: 0.15,
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event)
    }
  ]
});

/** Owns Core Ranger Wilderness Survival condition and control-triggered trait behavior. */

// On an eligible heal, claim Lesser Muddy Terrain's recharge and emit the initial
// immobilize followed by the profile-defined Muddy Terrain condition pulses.
export function emitChildOfEarth(context: RangerRuntime, skill: RangerSkill): void {
  if (!hasTrait(context, TRAIT.CHILD_OF_EARTH)) return;

  const profile = requireBalanceProfileFromContext(context, TRAIT.CHILD_OF_EARTH);
  const immobilized = requireEffect(profile, 'condition', 'Immobilized');
  // Pulse conditions keep their own identities, so removing one never rebinds another.
  const pulses = [requireEffect(profile, 'condition', 'Crippled'), requireEffect(profile, 'condition', 'Slow')].filter(
    (effect) => effect !== undefined
  );
  // The cooldown gates the lesser field; with every packet removed there is nothing to gate.
  if (!immobilized && !pulses.length) return;
  if (!context.procs.claim(TRAIT.CHILD_OF_EARTH, 'ranger.core.childOfEarth', context.time)) return;
  const at = context.time;
  if (immobilized)
    context.effects.emit({
      kind: 'packet',
      event: buildRangerPacket(
        {
          at,
          source: 'Trait',
          actorType: 'effect',
          skillId: TRAIT.CHILD_OF_EARTH,
          skillName: 'Child of Earth',
          name: 'Lesser Muddy Terrain - Immobilized',
          condition: String(immobilized.condition),
          duration: effectNumber(profile, immobilized, 'duration'),
          stacks: effectNumber(profile, immobilized, 'stacks'),
          triggeredBy: skill.name
        },
        'condition'
      )
    });
  const applications = balanceProfileNumber(profile, 'maximumStacks');
  const interval = balanceProfileNumber(profile, 'pulseInterval');
  for (let application = 0; application < applications; application += 1) {
    for (const effect of pulses) {
      const condition = String(effect.condition);
      context.effects.emit({
        kind: 'packet',
        event: buildRangerPacket(
          {
            at: at + application * interval,
            source: 'Trait',
            actorType: 'effect',
            skillId: TRAIT.CHILD_OF_EARTH,
            skillName: 'Child of Earth',
            name: `Lesser Muddy Terrain - ${condition}`,
            condition,
            duration: effectNumber(profile, effect, 'duration'),
            stacks: effectNumber(profile, effect, 'stacks'),
            triggeredBy: skill.name
          },
          'condition'
        )
      });
    }
  }
}
