/** Canonical Core ranger skill definitions grouped by their GW2 owner. */
import { BOON, CONDITION, RECIPIENT } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { rangerMerged } from '#gw2/professions/ranger/core/state.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

export const RANGER_CORE_STAFF_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  [ID.SOLAR_BEAM]: {
    name: 'Solar Beam',
    description:
      'Fire a concentrated beam of light at the target enemy or ally, damaging foes and healing allies struck by the beam.',
    icon: 'https://render.guildwars2.com/file/945C70A3D52FE991935FECF0219BF814526F0C03/1128621.png',
    type: 'Weapon',
    weapon: 'Staff',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 833,
    effects: [
      {
        type: 'strike',
        coefficient: 0.3,
        hits: 1
      }
    ]
  },
  [ID.ASTRAL_WISP]: {
    name: 'Astral Wisp',
    description:
      'Send a wisp to a target area. It will detonate upon reaching the area, attaching to allies. Allies attached with a wisp heal over time.',
    icon: 'https://render.guildwars2.com/file/A0E6130606B5D4F690355F9455E00F4BF89D550E/1128622.png',
    type: 'Weapon',
    weapon: 'Staff',
    slot: 'Weapon_2',
    cooldown: 8,
    castTimeMs: 333,
    effects: []
  },
  [ID.ANCESTRAL_GRACE]: {
    name: 'Ancestral Grace',
    description:
      'Become a wisp of natural energy, traversing to the targeted location. When you reach the target, heal nearby allies and grant protection to your pet. Recharge is reduced if you heal another ally.',
    icon: 'https://render.guildwars2.com/file/DF1223B769A504A6CC381A4A281C0130C9BF67A0/1128624.png',
    type: 'Weapon',
    weapon: 'Staff',
    slot: 'Weapon_3',
    cooldown: 20,
    castTimeMs: 833,
    effects: [
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.SUMMONS, affectsSelf: false, maximumRecipients: 1 },
        boon: BOON.PROTECTION,
        duration: 3,
        stacks: 1
      }
    ],
    // Beastmode transfers the pet's protection entitlement to the merged ranger.
    effectVariants: [
      {
        when: (runtime) => rangerMerged(runtime.profession),
        transform: (_runtime, _cast, effects) =>
          effects.map((effect) =>
            effect.type === 'boon' ? { ...effect, audience: { recipients: RECIPIENT.SELF } } : effect
          )
      }
    ]
  },
  [ID.VINE_SURGE]: {
    name: 'Vine Surge',
    description: 'Send forth vines that immobilize enemies and cleanse conditions from allies.',
    icon: 'https://render.guildwars2.com/file/DD0ECCBB503C3FA6527DE6049AD63AC6027CA9DB/1128628.png',
    type: 'Weapon',
    weapon: 'Staff',
    slot: 'Weapon_4',
    cooldown: 20,
    castTimeMs: 500,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1
      },
      // Each target is immobilized once by the advancing vines (wiki: Vine_Surge, PvE).
      { type: 'condition', condition: CONDITION.IMMOBILIZED, stacks: 1, duration: 1.5 }
    ]
  },
  [ID.SUBLIME_CONVERSION]: {
    name: 'Sublime Conversion',
    description:
      'Summon an energy barrier that causes enemy projectiles to heal upon impact. Allies that pass through the wall gain boons.',
    icon: 'https://render.guildwars2.com/file/CB54A104F1B64FD26D24F3F55C05DDD2631619D5/1128627.png',
    type: 'Weapon',
    weapon: 'Staff',
    slot: 'Weapon_5',
    cooldown: 25,
    castTimeMs: 333,
    effects: [
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.REGENERATION,
        duration: 5,
        stacks: 1
      }
    ]
  }
});
