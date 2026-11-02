/** Canonical Core guardian skill definitions grouped by their GW2 owner. */
import { BOON, COMBO_FIELD, CONDITION, CONTROL, RECIPIENT } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { castWasInterrupted } from '#gw2/platform/execution/cast-timing.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';

export const GUARDIAN_SLOT_SKILLS_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = {
  // Instant shouts share boons with the party while spent charges recharge independently of the use lockout.
  [ID.ADVANCE]: {
    name: '"Advance!"',
    icon: 'https://render.guildwars2.com/file/4EB81AB80FA319D32A1A11566EA10639A14AC708/103635.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Shout',
    cooldown: 24,
    ammo: 2,

    ammoCastLockout: 5,
    castTimeMs: 0,
    effects: [
      { type: 'boon', boon: BOON.SWIFTNESS, duration: 20, audience: { recipients: RECIPIENT.PARTY } },
      { type: 'boon', boon: BOON.AEGIS, duration: 20, audience: { recipients: RECIPIENT.PARTY } }
    ]
  },
  [ID.HOLD_THE_LINE]: {
    name: '"Hold the Line!"',
    icon: 'https://render.guildwars2.com/file/CA143E59076FDECC06DF0F209836104F359977E0/103663.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Shout',
    cooldown: 20,
    ammo: 2,

    ammoCastLockout: 5,
    castTimeMs: 0,
    effects: [
      { type: 'boon', boon: BOON.PROTECTION, duration: 6, audience: { recipients: RECIPIENT.PARTY } },
      { type: 'boon', boon: BOON.REGENERATION, duration: 6, audience: { recipients: RECIPIENT.PARTY } }
    ]
  },
  // Party Stability and Resolution use normal boon delivery so relics and Firebrand traits can react.
  [ID.STAND_YOUR_GROUND]: {
    name: '"Stand Your Ground!"',
    icon: 'https://render.guildwars2.com/file/7B3B7DFE6C2422C74891CE17E0A3EF15722805F8/103664.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Shout',
    cooldown: 24,
    castTimeMs: 0,
    effects: [
      {
        type: 'boon',
        boon: BOON.RESOLUTION,
        duration: 5,
        stacks: 1,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      },
      {
        type: 'boon',
        boon: BOON.STABILITY,
        duration: 6,
        stacks: 5,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      }
    ]
  },
  [ID.RECEIVE_THE_LIGHT]: {
    name: '"Receive the Light!"',
    icon: 'https://render.guildwars2.com/file/98FF447227E81AB44D9298F0E3BD62D553972B54/103089.png',
    type: 'Heal',
    slot: 'Heal',
    skillFamily: 'Shout',
    cooldown: 24,
    castTimeMs: 680,
    effects: []
  },
  [ID.BANE_SIGNET]: {
    name: 'Bane Signet',
    icon: 'https://render.guildwars2.com/file/9FF294A9CC489D4FE8CED934A0C4359964B67443/103638.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Signet',
    cooldown: 20,
    // Passive grants stay with their skill and obey readiness in the attribute reader.
    attributeBonuses: { power: 180 },
    // Use the reviewed activation duration so damage and control resolve at cast completion.
    castTimeMs: 880,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      },
      {
        type: 'control',
        controlKind: CONTROL.KNOCKDOWN
      }
    ]
  },
  [ID.SHELTER]: {
    name: 'Shelter',
    icon: 'https://render.guildwars2.com/file/D979B406E04C80687055B7C40A3837A4AB36B3D8/103645.png',
    type: 'Heal',
    slot: 'Heal',
    cooldown: 30,
    castTimeMs: 680,
    effects: []
  },
  [ID.HAMMER_OF_WISDOM]: {
    name: 'Hammer of Wisdom',
    icon: 'https://render.guildwars2.com/file/99430A49F97BA45EF101E611A69193D57BF70A7D/103655.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'SpiritWeapon',
    cooldown: 20,
    ammoCastLockout: 8,
    ammo: 2,

    castTimeMs: 200,
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1
      },
      {
        type: 'control',
        controlKind: CONTROL.KNOCKDOWN
      }
    ]
  },
  [ID.SANCTUARY]: {
    name: 'Sanctuary',
    icon: 'https://render.guildwars2.com/file/2E31D763EA1D05432949EBB39603CD6DBBE29870/103541.png',
    type: 'Utility',
    slot: 'Utility',

    cooldown: 40,
    castTimeMs: 200,
    effects: []
  },
  [ID.SIGNET_OF_WRATH]: {
    name: 'Signet of Wrath',
    icon: 'https://render.guildwars2.com/file/7F660CD006085D42B5A9F16A281D0E15434A2304/103643.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Signet',
    attributeBonuses: { conditionDamage: 180 },
    cooldown: 18,
    // The active commits before the Quickness cast finishes, allowing the remaining recovery to be canceled.
    castTimeMs: 880,
    interruptCommitMs: 820,
    effects: [
      {
        type: 'strike',
        coefficient: 0.25,
        hits: 1
      },
      {
        type: 'condition',
        condition: CONDITION.BURNING,
        stacks: 3,
        duration: 5
      },
      {
        type: 'condition',
        condition: CONDITION.IMMOBILIZED,
        stacks: 1,
        duration: 6
      }
    ]
  },
  [ID.RENEWED_FOCUS]: {
    name: 'Renewed Focus',
    icon: 'https://render.guildwars2.com/file/344C7EEC3F6FE10568720E4F75EF91C37A58C43C/103665.png',
    type: 'Elite',
    slot: 'Elite',

    cooldown: 90,
    castTimeMs: 1360,
    effects: [],
    // A full channel refreshes only the virtues present in the selected specialization's catalog.
    sideEffects: [
      {
        on: 'castCommit',
        when: (_runtime, cast) => !castWasInterrupted(cast),
        do: { type: 'guardian.refresh-virtues' }
      }
    ]
  },
  [ID.SIGNET_OF_RESOLVE]: {
    name: 'Signet of Resolve',
    icon: 'https://render.guildwars2.com/file/45904C2C787647E168F1A4B607471A32A8CB9609/103666.png',
    type: 'Heal',
    slot: 'Heal',
    skillFamily: 'Signet',
    cooldown: 25,
    castTimeMs: 680,
    effects: []
  },
  [ID.SWORD_OF_JUSTICE]: {
    name: 'Sword of Justice',
    icon: 'https://render.guildwars2.com/file/98B40D09401B44949604E073F5F793C660B7ED22/103669.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'SpiritWeapon',
    cooldown: 15,
    ammo: 3,

    ammoCastLockout: 1,
    castTimeMs: 600,
    interruptCommitMs: 400,
    retainsCastLockoutAfterInterrupt: true,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        // Include the spirit's arrival delay: four strikes begin 1320 ms after cast start, 400 ms apart.
        ticks: [1320, 1720, 2120, 2520].map((atMs) => ({ atMs, coefficient: 0.8 }))
      },
      {
        type: 'condition',
        // Every sword packet applies its own Vulnerability at the matching impact time.
        ticks: [1320, 1720, 2120, 2520].map((atMs) => ({
          atMs,
          condition: CONDITION.VULNERABILITY,
          stacks: 3,
          duration: 8
        }))
      }
    ])
  },
  [ID.PURGING_FLAMES]: {
    name: 'Purging Flames',
    icon: 'https://render.guildwars2.com/file/646CD9EA044A959A0A0D6143B29707EADB31B2B9/103675.png',
    type: 'Utility',
    slot: 'Utility',

    cooldown: 20,
    castTimeMs: 320,
    comboFields: [
      {
        ownerId: 'guardian',
        fieldType: COMBO_FIELD.FIRE,
        duration: 5,
        startAnchor: 'castEnd'
      }
    ],
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      // The field pulses once per second, each pulse striking and applying Burning; extensions add whole pulses.
      { type: 'strike', coefficient: 0.2, atMs: 320, applications: 6, intervalMs: 1000 },
      {
        type: 'condition',
        condition: CONDITION.BURNING,
        stacks: 1,
        duration: 2,
        atMs: 320,
        applications: 6,
        intervalMs: 1000
      }
    ])
  },
  [ID.JUDGES_INTERVENTION]: {
    name: "Judge's Intervention",
    icon: 'https://render.guildwars2.com/file/0130A69F3F5F55A493AE9BFCA965603330C605AA/103668.png',
    type: 'Utility',
    slot: 'Utility',

    cooldown: 20,
    shadowstepSkill: true,
    castTimeMs: 200,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1
      },
      {
        type: 'condition',
        condition: CONDITION.BURNING,
        stacks: 1,
        duration: 8
      }
    ]
  },
  [ID.LITANY_OF_WRATH]: {
    name: 'Litany of Wrath',
    icon: 'https://render.guildwars2.com/file/77077EDEB2AF1F3D4062E6428000F44F77616ADE/699527.png',
    type: 'Heal',
    slot: 'Heal',

    cooldown: 20,
    castTimeMs: 680,
    effects: []
  },
  [ID.FEEL_MY_WRATH]: {
    name: '"Feel My Wrath!"',
    icon: 'https://render.guildwars2.com/file/B743B8DDF91DBC0239460877775FBE7BD36F6873/103702.png',
    type: 'Elite',
    slot: 'Elite',
    skillFamily: 'Shout',
    cooldown: 30,
    castTimeMs: 400,
    effects: [
      { type: 'boon', boon: BOON.QUICKNESS, duration: 3, audience: { recipients: RECIPIENT.PARTY } },
      // The party application includes the caster, so this supplement doubles only the caster's duration to six seconds.
      { type: 'boon', boon: BOON.QUICKNESS, duration: 3, audience: { recipients: RECIPIENT.SELF } },
      { type: 'boon', boon: BOON.FURY, duration: 10, audience: { recipients: RECIPIENT.PARTY } }
    ]
  }
};
