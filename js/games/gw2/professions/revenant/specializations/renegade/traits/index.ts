import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { MODIFIER_TARGET, type Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { resourceAtLeast } from '#gw2/platform/combat/resources/pool.js';
import {
  revenantRuntimeCoreState,
  revenantRuntimeSpecializationState
} from '#gw2/professions/revenant/core/state-queries.js';
import { REVENANT_MAXIMUM_ENDURANCE } from '#gw2/professions/revenant/core/state.js';
import { boonActive, targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import { gw2BoonApplicationRecipients } from '#gw2/platform/combat/state/allied-players.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait, traitAttributeBonuses } from '#gw2/platform/profession-definition/traits.js';
import type { TriggerPointInput } from '#gw2/platform/profession-definition/trigger-points.js';
import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import type { Gw2HitResolutionContext } from '#gw2/platform/resolver/hit-resolution.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  balanceNumberFromContext,
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { invocationFervorGranted } from '#gw2/professions/revenant/core/mechanics/trigger-points.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import {
  renegadeBoonApplied,
  renegadeCastCompleted,
  renegadeStruck
} from '#gw2/professions/revenant/specializations/renegade/mechanics/trigger-points.js';
import {
  activeKallasFervorStacks,
  bandTogetherReady,
  grantKallasFervor
} from '#gw2/professions/revenant/specializations/renegade/mechanics/kalla-and-band-together.js';
import {
  RENEGADE_PROFILE_IDS as PROFILE,
  RENEGADE_PROFILE_IDS
} from '#gw2/professions/revenant/specializations/renegade/profiles.js';
import { warbandCompleted } from '#gw2/professions/revenant/specializations/renegade/skills/warband.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';

/** Owns All for One tuning and behavior at its established execution boundaries. */
const allForOne = defineTrait({
  triggers: [
    onTriggerPoint(warbandCompleted, {
      run: (runtime, input: TriggerPointInput<typeof warbandCompleted>) => grantAllForOneEnergy(runtime, input.enhanced)
    })
  ],
  id: TRAIT.ALL_FOR_ONE,
  name: 'All for One',
  balance: {
    id: RENEGADE_PROFILE_IDS.allForOne,
    icon: 'https://render.guildwars2.com/file/9398D8F8E764A23596E17EDAA35B99961D62F061/1769993.png',
    categories: ['Trait'],
    skillFamily: 'Trait',
    resourceGain: 10,
    rechargeMultiplier: 0.5
  },
  rechargeRules: [
    {
      when: (runtime, skill) => bandTogetherReady(runtime, skill.id),
      multiplier: { profile: PROFILE.allForOne, field: 'rechargeMultiplier' }
    }
  ]
});

/** Owns Ambush Commander tuning and behavior at its established execution boundaries. */
const ambushCommander = defineTrait({
  triggers: [
    onTriggerPoint(invocationFervorGranted, {
      requiresSelection: false,
      run: (runtime, input: TriggerPointInput<typeof invocationFervorGranted>) => grantKallasFervor(runtime, input)
    }),
    onTriggerPoint(renegadeStruck, {
      run: (runtime, input: TriggerPointInput<typeof renegadeStruck>) => criticalTraits(runtime, input.cause, input.hit)
    })
  ],
  id: TRAIT.AMBUSH_COMMANDER,
  name: 'Ambush Commander',
  balance: {
    damageIncreasePerStack: 0.02,
    conditionDamageIncreasePerStack: 0.02,
    id: RENEGADE_PROFILE_IDS.kallasFervor,
    maximumStacks: 5,
    lifeSiphonDamagePerStack: 0.02,
    effects: [
      {
        name: 'kallas-fervor',
        type: 'buff',
        kind: 'kallas-fervor',
        duration: 8,
        stacks: 1,
        actorType: 'player'
      }
    ]
  }
});

/** Owns Ashen Demeanor tuning and behavior at its established execution boundaries. */
const ashenDemeanorTrait = defineTrait({
  triggers: [
    onTriggerPoint(renegadeCastCompleted, {
      run: (runtime, input: TriggerPointInput<typeof renegadeCastCompleted>) => ashenDemeanor(runtime, input.cast)
    })
  ],
  id: TRAIT.ASHEN_DEMEANOR,
  name: 'Ashen Demeanor',
  balance: {
    id: RENEGADE_PROFILE_IDS.ashenDemeanor,
    cooldown: 10,
    fervorStacks: 3,
    effects: [
      { type: 'boon', boon: 'might', duration: 6, stacks: 5, audience: { recipients: 'self' } },
      { type: 'boon', boon: 'resistance', duration: 6, stacks: 1, audience: { recipients: 'self' } }
    ]
  }
});

/** Owns Blood Fury tuning and behavior at its established execution boundaries. */
const bloodFury = defineTrait({
  triggers: [
    onTriggerPoint(renegadeBoonApplied, {
      run: (runtime, input: TriggerPointInput<typeof renegadeBoonApplied>) => furyTraits(runtime, input.cause)
    })
  ],
  id: TRAIT.BLOOD_FURY,
  name: 'Blood Fury',
  balance: {
    id: RENEGADE_PROFILE_IDS.bloodFury,
    conditionDurationBonus: 0.25,
    icon: 'https://render.guildwars2.com/file/10FA58BEA8CF9AAB3F7841B154DC26E95A4FC705/1769989.png',
    categories: ['Trait'],
    skillFamily: 'Trait',
    cooldown: 3
  },
  modifierRules: [
    {
      id: 'revenant.blood-fury-bleeding-duration',
      order: 104,
      target: MODIFIER_TARGET.CONDITION_DURATION,
      operation: 'add',
      amount: (context) => balanceNumberFromContext(context, RENEGADE_PROFILE_IDS.bloodFury, 'conditionDurationBonus'),
      // Blood Fury shares the chronological player-Fury query used by Core Revenant modifiers.
      when: (context) => context.condition === 'Bleeding' && boonActive(context, 'fury')
    }
  ]
});

/** Owns the additional protection payload layered on the enhanced order. */
const boldReversal = defineTrait({
  id: TRAIT.BOLD_REVERSAL,
  name: 'Bold Reversal',
  balance: {
    id: RENEGADE_PROFILE_IDS.boldReversalRighteousRebel,
    effects: [
      {
        type: 'boon',
        boon: 'protection',
        duration: 1,
        stacks: 1,
        applications: 6,
        intervalMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        actorType: 'player'
      }
    ]
  }
});

/** Owns Brutal Momentum tuning and behavior at its established execution boundaries. */
const brutalMomentum = defineTrait({
  // Attributes supply the baseline; full endurance adds only the remaining critical chance.
  modifierRules: [
    {
      id: 'revenant.brutal-momentum',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) => {
        const profile = requireBalanceProfileFromContext(context, RENEGADE_PROFILE_IDS.brutalMomentum);
        return (
          balanceProfileNumber(profile, 'fullEnduranceCriticalChance') - balanceProfileNumber(profile, 'criticalChance')
        );
      },
      when: (context) =>
        resourceAtLeast(revenantRuntimeCoreState(context).endurance?.value ?? 0, REVENANT_MAXIMUM_ENDURANCE)
    }
  ],
  attributes: traitAttributeBonuses(RENEGADE_PROFILE_IDS.brutalMomentum, (profile) => ({
    traitCriticalChance: 100 * balanceProfileNumber(profile, 'criticalChance')
  })),
  id: TRAIT.BRUTAL_MOMENTUM,
  name: 'Brutal Momentum',
  balance: {
    id: RENEGADE_PROFILE_IDS.brutalMomentum,
    criticalChance: 0.1,
    fullEnduranceCriticalChance: 0.33,
    internalCooldown: 8,
    effects: [{ name: 'vigor', type: 'boon', boon: 'vigor', duration: 6, stacks: 1 }]
  },
  triggers: [
    {
      emit: PROFILE.brutalMomentum,
      on: 'buff.applied',
      cooldown: 'profile',
      when: (runtime, event) =>
        (event.kind || '').toLowerCase() === 'fury' &&
        gw2BoonApplicationRecipients(runtime.config, event).includesSelf &&
        Boolean(requireEffect(requireBalanceProfileFromContext(runtime, PROFILE.brutalMomentum), 'boon', 'vigor')),
      effects: (effect) => effect.type === 'boon' && effect.name === 'vigor',
      attribution: {
        source: 'revenant',
        actorType: 'player',
        skillId: PROFILE.brutalMomentum,
        skillName: 'Brutal Momentum',
        name: undefined
      }
    }
  ]
});

/** Owns Endless Enmity tuning and behavior at its established execution boundaries. */
const endlessEnmity = defineTrait({
  id: TRAIT.ENDLESS_ENMITY,
  name: 'Endless Enmity',
  balance: {
    id: RENEGADE_PROFILE_IDS.endlessEnmity,
    icon: 'https://render.guildwars2.com/file/A4D16BE749A19FE8A8B5783EE2BD1DF899156D47/1769999.png',
    categories: ['Trait'],
    skillFamily: 'Trait',
    internalCooldown: 8,
    effects: [
      {
        name: 'fury',
        type: 'boon',
        boon: 'fury',
        duration: 4,
        stacks: 1,
        audience: { recipients: 'party' as const },
        actorType: 'player'
      }
    ]
  },
  triggers: [
    {
      emit: PROFILE.endlessEnmity,
      on: 'damage.resolved',
      cooldown: 'profile',
      when: (runtime, event, details) =>
        event.actorType === 'player' &&
        Number(event.coefficient) > 0 &&
        Boolean(details.hitContext?.critEligible && details.hitContext.critical.didCrit) &&
        Boolean(requireEffect(requireBalanceProfileFromContext(runtime, PROFILE.endlessEnmity), 'boon', 'fury')),
      effects: (effect) => effect.type === 'boon' && effect.name === 'fury',
      attribution: {
        source: 'revenant',
        actorType: 'player',
        skillId: TRAIT.ENDLESS_ENMITY,
        skillName: 'Endless Enmity',
        name: 'Endless Enmity \u2014 fury'
      }
    }
  ]
});

/** Owns Heartpiercer tuning and behavior at its established execution boundaries. */
const heartpiercer = defineTrait({
  id: TRAIT.HEARTPIERCER,
  name: 'Heartpiercer',
  // Trait balance is the single tuning source for modifiers and presentation.
  balance: { damageMultiplier: 1.15, conditionDamageMultiplier: 1.25 },
  modifierRules: [
    {
      id: 'revenant.heartpiercer-strike',
      order: 100,
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) => balanceNumberFromContext(context, TRAIT.HEARTPIERCER, 'damageMultiplier'),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && targetConditionActive(context, 'Bleeding')
    },
    {
      id: 'revenant.heartpiercer-bleeding',
      order: 101,
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'multiply',
      factor: (context) => balanceNumberFromContext(context, TRAIT.HEARTPIERCER, 'conditionDamageMultiplier'),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && context.condition === 'Bleeding'
    }
  ]
});

/** Owns Lasting Legacy tuning and behavior at its established execution boundaries. */
const lastingLegacy = defineTrait({
  id: TRAIT.LASTING_LEGACY,
  name: 'Lasting Legacy',
  balance: {
    damageIncreasePerStack: 0.05,
    conditionDamageIncreasePerStack: 0.03,
    id: RENEGADE_PROFILE_IDS.kallasFervorLastingLegacy,
    variantBadge: 'Lasting Legacy',
    maximumStacks: 5,
    lifeSiphonDamagePerStack: 0.03,
    effects: [
      {
        name: 'kallas-fervor',
        type: 'buff',
        kind: 'kallas-fervor',
        duration: 12,
        stacks: 1,
        actorType: 'player'
      }
    ]
  },
  profiles: [
    {
      id: RENEGADE_PROFILE_IDS.heroicCommandLastingLegacy,
      name: 'Heroic Command (Lasting Legacy)',
      profileKind: 'skill-variant',

      variantBadge: 'Lasting Legacy',
      effects: [
        {
          name: 'might',
          type: 'boon',
          boon: 'might',
          duration: 8,
          stacks: 3,
          actorType: 'player'
        }
      ]
    }
  ],
  modifierRules: [
    {
      requiresSelection: false,
      id: 'revenant.kallas-fervor-strike',
      order: 102,
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',

      amount: (context) =>
        kallasFervorStacks(context) *
        balanceNumberFromContext(
          context,
          hasTrait(context, TRAIT.LASTING_LEGACY) ? PROFILE.kallasFervorLastingLegacy : PROFILE.kallasFervor,
          'damageIncreasePerStack'
        ),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && kallasFervorStacks(context) > 0
    },
    {
      requiresSelection: false,
      id: 'revenant.kallas-fervor-condition',
      order: 103,
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'damage-additive',

      amount: (context) =>
        kallasFervorStacks(context) *
        balanceNumberFromContext(
          context,
          hasTrait(context, TRAIT.LASTING_LEGACY) ? PROFILE.kallasFervorLastingLegacy : PROFILE.kallasFervor,
          'conditionDamageIncreasePerStack'
        ),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && kallasFervorStacks(context) > 0
    }
  ]
});

/** Owns Righteous Rebel tuning and behavior at its established execution boundaries. */
const righteousRebel = defineTrait({
  id: TRAIT.RIGHTEOUS_REBEL,
  name: 'Righteous Rebel',
  balance: {
    id: RENEGADE_PROFILE_IDS.ordersFromAboveRighteousRebel,
    variantBadge: 'Righteous Rebel',
    effects: [
      {
        type: 'boon',
        boon: 'alacrity',
        duration: 2,
        stacks: 1,
        applications: 6,
        intervalMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        actorType: 'player'
      }
    ]
  }
});

/** Owns Vindication tuning and behavior at its established execution boundaries. */
const vindication = defineTrait({
  id: TRAIT.VINDICATION,
  name: 'Vindication',
  balance: {
    id: RENEGADE_PROFILE_IDS.vindication,
    icon: 'https://render.guildwars2.com/file/3453B30240026E36661AACD3FA94FB0DBFC8246C/1769995.png',
    categories: ['Trait'],
    skillFamily: 'Trait',
    effects: [
      {
        name: 'daze',
        type: 'control',
        actorType: 'player',
        controlKind: 'daze'
      }
    ]
  },
  triggers: [
    {
      on: 'damage.resolved',
      when: (_runtime, event) => event.skillId === ID.CITADEL_BOMBARDMENT && Number(event.hitIndex || 1) === 1,
      emit: PROFILE.vindication,
      effects: (effect) => effect.type === 'control' && effect.name === 'daze',
      attribution: {
        source: 'revenant',
        sourceId: TRAIT.VINDICATION,
        actorType: 'player',
        skillId: TRAIT.VINDICATION,
        skillName: 'Vindication',
        name: 'Vindication — Daze'
      }
    }
  ]
});

export const traitDefinitions = [
  boldReversal,
  brutalMomentum,
  ambushCommander,
  lastingLegacy,
  righteousRebel,
  ashenDemeanorTrait,
  endlessEnmity,
  bloodFury,
  allForOne,
  vindication,
  heartpiercer
];

/** Applies the trait at the mechanic's existing execution boundary. */
function grantAllForOneEnergy(runtime: RevenantRuntime, enhanced: boolean): void {
  if (enhanced)
    runtime.resourceController.grant('energy', balanceNumberFromContext(runtime, PROFILE.allForOne, 'resourceGain'));
}

/** Actual critical and positional facts drive Ambush Commander and Endless Enmity. */
function criticalTraits(runtime: RevenantRuntime, event: Gw2ResolverEvent, hit?: Gw2HitResolutionContext): void {
  const critical = Boolean(hit?.critEligible && hit.critical.didCrit);

  // A defiant golem never rotates, so flanking/behind positional triggers always apply.
  if (Boolean(runtime.config.target?.defiant) || critical)
    grantKallasFervor(runtime, { sourceId: TRAIT.AMBUSH_COMMANDER, sourceName: 'Ambush Commander', cause: event });
}

/** Ashen Demeanor grants its Fervor and self boons once per healing-skill cooldown. */
function ashenDemeanor(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  if (cast.skill.slot !== 'Heal') return;

  const profile = requireBalanceProfileFromContext(runtime, PROFILE.ashenDemeanor);

  if (!runtime.procs.claimCooldown('ashenDemeanor', runtime.time, balanceProfileNumber(profile, 'cooldown'))) return;

  for (let stack = 0; stack < Math.max(0, balanceProfileNumber(profile, 'fervorStacks')); stack += 1)
    grantKallasFervor(runtime, { sourceId: TRAIT.ASHEN_DEMEANOR, sourceName: profile.name });
  // Fervor has settled; surviving self boons use the same authored materialization as other traits.
  emitTraitProfile(runtime, TRAIT.ASHEN_DEMEANOR, PROFILE.ashenDemeanor, undefined, {
    at: runtime.time,
    activationId: cast.id,
    effects: (effect) => effect.type === 'boon',
    attribution: (effect) => ({
      source: 'revenant',
      actorType: 'player',
      skillId: TRAIT.ASHEN_DEMEANOR,
      skillName: profile.name,
      audience: effect.audience ?? { recipients: 'self' }
    }),
    transform: (packet) => ({ ...packet, name: profile.name + ' — ' + packet.kind })
  });
}

/** Received Fury advances Blood Fury's Fervor on its own cooldown. */
function furyTraits(runtime: RevenantRuntime, event: Gw2ResolverEvent): void {
  if ((event.kind || '').toLowerCase() !== 'fury') return;

  // The Fury trigger claims its interval even if Fervor is already capped.
  if (
    !runtime.procs.claimCooldown(
      'revenant.renegade.bloodFury',
      runtime.time,
      Math.max(0, balanceNumberFromContext(runtime, PROFILE.bloodFury, 'cooldown'))
    )
  )
    return;

  grantKallasFervor(runtime, { sourceId: TRAIT.BLOOD_FURY, sourceName: 'Blood Fury', cause: event });
}

/** Trait modifiers count only Fervor stacks active at the hit instant. */
function kallasFervorStacks(context: Gw2ModifierContext): number {
  return activeKallasFervorStacks(revenantRuntimeSpecializationState(context, 'Renegade'), context.time);
}
