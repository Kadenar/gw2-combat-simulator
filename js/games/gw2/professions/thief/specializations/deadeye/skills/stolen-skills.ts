import { ACTOR, STATUS, RECIPIENT, BOON, CONDITION } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { Skill, SkillId } from '#gw2/platform/skills/types.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import { deadeyeState } from '#gw2/professions/thief/specializations/deadeye/state.js';

/** Stolen skills a Deadeye steal can grant, shared by the hooks and the skill palette. */
export const DEADEYE_STOLEN_SKILL_IDS: readonly SkillId[] = Object.freeze([
  ID.STEAL_TIME,
  ID.STEAL_WARMTH,
  ID.STEAL_RESISTANCE,
  ID.STEAL_PRECISION,
  ID.STEAL_HEALTH,
  ID.STEAL_STRENGTH,
  ID.STEAL_DURABILITY,
  ID.STEAL_DEFENSES,
  ID.STEAL_MOBILITY
]);

/** Membership is shared by accepted-cast snapshots and stolen-skill traits. */
export const STOLEN_SKILLS = new Set<SkillId>(DEADEYE_STOLEN_SKILL_IDS);

/** Stolen skills commit stealth before consuming their stored use, then deliver their authored effects. */
export const DEADEYE_STOLEN_SKILLS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.STEAL_WARMTH]: {
    // The skill owns this transition at successful commitment.
    sideEffects: [
      { on: 'castCommit', do: { type: 'thief.stealth' } },
      { on: 'castCommit', do: { type: 'thief.consume-stolen' } }
    ],
    // The selected stealth grant commits before consuming the stored use.
    castTimeMs: 200,
    cooldown: 0.5,
    initiativeCost: 0,
    // Use the PvE stolen-skill coefficient (1.0); the API also lists the competitive 0.5 split.
    effects: impactEffects({ atMs: 200, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      { type: 'strike', coefficient: 1, hits: 1, name: 'Steal Warmth', actorType: ACTOR.PLAYER },
      {
        type: 'buff',
        kind: STATUS.STEALTH,
        duration: 3,
        stacks: 1,
        when: (runtime) => deadeyeState.from(runtime).malice.value >= 3
      },
      {
        type: 'boon',
        boon: BOON.VIGOR,
        duration: 10,
        stacks: 1,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      },
      { type: 'condition', condition: CONDITION.CHILLED, stacks: 1, duration: 3, actorType: ACTOR.PLAYER }
    ])
  },
  [ID.STEAL_RESISTANCE]: {
    // The skill owns this transition at successful commitment.
    sideEffects: [
      { on: 'castCommit', do: { type: 'thief.stealth' } },
      { on: 'castCommit', do: { type: 'thief.consume-stolen' } }
    ],
    // The selected stealth grant commits before consuming the stored use.
    castTimeMs: 280,
    cooldown: 0.5,
    initiativeCost: 0,
    // Use the PvE stolen-skill coefficient (1.0); the API also lists the competitive 0.5 split.
    effects: impactEffects({ atMs: 200, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      { type: 'strike', coefficient: 1, hits: 1, name: 'Steal Resistance', actorType: ACTOR.PLAYER },
      {
        type: 'buff',
        kind: STATUS.STEALTH,
        duration: 3,
        stacks: 1,
        when: (runtime) => deadeyeState.from(runtime).malice.value >= 3
      },
      {
        type: 'boon',
        boon: BOON.RESISTANCE,
        duration: 5,
        stacks: 1,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      },
      { type: 'condition', condition: CONDITION.TORMENT, stacks: 3, duration: 8, actorType: ACTOR.PLAYER }
    ])
  },
  [ID.STEAL_PRECISION]: {
    // The skill owns this transition at successful commitment.
    sideEffects: [
      { on: 'castCommit', do: { type: 'thief.stealth' } },
      { on: 'castCommit', do: { type: 'thief.consume-stolen' } }
    ],
    // The selected stealth grant commits before consuming the stored use.
    castTimeMs: 280,
    cooldown: 0.5,
    initiativeCost: 0,
    // Use the PvE stolen-skill coefficient (1.0); the API also lists the competitive 0.5 split.
    effects: impactEffects({ atMs: 200, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      { type: 'strike', coefficient: 1, hits: 1, name: 'Steal Precision', actorType: ACTOR.PLAYER },
      {
        type: 'buff',
        kind: STATUS.STEALTH,
        duration: 3,
        stacks: 1,
        when: (runtime) => deadeyeState.from(runtime).malice.value >= 3
      },
      {
        type: 'boon',
        boon: BOON.FURY,
        duration: 8,
        stacks: 1,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      },
      {
        type: 'condition',
        condition: CONDITION.BLINDNESS,
        stacks: 1,
        duration: 6,
        actorType: ACTOR.PLAYER
      }
    ])
  },
  [ID.STEAL_HEALTH]: {
    // The skill owns this transition at successful commitment.
    sideEffects: [
      { on: 'castCommit', do: { type: 'thief.stealth' } },
      { on: 'castCommit', do: { type: 'thief.consume-stolen' } }
    ],
    // The selected stealth grant commits before consuming the stored use.
    castTimeMs: 200,
    cooldown: 0.5,
    initiativeCost: 0,
    // Use the PvE stolen-skill coefficient (1.0); the API also lists the competitive 0.5 split.
    effects: impactEffects({ atMs: 200, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      { type: 'strike', coefficient: 1, hits: 1, name: 'Steal Health', actorType: ACTOR.PLAYER },
      {
        type: 'buff',
        kind: STATUS.STEALTH,
        duration: 3,
        stacks: 1,
        when: (runtime) => deadeyeState.from(runtime).malice.value >= 3
      },
      { type: 'condition', condition: CONDITION.BLEEDING, stacks: 5, duration: 8, actorType: ACTOR.PLAYER }
    ])
  },
  [ID.STEAL_STRENGTH]: {
    // The skill owns this transition at successful commitment.
    sideEffects: [
      { on: 'castCommit', do: { type: 'thief.stealth' } },
      { on: 'castCommit', do: { type: 'thief.consume-stolen' } }
    ],
    // The selected stealth grant commits before consuming the stored use.
    castTimeMs: 280,
    cooldown: 0.5,
    initiativeCost: 0,
    // Use the PvE stolen-skill coefficient (1.0); the API also lists the competitive 0.5 split.
    effects: impactEffects({ atMs: 200, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      { type: 'strike', coefficient: 1, hits: 1, name: 'Steal Strength', actorType: ACTOR.PLAYER },
      {
        type: 'buff',
        kind: STATUS.STEALTH,
        duration: 3,
        stacks: 1,
        when: (runtime) => deadeyeState.from(runtime).malice.value >= 3
      },
      {
        type: 'boon',
        boon: BOON.MIGHT,
        duration: 12,
        stacks: 5,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      },
      { type: 'condition', condition: CONDITION.WEAKNESS, stacks: 1, duration: 8, actorType: ACTOR.PLAYER }
    ])
  },
  [ID.STEAL_TIME]: {
    // The skill owns this transition at successful commitment.
    sideEffects: [
      { on: 'castCommit', do: { type: 'thief.stealth' } },
      { on: 'castCommit', do: { type: 'thief.consume-stolen' } }
    ],
    // The selected stealth grant commits before consuming the stored use.
    castTimeMs: 280,
    cooldown: 0.5,
    initiativeCost: 0,
    // Use the PvE stolen-skill coefficient (1.0); the API also lists the competitive 0.5 split.
    effects: impactEffects({ atMs: 200, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Steal Time',
        actorType: ACTOR.PLAYER,
        weaponStrengthProfileId: 'nonweapon.profession-mechanic'
      },
      {
        type: 'buff',
        kind: STATUS.STEALTH,
        duration: 3,
        stacks: 1,
        when: (runtime) => deadeyeState.from(runtime).malice.value >= 3
      },
      {
        type: 'boon',
        boon: BOON.QUICKNESS,
        duration: 5,
        stacks: 1,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      },
      { type: 'condition', condition: CONDITION.SLOW, stacks: 1, duration: 3, actorType: ACTOR.PLAYER }
    ])
  },
  [ID.STEAL_DURABILITY]: {
    // The skill owns this transition at successful commitment.
    sideEffects: [
      { on: 'castCommit', do: { type: 'thief.stealth' } },
      { on: 'castCommit', do: { type: 'thief.consume-stolen' } }
    ],
    // The selected stealth grant commits before consuming the stored use.
    castTimeMs: 280,
    cooldown: 0.5,
    initiativeCost: 0,
    // Use the PvE stolen-skill coefficient (1.0); the API also lists the competitive 0.5 split.
    effects: impactEffects({ atMs: 200, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      { type: 'strike', coefficient: 1, hits: 1, name: 'Steal Durability', actorType: ACTOR.PLAYER },
      {
        type: 'buff',
        kind: STATUS.STEALTH,
        duration: 3,
        stacks: 1,
        when: (runtime) => deadeyeState.from(runtime).malice.value >= 3
      },
      {
        type: 'boon',
        boon: BOON.PROTECTION,
        duration: 5,
        stacks: 1,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      },
      { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 10, duration: 5, actorType: ACTOR.PLAYER }
    ])
  },
  [ID.STEAL_DEFENSES]: {
    // The skill owns this transition at successful commitment.
    sideEffects: [
      { on: 'castCommit', do: { type: 'thief.stealth' } },
      { on: 'castCommit', do: { type: 'thief.consume-stolen' } }
    ],
    // The selected stealth grant commits before consuming the stored use.
    castTimeMs: 200,
    cooldown: 0.5,
    initiativeCost: 0,
    // Use the PvE stolen-skill coefficient (1.0); the API also lists the competitive 0.5 split.
    effects: impactEffects({ atMs: 200, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      { type: 'strike', coefficient: 1, hits: 1, name: 'Steal Defenses', actorType: ACTOR.PLAYER },
      {
        type: 'buff',
        kind: STATUS.STEALTH,
        duration: 3,
        stacks: 1,
        when: (runtime) => deadeyeState.from(runtime).malice.value >= 3
      },
      {
        type: 'boon',
        boon: BOON.AEGIS,
        duration: 5,
        stacks: 1,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      },
      { type: 'condition', condition: CONDITION.POISONED, stacks: 2, duration: 8, actorType: ACTOR.PLAYER }
    ])
  },
  [ID.STEAL_MOBILITY]: {
    // The skill owns this transition at successful commitment.
    sideEffects: [
      { on: 'castCommit', do: { type: 'thief.stealth' } },
      { on: 'castCommit', do: { type: 'thief.consume-stolen' } }
    ],
    // The selected stealth grant commits before consuming the stored use.
    castTimeMs: 200,
    cooldown: 0.5,
    initiativeCost: 0,
    // Use the PvE stolen-skill coefficient (1.0); the API also lists the competitive 0.5 split.
    effects: impactEffects({ atMs: 200, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      { type: 'strike', coefficient: 1, hits: 1, name: 'Steal Mobility', actorType: ACTOR.PLAYER },
      {
        type: 'buff',
        kind: STATUS.STEALTH,
        duration: 3,
        stacks: 1,
        when: (runtime) => deadeyeState.from(runtime).malice.value >= 3
      },
      { type: 'condition', condition: CONDITION.IMMOBILIZED, stacks: 1, duration: 1.5, actorType: ACTOR.PLAYER }
    ])
  }
});
