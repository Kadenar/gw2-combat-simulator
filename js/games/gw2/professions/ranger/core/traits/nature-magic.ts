import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { isStandardBoon } from '#gw2/platform/combat/boons.js';
import { gw2EventOwnerActorType, isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { requireBalanceProfileFromContext } from '#gw2/platform/engine/skills/balance-profiles.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import { materializeSkillEffectApplications } from '#gw2/platform/engine/effects/materializer.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import { rangerPetCompanionId } from '#gw2/professions/ranger/core/mechanics/pets.js';
import { emitSunSpiritBurning } from '#gw2/professions/ranger/core/skills/slot-skills.js';
import { rangerActiveBoonCount, rangerPetEvent } from '#gw2/professions/ranger/core/traits/modifier-queries.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import type { RangerSkill, RangerRuntime } from '#gw2/professions/ranger/types.js';

/** Both live player grants and configured console pulses use the same ranger-scaled pet application. */
function shareFortifyingBond(runtime: RangerRuntime, kind: string, stacks: number, cause?: Gw2ResolverEvent): void {
  if (!runtime.profession.core.petActive) return;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.FORTIFYING_BOND);
  runtime.effects.emit({
    kind: 'profile',
    profile: profile,
    effects: profile.effects?.filter((effect) => effect.type === 'boon' && effect.boon === kind),
    cause,
    attribution: {
      source: 'Trait',
      sourceId: TRAIT.FORTIFYING_BOND,
      actorType: 'effect',
      ownerActorType: 'player',
      skillId: TRAIT.FORTIFYING_BOND,
      skillName: 'Fortifying Bond',
      triggeredBy: cause?.skillName ?? 'Training console'
    },
    transform: (packet) => ({
      ...packet,
      stacks,
      audience: {
        recipients: 'summons',
        affectsSelf: false,
        maximumRecipients: 1,
        eligibleCompanionIds: [rangerPetCompanionId(runtime)]
      }
    })
  });
}

/** Share received player boons with the active pet using the trait's durations and the ranger's concentration. */
export const fortifyingBond = defineTrait({
  id: TRAIT.FORTIFYING_BOND,
  name: 'Fortifying Bond',
  balance: {
    effects: Object.entries({
      aegis: 5,
      alacrity: 3,
      fury: 5,
      might: 10,
      protection: 3,
      quickness: 2.5,
      regeneration: 6,
      resistance: 2,
      resolution: 5,
      stability: 5,
      swiftness: 6,
      vigor: 3
    }).map(([boon, duration]) => ({ name: boon, type: 'boon' as const, boon, duration, stacks: 1 }))
  },
  hooks: {
    initialize(runtime: RangerRuntime) {
      if (
        hasTrait(runtime, TRAIT.FORTIFYING_BOND) &&
        Object.entries(runtime.config.boons ?? {}).some(([kind, value]) => isStandardBoon(kind) && Number(value) > 0)
      )
        runtime.schedule('ranger.fortifying-bond-console', 0, null);
    },
    tasks: {
      'ranger.fortifying-bond-console'(runtime: RangerRuntime) {
        // Model configured console boons as three-second refreshes, each of which triggers Bond.
        // Emit only the trait's pet grant: the configured player boon already exists in the permanent-boon layer.
        for (const [kind, value] of Object.entries(runtime.config.boons ?? {}))
          if (isStandardBoon(kind) && Number(value) > 0) shareFortifyingBond(runtime, kind, Number(value));
        runtime.schedule('ranger.fortifying-bond-console', runtime.time + 3, null);
      }
    },
    reactions: {
      'buff.applied'(runtime: RangerRuntime, event) {
        if (
          !hasTrait(runtime, TRAIT.FORTIFYING_BOND) ||
          !runtime.profession.core.petActive ||
          !event.resolvedAudience?.includesSelf ||
          !isStandardBoon(String(event.kind)) ||
          !(Number(event.duration) > 0) ||
          !(Number(event.stacks) > 0) ||
          // Trait and equipment effects are player grants; NPCs and pet-cast boons cannot trigger sharing.
          !['player', 'effect'].includes(event.actorType) ||
          !['player', 'effect'].includes(gw2EventOwnerActorType(event))
        )
          return;
        shareFortifyingBond(runtime, String(event.kind), Number(event.stacks), event);
      }
    }
  }
});

/** Every spirit repeats its slam one second after the final authored shake, including patched pulse timings. */
function spiritRepeatSlamAt(cast: RuntimeCast<RangerSkill>): number {
  return (
    1 +
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
    modifyEffects(runtime: RangerRuntime, cast: RuntimeCast<RangerSkill>, effects) {
      if (!hasTrait(runtime, TRAIT.NATURES_VENGEANCE)) return effects;
      const slams = effects.filter((effect) => effect.metadata?.packetKind === 'ranger.spirit-slam');
      if (!slams.length) return effects;
      const atMs = (spiritRepeatSlamAt(cast) - cast.start) * 1000;
      return [
        ...effects,
        ...slams.map((effect) => ({
          ...effect,
          // Paired critical and noncritical hits support half damage for Storm's second slam only.
          ...(cast.skill.id === ID.STORM_SPIRIT && effect.type === 'strike'
            ? { coefficient: (effect.coefficient ?? 0) / 2 }
            : {}),
          atMs,
          timingAnchor: 'castStart' as const,
          timingScale: 'fixed' as const
        }))
      ];
    },
    onCastCommit(runtime: RangerRuntime, cast: RuntimeCast<RangerSkill>) {
      // Solar Flare owns a separately patchable child profile rather than an inline slam packet.
      if (hasTrait(runtime, TRAIT.NATURES_VENGEANCE) && cast.skill.id === ID.SUN_SPIRIT)
        runtime.schedule('ranger.natures-vengeance-sun', spiritRepeatSlamAt(cast), cast.skill);
    },
    tasks: {
      'ranger.natures-vengeance-sun'(runtime: RangerRuntime, data: unknown) {
        emitSunSpiritBurning(runtime, data as RuntimeCast<RangerSkill>['skill'], runtime.time);
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
      when: (_runtime: RangerRuntime, cast: RuntimeCast<RangerSkill>) => cast.skill.type === 'Heal',
      effects: (effect) => effect.type === 'boon' && effect.name === 'regeneration',
      attribution: (_runtime: RangerRuntime, cast: RuntimeCast<RangerSkill>) => ({
        skillId: TRAIT.WELLSPRING,
        skillName: 'Wellspring',
        name: `Wellspring - regeneration`,
        triggeredBy: cast.skill.name
      })
    }
  ],
  buildAttributes: traitAttributeEffects(TRAIT.WELLSPRING, [
    {
      kind: 'conversion',
      from: 'Power',
      to: 'Healing Power',
      field: 'attributeConversion',
      rounding: 'none',
      input: 'common'
    }
  ])
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
      when: (_runtime: RangerRuntime, cast: RuntimeCast<RangerSkill>) => cast.skill.weapon === 'Warhorn',
      effects: (effect) => effect.type === 'boon' && effect.name === 'regeneration',
      attribution: (_runtime: RangerRuntime, cast: RuntimeCast<RangerSkill>) => ({
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
  buildAttributes: traitAttributeEffects(TRAIT.LINGERING_MAGIC, [
    { kind: 'flat', to: 'Concentration', field: 'attributeBonus', feedsConversions: false }
  ])
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
