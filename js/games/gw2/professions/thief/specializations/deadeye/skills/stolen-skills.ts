import { ACTOR, BOON, CONDITION, RECIPIENT, STATUS } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import { deadeyeState } from '#gw2/professions/thief/specializations/deadeye/state.js';

/** Stolen skills commit stealth before consuming their stored use, then deliver their authored effects. */
export const DEADEYE_STOLEN_SKILLS: Readonly<Record<number, SkillDefinition>> = {
  [ID.STEAL_WARMTH]: {
    name: 'Steal Warmth',
    icon: 'https://render.guildwars2.com/file/FC5822562E0D060DA74529354F231BF503A4FC7B/1770620.png',
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 0.5,
    // The selected stealth grant commits before consuming the stored use.
    castTimeMs: 200,
    // Use the PvE stolen-skill coefficient (1.0); the API also lists the competitive 0.5 split.
    effects: impactEffects({ atMs: 200, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      { type: 'strike', coefficient: 1, hits: 1, name: 'Steal Warmth', actorType: ACTOR.PLAYER },
      {
        type: 'buff',
        kind: STATUS.STEALTH,
        duration: 3,
        stacks: 1,
        when: (runtime) => deadeyeState.from(runtime.profession).malice.value >= 3
      },
      {
        type: 'boon',
        boon: BOON.VIGOR,
        duration: 10,
        stacks: 1,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      },
      { type: 'condition', condition: CONDITION.CHILLED, stacks: 1, duration: 3, actorType: ACTOR.PLAYER }
    ]),
    // The skill owns this transition at successful commitment.
    sideEffects: [
      { on: 'castCommit', do: { type: 'thief.stealth' } },
      { on: 'castCommit', do: { type: 'thief.consume-stolen' } }
    ]
  },
  [ID.STEAL_RESISTANCE]: {
    name: 'Steal Resistance',
    icon: 'https://render.guildwars2.com/file/FD5FD424729C41D53AE20E61107009175B29C851/1770616.png',
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 0.5,
    // The selected stealth grant commits before consuming the stored use.
    castTimeMs: 280,
    // Use the PvE stolen-skill coefficient (1.0); the API also lists the competitive 0.5 split.
    effects: impactEffects({ atMs: 200, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      { type: 'strike', coefficient: 1, hits: 1, name: 'Steal Resistance', actorType: ACTOR.PLAYER },
      {
        type: 'buff',
        kind: STATUS.STEALTH,
        duration: 3,
        stacks: 1,
        when: (runtime) => deadeyeState.from(runtime.profession).malice.value >= 3
      },
      {
        type: 'boon',
        boon: BOON.RESISTANCE,
        duration: 5,
        stacks: 1,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      },
      { type: 'condition', condition: CONDITION.TORMENT, stacks: 3, duration: 8, actorType: ACTOR.PLAYER }
    ]),
    // The skill owns this transition at successful commitment.
    sideEffects: [
      { on: 'castCommit', do: { type: 'thief.stealth' } },
      { on: 'castCommit', do: { type: 'thief.consume-stolen' } }
    ]
  },
  [ID.STEAL_PRECISION]: {
    name: 'Steal Precision',
    icon: 'https://render.guildwars2.com/file/1DFF7D36F880D358AB020FC03CFCCF33C409C7C5/1770615.png',
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 0.5,
    // The selected stealth grant commits before consuming the stored use.
    castTimeMs: 280,
    // Use the PvE stolen-skill coefficient (1.0); the API also lists the competitive 0.5 split.
    effects: impactEffects({ atMs: 200, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      { type: 'strike', coefficient: 1, hits: 1, name: 'Steal Precision', actorType: ACTOR.PLAYER },
      {
        type: 'buff',
        kind: STATUS.STEALTH,
        duration: 3,
        stacks: 1,
        when: (runtime) => deadeyeState.from(runtime.profession).malice.value >= 3
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
    ]),
    // The skill owns this transition at successful commitment.
    sideEffects: [
      { on: 'castCommit', do: { type: 'thief.stealth' } },
      { on: 'castCommit', do: { type: 'thief.consume-stolen' } }
    ]
  },
  [ID.STEAL_HEALTH]: {
    name: 'Steal Health',
    icon: 'https://render.guildwars2.com/file/D6A0B179460001074F5606A3B450D07D03523BC1/1770619.png',
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 0.5,
    // The selected stealth grant commits before consuming the stored use.
    castTimeMs: 200,
    // Use the PvE stolen-skill coefficient (1.0); the API also lists the competitive 0.5 split.
    effects: impactEffects({ atMs: 200, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      { type: 'strike', coefficient: 1, hits: 1, name: 'Steal Health', actorType: ACTOR.PLAYER },
      {
        type: 'buff',
        kind: STATUS.STEALTH,
        duration: 3,
        stacks: 1,
        when: (runtime) => deadeyeState.from(runtime.profession).malice.value >= 3
      },
      { type: 'condition', condition: CONDITION.BLEEDING, stacks: 5, duration: 8, actorType: ACTOR.PLAYER }
    ]),
    // The skill owns this transition at successful commitment.
    sideEffects: [
      { on: 'castCommit', do: { type: 'thief.stealth' } },
      { on: 'castCommit', do: { type: 'thief.consume-stolen' } }
    ]
  },
  [ID.STEAL_STRENGTH]: {
    name: 'Steal Strength',
    icon: 'https://render.guildwars2.com/file/CDF49C91397270A36A20BB4B4CDAEE99A2F6E957/1770617.png',
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 0.5,
    // The selected stealth grant commits before consuming the stored use.
    castTimeMs: 280,
    // Use the PvE stolen-skill coefficient (1.0); the API also lists the competitive 0.5 split.
    effects: impactEffects({ atMs: 200, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      { type: 'strike', coefficient: 1, hits: 1, name: 'Steal Strength', actorType: ACTOR.PLAYER },
      {
        type: 'buff',
        kind: STATUS.STEALTH,
        duration: 3,
        stacks: 1,
        when: (runtime) => deadeyeState.from(runtime.profession).malice.value >= 3
      },
      {
        type: 'boon',
        boon: BOON.MIGHT,
        duration: 12,
        stacks: 5,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      },
      { type: 'condition', condition: CONDITION.WEAKNESS, stacks: 1, duration: 8, actorType: ACTOR.PLAYER }
    ]),
    // The skill owns this transition at successful commitment.
    sideEffects: [
      { on: 'castCommit', do: { type: 'thief.stealth' } },
      { on: 'castCommit', do: { type: 'thief.consume-stolen' } }
    ]
  },
  [ID.STEAL_TIME]: {
    name: 'Steal Time',
    icon: 'https://render.guildwars2.com/file/0779426B11E048DA03E834C74828CCD070222A49/1770618.png',
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 0.5,
    // The selected stealth grant commits before consuming the stored use.
    castTimeMs: 280,
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
        when: (runtime) => deadeyeState.from(runtime.profession).malice.value >= 3
      },
      {
        type: 'boon',
        boon: BOON.QUICKNESS,
        duration: 5,
        stacks: 1,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      },
      { type: 'condition', condition: CONDITION.SLOW, stacks: 1, duration: 3, actorType: ACTOR.PLAYER }
    ]),
    // The skill owns this transition at successful commitment.
    sideEffects: [
      { on: 'castCommit', do: { type: 'thief.stealth' } },
      { on: 'castCommit', do: { type: 'thief.consume-stolen' } }
    ]
  },
  [ID.STEAL_DURABILITY]: {
    name: 'Steal Durability',
    icon: 'https://render.guildwars2.com/file/EE36E907052CF7E41C20280FABB4AD57EEBF4F70/1770613.png',
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 0.5,
    // The selected stealth grant commits before consuming the stored use.
    castTimeMs: 280,
    // Use the PvE stolen-skill coefficient (1.0); the API also lists the competitive 0.5 split.
    effects: impactEffects({ atMs: 200, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      { type: 'strike', coefficient: 1, hits: 1, name: 'Steal Durability', actorType: ACTOR.PLAYER },
      {
        type: 'buff',
        kind: STATUS.STEALTH,
        duration: 3,
        stacks: 1,
        when: (runtime) => deadeyeState.from(runtime.profession).malice.value >= 3
      },
      {
        type: 'boon',
        boon: BOON.PROTECTION,
        duration: 5,
        stacks: 1,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      },
      { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 10, duration: 5, actorType: ACTOR.PLAYER }
    ]),
    // The skill owns this transition at successful commitment.
    sideEffects: [
      { on: 'castCommit', do: { type: 'thief.stealth' } },
      { on: 'castCommit', do: { type: 'thief.consume-stolen' } }
    ]
  },
  [ID.STEAL_DEFENSES]: {
    name: 'Steal Defenses',
    icon: 'https://render.guildwars2.com/file/6FAE300063E1F79B92A2664CA67307036C4AB9E6/1770612.png',
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 0.5,
    // The selected stealth grant commits before consuming the stored use.
    castTimeMs: 200,
    // Use the PvE stolen-skill coefficient (1.0); the API also lists the competitive 0.5 split.
    effects: impactEffects({ atMs: 200, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      { type: 'strike', coefficient: 1, hits: 1, name: 'Steal Defenses', actorType: ACTOR.PLAYER },
      {
        type: 'buff',
        kind: STATUS.STEALTH,
        duration: 3,
        stacks: 1,
        when: (runtime) => deadeyeState.from(runtime.profession).malice.value >= 3
      },
      {
        type: 'boon',
        boon: BOON.AEGIS,
        duration: 5,
        stacks: 1,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      },
      { type: 'condition', condition: CONDITION.POISONED, stacks: 2, duration: 8, actorType: ACTOR.PLAYER }
    ]),
    // The skill owns this transition at successful commitment.
    sideEffects: [
      { on: 'castCommit', do: { type: 'thief.stealth' } },
      { on: 'castCommit', do: { type: 'thief.consume-stolen' } }
    ]
  },
  [ID.STEAL_MOBILITY]: {
    name: 'Steal Mobility',
    icon: 'https://render.guildwars2.com/file/09229668D0C0051A5364F9C8314C42995A087774/1770614.png',
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 0.5,
    // The selected stealth grant commits before consuming the stored use.
    castTimeMs: 200,
    // Use the PvE stolen-skill coefficient (1.0); the API also lists the competitive 0.5 split.
    effects: impactEffects({ atMs: 200, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      { type: 'strike', coefficient: 1, hits: 1, name: 'Steal Mobility', actorType: ACTOR.PLAYER },
      {
        type: 'buff',
        kind: STATUS.STEALTH,
        duration: 3,
        stacks: 1,
        when: (runtime) => deadeyeState.from(runtime.profession).malice.value >= 3
      },
      { type: 'condition', condition: CONDITION.IMMOBILIZED, stacks: 1, duration: 1.5, actorType: ACTOR.PLAYER }
    ]),
    // The skill owns this transition at successful commitment.
    sideEffects: [
      { on: 'castCommit', do: { type: 'thief.stealth' } },
      { on: 'castCommit', do: { type: 'thief.consume-stolen' } }
    ]
  }
};
