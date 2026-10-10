import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';

import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { TriggerPointInput } from '#gw2/platform/profession-definition/trigger-points.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { grantNecromancerLifeForce } from '#gw2/professions/necromancer/core/mechanics/life-force.js';
import { creatureSummoned } from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { ritualistPartyBoonPolicy } from '#gw2/professions/necromancer/specializations/ritualist/mechanics/party-boons.js';
import {
  ritualistShroudEntered,
  ritualistSpiritCommitted,
  ritualistSpiritSummoned
} from '#gw2/professions/necromancer/specializations/ritualist/mechanics/spirit-lifecycle.js';
import { ritualistState } from '#gw2/professions/necromancer/specializations/ritualist/state.js';
import type { NecromancerRuntime, NecromancerSkill } from '#gw2/professions/necromancer/types.js';

import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import { necromancerRuntimeSpecializationState } from '#gw2/professions/necromancer/core/mechanics/modifier-queries.js';

/** Owns Spirits' Strength tuning and behavior at its existing execution boundaries. */
export const spiritsStrength = defineTrait({
  id: TRAIT.SPIRITS_STRENGTH,
  name: "Spirits' Strength",
  balance: { damageMultiplier: 1.5 },
  modifierRules: [
    {
      order: 123,
      id: 'necromancer.spirits-strength',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.SPIRITS_STRENGTH), 'damageMultiplier'),
      when: (context) =>
        (context.event?.actorType === 'summon' || context.event?.summonKind === 'spirit') &&
        // Innervate attacks are player-buffed abilities, not spirit autonomous attacks; the trait does not apply to them
        context.event.metadata?.spiritAttackType !== 'innervate'
    }
  ]
});

/** Owns Explosive Growth tuning and behavior at its existing execution boundaries. */
export const explosiveGrowth = defineTrait({
  triggers: [onTriggerPoint(creatureSummoned, { run: summonExplosiveGrowth })],
  id: TRAIT.EXPLOSIVE_GROWTH,
  name: 'Explosive Growth',
  balance: {
    categories: ['Trait'],
    effects: [{ name: 'Strike', type: 'strike', coefficient: 1.2, hits: 1, actorType: 'effect' }]
  }
});

/** Owns Boon of Creation tuning and behavior at its existing execution boundaries. */
export const boonOfCreation = defineTrait({
  triggers: [
    onTriggerPoint(creatureSummoned, {
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof creatureSummoned>) =>
        summonBoonOfCreation(runtime, input.count)
    })
  ],
  id: TRAIT.BOON_OF_CREATION,
  name: 'Boon of Creation',
  balance: { categories: ['Trait'], attributeBonus: 180, lifeForceGain: 10, effects: [] },
  buildAttributes: traitAttributeEffects(TRAIT.BOON_OF_CREATION, [
    { kind: 'flat', to: 'Concentration', field: 'attributeBonus', feedsConversions: false }
  ])
});

/** Owns Empowering Spirits tuning and behavior at its existing execution boundaries. */
export const empoweringSpirits = defineTrait({
  triggers: [
    onTriggerPoint(ritualistSpiritSummoned, {
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof ritualistSpiritSummoned>) =>
        applyEmpoweringSpirits(runtime, input.cast, input.key)
    })
  ],
  id: TRAIT.EMPOWERING_SPIRITS,
  name: 'Empowering Spirits',
  balance: {
    categories: ['Trait'],
    effects: [
      {
        name: 'quickness',
        type: 'boon',
        boon: 'quickness',
        stacks: 1,
        duration: 3.75,
        actorType: 'player',
        audience: { recipients: 'party' as const }
      },
      {
        name: 'might',
        type: 'boon',
        boon: 'might',
        stacks: 8,
        duration: 10,
        actorType: 'player',
        audience: { recipients: 'party' as const }
      },
      {
        name: 'fury',
        type: 'boon',
        boon: 'fury',
        stacks: 1,
        duration: 5,
        actorType: 'player',
        audience: { recipients: 'party' as const }
      },
      {
        name: 'resolution',
        type: 'boon',
        boon: 'resolution',
        stacks: 1,
        duration: 4,
        actorType: 'player',
        audience: { recipients: 'party' as const }
      }
    ]
  }
});

/** Owns Lingering Spirits tuning and behavior at its existing execution boundaries. */
export const lingeringSpirits = defineTrait({
  id: TRAIT.LINGERING_SPIRITS,
  name: 'Lingering Spirits',
  // Trait balance is the single tuning source for modifiers and presentation.
  balance: { damageIncrease: 0.05 },
  modifierRules: [
    {
      order: 1,
      id: 'necromancer.lingering-spirits',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.LINGERING_SPIRITS), 'damageIncrease'),
      when: (context) => Boolean(necromancerRuntimeSpecializationState(context, 'Ritualist').activeSpirits?.anguish)
    }
  ]
});

/** Owns Soul Twisting's ordered mechanic integration. */
export const soulTwisting = defineTrait({
  triggers: [
    onTriggerPoint(ritualistShroudEntered, { run: armSoulTwisting }),
    onTriggerPoint(ritualistSpiritCommitted, {
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof ritualistSpiritCommitted>) =>
        consumeSoulTwisting(runtime, input.cast)
    })
  ],
  id: TRAIT.SOUL_TWISTING,
  name: 'Soul Twisting'
});

/** Owns Wielder's Boon's ordered mechanic integration. */
export const wieldersBoon = defineTrait({ id: TRAIT.WIELDERS_BOON, name: "Wielder's Boon" });

/** Registers each native trait owner once in its existing execution order. */
export const necromancerRitualistTraits = [
  spiritsStrength,
  explosiveGrowth,
  boonOfCreation,
  empoweringSpirits,
  lingeringSpirits,
  soulTwisting,
  wieldersBoon
];

/** Accepted creatures grant life force before their independent explosion. */
function summonBoonOfCreation(runtime: NecromancerRuntime, count: number): void {
  grantNecromancerLifeForce(
    runtime,
    balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.BOON_OF_CREATION), 'lifeForceGain') * count
  );
}

function summonExplosiveGrowth(
  runtime: NecromancerRuntime,
  {
    skill,
    at,
    count,
    activationId
  }: { skill: NecromancerSkill; at: number; count: number; activationId: string | undefined }
): void {
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.EXPLOSIVE_GROWTH);
  const strike = requireEffect(profile, 'strike', 'Strike');
  if (strike)
    emitTraitProfile(runtime, TRAIT.EXPLOSIVE_GROWTH, TRAIT.EXPLOSIVE_GROWTH, undefined, {
      at: at,
      fullEnd: at,
      effect: { type: 'strike', name: 'Strike' },
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.EXPLOSIVE_GROWTH,
        actorType: 'effect',
        skillId: TRAIT.EXPLOSIVE_GROWTH,
        skillName: 'Explosive Growth',
        parentSkillName: skill.name,
        activationId: `${activationId}:explosive-growth:${at}`,
        triggeredBy: skill.name,
        skillWeapon: 'Unequipped',
        name: 'Explosive Growth'
      },
      transform: (packet) => ({ ...packet, coefficient: Number(packet.coefficient) * count })
    });
}

/** Summon boons follow the shared creature reactions and precede autonomous scheduling. */
function applyEmpoweringSpirits(runtime: NecromancerRuntime, cast: RuntimeCast<NecromancerSkill>, key: string): void {
  {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.EMPOWERING_SPIRITS);
    for (const kind of ['quickness', key === 'anguish' ? 'might' : key === 'wanderlust' ? 'fury' : 'resolution']) {
      const effect = requireEffect(profile, 'boon', kind);
      if (effect) {
        runtime.effects.emit({
          kind: 'profile',
          profile: profile,
          effects: [effect],
          ...ritualistPartyBoonPolicy(runtime, cast)
        });
      }
    }
  }
}

/** Entry arms a single summon refund; the granted refund survives until a summon consumes it. */
function armSoulTwisting(runtime: NecromancerRuntime): void {
  ritualistState.from(runtime).soulTwistingAvailable = true;
}

/** Only a committed summon spends the refund. */
function consumeSoulTwisting(runtime: NecromancerRuntime, cast: RuntimeCast<NecromancerSkill>): void {
  const state = ritualistState.from(runtime);
  if (state.soulTwistingAvailable) {
    state.soulTwistingAvailable = false;
    runtime.cooldownController.clear(cast.skill.id);
  }
}
