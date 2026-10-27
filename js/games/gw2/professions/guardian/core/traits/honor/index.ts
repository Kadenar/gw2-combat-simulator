import { RECIPIENT, ACTOR, WEAPON, BOON } from '#gw2/platform/constants.js';
import { boonKey, isStandardBoon } from '#gw2/platform/combat/boons.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import { balanceNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import {
  guardianCastCompleted,
  type GuardianCastCompletion
} from '#gw2/professions/guardian/core/mechanics/trigger-points.js';
import { guardianCastCause } from '#gw2/professions/guardian/core/mechanics/event-handlers.js';
import { writOfPersistenceEffects } from '#gw2/professions/guardian/core/traits/honor/writ-of-persistence.js';
import { emitTraitSymbol } from '#gw2/professions/guardian/core/traits/symbols.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import type { GuardianRuntime } from '#gw2/professions/guardian/types.js';

/** Owns Empowering Might's live tuning and trait behavior. */
export const empoweringMight = defineTrait({
  name: 'Empowering Might',
  id: TRAIT.EMPOWERING_MIGHT,
  balance: {
    internalCooldown: 1,
    effects: [
      {
        type: 'boon',
        name: boonKey(BOON.MIGHT),
        boon: BOON.MIGHT,
        stacks: 1,
        duration: 8,
        audience: { recipients: RECIPIENT.PARTY }
      }
    ]
  },
  triggers: [
    {
      order: -2,
      emit: TRAIT.EMPOWERING_MIGHT,
      on: 'damage.resolved',
      cooldown: 'profile',
      when: (_runtime, event, details) =>
        event.actorType === ACTOR.PLAYER &&
        Number(event.coefficient) > 0 &&
        (details.hitContext?.damage ?? 0) > 0 &&
        Boolean(details.hitContext?.critEligible && details.hitContext.critical.didCrit),
      attribution: {
        source: 'guardian',
        skillId: TRAIT.EMPOWERING_MIGHT,
        skillName: 'Empowering Might'
      }
    }
  ]
});

/** Owns Protector's Restoration's live tuning and trait behavior. */
export const protectorsRestoration = defineTrait({
  name: "Protector's Restoration",
  id: TRAIT.PROTECTORS_RESTORATION,
  triggers: [
    onTriggerPoint(guardianCastCompleted, {
      when: (_runtime, { cast }: GuardianCastCompletion) => cast.skill.type === 'Heal',
      run: placeProtectorsSymbol
    })
  ]
});

/** Writ changes only symbol lifetimes; each symbol owns its fields, cadences, and repeated payloads. */
export const writOfPersistence = defineTrait({
  name: 'Writ of Persistence',
  id: TRAIT.WRIT_OF_PERSISTENCE,
  balance: { durationExtension: 2 },
  // Field duration is extended by Core after its weapon-field selection; see guardian core hooks.
  hooks: {
    modifyEffects: (runtime: MechanicQueriesOf<GuardianRuntime>, cast, effects) =>
      writOfPersistenceEffects(runtime, cast.skill, effects)
  }
});

/** Owns Force of Will's live tuning and trait behavior. */
export const forceOfWill = defineTrait({
  name: 'Force of Will',
  id: TRAIT.FORCE_OF_WILL,
  balance: { attributeBonus: 300 },
  attributes: traitAttributeEffects(TRAIT.FORCE_OF_WILL, [
    { kind: 'flat', to: 'Vitality', field: 'attributeBonus', feedsConversions: 'all' }
  ])
});

/** Owns Honorable Staff's live tuning and trait behavior. */
export const honorableStaff = defineTrait({
  name: 'Honorable Staff',
  id: TRAIT.HONORABLE_STAFF,
  balance: { attributeBonus: 120 },
  attributes: traitAttributeEffects(TRAIT.HONORABLE_STAFF, [
    { kind: 'flat', to: 'Concentration', field: 'attributeBonus', feedsConversions: 'none' }
  ])
});

/** Mace boons gain base duration before capped boon-duration bonuses; recharge uses the shared controller. */
export const invigoratedBulwark = defineTrait({
  name: 'Invigorated Bulwark',
  id: TRAIT.INVIGORATED_BULWARK,
  balance: { rechargeMultiplier: 0.8, durationMultiplier: 1.33 },
  rechargeRules: [
    {
      when: (_runtime, skill) => skill.weapon === WEAPON.MACE,
      multiplier: { profile: TRAIT.INVIGORATED_BULWARK, field: 'rechargeMultiplier' }
    }
  ],
  hooks: {
    prepareEvent(runtime, event) {
      const skill = runtime.helpers.skillsById.get(event.skillId ?? '');

      if (
        !hasTrait(runtime, TRAIT.INVIGORATED_BULWARK) ||
        event.type !== 'buff' ||
        !isStandardBoon(String(event.kind)) ||
        skill?.weapon !== WEAPON.MACE ||
        event.sourceId !== skill.id
      )
        return event;

      const multiplier = balanceNumberFromContext(runtime, TRAIT.INVIGORATED_BULWARK, 'durationMultiplier');
      // Scaling the skill-owned packet also covers Writ's added pulses without consuming capped bonus duration.
      return { ...event, duration: Number(event.duration) * multiplier };
    }
  }
});

/** A committed heal claims Protection's interval only when its selected symbol can emit. */
function placeProtectorsSymbol(runtime: GuardianRuntime, { cast }: GuardianCastCompletion): void {
  const cause = { ...guardianCastCause(runtime, cast), type: 'action' as const };
  emitTraitSymbol(runtime, TRAIT.PROTECTORS_RESTORATION, ID.LESSER_SYMBOL_OF_PROTECTION, cause);
}
