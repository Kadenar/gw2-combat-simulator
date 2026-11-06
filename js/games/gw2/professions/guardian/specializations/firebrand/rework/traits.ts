import { boonKey } from '#gw2/platform/combat/boons.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { ACTOR, BOON, CONDITION, RECIPIENT } from '#gw2/platform/constants.js';
import { applySideEffect } from '#gw2/platform/effects/action-dispatch.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import { balanceNumber, effectNumber, requireBalanceProfile } from '#gw2/platform/skills/balance-profiles.js';
import { guardianCastCause } from '#gw2/professions/guardian/core/mechanics/event-handlers.js';
import { guardianBoonActive } from '#gw2/professions/guardian/core/mechanics/modifier-queries.js';
import { GUARDIAN_SKILL_IDS as SKILL, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { FIREBRAND_REWORK_TRAIT_IDS as REWORK } from '#gw2/professions/guardian/specializations/firebrand/ids.js';
import {
  grantAshes,
  resolveAshesGrantData
} from '#gw2/professions/guardian/specializations/firebrand/mechanics/ashes.js';
import {
  finalMantraChargeUsed,
  firebrandControlAccepted,
  swiftScholarPagesGranted,
  type FinalMantraCharge,
  type FirebrandControl
} from '#gw2/professions/guardian/specializations/firebrand/mechanics/trigger-points.js';
import { firebrandTraits, swiftScholar } from '#gw2/professions/guardian/specializations/firebrand/traits/index.js';
import type { GuardianRuntime, GuardianSkill } from '#gw2/professions/guardian/types.js';

/** Unknown bonuses start neutral; the selected patch supplies explicitly labeled experimental values. */
const unrelentingCriticism = defineTrait({
  id: TRAIT.UNRELENTING_CRITICISM,
  balance: { conditionDamageIncrease: 0, conditionDurationBonus: 0 },
  attributes: ({ balanceContext }) => ({
    traitDurations: {
      'Bleeding Duration':
        100 * balanceNumber(balanceContext.catalog, TRAIT.UNRELENTING_CRITICISM, 'conditionDurationBonus')
    }
  }),
  modifierRules: [
    {
      id: 'guardian.unrelenting-criticism',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'multiply',
      factor: (context) => 1 + balanceNumber(context.catalog, TRAIT.UNRELENTING_CRITICISM, 'conditionDamageIncrease'),
      when: (context) => context.condition === CONDITION.BLEEDING
    }
  ]
});

/** Quickness gates outgoing damage without contributing attributes or feeding attribute conversions. */
const imbuedHaste = defineTrait({
  id: TRAIT.IMBUED_HASTE,
  balance: { conditionDamageIncrease: 0 },
  modifierRules: [
    {
      id: 'guardian.imbued-haste',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'multiply',
      factor: (context) => 1 + balanceNumber(context.catalog, TRAIT.IMBUED_HASTE, 'conditionDamageIncrease'),
      when: (context) => guardianBoonActive(context, boonKey(BOON.QUICKNESS))
    }
  ]
});

/** Revelation keeps the final-mantra page refund, with no hostile Slow packet. */
const revelation = defineTrait({
  id: REWORK.REVELATION,
  balance: { resourceGain: 2 },
  triggers: [
    onTriggerPoint(finalMantraChargeUsed, {
      run(runtime: GuardianRuntime, { context }: FinalMantraCharge) {
        applySideEffect(runtime, context, {
          type: 'resourceGrant',
          resource: 'tomePages',
          amount: { profile: REWORK.REVELATION, field: 'resourceGain' }
        });
        runtime.effects.emit({
          kind: 'announcement',
          announcement: {
            type: 'trait',
            name: 'Revelation',
            at: runtime.time,
            detail: `+${balanceNumber(runtime.helpers, REWORK.REVELATION, 'resourceGain')} tome pages`
          }
        });
      }
    })
  ]
});

/** One admitted Swift Scholar refund grants expiring Ashes to the player and eligible nearby allies. */
function grantFervidAshes(runtime: GuardianRuntime, { cast }: { readonly cast: RuntimeCast<GuardianSkill> }): void {
  const profile = requireBalanceProfile(runtime.helpers, REWORK.FERVID_CONVICTION);
  const admission = resolveAshesGrantData({ catalog: runtime.helpers, traits: runtime.traits }, profile);

  if (
    !admission ||
    !runtime.procs.claim(REWORK.FERVID_CONVICTION, 'guardian.firebrand.fervid-conviction', runtime.time)
  )
    return;

  const { buff } = admission;

  const stacks = effectNumber(profile, buff, 'stacks');
  const duration = effectNumber(profile, buff, 'duration');
  const maximumTargets = balanceNumber(runtime.helpers, REWORK.FERVID_CONVICTION, 'maximumTargets');

  if (stacks <= 0 || duration <= 0 || maximumTargets <= 0) return;

  grantAshes(runtime, {
    source: 'fervid-conviction',
    cause: guardianCastCause(runtime, cast),
    charges: stacks,
    lifetimeSeconds: duration,
    recipients: { includesSelf: true, maximumAllies: maximumTargets - 1 }
  });
  runtime.effects.emit({
    kind: 'announcement',
    announcement: {
      type: 'trait',
      name: 'Fervid Conviction',
      at: runtime.time,
      sourceSkill: cast.skill.name,
      detail: `+${stacks} Ashes of the Just`
    }
  });
}

const fervidConviction = defineTrait({
  id: REWORK.FERVID_CONVICTION,
  balance: {
    internalCooldown: 0,
    maximumTargets: 5,
    effects: [{ type: 'buff', name: 'ashes-of-the-just', kind: 'ashes-of-the-just', stacks: 1, duration: 10 }]
  },
  triggers: [onTriggerPoint(swiftScholarPagesGranted, { run: grantFervidAshes })]
});

/** Swift Scholar completion replaces Aegis/Stability as the only producer of Stalwart Speed Quickness. */
const stalwartSpeed = defineTrait({
  id: TRAIT.STALWART_SPEED,
  balance: {
    internalCooldown: 0,
    effects: [
      {
        type: 'boon',
        name: boonKey(BOON.QUICKNESS),
        boon: BOON.QUICKNESS,
        stacks: 1,
        duration: 2,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      }
    ]
  },
  triggers: [
    onTriggerPoint(swiftScholarPagesGranted, {
      run(runtime: GuardianRuntime, { cast }: { readonly cast: RuntimeCast<GuardianSkill> }) {
        if (!runtime.procs.claim(TRAIT.STALWART_SPEED, 'guardian.firebrand.stalwartSpeed', runtime.time)) return;

        emitTraitProfile(runtime, TRAIT.STALWART_SPEED, TRAIT.STALWART_SPEED, guardianCastCause(runtime, cast), {
          skillName: 'Stalwart Speed',
          attribution: { actorType: ACTOR.PLAYER }
        });
      }
    })
  ]
});

/** Only accepted player disables or Immobilized reduce Unbroken Lines; Slow no longer qualifies. */
const stoicDemeanor = defineTrait({
  id: TRAIT.STOIC_DEMEANOR,
  balance: { rechargeReduction: 0, internalCooldown: 0 },
  triggers: [
    onTriggerPoint(firebrandControlAccepted, {
      when: (_runtime, { cause }: FirebrandControl) =>
        cause.actorType === ACTOR.PLAYER && cause.condition !== CONDITION.SLOW,
      run(runtime: GuardianRuntime) {
        const reduction = balanceNumber(runtime.helpers, TRAIT.STOIC_DEMEANOR, 'rechargeReduction');

        if (
          reduction <= 0 ||
          !runtime.procs.claim(TRAIT.STOIC_DEMEANOR, 'guardian.firebrand.stoicDemeanor', runtime.time)
        )
          return;

        runtime.cooldownController.reduceSkillRecharge(
          runtime.helpers.skillsById.get(SKILL.UNBROKEN_LINES)!,
          reduction,
          runtime.time
        );
      }
    })
  ]
});

/** Tune each consumed Ashes charge before duration bonuses, preserving ownership for self and allied burns. */
const righteousFlames = defineTrait({
  id: REWORK.RIGHTEOUS_FLAMES,
  balance: {
    effects: [{ type: 'condition', name: CONDITION.BURNING, condition: CONDITION.BURNING, duration: 2, stacks: 1 }]
  }
});

// Support-only traits own no damage effects; replacing their old definitions removes page-capacity and cadence bonuses.
export const firebrandReworkTraits = [
  // The rework removes the capacity/cadence selectors together with their replaced traits.
  defineTrait({ id: TRAIT.PURITY_OF_WORD, balance: { maximumStacks: 5, pulseInterval: 8 } }),
  swiftScholar,
  ...firebrandTraits.filter((trait) => trait.id === TRAIT.LEGENDARY_LORE),
  unrelentingCriticism,
  imbuedHaste,
  revelation,
  fervidConviction,
  stalwartSpeed,
  stoicDemeanor,
  righteousFlames,
  defineTrait({ id: REWORK.BASTION }),
  defineTrait({ id: REWORK.DELIVERANCE })
];
