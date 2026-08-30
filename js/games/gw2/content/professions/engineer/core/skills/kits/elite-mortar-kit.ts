/** Core Engineer Elite Mortar Kit skill mechanics. */
import { ENGINEER_SKILL_IDS as ID } from '../../../data/ids.js';
import type { Skill, SkillFragment } from '../../../../../../platform/engine/types.js';

// Owns the equip action, palette skills, stow action, and linked toolbelt skill for Elite Mortar Kit.
export const ENGINEER_ELITE_MORTAR_KIT_SKILL_MECHANICS: Readonly<Record<string, SkillFragment>> = Object.freeze({
  [ID.ELIXIR_SHELL]: {
    implemented: true,
    quicknessCastTimeMs: 560,
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
    implemented: true,
    castTimeMs: 500,
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
    implemented: true,
    castTimeMs: 500,
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
    implemented: true,
    castTimeMs: 500,
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
    implemented: true,
    quicknessCastTimeMs: 880,
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
        coefficient: 1.33,
        hits: 1,
        // EVTC samples land about 1.7 seconds after the cast completes, independent of cast-speed scaling.
        atMs: 1700,
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
    implemented: true,
    handlerId: 'engineer.kit-equip',
    castTimeMs: 0,
    cooldown: 0,
    effects: [],
    kitName: 'Elite Mortar Kit'
  },
  [ID.POISON_GAS_SHELL]: {
    interruptCommitMs: 0,
    implemented: true,
    // Use the measured Quickness animation so the poison field and its pulses start at the observed time.
    quicknessCastTimeMs: 560,
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
        condition: 'Poisoned',
        stacks: 1,
        duration: 3,
        applications: 5,
        atMs: 0,
        intervalMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        actorType: 'player',
        persistsAfterInterrupt: true
      }
    ],
    kit: 'Elite Mortar Kit'
  }
});

// Keeps the synthetic stow action beside the kit palette it closes.
export const ENGINEER_ELITE_MORTAR_KIT_EXTRA_SKILLS: readonly Skill[] = Object.freeze([
  {
    id: ID.STOW_ELITE_MORTAR_KIT,
    name: 'Stow Elite Mortar Kit',
    description: 'Stow the elite mortar kit and return to equipped weapons.',
    icon: 'https://render.guildwars2.com/file/' + '7342BF326738A4C5132F42CE0915D3A2184E52FB/60975.png',
    type: 'Elite',
    slot: 'Elite',
    handlerId: 'engineer.kit-stow',
    kit: 'Elite Mortar Kit',
    paletteFlip: false,
    slotSelectable: false,
    castTimeMs: 0,
    cooldown: 0,
    implemented: true,
    effects: []
  }
]);
