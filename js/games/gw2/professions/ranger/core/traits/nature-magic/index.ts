import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { GW2_STANDARD_BOONS, isStandardBoon } from '#gw2/platform/combat/boons.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { gw2EventOwnerActorType, isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { materializeSkillEffectApplications } from '#gw2/platform/effects/materializer.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { SelectedContentContext } from '#gw2/platform/profession-definition/runtime-context.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import type { TriggerPointInput } from '#gw2/platform/profession-definition/trigger-points.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';

import { beastSkillUsed, petSwapped, rangerInitialized } from '#gw2/professions/ranger/core/mechanics/combat.js';
import { rangerPetCompanionId } from '#gw2/professions/ranger/core/mechanics/pet-attributes.js';
import { emitStormSpiritSlam, emitSunSpiritBurning } from '#gw2/professions/ranger/core/skills/slot-skills.js';
import { rangerActiveBoonCount, rangerPetEvent } from '#gw2/professions/ranger/core/traits/modifier-queries.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import type { RangerRuntime, RangerSkill } from '#gw2/professions/ranger/types.js';

/** Both live player grants and configured console pulses use the same ranger-scaled pet application. */
function shareFortifyingBond(runtime: RangerRuntime, kind: string, stacks: number, cause?: Gw2ResolverEvent): void {
  if (!runtime.profession.core.petActive) return;

  emitTraitProfile(runtime, TRAIT.FORTIFYING_BOND, TRAIT.FORTIFYING_BOND, cause, {
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
    }),
    preserveName: true,
    effects: (effect) => effect.type === 'boon' && effect.boon === kind
  });
}

/** Share received player boons with the active pet using the trait's durations and the ranger's concentration. */
export const fortifyingBond = defineTrait({
  id: TRAIT.FORTIFYING_BOND,
  name: 'Fortifying Bond',
  balance: {
    pulseInterval: 3,
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
  triggers: [
    onTriggerPoint(rangerInitialized, {
      run(runtime: RangerRuntime) {
        if (
          Object.entries(runtime.config.boons ?? {}).some(([kind, value]) => isStandardBoon(kind) && Number(value) > 0)
        )
          runtime.schedule('ranger.fortifying-bond-console', 0, null);
      }
    }),
    {
      on: 'buff.applied',
      run(runtime: RangerRuntime, event) {
        if (
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
  ],
  lifetime: {
    tasks: {
      'ranger.fortifying-bond-console'(runtime: RangerRuntime) {
        // Model configured console boons as three-second refreshes, each of which triggers Bond.
        // Emit only the trait's pet grant: the configured player boon already exists in the permanent-boon layer.
        for (const [kind, value] of Object.entries(runtime.config.boons ?? {}))
          if (isStandardBoon(kind) && Number(value) > 0) shareFortifyingBond(runtime, kind, Number(value));
        const interval = balanceProfileNumber(
          requireBalanceProfileFromContext(runtime, TRAIT.FORTIFYING_BOND),
          'pulseInterval'
        );
        if (interval > 0) runtime.schedule('ranger.fortifying-bond-console', runtime.time + interval, null);
      }
    }
  }
});

/** Every spirit repeats its slam one second after the final authored shake, including patched pulse timings. */
function spiritRepeatSlamAt(runtime: MechanicQueriesOf<RangerRuntime>, cast: RuntimeCast<RangerSkill>): number {
  return (
    balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.NATURES_VENGEANCE), 'baseDuration') +
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

/** Capture trait admission separately so isolated skill effects cannot create another slam. */
const admittedSpiritRepeats = new WeakSet<RuntimeCast<RangerSkill>>();

/** Repeat only slam payloads after the last shake, without another cast, summon reward, or boon sequence. */
export const naturesVengeance = defineTrait({
  id: TRAIT.NATURES_VENGEANCE,
  name: "Nature's Vengeance",
  // The trait owns the delay between the final spirit shake and its repeated slam.
  balance: { baseDuration: 1 },
  triggers: [
    {
      on: 'castStart',
      run(_runtime, cast) {
        if (!cast.cancelled) admittedSpiritRepeats.add(cast);
      }
    },
    {
      on: 'castCommit',
      run(runtime: RangerRuntime, cast: RuntimeCast<RangerSkill>) {
        // Child-owned slams repeat their own selected profiles rather than duplicating parent effects.
        if (cast.skill.id === ID.SUN_SPIRIT)
          runtime.schedule('ranger.natures-vengeance-sun', spiritRepeatSlamAt(runtime, cast), cast.skill);
        if (cast.skill.id === ID.STORM_SPIRIT)
          runtime.scheduleForCast('ranger.natures-vengeance-storm', spiritRepeatSlamAt(runtime, cast), cast);
      }
    }
  ],
  hooks: {
    modifyEffects(runtime: MechanicQueriesOf<RangerRuntime>, cast: RuntimeCast<RangerSkill>, effects) {
      if (!admittedSpiritRepeats.has(cast)) return effects;
      const slams = effects.filter((effect) => effect.metadata?.packetKind === 'ranger.spirit-slam');
      if (!slams.length) return effects;
      const atMs = (spiritRepeatSlamAt(runtime, cast) - cast.start) * 1000;
      return [
        ...effects,
        ...slams.map((effect) => ({
          ...effect,
          atMs,
          timingAnchor: 'castStart' as const,
          timingScale: 'fixed' as const
        }))
      ];
    }
  },
  lifetime: {
    tasks: {
      'ranger.natures-vengeance-sun'(runtime: RangerRuntime, data: unknown) {
        emitSunSpiritBurning(runtime, data as RuntimeCast<RangerSkill>['skill'], runtime.time);
      },
      'ranger.natures-vengeance-storm'(runtime: RangerRuntime, data: unknown) {
        const { cast } = data as { cast: RuntimeCast<RangerSkill> };
        emitStormSpiritSlam(runtime, cast, runtime.time, true);
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
      when: (_runtime: MechanicQueriesOf<RangerRuntime>, cast: RuntimeCast<RangerSkill>) => cast.skill.type === 'Heal',
      effects: (effect) => effect.type === 'boon' && effect.name === 'regeneration',
      attribution: (_runtime: MechanicQueriesOf<RangerRuntime>, cast: RuntimeCast<RangerSkill>) => ({
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
      when: (_runtime: MechanicQueriesOf<RangerRuntime>, cast: RuntimeCast<RangerSkill>) =>
        cast.skill.weapon === 'Warhorn',
      effects: (effect) => effect.type === 'boon' && effect.name === 'regeneration',
      attribution: (_runtime: MechanicQueriesOf<RangerRuntime>, cast: RuntimeCast<RangerSkill>) => ({
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
  triggers: [
    onTriggerPoint(beastSkillUsed, {
      run: (runtime, input: TriggerPointInput<typeof beastSkillUsed>) => applyRejuvenation(runtime, input.skill)
    })
  ],
  id: TRAIT.REJUVENATION,
  name: 'Rejuvenation',
  balance: {
    internalCooldown: 20,
    effects: [{ name: 'regeneration', type: 'boon', boon: 'regeneration', duration: 10, stacks: 1 }]
  }
});

/** Owns Spirited Arrival's live tuning and trait behavior. */
export const spiritedArrival = defineTrait({
  triggers: [
    onTriggerPoint(petSwapped, {
      run: (runtime, input: TriggerPointInput<typeof petSwapped>) => applySpiritedArrival(runtime, input.skill)
    })
  ],
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
  // Trait balance is the single tuning source for modifiers and presentation.
  balance: { damageMultiplier: 1, damagePerBoon: 0.01, maximumBoons: GW2_STANDARD_BOONS.length },
  modifierRules: [
    {
      order: 7,
      id: 'ranger.bountiful-hunter-player',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      // Count unique boons only up to the selected balance cap.

      factor: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.BOUNTIFUL_HUNTER), 'damageMultiplier') +
        Math.min(
          balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.BOUNTIFUL_HUNTER), 'maximumBoons'),
          rangerActiveBoonCount(context, 'player')
        ) *
          balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.BOUNTIFUL_HUNTER), 'damagePerBoon'),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event)
    },
    {
      order: 32,
      id: 'ranger.bountiful-hunter-pet',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      // Count unique boons only up to the selected balance cap.

      factor: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.BOUNTIFUL_HUNTER), 'damageMultiplier') +
        Math.min(
          balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.BOUNTIFUL_HUNTER), 'maximumBoons'),
          rangerActiveBoonCount(context, 'pet')
        ) *
          balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.BOUNTIFUL_HUNTER), 'damagePerBoon'),
      when: (context) => rangerPetEvent(context)
    }
  ]
});

/** Lingering Magic supplies companion Concentration while the pet mechanic owns boon attribution. */
export function lingeringMagicConcentration(context: SelectedContentContext): number {
  return context.hasTrait(TRAIT.LINGERING_MAGIC)
    ? balanceProfileNumber(context.requireBalanceProfile(TRAIT.LINGERING_MAGIC), 'attributeBonus')
    : 0;
}

/** Grants combat-only arrival boons before Clarion Bond. */
function applySpiritedArrival(context: RangerRuntime, skill: RangerSkill): void {
  const at = context.time;
  const inCombat = context.combatStartTime != null && context.time >= context.combatStartTime;
  if (inCombat) {
    emitTraitProfile(context, TRAIT.SPIRITED_ARRIVAL, TRAIT.SPIRITED_ARRIVAL, undefined, {
      at,
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.SPIRITED_ARRIVAL,
        actorType: 'effect',
        skillId: TRAIT.SPIRITED_ARRIVAL,
        skillName: 'Spirited Arrival',
        triggeredBy: skill.name
      },
      transform: (event) => ({
        ...event,
        name: 'Spirited Arrival - ' + event.kind,
        boon: event.kind,
        audience: { recipients: 'party', maximumRecipients: 5 }
      }),
      preserveName: true,
      effects: (effect) => effect.type === 'boon'
    });
  }
}

/** Applies the trait at the accepted Beast-skill boundary. */
function applyRejuvenation(context: RangerRuntime, skill: RangerSkill): void {
  {
    const profile = requireBalanceProfileFromContext(context, TRAIT.REJUVENATION);
    const effect = requireEffect(profile, 'boon', 'regeneration');
    // The cooldown gates only regeneration, so a removed boon leaves the trait ready.
    if (effect && context.procs.claim(TRAIT.REJUVENATION, 'ranger.core.rejuvenation', context.time)) {
      const kind = String(effect.boon);
      emitTraitProfile(context, TRAIT.REJUVENATION, TRAIT.REJUVENATION, undefined, {
        at: context.time,
        fullEnd: context.time,
        effect: { type: 'boon', name: 'regeneration' },
        attribution: {
          source: 'Trait',
          sourceId: TRAIT.REJUVENATION,
          actorType: 'effect',
          skillId: TRAIT.REJUVENATION,
          skillName: 'Rejuvenation',
          name: `Rejuvenation - ${kind}`,
          audience: { recipients: 'party' as const, maximumRecipients: 5 },
          triggeredBy: skill.name
        }
      });
    }
  }
}
