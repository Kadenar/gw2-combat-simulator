import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { GW2_STANDARD_BOONS, isStandardBoon } from '#gw2/platform/combat/boons.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { countActiveBoons } from '#gw2/platform/combat/query/runtime-query.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import type { TriggerPointInput } from '#gw2/platform/profession-definition/trigger-points.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { revenantRuntimeCoreState } from '#gw2/professions/revenant/core/state-queries.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import {
  facetConsumed,
  heraldUpkeepSettled
} from '#gw2/professions/revenant/specializations/herald/mechanics/boundaries.js';
import { scheduleFacetPulse } from '#gw2/professions/revenant/specializations/herald/mechanics/facets.js';
import {
  HERALD_DRACONIC_ECHO_PROFILE_ID,
  HERALD_ELEVATED_COMPASSION_PROFILE_ID,
  HERALD_SHARED_EMPOWERMENT_PROFILE_ID
} from '#gw2/professions/revenant/specializations/herald/profiles.js';
import { HERALD_BASE_SKILL_MECHANICS } from '#gw2/professions/revenant/specializations/herald/skills/index.js';
import { heraldState } from '#gw2/professions/revenant/specializations/herald/state.js';
import { draconicEchoActive } from '#gw2/professions/revenant/specializations/herald/traits/behavior.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';
import { canonicalInterval, canonicalTime } from '#kernel/core/clock.js';
const COMPASSION = 'revenant.herald-elevated-compassion';
const ECHO_EXPIRY = 'revenant.herald-echo-expiry';

/** Owns Core Value tuning and behavior at its established execution boundaries. */
export const coreValue = defineTrait({
  id: TRAIT.CORE_VALUE,
  name: 'Core Value',
  balance: { duration: 1 }
});

/** Retain consumed facets while allowing each facet's bonus to be tuned independently. */
export const draconicEcho = defineTrait({
  // Echo's Nature bonus uses the normal cap, including retained facet windows.
  attributes: (context) => ({
    traitDurations: {
      'Boon Duration': draconicEchoActive(context, ID.FACET_OF_NATURE)
        ? balanceProfileNumber(
            requireBalanceProfileFromContext(context, HERALD_DRACONIC_ECHO_PROFILE_ID),
            'boonDurationBonus'
          )
        : 0
    }
  }),
  triggers: [
    onTriggerPoint(facetConsumed, {
      run: (runtime, input: TriggerPointInput<typeof facetConsumed>) =>
        retainDraconicEcho(runtime, input.facet, input.wasActive)
    })
  ],
  modifierRules: [
    {
      id: 'revenant.draconic-echo-strength',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        1 +
        balanceProfileNumber(
          requireBalanceProfileFromContext(context, HERALD_DRACONIC_ECHO_PROFILE_ID),
          'damageIncrease'
        ),
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) && draconicEchoActive(context, ID.FACET_OF_STRENGTH)
    },
    {
      id: 'revenant.draconic-echo-elements',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        1 +
        balanceProfileNumber(
          requireBalanceProfileFromContext(context, HERALD_DRACONIC_ECHO_PROFILE_ID),
          'conditionDamageIncrease'
        ),
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) && draconicEchoActive(context, ID.FACET_OF_ELEMENTS)
    },
    {
      id: 'revenant.draconic-echo-darkness',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) =>
        balanceProfileNumber(
          requireBalanceProfileFromContext(context, HERALD_DRACONIC_ECHO_PROFILE_ID),
          'criticalChanceBonus'
        ),
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) && draconicEchoActive(context, ID.FACET_OF_DARKNESS)
    }
  ],
  lifetime: { tasks: { [ECHO_EXPIRY]: echoExpiry } },
  id: TRAIT.DRACONIC_ECHO,
  name: 'Draconic Echo',
  balance: {
    id: HERALD_DRACONIC_ECHO_PROFILE_ID,
    duration: 6,
    damageIncrease: 0.1,
    conditionDamageIncrease: 0.1,
    criticalChanceBonus: 0.1,
    boonDurationBonus: 10,
    effects: []
  }
});

/** Owns Elevated Compassion tuning and behavior at its established execution boundaries. */
export const elevatedCompassion = defineTrait({
  triggers: [onTriggerPoint(heraldUpkeepSettled, { run: syncCompassion })],
  attributes: traitAttributeEffects(HERALD_ELEVATED_COMPASSION_PROFILE_ID, [
    {
      kind: 'conversion',
      from: 'Power',
      to: 'Concentration',
      field: 'attributeConversion',
      rounding: 'round',
      input: 'common'
    }
  ]),
  lifetime: { tasks: { [COMPASSION]: compassionPulse } },
  id: TRAIT.ELEVATED_COMPASSION,
  name: 'Elevated Compassion',
  balance: {
    id: HERALD_ELEVATED_COMPASSION_PROFILE_ID,
    attributeConversion: 0.13,
    description: 'Grants quickness while aggregate upkeep is at least six.',
    cooldown: 1,
    threshold: 6,
    effects: [
      {
        name: 'quickness',
        type: 'boon',
        boon: 'quickness',
        duration: 1.25,
        stacks: 1,
        actorType: 'player',
        audience: { recipients: 'party' as const }
      }
    ]
  }
});

/** Owns Forceful Persistence tuning and behavior at its established execution boundaries. */
export const forcefulPersistence = defineTrait({
  id: TRAIT.FORCEFUL_PERSISTENCE,
  name: 'Forceful Persistence',
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
            balanceProfileNumber(
              requireBalanceProfileFromContext(context, TRAIT.FORCEFUL_PERSISTENCE),
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

/** Owns Reinforced Potency tuning and behavior at its established execution boundaries. */
export const reinforcedPotency = defineTrait({
  attributes: traitAttributeEffects(TRAIT.REINFORCED_POTENCY, [
    { kind: 'flat', to: 'Concentration', field: 'attributeBonus', feedsConversions: false }
  ]),
  id: TRAIT.REINFORCED_POTENCY,
  name: 'Reinforced Potency',
  balance: {
    damagePerBoon: 0.01,
    maximumBoons: GW2_STANDARD_BOONS.length,
    attributeBonus: 240
  },
  modifierRules: [
    {
      id: 'revenant.reinforced-potency',
      order: 103,
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      // Count unique boons only up to the selected balance cap.

      amount: (context) =>
        Math.min(
          balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.REINFORCED_POTENCY), 'maximumBoons'),
          countActiveBoons(context)
        ) * balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.REINFORCED_POTENCY), 'damagePerBoon'),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event)
    }
  ]
});

/** Owns Shared Empowerment tuning and behavior at its established execution boundaries. */
export const sharedEmpowerment = defineTrait({
  id: TRAIT.SHARED_EMPOWERMENT,
  name: 'Shared Empowerment',
  balance: {
    id: HERALD_SHARED_EMPOWERMENT_PROFILE_ID,
    description: 'Applying a boon to an ally grants nearby allies one stack of might.',
    internalCooldown: 1,
    effects: [
      {
        name: 'might',
        type: 'boon',
        boon: 'might',
        duration: 8,
        stacks: 1,
        actorType: 'effect',
        audience: { recipients: 'party' as const, maximumRecipients: 5 }
      }
    ]
  },
  triggers: [
    {
      emit: HERALD_SHARED_EMPOWERMENT_PROFILE_ID,
      on: 'buff.applied',
      cooldown: 'profile',
      when: (runtime, event) =>
        event.sourceId !== TRAIT.SHARED_EMPOWERMENT &&
        isStandardBoon(String(event.kind)) &&
        Number(event.resolvedAudience?.recipientCount) > 0 &&
        Boolean(
          requireEffect(
            requireBalanceProfileFromContext(runtime, HERALD_SHARED_EMPOWERMENT_PROFILE_ID),
            'boon',
            'might'
          )
        ),
      effects: (effect) => effect.type === 'boon' && effect.name === 'might',
      attribution: {
        source: 'revenant',
        skillId: TRAIT.SHARED_EMPOWERMENT,
        skillName: 'Shared Empowerment',
        name: 'Shared Empowerment — might'
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

/** Applies the trait at the mechanic's existing execution boundary. */
function retainDraconicEcho(runtime: RevenantRuntime, facet: RevenantSkill, wasActive: boolean): void {
  const core = runtime.profession.core;
  if (!wasActive) return;
  const state = heraldState.from(runtime);
  const profile = requireBalanceProfileFromContext(runtime, HERALD_DRACONIC_ECHO_PROFILE_ID);
  const expiresAt = canonicalTime(runtime.time + balanceProfileNumber(profile, 'duration'));
  // Retention preserves the pulse phase, but never keeps an Energy-draining upkeep alive.
  state.lingeringFacets[facet.id] = { startsAt: runtime.time, expiresAt, legendId: core.activeLegendId };
  const nextAt = state.facetPulseReadyAt[facet.id];
  if (facet.upkeepPulse && nextAt >= runtime.time && nextAt < expiresAt) scheduleFacetPulse(runtime, facet.id, nextAt);
  runtime.schedule(ECHO_EXPIRY, expiresAt, { skillId: facet.id, expiresAt });
}

function echoExpiry(runtime: RevenantRuntime, data: unknown): void {
  const { skillId, expiresAt } = data as { skillId: SkillId; expiresAt: number };
  const state = heraldState.from(runtime);
  if (state.lingeringFacets[skillId]?.expiresAt === expiresAt) delete state.lingeringFacets[skillId];
}

function elevatedCompassionActive(runtime: RevenantRuntime): boolean {
  const profile = requireBalanceProfileFromContext(runtime, HERALD_ELEVATED_COMPASSION_PROFILE_ID);
  const threshold = Math.max(0, balanceProfileNumber(profile, 'threshold'));
  const upkeep = runtime.profession.core.activeUpkeeps.reduce(
    (total, active) => total + Math.max(0, active.upkeepCost || 0),
    0
  );
  // A removed Quickness packet has no cadence to schedule, including on threshold re-entry.
  return (
    hasTrait(runtime, TRAIT.ELEVATED_COMPASSION) &&
    upkeep >= threshold &&
    Boolean(requireEffect(profile, 'boon', 'quickness'))
  );
}

/** Grants one Quickness pulse and reserves the next legal pulse so threshold re-entry cannot bypass the ICD. */
function grantCompassion(runtime: RevenantRuntime): void {
  const profile = requireBalanceProfileFromContext(runtime, HERALD_ELEVATED_COMPASSION_PROFILE_ID);
  const effect = requireEffect(profile, 'boon', 'quickness');
  // The cooldown gates only quickness, so a removed boon leaves the pulse ready.
  if (!effect) return;
  emitTraitProfile(runtime, HERALD_ELEVATED_COMPASSION_PROFILE_ID, HERALD_ELEVATED_COMPASSION_PROFILE_ID, undefined, {
    at: runtime.time,
    fullEnd: runtime.time,
    effect: { type: 'boon', name: 'quickness' },
    attribution: {
      source: 'revenant',
      sourceId: TRAIT.ELEVATED_COMPASSION,
      actorType: 'player',
      skillId: TRAIT.ELEVATED_COMPASSION,
      skillName: 'Elevated Compassion',
      name: 'Elevated Compassion - quickness',
      audience: effect.audience ?? { recipients: 'party', maximumRecipients: 5 }
    }
  });
  runtime.procs.setDeadline(
    'revenant.herald.elevatedCompassion',
    canonicalTime(runtime.time + canonicalInterval(balanceProfileNumber(profile, 'cooldown')))
  );
}

function scheduleCompassion(runtime: RevenantRuntime, at: number): void {
  heraldState.from(runtime).elevatedCompassionPulseAt = at;
  runtime.schedule(COMPASSION, at);
}

/** Upkeep-changing casts start the one Elevated Compassion cadence; falling below threshold ends it lazily. */
function syncCompassion(runtime: RevenantRuntime): void {
  const state = heraldState.from(runtime);
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
  const state = heraldState.from(runtime);
  if (state.elevatedCompassionPulseAt !== runtime.time) return;
  if (!elevatedCompassionActive(runtime)) {
    state.elevatedCompassionPulseAt = null;
    return;
  }

  grantCompassion(runtime);
  scheduleCompassion(runtime, runtime.procs.deadline('revenant.herald.elevatedCompassion'));
}
