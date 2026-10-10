import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { skillForEvent, targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import type { TriggerPointInput } from '#gw2/platform/profession-definition/trigger-points.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { burstFirstHit, controlAccepted } from '#gw2/professions/warrior/core/mechanics/combat.js';
import { warriorBoonActive } from '#gw2/professions/warrior/core/traits/modifier-queries.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { grantWarriorResource } from '#gw2/professions/warrior/resource-rules.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';

/** Owns this trait's tuning and selected contributions. */
export const mercilessHammer = defineTrait({
  triggers: [onTriggerPoint(controlAccepted, { run: (runtime) => mercilessHammerControl(runtime) })],
  id: TRAIT.MERCILESS_HAMMER,
  name: 'Merciless Hammer',
  balance: {
    damageMultiplier: 1.25,
    resourceGain: 7
  },
  modifierRules: [
    {
      id: 'warrior.merciless-hammer',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.MERCILESS_HAMMER), 'damageMultiplier'),
      order: 94,
      when: (context) =>
        ['Hammer', 'Mace'].includes(
          String(
            context.event?.skillWeapon ||
              skillForEvent(context.profession?.catalog, context.event, context.skillId)?.skillWeapon ||
              skillForEvent(context.profession?.catalog, context.event, context.skillId)?.weapon ||
              ''
          )
        ) && Boolean(context.config?.target?.defiant)
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const stalwartStrength = defineTrait({
  id: TRAIT.STALWART_STRENGTH,
  name: 'Stalwart Strength',
  balance: {
    damageMultiplier: 1.1,
    internalCooldown: 0.32,
    effects: [{ name: 'stability', type: 'boon', boon: 'stability', stacks: 1, duration: 5 }]
  },
  modifierRules: [
    {
      id: 'warrior.stalwart-strength',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.STALWART_STRENGTH), 'damageMultiplier'),
      order: 95,
      when: (context) => warriorBoonActive(context, 'stability')
    }
  ],
  triggers: [
    {
      order: 0,

      on: 'control.resolved',
      when: (_runtime, event) => event.actorType === 'player',
      emit: TRAIT.STALWART_STRENGTH,
      cooldown: 'profile',
      attribution: { priority: 5 }
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const cullTheWeak = defineTrait({
  triggers: [
    onTriggerPoint(burstFirstHit, {
      run: (runtime, input: TriggerPointInput<typeof burstFirstHit>) => cullTheWeakBurst(runtime, input.event)
    })
  ],
  id: TRAIT.CULL_THE_WEAK,
  name: 'Cull the Weak',
  balance: {
    damageMultiplier: 1.1,
    internalCooldown: 5,
    effects: [{ name: 'Weakness', type: 'condition', condition: 'Weakness', duration: 3.5, stacks: 1 }]
  },
  modifierRules: [
    {
      id: 'warrior.cull-the-weak',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.CULL_THE_WEAK), 'damageMultiplier'),
      order: 93,
      when: (context) => targetConditionActive(context, 'Weakness')
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const thickSkin = defineTrait({
  id: TRAIT.THICK_SKIN,
  name: 'Thick Skin',
  balance: {
    effects: [{ name: 'protection', type: 'boon', boon: 'protection', stacks: 1, duration: 3 }]
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

type WarriorRuntime = MechanicContext<WarriorRuntimeState, WarriorSkill>;

/** Apply line-owned rewards at the shared reaction boundary. */
function mercilessHammerControl(runtime: WarriorRuntime): void {
  grantWarriorResource(
    runtime,
    balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.MERCILESS_HAMMER), 'resourceGain')
  );
}

/** Apply line-owned rewards at the shared reaction boundary. */
function cullTheWeakBurst(runtime: WarriorRuntime, event: Gw2ResolverEvent): void {
  if (runtime.procs.claim(TRAIT.CULL_THE_WEAK)) {
    const traitProfile = requireBalanceProfileFromContext(runtime, TRAIT.CULL_THE_WEAK);
    emitTraitProfile(runtime, TRAIT.CULL_THE_WEAK, TRAIT.CULL_THE_WEAK, event, {
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.CULL_THE_WEAK,
        actorType: 'effect',
        skillId: event.skillId,
        skillName: event.skillName
      },
      transform: (packet) => ({ ...packet, priority: 5, name: traitProfile.name, stacks: 1 * Number(packet.stacks) }),
      effects: (effect) => ['boon', 'buff', 'condition'].includes(effect.type)
    });
  }
}
