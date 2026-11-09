/** Core Engineer Elite Mortar Kit skill mechanics. */
import { ACTOR, COMBO_FIELD, COMBO_FINISHER, CONDITION } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { EngineerSkill } from '#gw2/professions/engineer/types.js';

/** Defines the equip action, palette skills, stow action, and linked toolbelt skill for Elite Mortar Kit. */
export const ENGINEER_ELITE_MORTAR_KIT_SKILL_MECHANICS: Readonly<Record<string, SkillDefinition<EngineerSkill>>> = {
  [ID.MORTAR_SHOT]: {
    name: 'Mortar Shot',
    icon: 'https://render.guildwars2.com/file/B6A4C502065F0AB570209E0EF3A4327FBC10B110/103475.png',
    type: 'Weapon',
    slot: 'Weapon_1',

    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    cooldown: 0,
    kitId: ID.ELITE_MORTAR_KIT,
    castTimeMs: 360,
    effects: [
      {
        weaponStrengthProfileId: 'bundle.ascended',
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Mortar Shot',
        actorType: ACTOR.PLAYER
      }
    ]
  },
  [ID.POISON_GAS_SHELL]: {
    name: 'Poison Gas Shell',
    icon: 'https://render.guildwars2.com/file/4396640C93D17832A63EF994CB0FE1F023630090/1012856.png',
    type: 'Weapon',
    slot: 'Weapon_2',

    cooldown: 10,
    kitId: ID.ELITE_MORTAR_KIT,
    // Use the measured Quickness animation so the poison field and its pulses start at the observed time.
    castTimeMs: 560,
    comboFields: [
      {
        ownerId: 'engineer',
        fieldType: COMBO_FIELD.POISON,
        duration: 5,
        startAnchor: 'castEnd',
        inclusiveExpiry: true
      }
    ],
    effects: [
      {
        weaponStrengthProfileId: 'bundle.ascended',
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Poison Gas Shell',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        ticks: Array.from({ length: 5 }, (_, index) => ({
          atMs: 0 + index * 1000,
          condition: CONDITION.POISONED,
          stacks: 1,
          duration: 3
        })),
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        actorType: ACTOR.PLAYER
      }
    ]
  },
  [ID.ENDOTHERMIC_SHELL]: {
    name: 'Endothermic Shell',
    icon: 'https://render.guildwars2.com/file/7A6304CAC62449F57CD560F2DFEEF33620273E0E/103477.png',
    type: 'Weapon',
    slot: 'Weapon_3',

    cooldown: 15,
    kitId: ID.ELITE_MORTAR_KIT,
    castTimeMs: 360,
    effects: [
      {
        weaponStrengthProfileId: 'bundle.ascended',
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Endothermic Shell',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.CHILLED,
        stacks: 1,
        duration: 1,
        actorType: ACTOR.PLAYER
      }
    ]
  },
  [ID.FLASH_SHELL]: {
    name: 'Flash Shell',
    icon: 'https://render.guildwars2.com/file/05D3ED204C42109D13A63ABA5507A96C176EF30B/1012855.png',
    type: 'Weapon',
    slot: 'Weapon_4',

    cooldown: 20,
    kitId: ID.ELITE_MORTAR_KIT,
    castTimeMs: 360,
    effects: [
      {
        weaponStrengthProfileId: 'bundle.ascended',
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Flash Shell',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.BLINDNESS,
        stacks: 1,
        duration: 5,
        actorType: ACTOR.PLAYER
      }
    ]
  },
  [ID.ORBITAL_STRIKE]: {
    name: 'Orbital Strike',
    icon: 'https://render.guildwars2.com/file/99CFD7B1B200DCC508172BC8A3C2EE970C06493E/1012854.png',
    type: 'Profession',
    slot: 'Profession_5',

    cooldown: 40,
    toolbeltParentId: ID.ELITE_MORTAR_KIT,
    mechanicSlot: 5,
    castTimeMs: 880,
    comboFinishers: [
      {
        ownerId: 'engineer',
        finisherType: COMBO_FINISHER.BLAST
      }
    ],
    effects: [
      {
        type: 'strike',
        // EVTC samples land about 1.7 seconds after the cast completes, independent of cast-speed scaling.
        ticks: [{ atMs: 1720, coefficient: 1.33 }],
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        name: 'Orbital Strike',
        actorType: ACTOR.PLAYER
      }
    ]
  },
  [ID.ELITE_MORTAR_KIT]: {
    name: 'Elite Mortar Kit',
    icon: 'https://render.guildwars2.com/file/0EC010DE95064B13B756C11F94CB040DFACD627B/103443.png',
    type: 'Elite',
    slot: 'Elite',
    // Custom: Equips the kit and updates bundle/weapon state; see `core/mechanics/kits.ts`.
    inputCategory: 'bar-swap',
    // Count the explicit bar-changing input in effort summaries.
    kitTransition: 'equip',
    cooldown: 0,
    castTimeMs: 0,
    effects: [],
    // Commit the bar transition before cast traits observe the selected kit.
    sideEffects: [{ on: 'castCommit', do: { type: 'engineer.kit-transition' } }]
  },
  [ID.ELIXIR_SHELL]: {
    name: 'Elixir Shell',
    icon: 'https://render.guildwars2.com/file/93910A51076B0B43AC4CCF741EF57678CBB2FD51/103479.png',
    type: 'Weapon',
    slot: 'Weapon_5',
    skillFamily: 'Elixir',
    cooldown: 24,
    kitId: ID.ELITE_MORTAR_KIT,
    castTimeMs: 560,
    comboFields: [
      {
        ownerId: 'engineer',
        fieldType: COMBO_FIELD.WATER,
        duration: 5,
        startAnchor: 'castEnd',
        inclusiveExpiry: true
      }
    ],
    effects: []
  }
};

/** Keeps the synthetic stow action beside the Elite Mortar Kit palette it closes. */
export const ENGINEER_ELITE_MORTAR_KIT_EXTRA_SKILLS: readonly EngineerSkill[] = [
  {
    name: 'Stow Elite Mortar Kit',
    // The stow face shares the equipped mortar slot, like the other kit flips.
    icon: 'https://render.guildwars2.com/file/' + '7342BF326738A4C5132F42CE0915D3A2184E52FB/60975.png',
    id: ID.STOW_ELITE_MORTAR_KIT,
    type: 'Elite',
    slot: 'Elite',
    // Custom: Stows the active kit and restores weapon state; see `core/mechanics/kits.ts`.
    inputCategory: 'bar-swap',
    // Count the explicit bar-changing input in effort summaries.
    kitTransition: 'stow',
    kitId: ID.ELITE_MORTAR_KIT,
    paletteFlip: false,
    slotSelectable: false,
    cooldown: 0,
    castTimeMs: 0,
    effects: [],
    // Commit the bar transition before cast traits observe the selected kit.
    sideEffects: [{ on: 'castCommit', do: { type: 'engineer.kit-transition' } }]
  }
];
