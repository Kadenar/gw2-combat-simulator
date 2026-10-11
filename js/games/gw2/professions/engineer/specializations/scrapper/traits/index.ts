import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { activeBuffStacks } from '#gw2/platform/combat/query/runtime-query.js';
import { produceRuntimeCombos } from '#gw2/platform/combos/runtime.js';
import { type SimulationEvent } from '#gw2/platform/events/events.js';
import { type RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MaximumAmmoContext } from '#gw2/platform/profession-definition/runtime-context.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import type { TraitDefinition } from '#gw2/platform/profession-definition/traits.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { activeBoonStacks } from '#gw2/professions/engineer/core/mechanics/resolution-helpers.js';
import { activeBoonStacks as modifierBoonStacks } from '#gw2/professions/engineer/core/traits/query-helpers.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { scrapperState } from '#gw2/professions/engineer/specializations/scrapper/state.js';
import { type EngineerResolverContext } from '#gw2/professions/engineer/types.js';

import { EngineerSkill, type EngineerResolverEvent, type EngineerRuntime } from '#gw2/professions/engineer/types.js';

import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';

// Ex Machina (adept trait): Function Gyro gets a minimum of 2 ammo charges.

export function scrapperMaximumAmmo(
  context: MaximumAmmoContext<object>,
  skill: EngineerSkill,
  maximum: number
): number {
  return skill.id === ID.FUNCTION_GYRO && context.hasTrait(TRAIT.EX_MACHINA)
    ? Math.max(balanceProfileNumber(context.requireBalanceProfile(TRAIT.EX_MACHINA), 'maximumAmmo'), maximum || 0)
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
        // Healing toolbelts grant five seconds; Med Kit combines this with the heal's seven below.
        duration: 5,
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
  // Both the selected Function Gyro finisher and accepted-combo rewards obey producer isolation.
  triggers: [
    {
      on: 'castCommit',
      when: (_runtime, cast) => cast.skill.id === ID.FUNCTION_GYRO,
      run: applyKineticAcceleratorsCast
    },
    { on: 'combo.resolved', run: reactToScrapperCombo }
  ],
  attributes: traitAttributeEffects(TRAIT.KINETIC_ACCELERATORS, [
    {
      kind: 'conversion',
      from: 'Power',
      to: 'Concentration',
      field: 'attributeConversion',
      rounding: 'round',
      input: 'eligible'
    }
  ])
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
  // Reactions may start a pulse loop; its admitted task retains live Stability and selection stop checks.
  triggers: [
    { on: 'damage.resolved', when: (_runtime, event) => Number(event.coefficient) > 0, run: triggerMassMomentum },
    {
      on: 'buff.applied',
      when: (_runtime, event) => (event.kind || '').toLowerCase() === 'stability',
      run: triggerMassMomentum
    },
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
  lifetime: {
    tasks: {
      'engineer.mass-momentum'(runtime, data) {
        const state = scrapperState.from(runtime);
        if (state.massMomentumAt !== runtime.time) return;
        state.massMomentumAt = Infinity;
        triggerMassMomentum(runtime, { ...(data as EngineerResolverEvent), at: runtime.time });
      }
    }
  }
});

/** Owns Applied Force tuning and its existing gameplay boundaries. */
export const appliedForce = defineTrait<EngineerSkill>({
  // Apply the trait portion of Might once for both build assumptions and live boons.
  attributes(context) {
    const profile = requireBalanceProfileFromContext(context.balanceContext, TRAIT.APPLIED_FORCE);

    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Power',
          amount:
            modifierBoonStacks(context, 'might', balanceProfileNumber(profile, 'maximumStacks')) *
            balanceProfileNumber(profile, 'attributePerStack'),
          feedsConversions: false,
          enabled: true
        }
      ]
    };
  },
  id: TRAIT.APPLIED_FORCE,
  name: 'Applied Force',
  balance: {
    maximumStacks: 25,
    threshold: 10,
    internalCooldown: 10,
    attributePerStack: 30,
    effects: [{ name: 'stability', type: 'boon', boon: 'stability', stacks: 1, duration: 3 }]
  },
  // Threshold admission is selected before inspecting Might or claiming its cooldown.
  triggers: [{ on: 'buff.applied', run: reactToAppliedForceBuff }]
});

/** Movement boons multiply Object in Motion's player-owned strike bonus. */
export const objectInMotion = defineTrait<EngineerSkill>({
  id: TRAIT.OBJECT_IN_MOTION,
  name: 'Object in Motion',
  // The trait balance owns tuning consumed by damage rules and presentation.
  balance: { damageMultiplier: 1.05 },
  modifierRules: [
    {
      // Object in Motion: +5% strike damage per active movement status (stability/swiftness/superspeed).
      // Multiplicative — three statuses = 1.05^3 ≈ +15.8%.
      id: 'engineer.object-in-motion',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',

      factor: (context) => {
        const count = ['stability', 'swiftness', 'superspeed'].filter(
          (kind) =>
            (kind === 'superspeed' ? activeBuffStacks(context, kind, 1) : modifierBoonStacks(context, kind, 1)) > 0
        ).length;
        return (
          balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.OBJECT_IN_MOTION), 'damageMultiplier') **
          count
        );
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

/** Keeps one pending Stability pulse and rechecks selection and live Stability before each grant. */
function triggerMassMomentum(context: EngineerRuntime, event: EngineerResolverEvent): void | false {
  if (!hasTrait(context, TRAIT.MASS_MOMENTUM) || activeBoonStacks(context, 'stability', 1, event.at) === 0)
    return false;
  const state = context.procs;
  const massMomentumProfile = requireBalanceProfileFromContext(context, TRAIT.MASS_MOMENTUM);
  if ((state.deadline('massMomentum') || 0) <= event.at) {
    state.setDeadline('massMomentum', event.at + balanceProfileNumber(massMomentumProfile, 'pulseInterval'));
    const massMomentumMight = requireEffect(massMomentumProfile, 'boon', 'might');
    if (massMomentumMight) {
      emitTraitProfile(context, TRAIT.MASS_MOMENTUM, TRAIT.MASS_MOMENTUM, undefined, {
        at: event.at,
        effect: { type: 'boon', name: 'might' },
        durationContext: event,
        attribution: {
          source: 'Trait',
          sourceId: TRAIT.MASS_MOMENTUM,
          actorType: 'effect',
          skillId: undefined,
          activationId: undefined,
          skillName: 'Mass Momentum',
          triggeredBy: event.skillName
        },
        transform: (packet) => ({
          ...packet,
          applicationIndex: undefined,
          totalApplications: undefined,
          name: 'Mass Momentum',
          stacks: Number(massMomentumMight.stacks),
          duration: massMomentumMight.duration
        })
      });

      context.effects.emit({
        attribution: { source: 'Trait', sourceId: TRAIT.MASS_MOMENTUM, actorType: 'effect' },
        kind: 'announcement',
        cause: event,
        announcement: { type: 'trait', name: 'Mass Momentum', at: event.at, sourceSkill: event.skillName, icon: '' }
      });
    }
  }

  const interval = balanceProfileNumber(massMomentumProfile, 'pulseInterval');
  const next = Math.max(event.at + interval, state.deadline('massMomentum') || 0);
  const live = scrapperState.from(context);
  if (interval > 0 && live.massMomentumAt > next) {
    live.massMomentumAt = next;
    context.schedule('engineer.mass-momentum', next, event);
  }
}

function reactToAppliedForceBuff(context: EngineerRuntime, event: EngineerResolverEvent): void {
  const kind = (event.kind || '').toLowerCase();
  // Applied Force (GM trait): reaching 10+ might stacks triggers 3s stability on a 10s ICD.
  if (
    kind === 'might' &&
    activeBoonStacks(
      context,
      'might',
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.APPLIED_FORCE), 'maximumStacks'),
      event.at
    ) >= balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.APPLIED_FORCE), 'threshold')
  ) {
    // Reaching the threshold consumes the interval even if Stability is removed.
    if (context.procs.claim(TRAIT.APPLIED_FORCE, 'appliedForce', event.at)) {
      const appliedForceProfile = requireBalanceProfileFromContext(context, TRAIT.APPLIED_FORCE);
      const appliedForceStability = requireEffect(appliedForceProfile, 'boon', 'stability');
      if (appliedForceStability) {
        emitTraitProfile(context, TRAIT.APPLIED_FORCE, TRAIT.APPLIED_FORCE, undefined, {
          at: event.at,
          effect: { type: 'boon', name: 'stability' },
          durationContext: event,
          attribution: {
            source: 'Trait',
            sourceId: TRAIT.APPLIED_FORCE,
            actorType: 'effect',
            skillId: undefined,
            activationId: undefined,
            skillName: 'Applied Force',
            triggeredBy: event.skillName
          },
          transform: (packet) => ({
            ...packet,
            applicationIndex: undefined,
            totalApplications: undefined,
            name: 'Applied Force',
            stacks: Number(appliedForceStability.stacks),
            duration: appliedForceStability.duration
          })
        });

        context.effects.emit({
          attribution: { source: 'Trait', sourceId: TRAIT.APPLIED_FORCE, actorType: 'effect' },
          kind: 'announcement',
          cause: event,
          announcement: { type: 'trait', name: 'Applied Force', at: event.at, sourceSkill: event.skillName, icon: '' }
        });
      }
    }
  }
}

function applyKineticAcceleratorsCast(context: EngineerRuntime, cast: RuntimeCast<EngineerSkill>): void {
  const skill = cast.skill;
  // Kinetic Accelerators (GM trait): Function Gyro becomes a blast finisher.
  // The marker gives the shared combo materializer a trait-gated descriptor
  // while preserving Function Gyro as the source of the resulting combo.
  produceRuntimeCombos(context, context.helpers, {
    type: 'action',
    endsAt: context.time,
    at: context.time,
    source: 'engineer',
    sourceId: skill.id,
    actorType: 'player',
    skillId: skill.id,
    skillName: skill.name,
    name: 'Kinetic Accelerators — Function Gyro blast finisher',
    activationId: cast.id,
    comboFinishers: [
      {
        ownerId: 'engineer',
        finisherType: 'Blast',
        chance: 1,
        ambiguousFieldSelection: 'oldest'
      }
    ]
  });
}

function reactToScrapperCombo(context: EngineerRuntime, event: EngineerResolverEvent): void {
  if (!grantKineticAcceleratorBoons(context, event)) return;
  context.effects.emit({
    attribution: { source: 'Trait', sourceId: TRAIT.KINETIC_ACCELERATORS, actorType: 'effect' },
    kind: 'announcement',
    cause: event,
    announcement: { type: 'trait', name: 'Kinetic Accelerators', at: event.at, sourceSkill: event.skillName, icon: '' }
  });
}

/** Each accepted combo grants boons once, with a live Whirl-only internal cooldown. */
function grantKineticAcceleratorBoons(context: EngineerResolverContext, event: SimulationEvent) {
  if (event.type !== 'combo' || !['Blast', 'Leap', 'Whirl'].includes(String(event.finisherType))) return false;
  if (event.finisherType === 'Whirl') {
    // Only Whirl finishers claim an interval; Blast and Leap remain independent.
    if (!context.procs.claim(TRAIT.KINETIC_ACCELERATORS, 'engineer.scrapper.kineticAcceleratorsWhirl', event.at))
      return false;
  }

  let emitted = false;
  for (const kind of ['quickness', 'might']) {
    const receipts = emitTraitProfile(context, TRAIT.KINETIC_ACCELERATORS, TRAIT.KINETIC_ACCELERATORS, undefined, {
      at: event.at,
      effect: { type: 'boon', name: kind },
      receipt: true,
      durationContext: event,
      attribution: {
        actorType: 'effect',
        skillId: event.skillId,
        skillName: event.skillName,
        activationId: event.activationId,
        name: 'Kinetic Accelerators \u2014 ' + kind,
        priority: Number(event.priority || 0),
        audience: { recipients: 'party' }
      },
      transform: (packet) => ({
        ...packet,
        comboId: event.comboId,
        applicationIndex: undefined,
        totalApplications: undefined
      })
    });
    emitted = receipts.length > 0 || emitted;
  }

  return emitted;
}
