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
import { legendaryLore, swiftScholar } from '#gw2/professions/guardian/specializations/firebrand/traits/pages.js';
import type { GuardianRuntime, GuardianSkill } from '#gw2/professions/guardian/types.js';

/** Bleeding receives its own damage and duration bonuses without affecting other conditions. */
const unrelentingCriticism = defineTrait({
  id: TRAIT.UNRELENTING_CRITICISM,
  balance: { conditionDamageIncrease: 0.05, conditionDurationBonus: 0.2 },
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
  balance: { conditionDamageIncrease: 0.1 },
  modifierRules: [
    {
      id: 'guardian.imbued-haste',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'multiply',
      factor: (context) => 1 + balanceNumber(context.catalog, TRAIT.IMBUED_HASTE, 'conditionDamageIncrease'),
      when: (context) => guardianBoonActive(context, BOON.QUICKNESS)
    }
  ]
});

/** Revelation keeps the final-mantra page refund, with no hostile Slow packet. */
const revelation = defineTrait({
  id: TRAIT.REVELATION,
  balance: { resourceGain: 1 },
  triggers: [
    onTriggerPoint(finalMantraChargeUsed, {
      run(runtime: GuardianRuntime, { context }: FinalMantraCharge) {
        applySideEffect(runtime, context, {
          type: 'resourceGrant',
          resource: 'tomePages',
          amount: { profile: TRAIT.REVELATION, field: 'resourceGain' }
        });
        runtime.effects.emit({
          kind: 'announcement',
          announcement: {
            type: 'trait',
            name: 'Revelation',
            at: runtime.time,
            detail: `+${balanceNumber(runtime.helpers, TRAIT.REVELATION, 'resourceGain')} tome pages`
          }
        });
      }
    })
  ]
});

/** One admitted Swift Scholar refund grants expiring Ashes to the player and eligible nearby allies. */
function grantFervidAshes(runtime: GuardianRuntime, { cast }: { readonly cast: RuntimeCast<GuardianSkill> }): void {
  const profile = requireBalanceProfile(runtime.helpers, TRAIT.FERVID_CONVICTION);

  // Removing the grant effect also removes its proc admission.
  if (!profile.effects?.some((effect) => effect.type === 'buff' && effect.name === 'ashes-of-the-just')) return;

  const admission = resolveAshesGrantData({ catalog: runtime.helpers, traits: runtime.traits }, profile);

  if (!admission || !runtime.procs.claim(TRAIT.FERVID_CONVICTION, 'guardian.firebrand.fervid-conviction', runtime.time))
    return;

  const { buff } = admission;

  const stacks = effectNumber(profile, buff, 'stacks');
  const duration = effectNumber(profile, buff, 'duration');
  const maximumTargets = balanceNumber(runtime.helpers, TRAIT.FERVID_CONVICTION, 'maximumTargets');

  if (stacks <= 0 || duration <= 0 || maximumTargets <= 0) return;

  grantAshes(runtime, {
    source: 'fervid-conviction',
    cause: guardianCastCause(runtime, cast),
    charges: stacks,
    lifetimeSeconds: duration,
    recipients: { includesSelf: true, maximumAllies: 0 }
  });
  // Self and allies share expiry and ownership, but receive separate charge counts.
  const allyStacks = balanceNumber(runtime.helpers, TRAIT.FERVID_CONVICTION, 'allyStacks');

  if (allyStacks > 0)
    grantAshes(runtime, {
      source: 'fervid-conviction',
      cause: guardianCastCause(runtime, cast),
      charges: allyStacks,
      lifetimeSeconds: duration,
      recipients: { includesSelf: false, maximumAllies: maximumTargets - 1 }
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
  id: TRAIT.FERVID_CONVICTION,
  balance: {
    internalCooldown: 0,
    maximumTargets: 5,
    // Supplied tooltip values; the self/ally split still awaits independent confirmation.
    allyStacks: 1,
    effects: [{ type: 'buff', name: 'ashes-of-the-just', kind: 'ashes-of-the-just', stacks: 2, duration: 10 }]
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
        name: BOON.QUICKNESS,
        boon: BOON.QUICKNESS,
        stacks: 1,
        duration: 4.5,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      }
    ]
  },
  triggers: [
    onTriggerPoint(swiftScholarPagesGranted, {
      run(runtime: GuardianRuntime, { cast }: { readonly cast: RuntimeCast<GuardianSkill> }) {
        if (!requireBalanceProfile(runtime.helpers, TRAIT.STALWART_SPEED).effects?.length) return;

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
  balance: { rechargeReduction: 3, internalCooldown: 0.25 },
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
  id: TRAIT.RIGHTEOUS_FLAMES,
  balance: {
    durationMultiplier: 1.5
  }
});

// Healing and incoming damage are outside simulation scope. Purity of Word owns all page tuning.
export const firebrandTraits = [
  defineTrait({ id: TRAIT.PURITY_OF_WORD, balance: { maximumStacks: 8, pulseInterval: 6, resourceGain: 1 } }),
  swiftScholar,
  legendaryLore,
  unrelentingCriticism,
  imbuedHaste,
  revelation,
  fervidConviction,
  stalwartSpeed,
  stoicDemeanor,
  righteousFlames,
  defineTrait({ id: TRAIT.BASTION }),
  defineTrait({ id: TRAIT.DELIVERANCE })
];
