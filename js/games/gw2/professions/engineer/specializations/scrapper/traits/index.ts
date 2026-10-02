import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import type { EngineerRuntime, EngineerSkill, EngineerResolverEvent } from '#gw2/professions/engineer/types.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type { TraitDefinition } from '#gw2/platform/profession-definition/traits.js';
import { scrapperState } from '#gw2/professions/engineer/specializations/scrapper/state.js';
import {
  applyKineticAcceleratorsCast,
  reactToScrapperCombo,
  triggerMassMomentum,
  reactToScrapperDamage,
  reactToAppliedForceBuff
} from '#gw2/professions/engineer/specializations/scrapper/traits/behavior.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { activeBoonStacks as modifierBoonStacks } from '#gw2/professions/engineer/core/traits/query-helpers.js';

// Ex Machina (adept trait): Function Gyro gets a minimum of 2 ammo charges.

export function scrapperMaximumAmmo(context: EngineerRuntime, skill: EngineerSkill, maximum: number): number {
  return skill.id === ID.FUNCTION_GYRO && hasTrait(context.config, TRAIT.EX_MACHINA)
    ? Math.max(
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.EX_MACHINA), 'maximumAmmo'),
        maximum || 0
      )
    : maximum;
}

/** Owns Ex Machina tuning and its existing gameplay boundaries. */
export const exMachina = defineTrait<EngineerSkill>({
  id: TRAIT.EX_MACHINA,
  name: 'Ex Machina',
  balance: { maximumAmmo: 2 },
  hooks: { maximumAmmo: scrapperMaximumAmmo }
});

// Heal classification includes the toolbelt parent while retaining the Med Kit exception.
const healingSkill = (skill: Skill | undefined) => skill?.type === 'Heal' || skill?.slot === 'Heal';

/** Owns Speed of Synergy tuning and its existing gameplay boundaries. */
export const speedOfSynergy = defineTrait<EngineerSkill>({
  id: TRAIT.SPEED_OF_SYNERGY,
  name: 'Speed of Synergy',
  balance: {
    // Separate authored grants retain the Med Kit toolbelt exception and the per-application cap.
    effects: [
      {
        name: 'Healing skill superspeed',
        type: 'buff',
        kind: 'superspeed',
        duration: 7,
        stacks: 1,
        maximumDuration: 10
      },
      {
        name: 'Healing toolbelt superspeed',
        type: 'buff',
        kind: 'superspeed',
        duration: 7,
        stacks: 1,
        maximumDuration: 10
      },
      {
        name: 'Med Kit toolbelt superspeed',
        type: 'buff',
        kind: 'superspeed',
        duration: 12,
        stacks: 1,
        maximumDuration: 10
      }
    ]
  },
  triggers: [
    {
      emit: TRAIT.SPEED_OF_SYNERGY,
      on: 'castCommit',
      when: (_runtime, cast) => healingSkill(cast.skill) && cast.skill.id !== ID.MED_KIT,
      effects: (effect) => effect.type === 'buff' && effect.name === 'Healing skill superspeed',
      attribution: { actorType: 'player', name: 'Speed of Synergy \u2014 superspeed' }
    },
    ...(['Healing toolbelt superspeed', 'Med Kit toolbelt superspeed'] as const).map<
      Extract<NonNullable<TraitDefinition<EngineerSkill>['triggers']>[number], { on: 'castCommit' }>
    >((name) => ({
      emit: TRAIT.SPEED_OF_SYNERGY,
      on: 'castCommit' as const,
      when: (runtime, cast) =>
        cast.skill.toolbeltParentId != null &&
        healingSkill(runtime.helpers.skillsById.get(cast.skill.toolbeltParentId)) &&
        (cast.skill.toolbeltParentId === ID.MED_KIT) === (name === 'Med Kit toolbelt superspeed'),
      effects: (effect) => effect.type === 'buff' && effect.name === name,
      attribution: { actorType: 'player' as const, name: 'Speed of Synergy \u2014 superspeed' }
    }))
  ]
});

/** Owns Gyroscopic Acceleration tuning and its existing gameplay boundaries. */
export const gyroscopicAcceleration = defineTrait<EngineerSkill>({
  id: TRAIT.GYROSCOPIC_ACCELERATION,
  name: 'Gyroscopic Acceleration',
  balance: {
    effects: [{ name: 'superspeed', type: 'buff', kind: 'superspeed', stacks: 1, duration: 5, maximumDuration: 10 }]
  },
  triggers: [
    {
      emit: TRAIT.GYROSCOPIC_ACCELERATION,
      on: 'castCommit',
      when: (_runtime, cast) =>
        cast.skill.id === ID.FUNCTION_GYRO ||
        Boolean(cast.skill.categories?.some((category) => category.toLowerCase() === 'well')),
      effects: (effect) => effect.type === 'buff' && effect.name === 'superspeed',
      attribution: { actorType: 'player', name: 'Gyroscopic Acceleration \u2014 superspeed' }
    }
  ]
});

/** Owns System Shocker tuning and its existing gameplay boundaries. */
export const systemShocker = defineTrait<EngineerSkill>({
  id: TRAIT.SYSTEM_SHOCKER,
  name: 'System Shocker',
  balance: {
    effects: [{ name: 'System Shocker', type: 'control', controlKind: 'daze' }]
  },
  triggers: [
    {
      emit: TRAIT.SYSTEM_SHOCKER,
      on: 'castCommit',
      when: (_runtime, cast) => cast.skill.id === ID.FUNCTION_GYRO,
      effects: (effect) => effect.type === 'control' && effect.name === 'System Shocker',
      attribution: { name: 'System Shocker — daze' }
    }
  ]
});

/** Owns Kinetic Accelerators tuning and its existing gameplay boundaries. */
export const kineticAccelerators = defineTrait<EngineerSkill>({
  id: TRAIT.KINETIC_ACCELERATORS,
  name: 'Kinetic Accelerators',
  balance: {
    attributeConversion: 0.13,
    internalCooldown: 3,
    effects: [
      { name: 'quickness', type: 'boon', boon: 'quickness', stacks: 1, duration: 3 },
      { name: 'might', type: 'boon', boon: 'might', stacks: 3, duration: 10 }
    ]
  },
  hooks: { onCastCommit: applyKineticAcceleratorsCast, reactions: { 'combo.resolved': reactToScrapperCombo } },
  buildAttributes: (_common, { balanceContext }) => {
    const kineticAcceleratorsProfile = requireBalanceProfileFromContext(balanceContext, TRAIT.KINETIC_ACCELERATORS);
    return {
      attributeEffects: [
        {
          kind: 'conversion',
          from: 'Power',
          to: 'Concentration',
          multiplier: balanceProfileNumber(kineticAcceleratorsProfile, 'attributeConversion'),
          rounding: 'round',
          input: 'eligible'
        }
      ]
    };
  }
});

/** Owns Mass Momentum tuning and its existing gameplay boundaries. */
export const massMomentum = defineTrait<EngineerSkill>({
  id: TRAIT.MASS_MOMENTUM,
  name: 'Mass Momentum',
  balance: {
    pulseInterval: 1,
    effects: [
      { name: 'might', type: 'boon', boon: 'might', stacks: 1, duration: 5 },
      { name: 'stability', type: 'boon', boon: 'stability', stacks: 1, duration: 3 }
    ]
  },
  triggers: [
    {
      on: 'castCommit',
      when: (_runtime, cast) => cast.skill.id === ID.FUNCTION_GYRO,
      emit: TRAIT.MASS_MOMENTUM,
      effects: (effect) => effect.type === 'boon' && effect.name === 'stability',
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.MASS_MOMENTUM,
        actorType: 'player',
        name: 'Mass Momentum — stability'
      }
    }
  ],
  hooks: {
    tasks: {
      'engineer.mass-momentum'(runtime, data) {
        const state = scrapperState.from(runtime);
        if (state.massMomentumAt !== runtime.time) return;
        state.massMomentumAt = Infinity;
        triggerMassMomentum(runtime, { ...(data as EngineerResolverEvent), at: runtime.time });
      }
    },
    reactions: {
      'damage.resolved': reactToScrapperDamage,
      'buff.applied'(runtime, event) {
        if ((event.kind || '').toLowerCase() === 'stability') triggerMassMomentum(runtime, event);
      }
    }
  }
});

/** Owns Applied Force tuning and its existing gameplay boundaries. */
export const appliedForce = defineTrait<EngineerSkill>({
  id: TRAIT.APPLIED_FORCE,
  name: 'Applied Force',
  balance: {
    maximumStacks: 25,
    threshold: 10,
    internalCooldown: 10,
    attributePerStack: 30,
    effects: [{ name: 'stability', type: 'boon', boon: 'stability', stacks: 1, duration: 3 }]
  },
  hooks: { reactions: { 'buff.applied': reactToAppliedForceBuff } }
});

/** Movement boons multiply Object in Motion's player-owned strike bonus. */
export const objectInMotion = defineTrait<EngineerSkill>({
  id: TRAIT.OBJECT_IN_MOTION,
  name: 'Object in Motion',
  modifierRules: [
    {
      // Object in Motion: +5% strike damage per active movement status (stability/swiftness/superspeed).
      // Multiplicative — three statuses = 1.05^3 ≈ +15.8%.
      id: 'engineer.object-in-motion',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      parameters: {
        damageFactorPerBoon: 1.05
      },
      factor: (context, _target, parameters) => {
        const count = ['stability', 'swiftness', 'superspeed'].filter(
          (kind) => modifierBoonStacks(context, kind, 1) > 0
        ).length;
        return parameters.damageFactorPerBoon ** count;
      },
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event)
    }
  ]
});

/** Registers scrapper traits in the established gameplay order. */
export const scrapperTraits = [
  speedOfSynergy,
  gyroscopicAcceleration,
  systemShocker,
  appliedForce,
  massMomentum,
  kineticAccelerators,
  exMachina,
  objectInMotion
];
