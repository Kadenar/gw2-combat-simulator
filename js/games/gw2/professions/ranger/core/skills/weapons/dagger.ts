import { consumeCharge, expireCharges, grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { targetHasCondition } from '#gw2/platform/combat/state/targets.js';
import { ACTOR, BOON, COMBO_FINISHER, CONDITION } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { requireSkill, skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { emitRangerAction } from '#gw2/professions/ranger/core/events.js';
import { rangerOwningPetState } from '#gw2/professions/ranger/core/mechanics/actor-state.js';
import {
  isActivePetStrike,
  isPetStrike,
  isPlayerStrike,
  petDerivedConditionMetadata
} from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
import { deliverChargedHit, grantSkillCharges } from '#gw2/professions/ranger/core/skills/charge-grants.js';
import { rangerMerged } from '#gw2/professions/ranger/core/state.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { RangerResolverContext, RangerRuntimeState, RangerSkill } from '#gw2/professions/ranger/types.js';

/** Canonical Core ranger skill definitions grouped by their GW2 owner. */

/** Restricts Stalker's Strike's bonus to its three documented movement-impairing conditions. */
function stalkersStrikeTargetImpaired(hasCondition: (condition: string) => boolean): boolean {
  return [CONDITION.CRIPPLED, CONDITION.SLOW, CONDITION.IMMOBILIZED].some(hasCondition);
}

// Projectile flags belong to strikes so Mistral and Shrike count impacts independently of combo success.
export const RANGER_CORE_DAGGER_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<RangerSkill>>> = {
  [ID.GROUNDWORK_GOUGE]: {
    name: 'Groundwork Gouge',
    icon: 'https://render.guildwars2.com/file/043E152903A33B09DAD74AA85F559062FC72EA0B/1770553.png',
    type: 'Weapon',
    weapon: 'Dagger',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 280,
    // Committing the opening strike preserves its effects and advances the dagger chain when interrupted.
    interruptCommitMs: 200,
    effects: [
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 1,
        duration: 4
      },
      {
        type: 'strike',
        coefficient: 0.4,
        hits: 1
      }
    ]
  },
  [ID.LEADING_SWIPE]: {
    name: 'Leading Swipe',
    icon: 'https://render.guildwars2.com/file/EDDA7CC00BAEB5EEE53A0D2937CDB10094A29692/1770554.png',
    type: 'Weapon',
    weapon: 'Dagger',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 320,
    effects: [
      {
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 1,
        duration: 4
      },
      {
        type: 'strike',
        coefficient: 0.42,
        hits: 1
      }
    ]
  },
  [ID.SERPENT_STAB]: {
    name: 'Serpent Stab',
    icon: 'https://render.guildwars2.com/file/080360524A4926B770065F99DDB57AB7FDFDC4AC/1770555.png',
    type: 'Weapon',
    weapon: 'Dagger',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 280,
    interruptCommitMs: 200,
    effects: impactEffects({ atMs: 200, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'condition',
        condition: CONDITION.POISONED,
        stacks: 1,
        duration: 4
      },
      {
        type: 'strike',
        coefficient: 0.44,
        hits: 1
      }
    ])
  },
  [ID.DEADLY_DELIVERY]: {
    name: 'Deadly Delivery',
    icon: 'https://render.guildwars2.com/file/080360524A4926B770065F99DDB57AB7FDFDC4AC/1770555.png',
    type: 'Weapon',
    weapon: 'Dagger',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 440,
    interruptCommitMs: 280,
    effects: impactEffects({ atMs: 280, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 1,
        duration: 4
      },
      {
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 1,
        duration: 4
      },
      {
        type: 'condition',
        condition: CONDITION.POISONED,
        stacks: 1,
        duration: 4
      },
      {
        type: 'strike',
        coefficient: 0.88,
        hits: 1
      }
    ])
  },
  [ID.DOUBLE_ARC]: {
    name: 'Double Arc',
    icon: 'https://render.guildwars2.com/file/337557BD3779CD416D6DD32E6E74BB7D949708E4/1770556.png',
    type: 'Weapon',
    weapon: 'Dagger',
    slot: 'Weapon_2',
    // Unspent charges and their delivered conditions have independent lifetimes.
    charges: 2,
    duration: 10,
    cooldown: 6,
    castTimeMs: 600,
    effects: [
      {
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 6,
        duration: 6
      },
      {
        type: 'strike',
        coefficient: 1.6,
        hits: 2,
        atMs: 0
      }
    ],
    // Arm subsequent qualifying hits only on semantic commitment.
    sideEffects: [
      {
        on: 'castCommit',
        do: {
          type: 'ranger.poisonous-strikes',
          id: 'poisonous-strikes',
          effects: [
            { name: CONDITION.POISONED, type: 'condition', condition: CONDITION.POISONED, stacks: 1, duration: 6 }
          ]
        }
      }
    ]
  },
  [ID.INSTINCTIVE_ENGAGE]: {
    name: 'Instinctive Engage',
    icon: 'https://render.guildwars2.com/file/411FB9186E16AAF67508EA94FAD8115855051430/1770557.png',
    type: 'Weapon',
    weapon: 'Dagger',
    slot: 'Weapon_3',
    cooldown: 12,
    castTimeMs: 840,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        comboFinishers: [
          {
            ownerId: 'ranger',
            finisherType: COMBO_FINISHER.LEAP
          }
        ]
      },
      {
        type: 'boon',
        boon: BOON.QUICKNESS,
        duration: 3,
        stacks: 1
      },
      {
        type: 'condition',
        condition: CONDITION.SLOW,
        stacks: 1,
        duration: 2
      },
      {
        type: 'condition',
        condition: CONDITION.POISONED,
        stacks: 4,
        duration: 8
      }
    ]
  },
  [ID.STALKERS_STRIKE]: {
    name: "Stalker's Strike",
    icon: 'https://render.guildwars2.com/file/997E9851717291082CC3314E68F3D703FD710B08/103166.png',
    type: 'Weapon',
    weapon: 'Dagger',
    slot: 'Weapon_4',
    cooldown: 10,
    impairedDamageMultiplier: 2,
    // Double this strike against the supported impairments, evaluated at impact.
    modifiers: [
      {
        id: 'ranger.stalkers-strike-movement-impaired',
        label: "Stalker's Strike - impaired target",
        target: 'strikeDamage',
        operation: 'multiply',
        factor: (context) => skillNumber(requireSkill(context.catalog, ID.STALKERS_STRIKE), 'impairedDamageMultiplier'),
        when: (context) =>
          stalkersStrikeTargetImpaired((condition) =>
            targetHasCondition(context.config ?? {}, condition, context.time, context.runtime)
          )
      }
    ],
    evades: true,
    // Movement impairment adds the remaining strike and Poison bonuses during resolution.
    castTimeMs: 760,
    // The early stab commits before the evade ends; cancelling retains its damage and the remaining evade lockout.
    interruptCommitMs: 200,
    retainsCastLockoutAfterInterrupt: true,
    effects: impactEffects({ atMs: 200, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        // The strike owns only its impaired-target bonus; the base poison remains independent.
        reactions: [
          {
            on: 'damage.resolved',
            actor: ACTOR.PLAYER,
            packets: 'each',
            when: (runtime, { event }) =>
              Number(event.coefficient) > 0 &&
              !isPetStrike(event) &&
              stalkersStrikeTargetImpaired((condition) => runtime.combat.targetHasCondition(condition, event.at)),
            do: [
              {
                type: 'ranger.stalkers-poison',
                id: 'impaired-poison',
                effects: [
                  { name: CONDITION.POISONED, type: 'condition', condition: CONDITION.POISONED, stacks: 2, duration: 8 }
                ]
              }
            ]
          }
        ],
        coefficient: 0.6,
        hits: 1
      },
      {
        type: 'condition',
        condition: CONDITION.POISONED,
        stacks: 3,
        duration: 8
      }
    ])
  },
  [ID.CRIPPLING_TALON]: {
    name: 'Crippling Talon',
    icon: 'https://render.guildwars2.com/file/9B167B580711A77D5E95EF5E6E5B04A907DA3E35/103165.png',
    type: 'Weapon',
    weapon: 'Dagger',
    slot: 'Weapon_5',
    cooldown: 15,
    ammoCastLockout: 1,
    ammo: 2,

    castTimeMs: 360,
    // Once the projectile launches, cancelling the remaining animation preserves its impact effects.
    interruptCommitMs: 320,
    effects: impactEffects({ persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        projectile: true,
        coefficient: 0.9,
        hits: 1,
        comboFinishers: [
          {
            ownerId: 'ranger',
            finisherType: COMBO_FINISHER.PROJECTILE
          }
        ]
      },
      {
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 3,
        duration: 6
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 4
      }
    ])
  }
};

/** Grant only the accepting actor; merging and unmerging never transfer these charges. */
export function handleRangerPoisonousStrikes(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const state = professionCoreState(context.profession);
  const actor = event.summonOwner ? rangerOwningPetState(state.pet, event.summonOwner) : state.player;

  if (actor)
    actor.poisonousStrikes = grantCharges(Math.max(0, Number(event.charges || 0)), event.at + (event.duration || 0));
}

const POISONOUS_STRIKES_ATTRIBUTION = {
  sourceId: ID.DOUBLE_ARC,
  skillId: ID.DOUBLE_ARC,
  skillName: 'Poisonous Strikes'
} as const;
const POISONOUS_STRIKES_NAME = 'Poisonous Strikes - Poisoned';

/** The current pet's own strikes spend its charges; Ranger-owned Cloud/vine effects cannot consume pet venom. */
export function triggerPoisonousStrikes(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const { pet } = professionCoreState(context.profession);

  if (!pet) return;

  // Pet charges belong only to this activation, including their inclusive final hit.
  expireCharges(pet.poisonousStrikes, event.at, true);

  if (!isActivePetStrike(context, event)) return;

  deliverChargedHit(
    context,
    event,
    ID.DOUBLE_ARC,
    'poisonous-strikes',
    () => consumeCharge(pet.poisonousStrikes, event.at, 0, true),
    {
      attribution: {
        ...POISONOUS_STRIKES_ATTRIBUTION,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON,
        triggeredBy: event.skillName
      },
      name: POISONOUS_STRIKES_NAME,
      fields: petDerivedConditionMetadata(context, event)
    }
  );
}

/** While Soulbeast replaces its pet in Beastmode, the merged Ranger's own strikes spend the player's charges. */
export function triggerMergedPoisonousStrikes(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const { player } = professionCoreState(context.profession);
  expireCharges(player.poisonousStrikes, event.at, true);

  if (!rangerMerged(context.profession) || !isPlayerStrike(event) || !(Number(event.coefficient) > 0)) return;

  deliverChargedHit(
    context,
    event,
    ID.DOUBLE_ARC,
    'poisonous-strikes',
    () => consumeCharge(player.poisonousStrikes, event.at, 0, true),
    {
      // While merged, the Ranger owns this poison and receives player poison and duration bonuses.
      attribution: {
        ...POISONOUS_STRIKES_ATTRIBUTION,
        source: 'ranger',
        actorType: ACTOR.EFFECT,
        ownerActorType: ACTOR.PLAYER,
        triggeredBy: event.skillName
      },
      name: POISONOUS_STRIKES_NAME
    }
  );
}

/** Queue grants at the declared activation boundary so same-time hits retain their established order. */
export const poisonousStrikesLifecycle = {
  sideEffectHandlers: {
    'ranger.poisonous-strikes'(runtime, context) {
      // Capture the beneficiary before same-time swaps or merge transitions can replace it.
      if (context.kind === 'cast')
        grantSkillCharges(runtime, context.cast, 'ranger.poisonous-strikes', runtime.profession.core.pet?.id);
    }
  },
  eventHandlers: { 'ranger.poisonous-strikes': handleRangerPoisonousStrikes }
} satisfies RuntimeHooks<RangerRuntimeState, RangerSkill>;

/** Add Stalker's Strike's bonus poison only against movement-impaired targets. */
function triggerStalkersStrike(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const skill = context.helpers.skillsById.get(event.skillId!)!;
  // The base packet owns its own Poison; the impaired-target action owns only the additional application.
  emitRangerAction(context, event.at, skill, 'impaired-poison', {
    attribution: {
      source: 'ranger',
      sourceId: skill.id,
      actorType: ACTOR.PLAYER,
      skillId: skill.id,
      skillName: skill.name,
      activationId: event.activationId
    },
    name: `${skill.name} - Poisoned`
  });
}

/** The impaired-target reaction delivers its extra Poison under the striking activation. */
export const stalkersStrikeLifecycle = {
  sideEffectHandlers: {
    'ranger.stalkers-poison'(runtime, context) {
      if (context.kind === 'effect') triggerStalkersStrike(runtime, context.trigger.event);
    }
  }
} satisfies RuntimeHooks<RangerRuntimeState, RangerSkill>;
