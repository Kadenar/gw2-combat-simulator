/**
 * Each mantra is ordered as preparation, normal charge, then final charge.
 * All phases use the shared charge lifecycle in `mechanics/mantras.ts`.
 */
import { BOON, CONDITION, RECIPIENT } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';

export const FIREBRAND_MANTRA_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  [ID.MANTRA_OF_SOLACE]: {
    name: 'Mantra of Solace',
    description:
      'Mantra. Prepare to heal yourself and grant boons to allies. \nThe final charge of this skill is more powerful.',
    icon: 'https://render.guildwars2.com/file/9E64514AF3280620040C0DBC61A7AABB0F765E54/1770463.png',
    type: 'Heal',
    slot: 'Heal',

    ammoCastLockout: 24,
    cooldown: 24,

    castTimeMs: 1520,
    canCastConcurrently: false,
    effects: [],
    // This phase updates the shared charge controller.
    sideEffects: [{ on: 'castCommit', do: { type: `guardian.prepare-mantra-${ID.MANTRA_OF_SOLACE}` } }]
  },
  [ID.RESTORING_REPRIEVE]: {
    name: 'Restoring Reprieve',
    description: 'Gain health. Grant boons to yourself and allies in front of and around you.',
    icon: 'https://render.guildwars2.com/file/F55B77232407D35E7C03CB6C7B1B199C776B7BB1/1770464.png',
    type: 'Heal',
    slot: 'Heal',
    cooldown: 10,
    ammo: 3,

    ammoCastLockout: 1,
    tags: ['specialization-managed-flip'],
    castTimeMs: 0,
    canCastConcurrently: true,
    effects: [
      { type: 'boon', boon: BOON.PROTECTION, duration: 2, audience: { recipients: RECIPIENT.PARTY } },
      { type: 'boon', boon: BOON.RESOLUTION, duration: 2, audience: { recipients: RECIPIENT.PARTY } }
    ],
    // This phase updates the shared charge controller.
    sideEffects: [{ on: 'castCommit', do: { type: `guardian.use-mantra-${ID.MANTRA_OF_SOLACE}` } }]
  },
  [ID.REJUVENATING_RESPITE]: {
    name: 'Rejuvenating Respite',
    description: 'Final Charge. Gain health and grant aegis, protection, and resolution to allies.',
    icon: 'https://render.guildwars2.com/file/D94367CB0B6F797D956C50B068F96B7F09D0CBBB/1770465.png',
    type: 'Heal',
    slot: 'Heal',
    cooldown: 1,
    tags: ['specialization-managed-flip'],
    castTimeMs: 0,
    canCastConcurrently: true,
    effects: [
      { type: 'boon', boon: BOON.AEGIS, duration: 2, audience: { recipients: RECIPIENT.PARTY } },
      { type: 'boon', boon: BOON.PROTECTION, duration: 3, audience: { recipients: RECIPIENT.PARTY } },
      { type: 'boon', boon: BOON.RESOLUTION, duration: 3, audience: { recipients: RECIPIENT.PARTY } }
    ],
    // Retirement fires the final-charge point, so Weighty Terms rewards precede it.
    sideEffects: [{ on: 'castCommit', do: { type: `guardian.finish-mantra-${ID.MANTRA_OF_SOLACE}` } }]
  },
  [ID.MANTRA_OF_FLAME]: {
    name: 'Mantra of Flame',
    description: 'Mantra. Prepare a chant to sear your enemies. \nThe final charge of this skill is more powerful.',
    icon: 'https://render.guildwars2.com/file/795917A9C66755C96C7AFEA510CA2271E260F3B2/1770484.png',
    type: 'Utility',
    slot: 'Utility',

    ammoCastLockout: 20,
    cooldown: 20,

    castTimeMs: 1520,
    canCastConcurrently: false,
    effects: [],
    // This phase updates the shared charge controller.
    sideEffects: [{ on: 'castCommit', do: { type: `guardian.prepare-mantra-${ID.MANTRA_OF_FLAME}` } }]
  },
  [ID.FLAME_RUSH]: {
    name: 'Flame Rush',
    description: 'Unleash a wave of purging fire in front of and around you.',
    icon: 'https://render.guildwars2.com/file/A64B7DECA2400A0879A6A7B2E82F482221374826/1770485.png',
    type: 'Utility',
    slot: 'Utility',
    cooldown: 10,
    ammo: 3,

    ammoCastLockout: 1,
    tags: ['specialization-managed-flip'],
    castTimeMs: 0,
    canCastConcurrently: true,
    effects: [
      {
        type: 'strike',
        coefficient: 0.7,
        hits: 1
      },
      {
        type: 'condition',
        condition: CONDITION.BURNING,
        stacks: 1,
        duration: 12
      }
    ],
    // This phase updates the shared charge controller.
    sideEffects: [{ on: 'castCommit', do: { type: `guardian.use-mantra-${ID.MANTRA_OF_FLAME}` } }]
  },
  [ID.FLAME_SURGE]: {
    name: 'Flame Surge',
    description: 'Final Charge. Unleash a powerful wave of purging fire in front of and around you.',
    icon: 'https://render.guildwars2.com/file/65805967085DEC9915FB2AB77690DEEDCF24B244/1770486.png',
    type: 'Utility',
    slot: 'Utility',
    cooldown: 1,
    tags: ['specialization-managed-flip'],
    castTimeMs: 0,
    canCastConcurrently: true,
    effects: [
      {
        type: 'strike',
        coefficient: 0.7,
        hits: 1
      },
      {
        type: 'condition',
        condition: CONDITION.BURNING,
        stacks: 3,
        duration: 12
      }
    ],
    // Retirement fires the final-charge point, so Weighty Terms rewards precede it.
    sideEffects: [{ on: 'castCommit', do: { type: `guardian.finish-mantra-${ID.MANTRA_OF_FLAME}` } }]
  },
  [ID.MANTRA_OF_POTENCE]: {
    name: 'Mantra of Potence',
    description:
      'Mantra. Recite a hymn from the annals of Turai to quicken yourself and your allies.\nThe final charge of this skill is more powerful.',
    icon: 'https://render.guildwars2.com/file/B4CB1901D4577CCCBBD315D833FE02C7B748BBC3/1770490.png',
    type: 'Utility',
    slot: 'Utility',

    ammoCastLockout: 20,
    cooldown: 20,

    castTimeMs: 1520,
    canCastConcurrently: false,
    effects: [],
    // This phase updates the shared charge controller.
    sideEffects: [{ on: 'castCommit', do: { type: `guardian.prepare-mantra-${ID.MANTRA_OF_POTENCE}` } }]
  },
  [ID.POTENT_HASTE]: {
    name: 'Potent Haste',
    description: 'Inspire allies before and beside you, enhancing their speed and strength.',
    icon: 'https://render.guildwars2.com/file/A2CEC1C89502B948B10894A56DDEC30A59211C16/1770491.png',
    type: 'Utility',
    slot: 'Utility',
    cooldown: 10,
    ammo: 3,

    ammoCastLockout: 1,
    tags: ['specialization-managed-flip'],
    castTimeMs: 0,
    canCastConcurrently: true,
    effects: [
      { type: 'boon', boon: BOON.QUICKNESS, duration: 2.5, audience: { recipients: RECIPIENT.PARTY } },
      { type: 'boon', boon: BOON.MIGHT, stacks: 5, duration: 6, audience: { recipients: RECIPIENT.PARTY } }
    ],
    // This phase updates the shared charge controller.
    sideEffects: [{ on: 'castCommit', do: { type: `guardian.use-mantra-${ID.MANTRA_OF_POTENCE}` } }]
  },
  [ID.OVERWHELMING_CELERITY]: {
    name: 'Overwhelming Celerity',
    description: 'Final Charge. Inspire allies before and beside you, greatly enhancing their speed and strength.',
    icon: 'https://render.guildwars2.com/file/BC1E1F76E4C9607A29AF77B61DFE35919DF56735/1770492.png',
    type: 'Utility',
    slot: 'Utility',
    cooldown: 1,
    tags: ['specialization-managed-flip'],
    castTimeMs: 0,
    canCastConcurrently: true,
    effects: [
      { type: 'boon', boon: BOON.QUICKNESS, duration: 5, audience: { recipients: RECIPIENT.PARTY } },
      { type: 'boon', boon: BOON.MIGHT, stacks: 8, duration: 10, audience: { recipients: RECIPIENT.PARTY } }
    ],
    // Retirement fires the final-charge point, so Weighty Terms rewards precede it.
    sideEffects: [{ on: 'castCommit', do: { type: `guardian.finish-mantra-${ID.MANTRA_OF_POTENCE}` } }]
  },
  [ID.MANTRA_OF_TRUTH]: {
    name: 'Mantra of Truth',
    description:
      'Mantra. Prepare the tenets of truth to debilitate your foes.\nThe final charge of this skill is more powerful.',
    icon: 'https://render.guildwars2.com/file/F42415D914927F6FC05D803EAE3371F83B5604CF/1770493.png',
    type: 'Utility',
    slot: 'Utility',

    ammoCastLockout: 20,
    cooldown: 20,

    castTimeMs: 1520,
    canCastConcurrently: false,
    effects: [],
    // This phase updates the shared charge controller.
    sideEffects: [{ on: 'castCommit', do: { type: `guardian.prepare-mantra-${ID.MANTRA_OF_TRUTH}` } }]
  },
  [ID.ECHO_OF_TRUTH]: {
    name: 'Echo of Truth',
    description: 'Recount a truth to enemies in front of and around you, inflicting them with conditions.',
    icon: 'https://render.guildwars2.com/file/44E806054B684DE2914C3EC9010598406F039509/1770494.png',
    type: 'Utility',
    slot: 'Utility',
    cooldown: 10,
    ammo: 3,

    ammoCastLockout: 1,
    tags: ['specialization-managed-flip'],
    castTimeMs: 0,
    canCastConcurrently: true,
    effects: [
      {
        type: 'strike',
        coefficient: 0.7,
        hits: 1
      },
      { type: 'condition', condition: CONDITION.CRIPPLED, stacks: 1, duration: 4 },
      { type: 'condition', condition: CONDITION.WEAKNESS, stacks: 1, duration: 4 },
      { type: 'condition', condition: CONDITION.BLINDNESS, stacks: 1, duration: 4 }
    ],
    // This phase updates the shared charge controller.
    sideEffects: [{ on: 'castCommit', do: { type: `guardian.use-mantra-${ID.MANTRA_OF_TRUTH}` } }]
  },
  [ID.VOICE_OF_TRUTH]: {
    name: 'Voice of Truth',
    description:
      'Final Charge. Reveal a harsh truth to enemies before and beside you, devastating them with conditions.',
    icon: 'https://render.guildwars2.com/file/35FF282628089D44A128CBB648F44F1C0A433A37/1770495.png',
    type: 'Utility',
    slot: 'Utility',
    cooldown: 1,
    tags: ['specialization-managed-flip'],
    castTimeMs: 0,
    canCastConcurrently: true,
    effects: [
      { type: 'strike', coefficient: 0.7, hits: 1 },
      { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 5, duration: 8 },
      { type: 'condition', condition: CONDITION.IMMOBILIZED, stacks: 1, duration: 2 },
      { type: 'condition', condition: CONDITION.WEAKNESS, stacks: 1, duration: 8 },
      { type: 'condition', condition: CONDITION.BLINDNESS, stacks: 1, duration: 8 }
    ],
    // Retirement fires the final-charge point, so Weighty Terms rewards precede it.
    sideEffects: [{ on: 'castCommit', do: { type: `guardian.finish-mantra-${ID.MANTRA_OF_TRUTH}` } }]
  },
  [ID.MANTRA_OF_LIBERATION]: {
    name: 'Mantra of Liberation',
    description:
      'Mantra. Echo remnants of an ancient pamphlet from Vabbi that urged Elonians to freedom. Grant stability and resolution to allies while breaking stun.\nThe final charge of this skill is more powerful.',
    icon: 'https://render.guildwars2.com/file/2BF01DA54BCDCEC209E503774C047E1DC5DAE126/1770460.png',
    type: 'Elite',
    slot: 'Elite',

    ammoCastLockout: 40,
    cooldown: 40,

    castTimeMs: 1520,
    canCastConcurrently: false,
    effects: [],
    // This phase updates the shared charge controller.
    sideEffects: [{ on: 'castCommit', do: { type: `guardian.prepare-mantra-${ID.MANTRA_OF_LIBERATION}` } }]
  },
  [ID.PORTENT_OF_FREEDOM]: {
    name: 'Portent of Freedom',
    description: 'Hints of freedom echo around, stabilizing and breaking stuns on you and your allies.',
    icon: 'https://render.guildwars2.com/file/EB6B0D1263094C0309B933F6F9614992E8B5FA3E/1770461.png',
    type: 'Elite',
    slot: 'Elite',
    cooldown: 25,
    ammo: 3,

    ammoCastLockout: 1,
    tags: ['specialization-managed-flip'],
    castTimeMs: 0,
    canCastConcurrently: true,
    effects: [
      { type: 'boon', boon: BOON.STABILITY, duration: 5, audience: { recipients: RECIPIENT.PARTY } },
      { type: 'boon', boon: BOON.RESOLUTION, duration: 5, audience: { recipients: RECIPIENT.PARTY } }
    ],
    // This phase updates the shared charge controller.
    sideEffects: [{ on: 'castCommit', do: { type: `guardian.use-mantra-${ID.MANTRA_OF_LIBERATION}` } }]
  },
  [ID.UNHINDERED_DELIVERY]: {
    name: 'Unhindered Delivery',
    description: 'Final Charge. Grant resolution, stability, and swiftness to allies.',
    icon: 'https://render.guildwars2.com/file/0E95796B56EC95DD4514457CDA50E962991E0D28/1770462.png',
    type: 'Elite',
    slot: 'Elite',
    cooldown: 1,
    tags: ['specialization-managed-flip'],
    castTimeMs: 0,
    canCastConcurrently: true,
    effects: [
      { type: 'boon', boon: BOON.RESOLUTION, duration: 8, audience: { recipients: RECIPIENT.PARTY } },
      { type: 'boon', boon: BOON.STABILITY, stacks: 5, duration: 8, audience: { recipients: RECIPIENT.PARTY } },
      { type: 'boon', boon: BOON.SWIFTNESS, duration: 5, audience: { recipients: RECIPIENT.PARTY } }
    ],
    // Retirement fires the final-charge point, so Weighty Terms rewards precede it.
    sideEffects: [{ on: 'castCommit', do: { type: `guardian.finish-mantra-${ID.MANTRA_OF_LIBERATION}` } }]
  }
});
