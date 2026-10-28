import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { boonKey } from '#gw2/platform/combat/boons.js';
import { skillForEvent } from '#gw2/platform/combat/query/runtime-query.js';
import { missesTarget } from '#gw2/platform/combat/state/targets.js';
import { ACTOR, BOON, COMBO_FINISHER, CONTROL } from '#gw2/platform/constants.js';
import { type SimulationEventBase } from '#gw2/platform/events/events.js';
import { type RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import {
  defineTrait,
  traitAttributeEffects,
  type TraitDefinition
} from '#gw2/platform/profession-definition/traits.js';
import { balanceNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { isEngineerToolbeltSkill } from '#gw2/professions/engineer/core/mechanics/toolbelt.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { type EngineerRuntime, type EngineerSkill } from '#gw2/professions/engineer/types.js';

// In-game "disable" reminder: stun, daze, knockback, pull, knockdown, sink, float, launch, taunt, and fear.
const DISABLE_CONTROL_KINDS: ReadonlySet<string> = new Set([
  CONTROL.STUN,
  CONTROL.DAZE,
  CONTROL.KNOCKBACK,
  CONTROL.PULL,
  CONTROL.KNOCKDOWN,
  CONTROL.SINK,
  CONTROL.FLOAT,
  CONTROL.LAUNCH,
  CONTROL.TAUNT,
  CONTROL.FEAR
]);

/** Owns HGH tuning and behavior at its established runtime and build boundaries. */
export const hgh = defineTrait({
  name: 'HGH',
  id: TRAIT.HGH,
  balance: {
    durationMultiplier: 1.2,
    effects: [
      { name: boonKey(BOON.MIGHT), type: 'boon', boon: BOON.MIGHT, stacks: 2, duration: 12 },
      { name: boonKey(BOON.FURY), type: 'boon', boon: BOON.FURY, stacks: 1, duration: 4 },
      {
        name: 'HGH',
        type: 'strike',
        weaponStrengthProfileId: 'bundle.ascended',
        coefficient: 0.85,
        hits: 1,
        packetLabel: 'additional Acid Bomb strike'
      }
    ]
  },
  // Boons and the extra Acid Bomb strike are producers; elixir duration is a retained value policy.
  triggers: [
    ...[boonKey(BOON.MIGHT), boonKey(BOON.FURY)].map<
      Extract<NonNullable<TraitDefinition<EngineerSkill>['triggers']>[number], { on: 'castCommit' }>
    >((boon) => ({
      on: 'castCommit',
      when: (_runtime, cast) => isElixirSkill(cast.skill),
      emit: TRAIT.HGH,
      effects: (effect) => effect.type === 'boon' && effect.name === boon,
      attribution: { source: 'Trait', sourceId: TRAIT.HGH, actorType: ACTOR.PLAYER, name: `HGH — ${boon}` }
    })),
    { on: 'castCommit', when: (_runtime, cast) => cast.skill.id === ID.ACID_BOMB, run: applyHghAcidBomb }
  ],
  hooks: { prepareEvent: prepareEngineerHghEvent }
});

/** Owns Compounding Chemicals tuning and behavior at its established runtime and build boundaries. */
export const compoundingChemicals = defineTrait({
  name: 'Compounding Chemicals',
  id: TRAIT.COMPOUNDING_CHEMICALS,
  balance: { attributeBonuses: { concentration: 240 } },
  attributes: traitAttributeEffects(TRAIT.COMPOUNDING_CHEMICALS, [
    { kind: 'flat', to: 'Concentration', feedsConversions: 'none' }
  ])
});

/** Owns Boiling Point tuning: gaining Might at or above the threshold grants Fury on a short ICD. */
export const boilingPoint = defineTrait({
  name: 'Boiling Point',
  id: TRAIT.BOILING_POINT,
  balance: {
    threshold: 5,
    internalCooldown: 1,
    effects: [{ name: boonKey(BOON.FURY), type: 'boon', boon: BOON.FURY, stacks: 1, duration: 3 }]
  },
  triggers: [
    {
      on: 'buff.applied',
      emit: TRAIT.BOILING_POINT,
      cooldown: 'profile',
      // The resolver records the application before reactions, so the threshold counts the Might just gained.
      when: (runtime, event) =>
        (event.kind || '').toLowerCase() === boonKey(BOON.MIGHT) &&
        Boolean(event.resolvedAudience?.includesSelf) &&
        runtime.combat.activeBoonStacks(boonKey(BOON.MIGHT), event.at) >=
          balanceNumberFromContext(runtime, TRAIT.BOILING_POINT, 'threshold'),
      attribution: { name: 'Boiling Point — fury' }
    }
  ]
});

/** Healing toolbelt activations create one player-owned blast, including issuance of F1 mech commands. */
export const blastZone = defineTrait({
  name: 'Blast Zone',
  id: TRAIT.BLAST_ZONE,
  balance: {
    effects: [
      {
        type: 'custom',
        eventType: 'marker',
        event: {},
        comboFinishers: [
          {
            ownerId: 'engineer',
            finisherType: COMBO_FINISHER.BLAST,
            chance: 1,
            attemptGroup: 'blast-zone'
          }
        ]
      }
    ]
  },
  triggers: (['castStart', 'castCommit'] as const).map((on) => ({
    on,
    emit: TRAIT.BLAST_ZONE,
    // Independent commands trigger when issued; ordinary casts must commit before granting the finisher.
    when: (_runtime, cast) =>
      isEngineerToolbeltSkill(cast.skill) &&
      cast.skill.mechanicSlot === 1 &&
      Boolean(cast.skill.independentCast) === (on === 'castStart'),
    attribution: { actorType: ACTOR.PLAYER }
  }))
});

/** Owns Equal and Opposite Reaction tuning: player disables grant Quickness and Stability on a short ICD. */
export const equalAndOppositeReaction = defineTrait({
  name: 'Equal and Opposite Reaction',
  id: TRAIT.EQUAL_AND_OPPOSITE_REACTION,
  balance: {
    internalCooldown: 1,
    effects: [
      { name: boonKey(BOON.QUICKNESS), type: 'boon', boon: BOON.QUICKNESS, stacks: 1, duration: 5 },
      { name: boonKey(BOON.STABILITY), type: 'boon', boon: BOON.STABILITY, stacks: 1, duration: 5 }
    ]
  },
  triggers: [
    {
      on: 'control.resolved',
      emit: TRAIT.EQUAL_AND_OPPOSITE_REACTION,
      cooldown: 'profile',
      // Only the player's own on-target disables count; turret and mech control belong to those summons.
      when: (_runtime, event) =>
        event.actorType === ACTOR.PLAYER &&
        !missesTarget(event) &&
        DISABLE_CONTROL_KINDS.has(String(event.controlKind).toLowerCase())
    }
  ]
});

/** Owns HGH's elixir cast effects and scheduled-event duration extension. */

function isElixirSkill(skill: EngineerSkill | undefined): boolean {
  return Boolean(skill?.categories?.some((category) => category.toLowerCase() === 'elixir'));
}

// HGH's final Acid Bomb pulse uses a fixed delivery offset from the completed cast.
const HGH_ACID_BOMB_DELAY_SECONDS = 6;

/** Schedules Acid Bomb's extended final pulse while HGH is selected. */
function applyHghAcidBomb(context: EngineerRuntime, cast: RuntimeCast<EngineerSkill>): void {
  // HGH adds one admitted field extension with Acid Bomb ownership; the profile owns the damage formula.
  emitTraitProfile(context, TRAIT.HGH, TRAIT.HGH, undefined, {
    at: cast.fullEnd + HGH_ACID_BOMB_DELAY_SECONDS,
    effect: { type: 'strike', name: 'HGH' },
    activationId: cast.id,
    skillWeaponFallback: 'Unequipped',
    attribution: {
      source: 'engineer',
      sourceId: cast.skill.id,
      actorType: ACTOR.PLAYER,
      skillId: cast.skill.id,
      skillName: cast.skill.name,
      name: 'Acid Bomb'
    }
  });
}

/** Extends scheduled elixir fields, boons, and conditions while HGH is selected. */
function prepareEngineerHghEvent(
  context: MechanicQueriesOf<EngineerRuntime>,
  event: SimulationEventBase
): SimulationEventBase {
  if (!hasTrait(context.traits, TRAIT.HGH) || event.sourceId === TRAIT.HGH) return event;

  const skill = skillForEvent(context.helpers, event);

  if (!isElixirSkill(skill)) return event;

  const durationMultiplier = balanceNumberFromContext(context, TRAIT.HGH, 'durationMultiplier');

  if (event.type === 'combo_field') {
    const duration = Number(event.expiresAt) - event.at;

    if (duration > 0) return { ...event, expiresAt: event.at + duration * durationMultiplier };
  } else if ((event.type === 'buff' || event.type === 'condition') && Number(event.duration) > 0) {
    return { ...event, duration: Number(event.duration) * durationMultiplier };
  }

  return event;
}
