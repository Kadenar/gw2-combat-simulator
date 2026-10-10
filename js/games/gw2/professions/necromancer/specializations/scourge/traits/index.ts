import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';

import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import type { TriggerPointInput } from '#gw2/platform/profession-definition/trigger-points.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { grantNecromancerLifeForce } from '#gw2/professions/necromancer/core/mechanics/life-force.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { party } from '#gw2/professions/necromancer/specializations/scourge/mechanics/audiences.js';
import {
  scourgeBarrierApplied,
  scourgeConditionApplied,
  scourgeShadeCommitted,
  scourgeShadeManifested
} from '#gw2/professions/necromancer/specializations/scourge/mechanics/combat-boundaries.js';
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
export const demonicLore = defineTrait({
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
        name: 'Burning',
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 1,
        actorType: 'effect'
      }
    ]
  },
  modifierRules: [
    {
      order: 121,
      id: 'necromancer.demonic-lore',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        balanceProfileNumber(
          requireBalanceProfileFromContext(context, TRAIT.DEMONIC_LORE),
          'conditionDamageMultiplier'
        ),
      when: (context) => context.condition === 'Torment'
    }
  ]
});

/** Owns Sand Savant tuning and behavior at its existing execution boundaries. */
export const sandSavant = defineTrait({
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
        actorType: 'player'
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
export const abrasiveGrit = defineTrait({
  triggers: [
    onTriggerPoint(scourgeShadeManifested, {
      when: (runtime: MechanicQueriesOf<NecromancerRuntime>) => hasTrait(runtime, TRAIT.DESERT_EMPOWERMENT),
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof scourgeShadeManifested>) =>
        grantBarrierBoon(runtime, input.cast, TRAIT.ABRASIVE_GRIT, 'might')
    }),
    onTriggerPoint(scourgeBarrierApplied, {
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof scourgeBarrierApplied>) =>
        grantBarrierBoon(runtime, input.cast, TRAIT.ABRASIVE_GRIT, 'might')
    })
  ],
  id: TRAIT.ABRASIVE_GRIT,
  name: 'Abrasive Grit',
  balance: {
    effects: [
      {
        name: 'might',
        type: 'boon',
        boon: 'might',
        stacks: 2,
        duration: 6,
        actorType: 'player',
        audience: { recipients: 'party' as const }
      }
    ]
  }
});

/** Owns Desert Empowerment tuning and behavior at its existing execution boundaries. */
export const desertEmpowerment = defineTrait({
  triggers: [
    onTriggerPoint(scourgeShadeManifested, {
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof scourgeShadeManifested>) =>
        grantBarrierBoon(runtime, input.cast, TRAIT.DESERT_EMPOWERMENT, 'alacrity')
    }),
    onTriggerPoint(scourgeBarrierApplied, {
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof scourgeBarrierApplied>) =>
        grantBarrierBoon(runtime, input.cast, TRAIT.DESERT_EMPOWERMENT, 'alacrity')
    })
  ],
  id: TRAIT.DESERT_EMPOWERMENT,
  name: 'Desert Empowerment',
  balance: {
    effects: [
      {
        name: 'alacrity',
        type: 'boon',
        boon: 'alacrity',
        stacks: 1,
        duration: 1.5,
        actorType: 'player',
        audience: { recipients: 'party' as const }
      }
    ]
  }
});

/** Owns Sadistic Searing tuning and behavior at its existing execution boundaries. */
export const sadisticSearing = defineTrait({
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
        name: 'Burning',
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 4,
        actorType: 'player'
      }
    ]
  }
});

/** Owns Fell Beacon tuning and behavior at its existing execution boundaries. */
export const fellBeacon = defineTrait({
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
      factor: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.FELL_BEACON), 'conditionDamageMultiplier'),
      when: (context) => context.condition === 'Burning'
    }
  ],
  buildAttributes: traitAttributeEffects(TRAIT.FELL_BEACON, [
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
export const sandSage = defineTrait({
  id: TRAIT.SAND_SAGE,
  name: 'Sand Sage',
  balance: {
    attributeBonus: 225
  }
});

/** Owns Nourishing Ashes tuning and behavior at its existing execution boundaries. */
export const nourishingAshes = defineTrait({
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
export const heraldOfSorrow = defineTrait({
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
  if (event.condition !== 'Torment') {
    return;
  }

  const profile = requireBalanceProfileFromContext(context, TRAIT.DEMONIC_LORE);
  const effect = requireEffect(profile, 'condition', 'Burning');
  // The cooldown gates only Burning, so a removed packet leaves it ready.
  if (!effect) return;
  // Advance the ICD before applying the condition so re-entrant Torment events
  // within the same tick cannot double-proc
  if (
    !context.procs.claimCooldown('necromancer.scourge.demonicLore', event.at, balanceProfileNumber(profile, 'cooldown'))
  )
    return;
  {
    /* Trait payloads and their timeline annotation share the same emission boundary. */ emitTraitProfile(
      context,
      TRAIT.DEMONIC_LORE,
      TRAIT.DEMONIC_LORE,
      undefined,
      {
        at: event.at,
        fullEnd: event.at,
        effect: { type: 'condition', name: 'Burning' },
        settlement: 'reaction',
        attribution: {
          source: 'Trait',
          sourceId: TRAIT.DEMONIC_LORE,
          actorType: 'effect',
          skillName: 'Demonic Lore',
          triggeredBy: event.skillName,
          ownerActorType: 'player',
          name: 'Demonic Lore' + ' - ' + String(effect.condition)
        }
      }
    );
    context.effects.emit({
      kind: 'announcement',
      announcement: { type: 'trait', name: 'Demonic Lore', at: event.at, sourceSkill: event.skillName }
    });
  }
}

/** Burning rewards follow Demonic Lore at the same accepted condition boundary. */
function applyNourishingAshes(runtime: NecromancerRuntime, event: Gw2ResolverEvent): void {
  if (event.condition !== 'Burning') return;
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
    effect: { type: 'condition', name: 'Burning' },
    activationId: cast.id,
    attribution: {
      actorType: 'effect',
      ownerActorType: 'player',
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
      actorType: 'player',
      skillId: cast.skill.id,
      skillName: cast.skill.name,
      audience: party(runtime),
      name: cast.skill.name
    }
  });
}
