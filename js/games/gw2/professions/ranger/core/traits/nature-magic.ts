import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { materializeSkillEffectApplications } from '#gw2/platform/engine/effects/materializer.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import { GW2_ACTION_TICK_MS } from '#gw2/platform/skills/timing.js';
import { emitSunSpiritBurning } from '#gw2/professions/ranger/core/skills/slot-skills.js';
import { rangerActiveBoonCount, rangerPetEvent } from '#gw2/professions/ranger/core/traits/modifier-queries.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import type { RangerRuntime } from '#gw2/professions/ranger/types.js';

/** Repeat on the next action tick after the authored final shake, including patched pulse timings. */
function finalSpiritShakeAt(cast: RuntimeCast): number {
  return (
    GW2_ACTION_TICK_MS / 1000 +
    Math.max(
      cast.fullEnd,
      ...(cast.skill.effects ?? [])
        .filter((effect) => effect.type === 'boon')
        .flatMap((effect) =>
          materializeSkillEffectApplications({
            skill: cast.skill,
            effect,
            start: cast.start,
            fullEnd: cast.fullEnd,
            baseEvent: {
              source: 'ranger',
              sourceId: cast.skill.id,
              actorType: 'player',
              skillId: cast.skill.id,
              skillName: cast.skill.name
            }
          }).map((application) => application.at)
        )
    )
  );
}

/** Repeat only slam payloads after the last shake, without another cast, summon reward, or boon sequence. */
export const naturesVengeance = defineTrait({
  id: TRAIT.NATURES_VENGEANCE,
  name: "Nature's Vengeance",
  hooks: {
    modifyEffects(runtime: RangerRuntime, cast: RuntimeCast, effects) {
      if (!hasTrait(runtime, TRAIT.NATURES_VENGEANCE)) return effects;
      const slams = effects.filter((effect) => effect.metadata?.packetKind === 'ranger.spirit-slam');
      if (!slams.length) return effects;
      const atMs = (finalSpiritShakeAt(cast) - cast.start) * 1000;
      return [
        ...effects,
        ...slams.map((effect) => ({
          ...effect,
          atMs,
          timingAnchor: 'castStart' as const,
          timingScale: 'fixed' as const
        }))
      ];
    },
    onCastCommit(runtime: RangerRuntime, cast: RuntimeCast) {
      // Solar Flare owns a separately patchable child profile rather than an inline slam packet.
      if (hasTrait(runtime, TRAIT.NATURES_VENGEANCE) && cast.skill.id === ID.SUN_SPIRIT)
        runtime.schedule('ranger.natures-vengeance-sun', finalSpiritShakeAt(cast), cast.skill);
    },
    tasks: {
      'ranger.natures-vengeance-sun'(runtime: RangerRuntime, data: unknown) {
        emitSunSpiritBurning(runtime, data as RuntimeCast['skill']);
      }
    }
  }
});

/** Owns Wellspring's live tuning and trait behavior. */
export const wellspring = defineTrait({
  id: TRAIT.WELLSPRING,
  name: 'Wellspring',
  balance: {
    attributeConversion: 0.07,
    effects: [
      {
        name: 'regeneration',
        type: 'boon',
        boon: 'regeneration',
        duration: 6,
        stacks: 1,
        audience: { recipients: 'party', maximumRecipients: 5 }
      }
    ]
  },
  triggers: [
    {
      order: 1,
      emit: TRAIT.WELLSPRING,
      on: 'castCommit' as const,
      when: (_runtime: RangerRuntime, cast: RuntimeCast) => cast.skill.type === 'Heal',
      effects: (effect) => effect.type === 'boon' && effect.name === 'regeneration',
      attribution: (_runtime: RangerRuntime, cast: RuntimeCast) => ({
        skillId: TRAIT.WELLSPRING,
        skillName: 'Wellspring',
        name: `Wellspring - regeneration`,
        triggeredBy: cast.skill.name
      })
    }
  ],
  buildAttributes: (_common, { balanceContext }) => ({
    attributeEffects: [
      {
        kind: 'conversion',
        from: 'Power',
        to: 'Healing Power',
        multiplier: balanceProfileNumber(
          requireBalanceProfileFromContext(balanceContext, TRAIT.WELLSPRING),
          'attributeConversion'
        ),
        rounding: 'none',
        input: 'common'
      }
    ]
  })
});

/** Owns Windborne Notes's live tuning and trait behavior. */
export const windborneNotes = defineTrait({
  id: TRAIT.WINDBORNE_NOTES,
  name: 'Windborne Notes',
  balance: {
    effects: [
      {
        name: 'regeneration',
        type: 'boon',
        boon: 'regeneration',
        duration: 6,
        stacks: 1,
        audience: { recipients: 'party', maximumRecipients: 5 }
      }
    ]
  },
  triggers: [
    {
      order: 2,
      emit: TRAIT.WINDBORNE_NOTES,
      on: 'castCommit' as const,
      when: (_runtime: RangerRuntime, cast: RuntimeCast) => cast.skill.weapon === 'Warhorn',
      effects: (effect) => effect.type === 'boon' && effect.name === 'regeneration',
      attribution: (_runtime: RangerRuntime, cast: RuntimeCast) => ({
        skillId: TRAIT.WINDBORNE_NOTES,
        skillName: 'Windborne Notes',
        name: `Windborne Notes - regeneration`,
        triggeredBy: cast.skill.name
      })
    }
  ]
});

/** Owns Rejuvenation's live tuning and trait behavior. */
export const rejuvenation = defineTrait({
  id: TRAIT.REJUVENATION,
  name: 'Rejuvenation',
  balance: {
    internalCooldown: 20,
    effects: [{ name: 'regeneration', type: 'boon', boon: 'regeneration', duration: 10, stacks: 1 }]
  }
});

/** Owns Spirited Arrival's live tuning and trait behavior. */
export const spiritedArrival = defineTrait({
  id: TRAIT.SPIRITED_ARRIVAL,
  name: 'Spirited Arrival',
  balance: {
    effects: [
      { name: 'might', type: 'boon', boon: 'might', duration: 12, stacks: 6 },
      { name: 'fury', type: 'boon', boon: 'fury', duration: 8, stacks: 1 }
    ]
  }
});

/** Owns Lingering Magic's live tuning and trait behavior. */
export const lingeringMagic = defineTrait({
  id: TRAIT.LINGERING_MAGIC,
  name: 'Lingering Magic',
  balance: {
    attributeBonus: 240
  },
  buildAttributes: (_common, { balanceContext: profileContext }) => {
    const profile = requireBalanceProfileFromContext(profileContext, TRAIT.LINGERING_MAGIC);
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Concentration',
          amount: balanceProfileNumber(profile, 'attributeBonus'),
          feedsConversions: false
        }
      ]
    };
  }
});

/** Owns Bountiful Hunter's live tuning and trait behavior. */
export const bountifulHunter = defineTrait({
  id: TRAIT.BOUNTIFUL_HUNTER,
  name: 'Bountiful Hunter',
  modifierRules: [
    {
      order: 7,
      id: 'ranger.bountiful-hunter-player',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      parameters: { baseFactor: 1, damagePerBoon: 0.01 },
      factor: (context, _target, parameters) =>
        parameters.baseFactor + rangerActiveBoonCount(context, 'player') * parameters.damagePerBoon,
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event)
    },
    {
      order: 32,
      id: 'ranger.bountiful-hunter-pet',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      parameters: { baseFactor: 1, damagePerBoon: 0.01 },
      factor: (context, _target, parameters) =>
        parameters.baseFactor + rangerActiveBoonCount(context, 'pet') * parameters.damagePerBoon,
      when: (context) => rangerPetEvent(context)
    }
  ]
});
