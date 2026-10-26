import { COMBO_FIELD, ACTOR, COMBO_FINISHER, CONDITION } from '#gw2/platform/constants.js';
/** Core Engineer Elite Mortar Kit skill mechanics. */
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

/** Defines the equip action, palette skills, stow action, and linked toolbelt skill for Elite Mortar Kit. */
export const ENGINEER_ELITE_MORTAR_KIT_SKILL_MECHANICS: Readonly<Record<string, Partial<Skill>>> = Object.freeze({
  [ID.MORTAR_SHOT]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
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
    // Custom: Equips the kit and updates bundle/weapon state; see `core/hooks.ts`.
    inputCategory: 'bar-swap', // Count the explicit bar-changing input in effort summaries.
    kitTransition: 'equip',
    cooldown: 0,
    castTimeMs: 0,
    effects: [],
    // Commit the bar transition before cast traits observe the selected kit.
    sideEffects: [{ on: 'castCommit', do: { type: 'engineer.kit-transition' } }]
  },
  [ID.ELIXIR_SHELL]: {
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
});

/** Keeps the synthetic stow action beside the Elite Mortar Kit palette it closes. */
export const ENGINEER_ELITE_MORTAR_KIT_EXTRA_SKILLS: readonly Skill[] = Object.freeze([
  {
    name: 'Stow Elite Mortar Kit',
    id: ID.STOW_ELITE_MORTAR_KIT,
    // The stow face shares the equipped mortar slot, like the other kit flips.
    flipParentId: ID.ELITE_MORTAR_KIT,
    description: 'Stow the elite mortar kit and return to equipped weapons.',
    icon: 'https://render.guildwars2.com/file/' + '7342BF326738A4C5132F42CE0915D3A2184E52FB/60975.png',
    type: 'Elite',
    slot: 'Elite',
    // Custom: Stows the active kit and restores weapon state; see `core/hooks.ts`.
    inputCategory: 'bar-swap', // Count the explicit bar-changing input in effort summaries.
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
]);
