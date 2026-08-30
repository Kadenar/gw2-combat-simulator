/** Canonical Core thief skill fragments grouped by their GW2 owner. */
import { THIEF_SKILL_IDS as ID } from '#gw2/content/professions/thief/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const THIEF_WEAPONS_SPEAR_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.ENTANGLING_ASP]: {
    implemented: true,
    handlerId: 'thief.spear-chain',
    castTimeMs: 650,
    cooldown: 0,
    initiativeCost: 2,
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1,
        name: 'Entangling Asp',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      }
    ]
  },
  [ID.SHATTERING_ASSAULT]: {
    implemented: true,
    handlerId: 'thief.spear-chain',
    castTimeMs: 800,
    cooldown: 0,
    initiativeCost: 1,
    effects: [
      {
        type: 'strike',
        coefficient: 1.8,
        hits: 1,
        name: 'Shattering Assault',
        actorType: 'player'
      },
      {
        type: 'buff',
        kind: 'stealth',
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.DISTRACTING_THROW]: {
    implemented: true,
    handlerId: 'thief.spear-chain',
    castTimeMs: 450,
    cooldown: 0,
    initiativeCost: 2,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        name: 'Distracting Throw',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 3,
        duration: 6,
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        metadata: {
          controlKind: 'daze',
          duration: 1.5
        }
      }
    ]
  },
  [ID.UNSUSPECTING_STRIKE]: {
    implemented: true,
    handlerId: 'thief.spear-chain',
    castTimeMs: 750,
    cooldown: 0,
    initiativeCost: 3,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        name: 'Unsuspecting Strike',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 6,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 6,
        actorType: 'player'
      }
    ]
  },
  [ID.SHADOW_VEIL]: {
    implemented: true,
    castTimeMs: 2000,
    cooldown: 0,
    initiativeCost: 3,
    effects: []
  },
  [ID.ASHEN_ASSAULT]: {
    implemented: true,
    preservesStealth: true,
    spearStealthAttack: true,
    handlerId: 'thief.spear-stealth-attack',
    castTimeMs: 575,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 5,
        name: 'Ashen Assault',
        actorType: 'player',
        atMs: 173.913043478261,
        intervalMs: 173.913043478261,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        coefficient: 0.3,
        hits: 1,
        name: 'Ashen Assault — Final Strike',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 5,
        duration: 8,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 3,
        duration: 4,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 3,
        duration: 4,
        actorType: 'player'
      }
    ],
    requiredMainHand: 'Spear',
    stealthAttack: true
  },
  [ID.MANTIS_STING]: {
    implemented: true,
    handlerId: 'thief.spear-chain',
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 3,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Mantis Sting',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 4,
        actorType: 'player'
      }
    ]
  },
  [ID.VAMPIRIC_SLASH]: {
    implemented: true,
    handlerId: 'thief.spear-chain',
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 1,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Vampiric Slash — Packet 1',
        actorType: 'player'
      },
      {
        type: 'strike',
        coefficient: 0.2,
        hits: 1,
        name: 'Vampiric Slash — Life Siphon',
        actorType: 'player',
        canCrit: false
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      }
    ]
  },
  [ID.FALLING_SPIDER]: {
    implemented: true,
    handlerId: 'thief.spear-chain',
    castTimeMs: 750,
    cooldown: 0,
    initiativeCost: 1,
    effects: [
      {
        type: 'strike',
        coefficient: 1.8,
        hits: 1,
        name: 'Falling Spider',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 3.5,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 3.5,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 4,
        duration: 8,
        actorType: 'player'
      }
    ]
  },
  [ID.BARBED_SPEAR]: {
    implemented: true,
    handlerId: 'thief.spear-chain',
    castTimeMs: 750,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.375,
        hits: 1,
        name: 'Barbed Spear',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 2.25,
        actorType: 'player'
      }
    ]
  }
});
