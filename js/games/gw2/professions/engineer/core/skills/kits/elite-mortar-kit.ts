/** Core Engineer Elite Mortar Kit skill mechanics. */
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

/** Defines the equip action, palette skills, stow action, and linked toolbelt skill for Elite Mortar Kit. */
export const ENGINEER_ELITE_MORTAR_KIT_SKILL_MECHANICS: Readonly<Record<string, Partial<Skill>>> = Object.freeze({
  [ID.ELIXIR_SHELL]: {
    castTimeMs: 560,
    cooldown: 24,
    comboFields: [
      {
        ownerId: 'engineer',
        fieldType: 'Water',
        duration: 5,
        startAnchor: 'castEnd',
        inclusiveExpiry: true
      }
    ],
    effects: [],
    kit: 'Elite Mortar Kit'
  },
  [ID.FLASH_SHELL]: {
    castTimeMs: 360,
    cooldown: 20,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Flash Shell',
        actorType: 'player'
      },
      {
        type: 'blind',
        actorType: 'player'
      }
    ],
    kit: 'Elite Mortar Kit'
  },
  [ID.ENDOTHERMIC_SHELL]: {
    castTimeMs: 360,
    cooldown: 15,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Endothermic Shell',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Chilled',
        stacks: 1,
        duration: 1,
        actorType: 'player'
      }
    ],
    kit: 'Elite Mortar Kit'
  },
  [ID.MORTAR_SHOT]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 360,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Mortar Shot',
        actorType: 'player'
      }
    ],
    kit: 'Elite Mortar Kit'
  },
  [ID.ORBITAL_STRIKE]: {
    castTimeMs: 880,
    cooldown: 40,
    comboFinishers: [
      {
        ownerId: 'engineer',
        finisherType: 'Blast',
        ambiguousFieldSelection: 'oldest'
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
        actorType: 'player'
      }
    ],
    toolbeltParentName: 'Elite Mortar Kit',
    mechanicSlot: 5
  },
  [ID.ELITE_MORTAR_KIT]: {
    // Custom: Equips the kit and updates bundle/weapon state; see `core/mechanics/kits.ts`.
    inputCategory: 'bar-swap', // Count the explicit bar-changing input in effort summaries.
    kitTransition: 'equip',
    castTimeMs: 0,
    cooldown: 0,
    effects: [],
    kitName: 'Elite Mortar Kit'
  },
  [ID.POISON_GAS_SHELL]: {
    // Use the measured Quickness animation so the poison field and its pulses start at the observed time.
    castTimeMs: 560,
    cooldown: 10,
    comboFields: [
      {
        ownerId: 'engineer',
        fieldType: 'Poison',
        duration: 5,
        startAnchor: 'castEnd',
        inclusiveExpiry: true
      }
    ],
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Poison Gas Shell',
        actorType: 'player'
      },
      {
        type: 'condition',
        ticks: Array.from({ length: 5 }, (_, index) => ({
          atMs: 0 + index * 1000,
          condition: 'Poisoned',
          stacks: 1,
          duration: 3
        })),
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        actorType: 'player'
      }
    ],
    kit: 'Elite Mortar Kit'
  }
});

/** Keeps the synthetic stow action beside the Elite Mortar Kit palette it closes. */
export const ENGINEER_ELITE_MORTAR_KIT_EXTRA_SKILLS: readonly Skill[] = Object.freeze([
  {
    id: ID.STOW_ELITE_MORTAR_KIT,
    name: 'Stow Elite Mortar Kit',
    // The stow face shares the equipped mortar slot, like the other kit flips.
    flipParentId: ID.ELITE_MORTAR_KIT,
    description: 'Stow the elite mortar kit and return to equipped weapons.',
    icon: 'https://render.guildwars2.com/file/' + '7342BF326738A4C5132F42CE0915D3A2184E52FB/60975.png',
    type: 'Elite',
    slot: 'Elite',
    // Custom: Stows the active kit and restores weapon state; see `core/mechanics/kits.ts`.
    inputCategory: 'bar-swap', // Count the explicit bar-changing input in effort summaries.
    kitTransition: 'stow',
    kit: 'Elite Mortar Kit',
    paletteFlip: false,
    slotSelectable: false,
    castTimeMs: 0,
    cooldown: 0,
    effects: []
  }
]);
