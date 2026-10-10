import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { vulnerabilityStacks } from '#gw2/platform/combat/query/runtime-query.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import type { TriggerPointInput } from '#gw2/platform/profession-definition/trigger-points.js';
import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import {
  revenantRuntimeCoreState,
  revenantRuntimeSpecializationState
} from '#gw2/professions/revenant/core/state-queries.js';
import {
  REVENANT_SKILL_IDS as ID,
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_TRAIT_IDS as TRAIT
} from '#gw2/professions/revenant/data/ids.js';
import { energyCostAccepted } from '#gw2/professions/revenant/specializations/conduit/mechanics/affinity-gains.js';
import { affinityGranted, gainAffinity } from '#gw2/professions/revenant/specializations/conduit/mechanics/affinity.js';
import {
  entityBoonCompleted,
  entityCastCompleted
} from '#gw2/professions/revenant/specializations/conduit/mechanics/boundaries.js';
import { scheduleFormExpiry } from '#gw2/professions/revenant/specializations/conduit/mechanics/form-expiry.js';
import {
  conduitLegendReset,
  conduitLegendSettled,
  cosmicWisdomEntered,
  cosmicWisdomEntering
} from '#gw2/professions/revenant/specializations/conduit/mechanics/forms.js';
import {
  CONDUIT_BALANCE_PROFILE_IDS,
  CONDUIT_BALANCE_PROFILE_IDS as PROFILE
} from '#gw2/professions/revenant/specializations/conduit/profiles.js';
import {
  BEGUILING_HAZE_SKILL_IDS,
  TWIN_MOON_SKILL_IDS
} from '#gw2/professions/revenant/specializations/conduit/skill-groups.js';
import { conduitState } from '#gw2/professions/revenant/specializations/conduit/state.js';
import { bolsteredBondsBonuses } from '#gw2/professions/revenant/specializations/conduit/traits/behavior.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';

/** Owns Bolstered Bonds tuning and behavior at its established execution boundaries. */
export const bolsteredBonds = defineTrait({
  attributes: (context) => ({
    attributeEffects: Object.entries(
      bolsteredBondsBonuses(
        context.balanceContext,
        context.runtime ? revenantRuntimeCoreState(context).selectedLegendIds : context.loadout.selectedLegends,
        (revenantRuntimeSpecializationState(context, 'Conduit').cosmicWisdomUntil ?? 0) > context.time
          ? balanceProfileNumber(
              requireBalanceProfileFromContext(context.balanceContext, TRAIT.BOLSTERED_BONDS),
              'attributeMultiplier'
            )
          : 1
      )
    ).map(([attribute, amount]) => ({
      kind: 'flat' as const,
      to: BUILD_ATTRIBUTE_NAMES[attribute as keyof typeof BUILD_ATTRIBUTE_NAMES],
      amount,
      feedsConversions: false
    }))
  }),
  id: TRAIT.BOLSTERED_BONDS,
  name: 'Bolstered Bonds',
  balance: {
    assassinAttributeBonus: 75,
    centaurAttributeBonus: 150,
    demonAttributeBonus: 75,
    dwarfAttributeBonus: 150,
    entityAttributeBonus: 75,
    attributeMultiplier: 2
  }
});

const BUILD_ATTRIBUTE_NAMES = Object.freeze({
  power: 'Power',
  precision: 'Precision',
  toughness: 'Toughness',
  vitality: 'Vitality',
  ferocity: 'Ferocity',
  conditionDamage: 'Condition Damage',
  expertise: 'Expertise',
  concentration: 'Concentration',
  healingPower: 'Healing Power'
});

/** Owns Conductive Armaments tuning and behavior at its established execution boundaries. */
export const conductiveArmaments = defineTrait({
  triggers: [
    onTriggerPoint(energyCostAccepted, {
      run: (runtime, input: TriggerPointInput<typeof energyCostAccepted>) =>
        grantConductiveArmaments(runtime, input.cast.skill)
    })
  ],
  id: TRAIT.CONDUCTIVE_ARMAMENTS,
  name: 'Conductive Armaments'
});

/** Owns Enhanced Embodiment tuning and behavior at its established execution boundaries. */
export const enhancedEmbodiment = defineTrait({
  triggers: [
    onTriggerPoint(conduitLegendReset, {
      run: (runtime, input: TriggerPointInput<typeof conduitLegendReset>) =>
        extendEnhancedEmbodiment(runtime, input.formActive)
    })
  ],
  id: TRAIT.ENHANCED_EMBODIMENT,
  name: 'Enhanced Embodiment',
  balance: {
    id: CONDUIT_BALANCE_PROFILE_IDS.enhancedEmbodiment,
    rechargeMultiplier: 0.6,
    effects: [
      {
        name: 'cosmic-wisdom-extension',
        type: 'buff',
        kind: 'cosmic-wisdom-extension',
        duration: 1,
        stacks: 1
      }
    ]
  }
});

/** Owns Expanded Consciousness tuning and behavior at its established execution boundaries. */
export const expandedConsciousness = defineTrait({
  triggers: [
    onTriggerPoint(affinityGranted, {
      run: (runtime, input: TriggerPointInput<typeof affinityGranted>) =>
        grantExpandedConsciousness(runtime, input.previous, input.maximum)
    })
  ],
  id: TRAIT.EXPANDED_CONSCIOUSNESS,
  name: 'Expanded Consciousness',
  balance: { id: CONDUIT_BALANCE_PROFILE_IDS.expandedConsciousness, resourceGain: 15, effects: [] }
});

/** Owns Found Purpose tuning and behavior at its established execution boundaries. */
export const foundPurpose = defineTrait({
  triggers: [
    onTriggerPoint(conduitLegendSettled, {
      run: (runtime, input: TriggerPointInput<typeof conduitLegendSettled>) =>
        grantFoundPurpose(runtime, input.cast, input.combat)
    })
  ],
  id: TRAIT.FOUND_PURPOSE,
  name: 'Found Purpose'
});

/** Owns Kinetic Insight tuning and behavior at its established execution boundaries. */
export const kineticInsight = defineTrait({
  id: TRAIT.KINETIC_INSIGHT,
  name: 'Kinetic Insight',
  balance: { rechargeMultiplier: 0.8, resourceGain: 2, effects: [] }
});

/** Owns Lingering Determination tuning and behavior at its established execution boundaries. */
export const lingeringDetermination = defineTrait({
  triggers: [
    onTriggerPoint(conduitLegendReset, {
      run: (runtime, input: TriggerPointInput<typeof conduitLegendReset>) =>
        grantLingeringDetermination(runtime, input.combat)
    })
  ],
  id: TRAIT.LINGERING_DETERMINATION,
  name: 'Lingering Determination',
  balance: { id: CONDUIT_BALANCE_PROFILE_IDS.lingeringDetermination, resourceGain: 2, effects: [] }
});

/** Owns Mistfire tuning and behavior at its established execution boundaries. */
export const mistfire = defineTrait({
  id: TRAIT.MISTFIRE,
  name: 'Mistfire',
  balance: {
    id: CONDUIT_BALANCE_PROFILE_IDS.mistfire,
    internalCooldown: 1,
    effects: [
      {
        type: 'strike',
        coefficient: 0.6,
        hits: 1,
        name: 'Mistfire',
        actorType: 'effect'
      },
      {
        name: 'Burning',
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 6,
        actorType: 'effect'
      }
    ]
  },
  triggers: [
    onTriggerPoint(cosmicWisdomEntering, {
      run: (runtime, input: TriggerPointInput<typeof cosmicWisdomEntering>) => emitCosmicMistfire(runtime, input.cast)
    }),
    {
      emit: PROFILE.mistfire,
      on: 'control.resolved',
      cooldown: 'profile',
      when: (runtime, event) =>
        !(event.skillId != null && TWIN_MOON_SKILL_IDS.has(event.skillId)) &&
        Boolean(requireEffect(requireBalanceProfileFromContext(runtime, PROFILE.mistfire), 'condition', 'Burning')),
      effects: (effect) => effect.type === 'condition' && effect.name === 'Burning',
      attribution: {
        source: 'revenant',
        ownerActorType: 'player',
        skillId: TRAIT.MISTFIRE,
        skillName: 'Mistfire',
        name: 'Mistfire — Burning'
      }
    }
  ]
});

/** Owns Numinous Gift tuning and behavior at its established execution boundaries. */
export const numinousGiftTrait = defineTrait({
  triggers: [
    onTriggerPoint(cosmicWisdomEntered, {
      // Numinous Gift is Conduit's intrinsic minor: Cosmic Wisdom grants its boons whether or not the trait is listed.
      requiresSelection: false,
      run: (runtime, input: TriggerPointInput<typeof cosmicWisdomEntered>) => numinousGift(runtime, input.cast)
    })
  ],
  attributes: (context) => ({
    traitDurations: hasTrait(context, TRAIT.YEARNING_EMPOWERMENT)
      ? Object.fromEntries(
          ['Bleeding', 'Burning', 'Confusion', 'Poison', 'Torment'].map((condition) => [
            condition + ' Duration',
            100 *
              balanceProfileNumber(
                requireBalanceProfileFromContext(context.balanceContext, CONDUIT_BALANCE_PROFILE_IDS.numinousGift),
                'conditionDurationBonus'
              )
          ])
        )
      : {}
  }),
  id: TRAIT.NUMINOUS_GIFT,
  name: 'Numinous Gift',
  balance: {
    id: CONDUIT_BALANCE_PROFILE_IDS.numinousGift,
    damageIncrease: 0.05,
    conditionDurationBonus: 0.05,
    effects: [
      { type: 'boon', boon: 'might', duration: 10, stacks: 5 },
      {
        type: 'boon',
        boon: 'fury',
        duration: 10,
        stacks: 1,
        metadata: { legendId: LEGEND.ASSASSIN }
      },
      {
        type: 'boon',
        boon: 'resistance',
        duration: 5,
        stacks: 1,
        metadata: { legendId: LEGEND.DEMON }
      },
      {
        type: 'boon',
        boon: 'stability',
        duration: 5,
        stacks: 1,
        metadata: { legendId: LEGEND.DWARF }
      },
      {
        type: 'boon',
        boon: 'protection',
        duration: 5,
        stacks: 1,
        metadata: { legendId: LEGEND.CENTAUR }
      },
      {
        type: 'boon',
        boon: 'quickness',
        duration: 5,
        stacks: 1,
        metadata: { legendId: LEGEND.ENTITY }
      }
    ]
  },
  modifierRules: [
    {
      id: 'revenant.targeted-destruction-numinous-gift',
      order: 100,
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',

      // Numinous Gift unlocks Targeted Destruction's bonus; the factor is expressed as a multiplier delta on top of
      // the existing vulnerability bonus so both traits stack multiplicatively with the base formula.
      factor: (context) => {
        const base =
          1 +
          vulnerabilityStacks(context) *
            balanceProfileNumber(
              requireBalanceProfileFromContext(context, TRAIT.TARGETED_DESTRUCTION),
              'damageIncreasePerStack'
            );
        return (
          (base +
            balanceProfileNumber(
              requireBalanceProfileFromContext(context, CONDUIT_BALANCE_PROFILE_IDS.numinousGift),
              'damageIncrease'
            )) /
          base
        );
      },
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && hasTrait(context, TRAIT.TARGETED_DESTRUCTION)
    }
  ]
});

/** Owns Shared Wisdom tuning and behavior at its established execution boundaries. */
export const sharedWisdom = defineTrait({
  triggers: [
    onTriggerPoint(entityBoonCompleted, {
      run: (runtime, input: TriggerPointInput<typeof entityBoonCompleted>) => grantEntitySkillBoon(runtime, input.cast)
    }),
    onTriggerPoint(entityCastCompleted, {
      run: (runtime, input: TriggerPointInput<typeof entityCastCompleted>) =>
        completionSharedWisdom(runtime, input.cast, 'entity-skill')
    })
  ],
  id: TRAIT.SHARED_WISDOM,
  name: 'Shared Wisdom',
  balance: {
    id: CONDUIT_BALANCE_PROFILE_IDS.sharedWisdom,
    effects: [
      {
        name: 'entity-skill',
        type: 'boon',
        boon: 'swiftness',
        duration: 5,
        stacks: 1,
        metadata: { trigger: 'entity-skill' }
      },
      {
        name: 'beguiling-haze',
        type: 'boon',
        boon: 'fury',
        duration: 5,
        stacks: 1,
        metadata: { trigger: 'beguiling-haze' }
      },
      {
        name: 'hex-eater-vortex',
        type: 'boon',
        boon: 'resolution',
        duration: 3,
        stacks: 1,
        metadata: { trigger: 'hex-eater-vortex' }
      },
      {
        name: 'gladiators-defense',
        type: 'boon',
        boon: 'stability',
        duration: 3,
        stacks: 1,
        metadata: { trigger: 'gladiators-defense' }
      },
      {
        name: 'twin-moon-sweep',
        type: 'boon',
        boon: 'might',
        duration: 10,
        stacks: 5,
        applications: 2,
        atMs: 0,
        intervalMs: 0,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        metadata: { trigger: 'twin-moon-sweep' }
      }
    ]
  }
});

export const traitDefinitions = [
  kineticInsight,
  lingeringDetermination,
  enhancedEmbodiment,
  expandedConsciousness,
  sharedWisdom,
  numinousGiftTrait,
  bolsteredBonds,
  mistfire,
  foundPurpose,
  conductiveArmaments
];

/** Weapon casts grant affinity after the mechanic has established a positive Energy cost. */
function grantConductiveArmaments(runtime: RevenantRuntime, skill: RevenantSkill): void {
  if (skill.type === 'Weapon') gainAffinity(runtime, 1);
}

/** Applies the trait at the mechanic's existing execution boundary. */
function extendEnhancedEmbodiment(runtime: RevenantRuntime, formActive: boolean): void {
  const state = conduitState.from(runtime);
  if (formActive) {
    const enhanced = requireBalanceProfileFromContext(runtime, PROFILE.enhancedEmbodiment);
    const extension = requireEffect(enhanced, 'buff', 'cosmic-wisdom-extension');
    if (extension) {
      state.cosmicWisdomUntil += Math.max(0, effectNumber(enhanced, extension, 'duration'));
      scheduleFormExpiry(runtime);
    }
  }
}

/** Applies the trait at the mechanic's existing execution boundary. */
function grantFoundPurpose(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>, combat: boolean): void {
  if (combat) numinousGift(runtime, cast, true);
}

/** Applies the trait at the mechanic's existing execution boundary. */
function grantLingeringDetermination(runtime: RevenantRuntime, combat: boolean): void {
  if (combat)
    gainAffinity(
      runtime,
      Math.max(
        0,
        balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.lingeringDetermination), 'resourceGain')
      )
    );
}

/** Applies the trait at the mechanic's existing execution boundary. */
function emitCosmicMistfire(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  {
    emitTraitProfile(runtime, TRAIT.MISTFIRE, PROFILE.mistfire, undefined, {
      effects: (effect) => effect.type === 'strike' || effect.type === 'condition',
      attribution: {
        source: 'revenant',
        sourceId: TRAIT.MISTFIRE,
        actorType: 'effect',
        ownerActorType: 'player',
        skillId: TRAIT.MISTFIRE,
        skillName: 'Mistfire',
        activationId: cast.id
      },
      transform: (event) => ({
        ...event,
        name: event.type === 'damage' ? 'Mistfire' : 'Mistfire — Burning',
        skillWeapon: 'Unequipped'
      })
    });
  }
}

/** Reward a selected cap crossing once; further grants at full affinity cannot repeat the Energy gain. */
function grantExpandedConsciousness(runtime: RevenantRuntime, previous: number, maximum: number): void {
  if (previous < maximum && runtime.resourceController.value('affinity') === maximum)
    runtime.resourceController.grant(
      'energy',
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.expandedConsciousness), 'resourceGain')
    );
}

/** Numinous Gift grants its base and equipped-legend boons to the caster or, with Found Purpose, to allies. */
function numinousGift(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>, allies = false): void {
  if (runtime.config.specialization !== 'Conduit') return;

  emitTraitProfile(runtime, TRAIT.NUMINOUS_GIFT, PROFILE.numinousGift, undefined, {
    effects: (effect) =>
      effect.type === 'boon' && (!effect.metadata?.legendId || hasLegend(runtime, effect.metadata.legendId)),
    attribution: {
      source: 'revenant',
      sourceId: cast.skill.id,
      actorType: 'player',
      skillId: cast.skill.id,
      skillName: cast.skill.name,
      activationId: cast.id
    },
    transform: (event) => ({
      ...event,
      name: cast.skill.name + ' \u2014 ' + event.kind,
      audience: { recipients: allies ? 'party' : 'self' }
    })
  });
}

function hasLegend(runtime: RevenantRuntime, legendId: string): boolean {
  return runtime.profession.core.selectedLegendIds.includes(legendId);
}

/** One entity-specific Shared Wisdom boon accompanies the cast's completion. */
function completionSharedWisdom(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>, trigger: string): void {
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.sharedWisdom);
  const shared = requireEffect(profile, 'boon', trigger);
  if (!shared) return;
  emitTraitProfile(runtime, TRAIT.SHARED_WISDOM, PROFILE.sharedWisdom, undefined, {
    effects: (effect) => effect === shared,
    at: cast.effectiveEnd,
    attribution: {
      source: 'revenant',
      sourceId: cast.skill.id,
      actorType: 'player',
      skillId: cast.skill.id,
      skillName: cast.skill.name,
      activationId: cast.id
    },
    transform: (event) => ({ ...event, name: cast.skill.name + ' \u2014 ' + event.kind })
  });
}

/** Retain each accepted Entity action's source identity while the trait owns its boon selection. */
function grantEntitySkillBoon(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  const haze = BEGUILING_HAZE_SKILL_IDS.has(cast.skill.id);
  const hex = cast.skill.id === ID.HEX_EATER_VORTEX;
  const trigger = haze ? 'beguiling-haze' : hex ? 'hex-eater-vortex' : 'gladiators-defense';
  emitTraitProfile(runtime, TRAIT.SHARED_WISDOM, PROFILE.sharedWisdom, undefined, {
    skillId: cast.skill.id,
    skillName: cast.skill.name,
    activationId: cast.id,
    effects: (effect) => effect.type === 'boon' && effect.name === trigger,
    // The profile's effect names are internal trigger keys, so the boon packet stays unlabelled.
    preserveName: true,
    attribution: {
      source: 'revenant',
      sourceId: haze ? TRAIT.SHARED_WISDOM : hex ? ID.HEX_EATER_VORTEX : ID.GLADIATORS_DEFENSE,
      actorType: 'player'
    }
  });
}
