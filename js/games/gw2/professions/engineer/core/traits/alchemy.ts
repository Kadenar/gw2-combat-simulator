import { missesTarget } from '#gw2/platform/combat/state/targets.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import { isElixirSkill, prepareEngineerHghEvent } from '#gw2/professions/engineer/core/traits/behavior.js';
import { isEngineerToolbeltSkill } from '#gw2/professions/engineer/core/traits/toolbelt.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';

// In-game "disable" reminder: stun, daze, knockback, pull, knockdown, sink, float, launch, taunt, and fear.
const DISABLE_CONTROL_KINDS = new Set([
  'stun',
  'daze',
  'knockback',
  'pull',
  'knockdown',
  'sink',
  'float',
  'launch',
  'taunt',
  'fear'
]);

/** Owns HGH tuning and behavior at its established runtime and build boundaries. */
export const hgh = defineTrait({
  id: TRAIT.HGH,
  name: 'HGH',
  balance: {
    durationMultiplier: 1.2,
    effects: [
      { name: 'might', type: 'boon', boon: 'might', stacks: 2, duration: 12 },
      { name: 'fury', type: 'boon', boon: 'fury', stacks: 1, duration: 4 },
      { name: 'HGH', type: 'strike', coefficient: 0.85, hits: 1, packetLabel: 'additional Acid Bomb strike' }
    ]
  },
  triggers: ['might', 'fury'].map((boon) => ({
    on: 'castCommit',
    when: (_runtime, cast) => isElixirSkill(cast.skill),
    emit: TRAIT.HGH,
    effects: (effect) => effect.type === 'boon' && effect.name === boon,
    attribution: { source: 'Trait', sourceId: TRAIT.HGH, actorType: 'player', name: `HGH — ${boon}` }
  })),
  hooks: { prepareEvent: prepareEngineerHghEvent }
});

/** Owns Compounding Chemicals tuning and behavior at its established runtime and build boundaries. */
export const compoundingChemicals = defineTrait({
  id: TRAIT.COMPOUNDING_CHEMICALS,
  name: 'Compounding Chemicals',
  balance: { attributeBonus: 240 },
  buildAttributes: traitAttributeEffects(TRAIT.COMPOUNDING_CHEMICALS, [
    { kind: 'flat', to: 'Concentration', field: 'attributeBonus', feedsConversions: false }
  ])
});

/** Owns Boiling Point tuning: gaining Might at or above the threshold grants Fury on a short ICD. */
export const boilingPoint = defineTrait({
  id: TRAIT.BOILING_POINT,
  name: 'Boiling Point',
  balance: {
    threshold: 5,
    internalCooldown: 1,
    effects: [{ name: 'fury', type: 'boon', boon: 'fury', stacks: 1, duration: 3 }]
  },
  triggers: [
    {
      on: 'buff.applied',
      emit: TRAIT.BOILING_POINT,
      icd: 'profile',
      // The resolver records the application before reactions, so the threshold counts the Might just gained.
      when: (runtime, event) =>
        (event.kind || '').toLowerCase() === 'might' &&
        Boolean(event.resolvedAudience?.includesSelf) &&
        runtime.combat.activeBoonStacks('might', event.at) >=
          balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.BOILING_POINT), 'threshold'),
      attribution: { name: 'Boiling Point — fury' }
    }
  ]
});

/** Healing toolbelt activations create one player-owned blast, including issuance of F1 mech commands. */
export const blastZone = defineTrait({
  id: TRAIT.BLAST_ZONE,
  name: 'Blast Zone',
  balance: {
    effects: [
      {
        type: 'custom',
        eventType: 'marker',
        event: {},
        comboFinishers: [
          {
            ownerId: 'engineer',
            finisherType: 'Blast',
            chance: 1,
            attemptGroup: 'blast-zone',
            ambiguousFieldSelection: 'oldest'
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
    attribution: { actorType: 'player' }
  }))
});

/** Owns Equal and Opposite Reaction tuning: player disables grant Quickness and Stability on a short ICD. */
export const equalAndOppositeReaction = defineTrait({
  id: TRAIT.EQUAL_AND_OPPOSITE_REACTION,
  name: 'Equal and Opposite Reaction',
  balance: {
    internalCooldown: 1,
    effects: [
      { name: 'quickness', type: 'boon', boon: 'quickness', stacks: 1, duration: 5 },
      { name: 'stability', type: 'boon', boon: 'stability', stacks: 1, duration: 5 }
    ]
  },
  triggers: [
    {
      on: 'control.resolved',
      emit: TRAIT.EQUAL_AND_OPPOSITE_REACTION,
      icd: 'profile',
      // Only the player's own on-target disables count; turret and mech control belong to those summons.
      when: (_runtime, event) =>
        event.actorType === 'player' &&
        !missesTarget(event) &&
        DISABLE_CONTROL_KINDS.has(String(event.controlKind).toLowerCase())
    }
  ]
});
