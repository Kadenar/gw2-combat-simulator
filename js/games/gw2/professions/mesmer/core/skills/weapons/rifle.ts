/** Canonical Core mesmer skill definitions grouped by their GW2 owner. */
import { ACTOR, BOON, COMBO_FIELD, CONDITION, CONTROL, RECIPIENT, WEAPON } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

export const MESMER_WEAPONS_RIFLE_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<MesmerSkill>>> = {
  [ID.FRIENDLY_FIRE]: {
    name: 'Friendly Fire',
    icon: 'https://render.guildwars2.com/file/BAAD0DF6B8C4AAF520B82BE3CEA7931BC2F52DCF/3256358.png',
    type: 'Weapon',
    weapon: 'Rifle',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 500,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        name: 'Damage',
        actorType: ACTOR.PLAYER,
        weapon: WEAPON.RIFLE.toLowerCase()
      }
    ]
  },
  [ID.JOURNEY]: {
    name: 'Journey',
    icon: 'https://render.guildwars2.com/file/3E615FE1679F39B3E22C0706F83ABEFF80092B21/3256359.png',
    type: 'Weapon',
    weapon: 'Rifle',
    slot: 'Weapon_2',

    cooldown: 5,
    resource: {
      mode: 'add',
      count: 1
    },
    castTimeMs: 333.333333333,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        name: 'Damage',
        actorType: ACTOR.PLAYER,
        weapon: WEAPON.RIFLE.toLowerCase()
      }
    ]
  },
  [ID.INSPIRING_IMAGERY]: {
    name: 'Inspiring Imagery',
    icon: 'https://render.guildwars2.com/file/9BC790BC5D1C4E667599C6090F6EFAADED6AD9A3/3256360.png',
    type: 'Weapon',
    weapon: 'Rifle',
    slot: 'Weapon_3',
    cooldown: 12,
    // Flip lifetime follows its parent's authored clock, with delayed readiness kept separate.
    flipArm: { skillId: ID.ABSTRACTION, duration: 2, delay: 0, anchor: 'castCommit' },
    tasks: [{ type: 'mesmer.core.imagery-expire', atMs: 2000, timingAnchor: 'castEnd' }],
    castTimeMs: 500,
    // The image grants boons after its field expires unless Abstraction detonates it first.
    comboFields: [{ ownerId: 'mesmer', fieldType: COMBO_FIELD.ETHEREAL, duration: 2, startAnchor: 'castEnd' }],
    effects: [
      {
        type: 'boon',
        boon: BOON.MIGHT,
        stacks: 12,
        duration: 9,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      },
      { type: 'boon', boon: BOON.FURY, duration: 9, audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 } }
    ],
    // The cast emits nothing itself: the boons are the natural-expiry payload read by `expireInspiringImagery`.
    effectVariants: [{ when: () => true, transform: () => [] }],
    sideEffects: [{ on: 'castCommit', do: { type: 'mesmer.arm-flip' } }]
  },
  [ID.ABSTRACTION]: {
    name: 'Abstraction',
    icon: 'https://render.guildwars2.com/file/72E5ACDEAE7571B67F96F9BDA8A271CCCF08957B/3256361.png',
    type: 'Weapon',
    weapon: 'Rifle',
    slot: 'Weapon_3',
    rechargeAnchor: 'castStart',
    cooldown: 0,
    castTimeMs: 0,
    // Early detonation replaces the image's boons with an offensive blast of its own field.
    effects: [
      {
        type: 'strike',
        coefficient: 1.81,
        hits: 1,
        name: 'Detonation',
        actorType: ACTOR.PLAYER,
        weapon: WEAPON.RIFLE.toLowerCase()
      },
      { type: 'condition', condition: CONDITION.WEAKNESS, stacks: 1, duration: 5 },
      { type: 'condition', condition: CONDITION.BLINDNESS, stacks: 1, duration: 5 }
    ],
    sideEffects: [
      {
        on: 'castStart',
        when: (_runtime, cast) => !cast.cancelledBeforeCommit,
        do: { type: 'mesmer.detonate-imagery' }
      },
      { on: 'castCommit', do: { type: 'flipConsume', skillId: ID.ABSTRACTION } }
    ]
  },
  [ID.PHANTASMAL_SHARPSHOOTER]: {
    name: 'Phantasmal Sharpshooter',
    icon: 'https://render.guildwars2.com/file/3499040CA6182B68293313C1000C470828CE1532/3256362.png',
    type: 'Weapon',
    weapon: 'Rifle',
    slot: 'Weapon_4',

    cooldown: 20,
    // The summon owns its attack and conversion timeline independently of the player cast.
    phantasmTiming: {
      // These lifecycle timings are estimates.
      damageAtMs: 1560,
      spawnAtMs: 1560
    },
    phantasm: true,
    resource: {
      mode: 'phantasm',
      count: 1
    },
    castTimeMs: 500,
    effects: [
      // The phantasm's shot supplies the stun, at its own impact rather than the player's cast completion.
      {
        type: 'control',
        source: 'Phantasm',
        actorType: ACTOR.SUMMON,
        summonKind: 'phantasm',
        controlKind: CONTROL.STUN,
        atMs: 0,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        coefficient: 2.28,
        hits: 1,
        name: 'Phantasm shot',
        actorType: ACTOR.SUMMON,
        summonKind: 'phantasm',
        weapon: WEAPON.RIFLE.toLowerCase()
      }
    ],
    sideEffects: [{ on: 'castStart', do: { type: 'mesmer.summon-phantasm' } }]
  },
  [ID.SINGULARITY_SHOT]: {
    name: 'Singularity Shot',
    icon: 'https://render.guildwars2.com/file/3895647E911D09067115A75D5F5C2035B069D2DA/3256363.png',
    type: 'Weapon',
    weapon: 'Rifle',
    slot: 'Weapon_5',
    cooldown: 20,
    // Flip lifetime follows its parent's authored clock, with delayed readiness kept separate.
    flipArm: { skillId: ID.DIMENSIONAL_APERTURE, duration: 3, delay: 0, anchor: 'castStart' },
    castTimeMs: 333.333333333,
    effects: [],
    sideEffects: [{ on: 'castCommit', do: { type: 'mesmer.arm-flip' } }]
  },
  // Flip actions share their parent's catalog so ordinary mechanics assembly owns both faces.
  [ID.DIMENSIONAL_APERTURE]: {
    name: 'Dimensional Aperture',
    icon: 'https://render.guildwars2.com/file/4342CE56CCFF5669FE084891F377B95D1026AFA1/3256364.png',
    type: 'Weapon',
    weapon: 'Rifle',
    slot: 'Weapon_5',
    rechargeAnchor: 'castStart',
    cooldown: 0,
    parentCooldownIncrease: 0.5,
    castTimeMs: 0,
    effects: [],
    sideEffects: [
      { on: 'castCommit', do: { type: 'flipConsume', skillId: ID.DIMENSIONAL_APERTURE } },
      { on: 'castCommit', do: { type: 'mesmer.extend-parent-recharge' } }
    ]
  }
};
