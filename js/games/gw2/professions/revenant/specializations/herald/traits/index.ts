// Trait IDs own balance lookup and emission so patches and runtime share the same trait definition.
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { isStandardBoon } from '#gw2/platform/combat/boons.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { countActiveBoons } from '#gw2/platform/combat/query/runtime-query.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { ACTOR, BOON, RECIPIENT } from '#gw2/platform/constants.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import {
  balanceNumber,
  balanceProfileNumber,
  requireBalanceProfile,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import {
  revenantRuntimeCoreState,
  revenantRuntimeSpecializationState
} from '#gw2/professions/revenant/core/state-queries.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import {
  heraldFacetPassiveLegend,
  retainHeraldFacet
} from '#gw2/professions/revenant/specializations/herald/mechanics/facets.js';
import {
  facetConsumed,
  heraldUpkeepSettled
} from '#gw2/professions/revenant/specializations/herald/mechanics/trigger-points.js';
import { HERALD_BASE_SKILL_MECHANICS } from '#gw2/professions/revenant/specializations/herald/skills/index.js';
import { heraldState } from '#gw2/professions/revenant/specializations/herald/state.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';
import { canonicalInterval, canonicalTime } from '#kernel/core/clock.js';

const COMPASSION = 'revenant.herald-elevated-compassion';

const coreValue = defineTrait({
  id: TRAIT.CORE_VALUE,
  balance: { duration: 1 }
});

/** Retain consumed facets while allowing each facet's bonus to be tuned independently. */
export const draconicEcho = defineTrait({
  id: TRAIT.DRACONIC_ECHO,
  balance: {
    duration: 6,
    damageIncrease: 0.1,
    conditionDamageIncrease: 0.1,
    criticalChanceBonus: 0.1,
    boonDurationBonus: 10,
    effects: []
  },
  // Echo's Nature bonus uses the normal cap, including retained facet windows.
  attributes: (context) => ({
    traitDurations: {
      'Boon Duration': draconicEchoActive(context, ID.FACET_OF_NATURE)
        ? balanceNumber(context.balanceContext.catalog, TRAIT.DRACONIC_ECHO, 'boonDurationBonus')
        : 0
    }
  }),
  modifierRules: [
    {
      id: 'revenant.draconic-echo-strength',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) => 1 + balanceNumber(context.catalog, TRAIT.DRACONIC_ECHO, 'damageIncrease'),
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) && draconicEchoActive(context, ID.FACET_OF_STRENGTH)
    },
    {
      id: 'revenant.draconic-echo-elements',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'multiply',
      factor: (context) => 1 + balanceNumber(context.catalog, TRAIT.DRACONIC_ECHO, 'conditionDamageIncrease'),
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) && draconicEchoActive(context, ID.FACET_OF_ELEMENTS)
    },
    {
      id: 'revenant.draconic-echo-darkness',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) => balanceNumber(context.catalog, TRAIT.DRACONIC_ECHO, 'criticalChanceBonus'),
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) && draconicEchoActive(context, ID.FACET_OF_DARKNESS)
    }
  ],
  triggers: [
    onTriggerPoint(facetConsumed, {
      when: (_runtime, input) => input.wasActive,
      run: (runtime, input) =>
        retainHeraldFacet(runtime, input.facet, balanceNumber(runtime.helpers, TRAIT.DRACONIC_ECHO, 'duration'))
    })
  ]
});

const elevatedCompassion = defineTrait({
  id: TRAIT.ELEVATED_COMPASSION,
  balance: {
    attributeConversion: 0.13,
    cooldown: 1,
    threshold: 6,
    effects: [
      {
        name: BOON.QUICKNESS,
        type: 'boon',
        boon: BOON.QUICKNESS,
        duration: 1.25,
        stacks: 1,
        actorType: ACTOR.PLAYER,
        audience: { recipients: RECIPIENT.PARTY }
      }
    ]
  },
  attributes: traitAttributeEffects(TRAIT.ELEVATED_COMPASSION, [
    {
      kind: 'conversion',
      from: 'Power',
      to: 'Concentration',
      field: 'attributeConversion',
      rounding: 'round',
      input: 'common'
    }
  ]),
  triggers: [onTriggerPoint(heraldUpkeepSettled, { run: syncCompassion })],
  lifetime: { tasks: { [COMPASSION]: compassionPulse } }
});

const forcefulPersistence = defineTrait<RevenantSkill>({
  id: TRAIT.FORCEFUL_PERSISTENCE,
  balance: { damageIncreasePerStack: 0.1, upkeepDamageIncrease: 0.25 },
  modifierRules: [
    {
      id: 'revenant.forceful-persistence',
      order: 100,
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      // Each active facet contributes 10%, other upkeeps 25%; share Ferocious Aggression's additive bucket.
      amount: (context) =>
        (revenantRuntimeCoreState(context).activeUpkeeps || []).reduce(
          (bonus, upkeep) =>
            bonus +
            balanceNumber(
              context.catalog,
              TRAIT.FORCEFUL_PERSISTENCE,
              HERALD_BASE_SKILL_MECHANICS[Number(upkeep.skillId)]?.facet
                ? 'damageIncreasePerStack'
                : 'upkeepDamageIncrease'
            ),
          0
        ),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event)
    }
  ]
});

const reinforcedPotency = defineTrait({
  id: TRAIT.REINFORCED_POTENCY,
  balance: {
    damagePerBoon: 0.02,
    maximumBoons: 5,
    attributeBonuses: { concentration: 240 }
  },
  attributes: traitAttributeEffects(TRAIT.REINFORCED_POTENCY, [
    // This intrinsic Concentration is conversion-eligible, unlike the separate boon-dependent damage bonus.
    { kind: 'flat', to: 'Concentration', feedsConversions: 'all' }
  ]),
  modifierRules: [
    {
      id: 'revenant.reinforced-potency',
      order: 103,
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      // Boons add within Potency's own multiplier, which then scales the shared outgoing damage bucket.
      factor: (context) =>
        1 +
        Math.min(balanceNumber(context.catalog, TRAIT.REINFORCED_POTENCY, 'maximumBoons'), countActiveBoons(context)) *
          balanceNumber(context.catalog, TRAIT.REINFORCED_POTENCY, 'damagePerBoon'),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event)
    }
  ]
});

const sharedEmpowerment = defineTrait({
  id: TRAIT.SHARED_EMPOWERMENT,
  balance: {
    internalCooldown: 1,
    effects: [
      {
        name: BOON.MIGHT,
        type: 'boon',
        boon: BOON.MIGHT,
        duration: 8,
        stacks: 1,
        actorType: ACTOR.EFFECT,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      }
    ]
  },
  triggers: [
    {
      emit: TRAIT.SHARED_EMPOWERMENT,
      on: 'buff.applied',
      cooldown: 'profile',
      when: (runtime, event) =>
        event.sourceId !== TRAIT.SHARED_EMPOWERMENT &&
        isStandardBoon(String(event.kind)) &&
        Number(event.resolvedAudience?.recipientCount) > 0 &&
        Boolean(requireEffect(requireBalanceProfile(runtime.helpers, TRAIT.SHARED_EMPOWERMENT), 'boon', BOON.MIGHT)),
      effects: (effect) => effect.type === 'boon' && effect.name === BOON.MIGHT,
      attribution: {
        source: 'revenant',
        skillId: TRAIT.SHARED_EMPOWERMENT,
        skillName: 'Shared Empowerment',
        name: 'Shared Empowerment - might'
      }
    }
  ]
});

export const traitDefinitions = [
  coreValue,
  draconicEcho,
  sharedEmpowerment,
  elevatedCompassion,
  reinforcedPotency,
  forcefulPersistence
];

/** Selected Draconic Echo attribute and modifier callbacks share the active or retained facet window. */
function draconicEchoActive(context: Gw2ModifierContext, skillId: SkillId): boolean {
  return (
    heraldFacetPassiveLegend(
      revenantRuntimeCoreState(context),
      revenantRuntimeSpecializationState(context, 'Herald'),
      skillId,
      context.time
    ) !== undefined
  );
}

function elevatedCompassionActive(runtime: RevenantRuntime): boolean {
  const profile = requireBalanceProfile(runtime.helpers, TRAIT.ELEVATED_COMPASSION);
  const threshold = Math.max(0, balanceProfileNumber(profile, 'threshold'));
  const upkeep = runtime.profession.core.activeUpkeeps.reduce(
    (total, active) => total + Math.max(0, active.upkeepCost || 0),
    0
  );
  // A removed Quickness packet has no cadence to schedule, including on threshold re-entry.
  return (
    hasTrait(runtime, TRAIT.ELEVATED_COMPASSION) &&
    upkeep >= threshold &&
    Boolean(requireEffect(profile, 'boon', BOON.QUICKNESS))
  );
}

/** Grants one Quickness pulse and reserves the next legal pulse so threshold re-entry cannot bypass the ICD. */
function grantCompassion(runtime: RevenantRuntime): void {
  const profile = requireBalanceProfile(runtime.helpers, TRAIT.ELEVATED_COMPASSION);
  const effect = requireEffect(profile, 'boon', BOON.QUICKNESS);

  // The cooldown gates only quickness, so a removed boon leaves the pulse ready.
  if (!effect) return;

  emitTraitProfile(runtime, TRAIT.ELEVATED_COMPASSION, TRAIT.ELEVATED_COMPASSION, undefined, {
    at: runtime.time,
    fullEnd: runtime.time,
    effect: { type: 'boon', name: BOON.QUICKNESS },
    attribution: {
      source: 'revenant',
      sourceId: TRAIT.ELEVATED_COMPASSION,
      actorType: ACTOR.PLAYER,
      skillId: TRAIT.ELEVATED_COMPASSION,
      skillName: 'Elevated Compassion',
      name: 'Elevated Compassion - quickness',
      audience: effect.audience ?? { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
    }
  });
  runtime.procs.setDeadline(
    'revenant.herald.elevatedCompassion',
    canonicalTime(runtime.time + canonicalInterval(balanceProfileNumber(profile, 'cooldown')))
  );
}

function scheduleCompassion(runtime: RevenantRuntime, at: number): void {
  heraldState.from(runtime.profession).elevatedCompassionPulseAt = at;
  runtime.schedule(COMPASSION, at);
}

/** Upkeep-changing casts start the one Elevated Compassion cadence; falling below threshold ends it lazily. */
function syncCompassion(runtime: RevenantRuntime): void {
  const state = heraldState.from(runtime.profession);

  if (!elevatedCompassionActive(runtime)) {
    state.elevatedCompassionPulseAt = null;
    return;
  }

  if (state.elevatedCompassionPulseAt != null && state.elevatedCompassionPulseAt >= runtime.time) return;

  const readyAt = Math.max(runtime.time, runtime.procs.deadline('revenant.herald.elevatedCompassion') || 0);

  if (readyAt <= runtime.time) {
    grantCompassion(runtime);
    scheduleCompassion(runtime, runtime.procs.deadline('revenant.herald.elevatedCompassion'));
  } else scheduleCompassion(runtime, readyAt);
}

function compassionPulse(runtime: RevenantRuntime): void {
  const state = heraldState.from(runtime.profession);

  if (state.elevatedCompassionPulseAt !== runtime.time) return;

  if (!elevatedCompassionActive(runtime)) {
    state.elevatedCompassionPulseAt = null;
    return;
  }

  grantCompassion(runtime);
  scheduleCompassion(runtime, runtime.procs.deadline('revenant.herald.elevatedCompassion'));
}
