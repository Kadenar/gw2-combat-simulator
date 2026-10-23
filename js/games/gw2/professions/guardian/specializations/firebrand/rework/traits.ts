import { ACTOR, BOON, CONDITION, RECIPIENT } from '#gw2/platform/constants.js';
import { boonKey } from '#gw2/platform/combat/boons.js';
import { grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { gw2EffectExpiresAt } from '#gw2/platform/combat/effect-timing.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { applySideEffect } from '#gw2/platform/effects/action-dispatch.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import {
  balanceNumberFromContext,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { guardianCastCause } from '#gw2/professions/guardian/core/mechanics/event-handlers.js';
import { guardianBoonActive } from '#gw2/professions/guardian/core/mechanics/modifier-queries.js';
import { GUARDIAN_SKILL_IDS as SKILL, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import {
  alliedAshes,
  FIREBRAND_ASHES_EXPIRE
} from '#gw2/professions/guardian/specializations/firebrand/mechanics/effects.js';
import {
  finalMantraChargeUsed,
  firebrandControlAccepted,
  swiftScholarPagesGranted,
  type FirebrandControl,
  type FinalMantraCharge
} from '#gw2/professions/guardian/specializations/firebrand/mechanics/trigger-points.js';
import { FIREBRAND_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/specializations/firebrand/profiles.js';
import { firebrandState } from '#gw2/professions/guardian/specializations/firebrand/state.js';
import { firebrandTraits, swiftScholar } from '#gw2/professions/guardian/specializations/firebrand/traits/index.js';
import { FIREBRAND_REWORK_TRAIT_IDS as REWORK } from '#gw2/professions/guardian/specializations/firebrand/ids.js';
import type { GuardianRuntime, GuardianSkill } from '#gw2/professions/guardian/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';

/** Unknown bonuses start neutral; the selected patch supplies explicitly labeled experimental values. */
const unrelentingCriticism = defineTrait({
  id: TRAIT.UNRELENTING_CRITICISM,
  name: 'Unrelenting Criticism',
  balance: { conditionDamageIncrease: 0, conditionDurationBonus: 0 },
  attributes: ({ balanceContext }) => ({
    traitDurations: {
      'Bleeding Duration':
        100 * balanceNumberFromContext(balanceContext, TRAIT.UNRELENTING_CRITICISM, 'conditionDurationBonus')
    }
  }),
  modifierRules: [
    {
      id: 'guardian.unrelenting-criticism',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        1 + balanceNumberFromContext(context, TRAIT.UNRELENTING_CRITICISM, 'conditionDamageIncrease'),
      when: (context) => context.condition === CONDITION.BLEEDING
    }
  ]
});

/** Quickness gates outgoing damage without contributing attributes or feeding attribute conversions. */
const imbuedHaste = defineTrait({
  id: TRAIT.IMBUED_HASTE,
  name: 'Imbued Haste',
  balance: { conditionDamageIncrease: 0 },
  modifierRules: [
    {
      id: 'guardian.imbued-haste',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'multiply',
      factor: (context) => 1 + balanceNumberFromContext(context, TRAIT.IMBUED_HASTE, 'conditionDamageIncrease'),
      when: (context) => guardianBoonActive(context, boonKey(BOON.QUICKNESS))
    }
  ]
});

/** Revelation keeps the final-mantra page refund, with no hostile Slow packet. */
const revelation = defineTrait({
  id: REWORK.REVELATION,
  name: 'Revelation',
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
            detail: `+${balanceNumberFromContext(runtime, REWORK.REVELATION, 'resourceGain')} tome pages`
          }
        });
      }
    })
  ]
});

/** One admitted Swift Scholar refund grants expiring Ashes to the player and eligible nearby allies. */
function grantFervidAshes(runtime: GuardianRuntime, { cast }: { readonly cast: RuntimeCast<GuardianSkill> }): void {
  const profile = requireBalanceProfileFromContext(runtime, REWORK.FERVID_CONVICTION);
  const buff = requireEffect(profile, 'buff', 'ashes-of-the-just');
  const ashes = requireBalanceProfileFromContext(runtime, PROFILE.ashes);
  const burn = requireEffect(ashes, 'condition', CONDITION.BURNING);

  if (
    !buff ||
    !burn ||
    !runtime.procs.claim(REWORK.FERVID_CONVICTION, 'guardian.firebrand.fervid-conviction', runtime.time)
  )
    return;

  const stacks = effectNumber(profile, buff, 'stacks');
  const duration = effectNumber(profile, buff, 'duration');
  const maximumTargets = balanceNumberFromContext(runtime, REWORK.FERVID_CONVICTION, 'maximumTargets');

  if (stacks <= 0 || duration <= 0 || maximumTargets <= 0) return;

  const expiresAt = gw2EffectExpiresAt(runtime.time, duration);
  const state = firebrandState.from(runtime);
  state.ashes = grantCharges(stacks, expiresAt, state.ashes, runtime.time);
  state.ashesBurnDuration = effectNumber(ashes, burn, 'duration');
  runtime.schedule(FIREBRAND_ASHES_EXPIRE, expiresAt, undefined, undefined, 10);
  alliedAshes(runtime, guardianCastCause(runtime, cast), stacks, duration, {
    maximumAllies: maximumTargets - 1,
    priority: 5,
    skillName: 'Fervid Conviction',
    name: 'Fervid Conviction'
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
  name: 'Fervid Conviction',
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
  name: 'Stalwart Speed',
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
  name: 'Stoic Demeanor',
  balance: { rechargeReduction: 0, internalCooldown: 0 },
  triggers: [
    onTriggerPoint(firebrandControlAccepted, {
      when: (_runtime, { cause }: FirebrandControl) =>
        cause.actorType === ACTOR.PLAYER && cause.condition !== CONDITION.SLOW,
      run(runtime: GuardianRuntime) {
        const reduction = balanceNumberFromContext(runtime, TRAIT.STOIC_DEMEANOR, 'rechargeReduction');

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
  name: 'Righteous Flames',
  balance: {
    effects: [{ type: 'condition', name: CONDITION.BURNING, condition: CONDITION.BURNING, duration: 2, stacks: 1 }]
  },
  hooks: {
    prepareEvent(runtime, event) {
      if (
        !hasTrait(runtime, REWORK.RIGHTEOUS_FLAMES) ||
        event.type !== 'condition' ||
        event.condition !== CONDITION.BURNING ||
        event.sourceId !== 'guardian.ashes-of-the-just'
      )
        return event;

      const profile = requireBalanceProfileFromContext(runtime, REWORK.RIGHTEOUS_FLAMES);
      const burn = requireEffect(profile, 'condition', CONDITION.BURNING);

      if (!burn) return event;

      return {
        ...event,
        duration: effectNumber(profile, burn, 'duration'),
        stacks: effectNumber(profile, burn, 'stacks')
      };
    }
  }
});

// Support-only traits own no damage effects; replacing their old definitions removes page-capacity and cadence bonuses.
export const firebrandReworkTraits = [
  swiftScholar,
  ...firebrandTraits.filter((trait) => trait.id === TRAIT.LEGENDARY_LORE),
  unrelentingCriticism,
  imbuedHaste,
  revelation,
  fervidConviction,
  stalwartSpeed,
  stoicDemeanor,
  righteousFlames,
  defineTrait({ id: REWORK.BASTION, name: 'Bastion' }),
  defineTrait({ id: REWORK.DELIVERANCE, name: 'Deliverance' })
];
