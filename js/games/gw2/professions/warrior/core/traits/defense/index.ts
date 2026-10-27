import { WEAPON, ACTOR, BOON, CONDITION } from '#gw2/platform/constants.js';
import { boonKey } from '#gw2/platform/combat/boons.js';
import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { skillForEvent, targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';

import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import type { TriggerPointInput } from '#gw2/platform/profession-definition/trigger-points.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import { balanceNumberFromContext, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { burstFirstHit, controlAccepted } from '#gw2/professions/warrior/core/mechanics/trigger-points.js';
import { warriorBoonActive } from '#gw2/professions/warrior/core/traits/modifier-queries.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { grantWarriorResource } from '#gw2/professions/warrior/resource-rules.js';
import type { WarriorRuntime } from '#gw2/professions/warrior/types.js';

/** Owns this trait's tuning and selected contributions. */
export const mercilessHammer = defineTrait({
  name: 'Merciless Hammer',
  id: TRAIT.MERCILESS_HAMMER,
  balance: {
    damageMultiplier: 1.25,
    resourceGain: 7
  },
  modifierRules: [
    {
      id: 'warrior.merciless-hammer',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) => balanceNumberFromContext(context, TRAIT.MERCILESS_HAMMER, 'damageMultiplier'),
      order: 94,
      when: (context) =>
        [WEAPON.HAMMER, WEAPON.MACE].some(
          (member) =>
            member ===
            String(
              context.event?.skillWeapon ||
                skillForEvent(context.profession?.catalog, context.event, context.skillId)?.skillWeapon ||
                skillForEvent(context.profession?.catalog, context.event, context.skillId)?.weapon ||
                ''
            )
        ) && Boolean(context.config?.target?.defiant)
    }
  ],
  triggers: [onTriggerPoint(controlAccepted, { run: (runtime) => mercilessHammerControl(runtime) })]
});

/** Owns this trait's tuning and selected contributions. */
export const stalwartStrength = defineTrait({
  name: 'Stalwart Strength',
  id: TRAIT.STALWART_STRENGTH,
  balance: {
    damageMultiplier: 1.1,
    internalCooldown: 0.32,
    effects: [{ name: boonKey(BOON.STABILITY), type: 'boon', boon: BOON.STABILITY, stacks: 1, duration: 5 }]
  },
  modifierRules: [
    {
      id: 'warrior.stalwart-strength',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) => balanceNumberFromContext(context, TRAIT.STALWART_STRENGTH, 'damageMultiplier'),
      order: 95,
      when: (context) => warriorBoonActive(context, boonKey(BOON.STABILITY))
    }
  ],
  triggers: [
    {
      order: 0,

      on: 'control.resolved',
      when: (_runtime, event) => event.actorType === ACTOR.PLAYER,
      emit: TRAIT.STALWART_STRENGTH,
      cooldown: 'profile',
      attribution: { priority: 5 }
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const cullTheWeak = defineTrait({
  name: 'Cull the Weak',
  id: TRAIT.CULL_THE_WEAK,
  balance: {
    damageMultiplier: 1.1,
    internalCooldown: 5,
    effects: [{ name: CONDITION.WEAKNESS, type: 'condition', condition: CONDITION.WEAKNESS, duration: 3.5, stacks: 1 }]
  },
  modifierRules: [
    {
      id: 'warrior.cull-the-weak',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) => balanceNumberFromContext(context, TRAIT.CULL_THE_WEAK, 'damageMultiplier'),
      order: 93,
      when: (context) => targetConditionActive(context, CONDITION.WEAKNESS)
    }
  ],
  triggers: [
    onTriggerPoint(burstFirstHit, {
      run: (runtime, input: TriggerPointInput<typeof burstFirstHit>) => cullTheWeakBurst(runtime, input.event)
    })
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const thickSkin = defineTrait({
  name: 'Thick Skin',
  id: TRAIT.THICK_SKIN,
  balance: {
    effects: [{ name: boonKey(BOON.PROTECTION), type: 'boon', boon: BOON.PROTECTION, stacks: 1, duration: 3 }]
  },
  triggers: [
    {
      order: 6,

      on: 'castStart',
      when: (_runtime, cast) => cast.skill.type === 'Heal',
      emit: TRAIT.THICK_SKIN,
      attribution: { name: 'Thick Skin', priority: 0 }
    }
  ]
});

/** Apply line-owned rewards at the shared reaction boundary. */
function mercilessHammerControl(runtime: WarriorRuntime): void {
  grantWarriorResource(runtime, balanceNumberFromContext(runtime, TRAIT.MERCILESS_HAMMER, 'resourceGain'));
}

/** Apply line-owned rewards at the shared reaction boundary. */
function cullTheWeakBurst(runtime: WarriorRuntime, event: Gw2ResolverEvent): void {
  if (runtime.procs.claim(TRAIT.CULL_THE_WEAK)) {
    const traitProfile = requireBalanceProfileFromContext(runtime, TRAIT.CULL_THE_WEAK);
    emitTraitProfile(runtime, TRAIT.CULL_THE_WEAK, TRAIT.CULL_THE_WEAK, event, {
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.CULL_THE_WEAK,
        actorType: ACTOR.EFFECT,
        skillId: event.skillId,
        skillName: event.skillName
      },
      transform: (packet) => ({ ...packet, priority: 5, name: traitProfile.name, stacks: 1 * Number(packet.stacks) }),
      effects: (effect) => ['boon', 'buff', 'condition'].includes(effect.type)
    });
  }
}
