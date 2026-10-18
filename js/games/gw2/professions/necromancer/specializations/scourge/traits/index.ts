import { ACTOR, RECIPIENT, BOON, CONDITION } from '#gw2/platform/constants.js';
import { boonKey } from '#gw2/platform/combat/boons.js';
import { necromancerRuntimeSpecializationState } from '#gw2/professions/necromancer/core/mechanics/modifier-queries.js';
import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';

import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import type { TriggerPointInput } from '#gw2/platform/profession-definition/trigger-points.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import {
  balanceNumberFromContext,
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { grantNecromancerLifeForce } from '#gw2/professions/necromancer/core/mechanics/life-force.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { necromancerPartyAudience } from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import {
  scourgeBarrierApplied,
  scourgeConditionApplied,
  scourgeShadeCommitted,
  scourgeShadeManifested
} from '#gw2/professions/necromancer/specializations/scourge/mechanics/trigger-points.js';
import {
  heraldOfSorrowAvailability,
  sandSavantMaximumAmmo
} from '#gw2/professions/necromancer/specializations/scourge/traits/behavior.js';
import type {
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NecromancerRuntime,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

/** Owns Demonic Lore tuning and behavior at its existing execution boundaries. */
const demonicLore = defineTrait({
  triggers: [
    onTriggerPoint(scourgeConditionApplied, {
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof scourgeConditionApplied>) =>
        reactToCondition(runtime, input.event)
    })
  ],
  id: TRAIT.DEMONIC_LORE,
  name: 'Demonic Lore',
  balance: {
    conditionDamageMultiplier: 1.33,
    cooldown: 3,
    effects: [
      {
        name: CONDITION.BURNING,
        type: 'condition',
        condition: CONDITION.BURNING,
        stacks: 1,
        duration: 1,
        actorType: ACTOR.EFFECT
      }
    ]
  },
  modifierRules: [
    {
      order: 121,
      id: 'necromancer.demonic-lore',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'multiply',
      factor: (context) => balanceNumberFromContext(context, TRAIT.DEMONIC_LORE, 'conditionDamageMultiplier'),
      when: (context) => context.condition === CONDITION.TORMENT
    }
  ]
});

/** Owns Sand Savant tuning and behavior at its existing execution boundaries. */
const sandSavant = defineTrait({
  id: TRAIT.SAND_SAVANT,
  name: 'Sand Savant',
  balance: {
    maximumStacks: 1,
    rechargePenalty: 1.25,
    effects: [
      {
        name: 'active-shade',
        type: 'buff',
        kind: 'active-shade',
        stacks: 1,
        duration: 8,
        actorType: ACTOR.PLAYER
      }
    ]
  },
  rechargeRules: [
    {
      order: 1,

      when: (_runtime, skill) => skill.id === ID.MANIFEST_SAND_SHADE,
      multiplier: { profile: TRAIT.SAND_SAVANT, field: 'rechargePenalty' }
    }
  ],
  hooks: { maximumAmmo: (runtime, skill, maximum) => sandSavantMaximumAmmo(runtime, skill, maximum) }
});

/** Owns Abrasive Grit tuning and behavior at its existing execution boundaries. */
const abrasiveGrit = defineTrait({
  triggers: [
    onTriggerPoint(scourgeShadeManifested, {
      when: (runtime: MechanicQueriesOf<NecromancerRuntime>) => hasTrait(runtime, TRAIT.DESERT_EMPOWERMENT),
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof scourgeShadeManifested>) =>
        grantBarrierBoon(runtime, input.cast, TRAIT.ABRASIVE_GRIT, boonKey(BOON.MIGHT))
    }),
    onTriggerPoint(scourgeBarrierApplied, {
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof scourgeBarrierApplied>) =>
        grantBarrierBoon(runtime, input.cast, TRAIT.ABRASIVE_GRIT, boonKey(BOON.MIGHT))
    })
  ],
  id: TRAIT.ABRASIVE_GRIT,
  name: 'Abrasive Grit',
  balance: {
    effects: [
      {
        name: boonKey(BOON.MIGHT),
        type: 'boon',
        boon: BOON.MIGHT,
        stacks: 2,
        duration: 6,
        actorType: ACTOR.PLAYER,
        audience: { recipients: RECIPIENT.PARTY }
      }
    ]
  }
});

/** Owns Desert Empowerment tuning and behavior at its existing execution boundaries. */
const desertEmpowerment = defineTrait({
  triggers: [
    onTriggerPoint(scourgeShadeManifested, {
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof scourgeShadeManifested>) =>
        grantBarrierBoon(runtime, input.cast, TRAIT.DESERT_EMPOWERMENT, boonKey(BOON.ALACRITY))
    }),
    onTriggerPoint(scourgeBarrierApplied, {
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof scourgeBarrierApplied>) =>
        grantBarrierBoon(runtime, input.cast, TRAIT.DESERT_EMPOWERMENT, boonKey(BOON.ALACRITY))
    })
  ],
  id: TRAIT.DESERT_EMPOWERMENT,
  name: 'Desert Empowerment',
  balance: {
    effects: [
      {
        name: boonKey(BOON.ALACRITY),
        type: 'boon',
        boon: BOON.ALACRITY,
        stacks: 1,
        duration: 1.5,
        actorType: ACTOR.PLAYER,
        audience: { recipients: RECIPIENT.PARTY }
      }
    ]
  }
});

/** Owns Sadistic Searing tuning and behavior at its existing execution boundaries. */
const sadisticSearing = defineTrait({
  triggers: [
    onTriggerPoint(scourgeShadeCommitted, {
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof scourgeShadeCommitted>) =>
        applySadisticSearing(runtime, input.cast)
    })
  ],
  id: TRAIT.SADISTIC_SEARING,
  name: 'Sadistic Searing',
  balance: {
    effects: [
      {
        name: CONDITION.BURNING,
        type: 'condition',
        condition: CONDITION.BURNING,
        stacks: 1,
        duration: 4,
        actorType: ACTOR.PLAYER
      }
    ]
  }
});

/** Owns Fell Beacon tuning and behavior at its existing execution boundaries. */
const fellBeacon = defineTrait({
  id: TRAIT.FELL_BEACON,
  name: 'Fell Beacon',
  balance: {
    conditionDamageMultiplier: 1.1,
    attributeConversion: 0.07
  },
  modifierRules: [
    {
      order: 120,
      id: 'necromancer.fell-beacon',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'multiply',
      factor: (context) => balanceNumberFromContext(context, TRAIT.FELL_BEACON, 'conditionDamageMultiplier'),
      when: (context) => context.condition === CONDITION.BURNING
    }
  ],
  attributes: traitAttributeEffects(TRAIT.FELL_BEACON, [
    {
      kind: 'conversion',
      from: 'Condition Damage',
      to: 'Expertise',
      field: 'attributeConversion',
      rounding: 'none',
      input: 'eligible'
    }
  ])
});

/** Owns Sand Sage tuning and behavior at its existing execution boundaries. */
const sandSage = defineTrait({
  // A living shade grants conversion-eligible duration attributes; expiry also removes their utility contribution.
  attributes(context) {
    const profile = requireBalanceProfileFromContext(context.balanceContext, TRAIT.SAND_SAGE);
    const shadeActive = (necromancerRuntimeSpecializationState(context, 'Scourge').shades || []).some(
      (expiresAt: number) => expiresAt > context.time
    );
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Concentration',
          amount: balanceProfileNumber(profile, 'attributeBonus'),
          feedsConversions: 'all',
          enabled: shadeActive
        },
        {
          kind: 'flat',
          to: 'Expertise',
          amount: balanceProfileNumber(profile, 'attributeBonus'),
          feedsConversions: 'all',
          enabled: shadeActive
        }
      ]
    };
  },

  id: TRAIT.SAND_SAGE,
  name: 'Sand Sage',
  balance: {
    attributeBonus: 225
  }
});

/** Owns Nourishing Ashes tuning and behavior at its existing execution boundaries. */
const nourishingAshes = defineTrait({
  triggers: [
    onTriggerPoint(scourgeConditionApplied, {
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof scourgeConditionApplied>) =>
        applyNourishingAshes(runtime, input.event)
    })
  ],
  id: TRAIT.NOURISHING_ASHES,
  name: 'Nourishing Ashes',
  balance: {
    lifeForceGain: 5,
    cooldown: 3
  }
});

/** Owns Herald of Sorrow's ordered mechanic integration. */
const heraldOfSorrow = defineTrait({
  id: TRAIT.HERALD_OF_SORROW,
  name: 'Herald of Sorrow',
  hooks: { availability: (runtime, skill, command) => heraldOfSorrowAvailability(runtime, skill, command) }
});

/** Registers each native trait owner once in its existing execution order. */
export const necromancerScourgeTraits = [
  demonicLore,
  sandSavant,
  abrasiveGrit,
  desertEmpowerment,
  sadisticSearing,
  fellBeacon,
  sandSage,
  nourishingAshes,
  heraldOfSorrow
];

// Convert eligible Torment applications into Demonic Lore burns while enforcing its resolver-owned cooldown.
function reactToCondition(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  // Only Torment triggers Demonic Lore — all other conditions are ignored here
  if (event.condition !== CONDITION.TORMENT) {
    return;
  }

  const profile = requireBalanceProfileFromContext(context, TRAIT.DEMONIC_LORE);
  const effect = requireEffect(profile, 'condition', CONDITION.BURNING);

  // The cooldown gates only Burning, so a removed packet leaves it ready.
  if (!effect) return;

  // Advance the ICD before applying the condition so re-entrant Torment events
  // within the same tick cannot double-proc
  if (
    !context.procs.claimCooldown('necromancer.scourge.demonicLore', event.at, balanceProfileNumber(profile, 'cooldown'))
  )
    return;

  /* Trait payloads and their timeline annotation share the same emission boundary. */ emitTraitProfile(
    context,
    TRAIT.DEMONIC_LORE,
    TRAIT.DEMONIC_LORE,
    undefined,
    {
      at: event.at,
      fullEnd: event.at,
      effect: { type: 'condition', name: CONDITION.BURNING },
      settlement: 'reaction',
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.DEMONIC_LORE,
        actorType: ACTOR.EFFECT,
        skillName: 'Demonic Lore',
        triggeredBy: event.skillName,
        ownerActorType: ACTOR.PLAYER,
        name: 'Demonic Lore' + ' - ' + String(effect.condition)
      }
    }
  );
  context.effects.emit({
    kind: 'announcement',
    announcement: { type: 'trait', name: 'Demonic Lore', at: event.at, sourceSkill: event.skillName }
  });
}

/** Burning rewards follow Demonic Lore at the same accepted condition boundary. */
function applyNourishingAshes(runtime: NecromancerRuntime, event: Gw2ResolverEvent): void {
  if (event.condition !== CONDITION.BURNING) return;

  const profile = requireBalanceProfileFromContext(runtime, TRAIT.NOURISHING_ASHES);

  // A qualifying Burning application claims before its life-force reward.
  if (
    !runtime.procs.claimCooldown(
      'necromancer.scourge.nourishingAshes',
      runtime.time,
      balanceProfileNumber(profile, 'cooldown')
    )
  )
    return;

  grantNecromancerLifeForce(runtime, balanceProfileNumber(profile, 'lifeForceGain'));
}

function applySadisticSearing(runtime: NecromancerRuntime, cast: RuntimeCast<NecromancerSkill>): void {
  // Preserve accepted cast targeting and impact delay while the profile expands the burning.
  if (cast.skill.id !== ID.NEFARIOUS_FAVOR) return;

  emitTraitProfile(runtime, TRAIT.SADISTIC_SEARING, TRAIT.SADISTIC_SEARING, undefined, {
    at: canonicalTime(runtime.time + (cast.command.impactDelayMs ?? 0) / 1000),
    effect: { type: 'condition', name: CONDITION.BURNING },
    activationId: cast.id,
    attribution: {
      actorType: ACTOR.EFFECT,
      ownerActorType: ACTOR.PLAYER,
      skillId: cast.skill.id,
      skillName: cast.skill.name,
      offTarget: cast.command.offTarget
    },
    transform: (packet) => ({ ...packet, name: cast.skill.name + ' — ' + packet.condition })
  });
}

function grantBarrierBoon(
  runtime: NecromancerRuntime,
  cast: RuntimeCast<NecromancerSkill>,
  trait: number,
  kind: string
): void {
  // Barrier completion chooses the party audience; the named boon remains wholly profile-owned.
  emitTraitProfile(runtime, trait, trait, undefined, {
    at: runtime.time,
    effect: { type: 'boon', name: kind },
    activationId: cast.id,
    attribution: {
      source: 'necromancer',
      sourceId: cast.skill.id,
      actorType: ACTOR.PLAYER,
      skillId: cast.skill.id,
      skillName: cast.skill.name,
      audience: necromancerPartyAudience(runtime),
      name: cast.skill.name
    }
  });
}
