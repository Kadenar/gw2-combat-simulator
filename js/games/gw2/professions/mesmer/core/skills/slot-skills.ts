/** Canonical Core mesmer skill definitions grouped by their GW2 owner. */
import { ACTOR, BOON, COMBO_FIELD, CONDITION, CONTROL, RECIPIENT, STATUS } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

// Reviewed activation durations keep completion effects and resource changes on their intended action ticks.
export const MESMER_SLOT_SKILLS_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<MesmerSkill>>> = {
  // Flip actions share their parent's catalog so ordinary mechanics assembly owns both faces.
  [ID.POWER_RETURN]: {
    name: 'Power Return',
    icon: 'https://render.guildwars2.com/file/A999116605543595AEF225D26026127828AED66B/103745.png',
    type: 'Heal',
    slot: 'Heal',
    rechargeAnchor: 'castStart',
    cooldown: 20,
    ammoCastLockout: 1,
    ammo: 2,
    armedAtStart: true,
    castTimeMs: 0,
    effects: [],
    // Start prepared and return to the parent when exhausted; Heal identity still triggers traits at fixed full health.
    sideEffects: [{ on: 'castCommit', do: { type: 'mesmer.exhaust-mantra' } }]
  },
  [ID.POWER_SPIKE]: {
    name: 'Power Spike',
    icon: 'https://render.guildwars2.com/file/3519C5C770CCEAF92926D9495999E1F8A23D5AF3/103743.png',
    type: 'Utility',
    slot: 'Utility',
    rechargeAnchor: 'castStart',
    cooldown: 10,
    ammo: 2,
    armedAtStart: true,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.33,
        hits: 1,
        name: 'Damage',
        actorType: ACTOR.PLAYER
      },
      // Apply the live debuff with the instant strike so reconstructed Mantra casts update target state.
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        duration: 8,
        stacks: 5
      }
    ],
    sideEffects: [{ on: 'castCommit', do: { type: 'mesmer.exhaust-mantra' } }]
  },
  [ID.ETHER_FEAST]: {
    name: 'Ether Feast',
    icon: 'https://render.guildwars2.com/file/3A946C46446E0761924AB07CFC19FD5F9107FFD3/103725.png',
    type: 'Heal',
    slot: 'Heal',
    cooldown: 20,
    castTimeMs: 666.666666667,
    effects: []
  },
  [ID.MIRROR]: {
    name: 'Mirror',
    icon: 'https://render.guildwars2.com/file/CED3F1AE9294F9C5045DA8017F25170CE87C0AE2/103726.png',
    type: 'Heal',
    slot: 'Heal',

    cooldown: 12,
    castTimeMs: 833.333333333,
    effects: []
  },
  [ID.MIRROR_IMAGES]: {
    name: 'Mirror Images',
    icon: 'https://render.guildwars2.com/file/AC1FF1F0953751DEF53E5C4A079A80F84239D05C/103736.png',
    type: 'Utility',
    slot: 'Utility',

    cooldown: 25,
    rechargeAnchor: 'castStart',
    resource: {
      mode: 'add',
      count: 2
    },
    castTimeMs: 0,
    effects: []
  },
  [ID.MANTRA_OF_PAIN]: {
    name: 'Mantra of Pain',
    icon: 'https://render.guildwars2.com/file/440570B77C68F009A4EB6C0C0FFD3BE00FC11E96/103742.png',
    type: 'Utility',
    slot: 'Utility',

    cooldown: 1,
    ammoCastLockout: 1,
    // Charges belong to the prepared flip; preparation must not create its own ammo pool.

    castTimeMs: 1600,
    effects: [],
    // Preparation replaces spent charges and any previous recharge state.
    sideEffects: [{ on: 'castCommit', do: { type: 'mesmer.prepare-mantra' } }]
  },
  [ID.MANTRA_OF_RECOVERY]: {
    name: 'Mantra of Recovery',
    icon: 'https://render.guildwars2.com/file/73CCCC9F09D026A016C5D760EA952B59C8AAF8F0/103744.png',
    type: 'Heal',
    slot: 'Heal',

    cooldown: 10,
    ammoCastLockout: 10,
    // Charges belong to the prepared flip; preparation must not create its own ammo pool.

    castTimeMs: 1600,
    effects: [],
    // Completing preparation restores the healing mantra's own two-charge flip.
    sideEffects: [{ on: 'castCommit', do: { type: 'mesmer.prepare-mantra' } }]
  },
  [ID.SIGNET_OF_DOMINATION]: {
    name: 'Signet of Domination',
    icon: 'https://render.guildwars2.com/file/CE55909D170BF3E2C9F9A22C559CDF43D1726CEC/103612.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Signet',
    cooldown: 25,
    attributeBonuses: { conditionDamage: 180 },
    castTimeMs: 480,
    // Signet activation applies its control when the cast completes.
    effects: [
      {
        type: 'control',
        source: 'Player',
        actorType: ACTOR.PLAYER,
        atMs: 0,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.SIGNET_OF_MIDNIGHT]: {
    name: 'Signet of Midnight',
    icon: 'https://render.guildwars2.com/file/6F03529059F71F0CCEC9046F1932619ECB245EC4/57900.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Signet',
    cooldown: 20,
    attributeBonuses: { expertise: 180 },
    rechargeAnchor: 'castStart',
    castTimeMs: 0,
    // Activating the signet applies one five-second blind.
    effects: [
      {
        type: 'condition',
        condition: CONDITION.BLINDNESS,
        stacks: 1,
        duration: 5,
        source: 'Player',
        actorType: ACTOR.PLAYER
      }
    ]
  },
  [ID.MASS_INVISIBILITY]: {
    name: 'Mass Invisibility',
    icon: 'https://render.guildwars2.com/file/E1EB3BC23A10BA9150EF992B03A813F4A26217A8/103755.png',
    type: 'Elite',
    slot: 'Elite',

    cooldown: 35,
    castTimeMs: 1080,
    effects: []
  },
  [ID.SIGNET_OF_ILLUSIONS]: {
    name: 'Signet of Illusions',
    icon: 'https://render.guildwars2.com/file/24B9A56E45B7AB5AA96FF3E85505DF60EA6EBD11/103756.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Signet',
    cooldown: 60,
    pulseInterval: 10,
    resourceGain: 1,
    // Restart the passive clone interval only after the active cast completes.
    tasks: [
      {
        type: 'mesmer.core.restart-signet-illusions-passive',
        timingAnchor: 'castEnd'
      }
    ],
    castTimeMs: 1120,
    effects: [],
    // Committed activation refreshes the selected catalog's eligible shatters and instruments.
    sideEffects: [{ on: 'castCommit', do: { type: 'mesmer.signet-reset' } }]
  },
  [ID.PHANTASMAL_WARDEN]: {
    name: 'Phantasmal Warden',
    icon: 'https://render.guildwars2.com/file/4E08BB09C3E6BE013AE255D763A3EB7C99AE2644/103768.png',
    type: 'Utility',
    slot: 'Utility',

    cooldown: 20,
    // Post-patch conversion follows the eight-hit attack, so clone availability no longer uses the old twelve-hit cycle.
    phantasmTiming: {
      damageAtMs: 3640,
      spawnAtMs: 5680
    },
    phantasm: true,
    resource: {
      mode: 'phantasm',
      count: 1
    },
    // The utility version's full activation is 1160 ms in the post-patch log.
    castTimeMs: 1160,
    // The summon appears before recovery ends, so later cancellation must preserve its attacks and blade conversion.
    interruptCommitMs: 720,
    phantasmSummonProgress: 720 / 1160,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 1080, coefficient: 0.138 },
          { atMs: 1440, coefficient: 0.138 },
          { atMs: 1800, coefficient: 0.138 },
          { atMs: 2160, coefficient: 0.138 },
          { atMs: 2520, coefficient: 0.138 },
          { atMs: 2880, coefficient: 0.138 },
          { atMs: 3280, coefficient: 0.138 },
          { atMs: 3640, coefficient: 0.138 }
        ],
        name: 'Damage',
        actorType: ACTOR.SUMMON,
        summonKind: 'phantasm',
        weapon: 'phantasm medium'
      }
    ],
    sideEffects: [{ on: 'castStart', do: { type: 'mesmer.summon-phantasm' } }]
  },
  [ID.FEEDBACK]: {
    name: 'Feedback',
    icon: 'https://render.guildwars2.com/file/A5720B5C9ED8CB02A3272944C50DF8426E22C5A0/103773.png',
    type: 'Utility',
    slot: 'Utility',

    cooldown: 32,
    rechargeAnchor: 'castStart',
    castTimeMs: 0,
    // Feedback's dome provides an ethereal combo field for its six-second lifetime.
    comboFields: [{ ownerId: 'mesmer', fieldType: COMBO_FIELD.ETHEREAL, duration: 6, startAnchor: 'castStart' }],
    effects: []
  },
  [ID.TIME_WARP]: {
    name: 'Time Warp',
    icon: 'https://render.guildwars2.com/file/6A4DBEEAEDBDE616BA514F5BEB7666ED7066A3AA/103620.png',
    type: 'Elite',
    slot: 'Elite',

    cooldown: 120,
    castTimeMs: 640,
    comboFields: [{ ownerId: 'mesmer', fieldType: COMBO_FIELD.ETHEREAL, duration: 5, startAnchor: 'castEnd' }],
    // Apply an immediate pulse when the field forms, then pulse once per second through its fifth second.
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.QUICKNESS,
        duration: 1,
        applications: 6,
        intervalMs: 1000
      },
      {
        type: 'buff',
        kind: STATUS.SUPERSPEED,
        duration: 1.5,
        applications: 6,
        intervalMs: 1000
      },
      {
        type: 'condition',
        condition: CONDITION.SLOW,
        stacks: 1,
        duration: 1,
        applications: 6,
        intervalMs: 1000
      }
    ])
  },
  [ID.PHANTASMAL_DEFENDER]: {
    name: 'Phantasmal Defender',
    icon: 'https://render.guildwars2.com/file/3439B9C801F6F72F0701A1BA759B249FF428D5C2/103791.png',
    type: 'Utility',
    slot: 'Utility',

    cooldown: 40,
    // The summon owns its attack and conversion timeline independently of the player cast.
    phantasmTiming: {
      damageAtMs: 3800,
      spawnAtMs: 4510
    },
    phantasm: true,
    resource: {
      mode: 'phantasm',
      count: 1
    },
    castTimeMs: 760,
    effects: [
      // Record the taunt's control trigger and three-second target condition at cast completion.
      ...impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
        {
          type: 'control',
          controlKind: CONTROL.TAUNT,
          source: 'Player',
          actorType: ACTOR.PLAYER
        },
        {
          type: 'condition',
          condition: CONDITION.TAUNT,
          stacks: 1,
          duration: 3,
          actorType: ACTOR.PLAYER
        }
      ]),
      {
        type: 'strike',
        coefficient: 0.4,
        hits: 1,
        name: 'Damage',
        actorType: ACTOR.SUMMON,
        summonKind: 'phantasm',
        weapon: 'phantasm defender'
      }
    ],
    sideEffects: [{ on: 'castStart', do: { type: 'mesmer.summon-phantasm' } }]
  },
  [ID.SIGNET_OF_THE_ETHER]: {
    name: 'Signet of the Ether',
    icon: 'https://render.guildwars2.com/file/EE5271572B2B10FBCE95097ECD54775832E8B9EF/699528.png',
    type: 'Heal',
    slot: 'Heal',
    skillFamily: 'Signet',
    cooldown: 30,
    // Delay self-recharge after resetting phantasms; the recorded reuse permits a 280 ms restart delay.
    tasks: [
      {
        type: 'mesmer.core.relock-signet-ether',
        atMs: 280,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ],
    castTimeMs: 920,
    effects: [],
    // Reset phantasms at commitment; the delayed self-relock remains independent.
    sideEffects: [{ on: 'castCommit', do: { type: 'mesmer.signet-reset' } }]
  },
  [ID.SIGNET_OF_HUMILITY]: {
    name: 'Signet of Humility',
    icon: 'https://render.guildwars2.com/file/A8B2B2403BF7A920040EB6E0E534920DA8D27B32/1012893.png',
    type: 'Elite',
    slot: 'Elite',
    skillFamily: 'Signet',
    cooldown: 45,
    castTimeMs: 880,
    // Signet activation applies its control when the cast completes.
    effects: [
      {
        type: 'control',
        source: 'Player',
        actorType: ACTOR.PLAYER,
        atMs: 0,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.MIMIC]: {
    name: 'Mimic',
    icon: 'https://render.guildwars2.com/file/6C744B3948470EF0E6422DEACDC6BFBD42B609D4/103604.png',
    type: 'Utility',
    slot: 'Utility',

    cooldown: 20,
    duration: 10,
    castTimeMs: 640,
    effects: [],
    // Arm a fresh utility-reset window at semantic completion.
    sideEffects: [{ on: 'castCommit', do: { type: 'mesmer.arm-mimic' } }]
  }
};
