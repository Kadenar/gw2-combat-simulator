/** Canonical Core revenant skill fragments grouped by their GW2 owner. */
import { REVENANT_SKILL_IDS as ID } from '#gw2/content/professions/revenant/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const REVENANT_WEAPONS_MACE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.MANIFEST_TOXIN]: {
    implemented: true,
    quicknessCastTimeMs: 560,
    interruptCommitMs: 440,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.6,
        hits: 1,
        name: 'Manifest Toxin — Packet 1',
        actorType: 'player',
        atMs: 440,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        // Once Manifest Toxin launches, its strike and Poison survive a later animation cancel.
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 12,
        actorType: 'player',
        atMs: 440,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      }
    ]
  },
  [ID.ANGUISH_SWIPE]: {
    implemented: true,
    quicknessCastTimeMs: 360,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.4,
        hits: 1,
        name: 'Anguish Swipe',
        actorType: 'player',
        atMs: 280,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 1,
        duration: 3,
        actorType: 'player',
        atMs: 280,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.MISERY_SWIPE]: {
    implemented: true,
    quicknessCastTimeMs: 440,
    interruptCommitMs: 280,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.35,
        hits: 1,
        name: 'Misery Swipe',
        actorType: 'player',
        atMs: 280,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 1,
        duration: 3,
        actorType: 'player',
        atMs: 280,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.ECHOING_ERUPTION]: {
    implemented: true,
    quicknessCastTimeMs: 960,
    cooldown: 8,
    ammo: 0,
    ammoRecharge: 0,
    energyCost: 5,
    comboFinishers: [
      {
        ownerId: 'revenant',
        finisherType: 'Blast',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Echoing Eruption',
        actorType: 'player',
        atMs: 800,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 4,
        duration: 5,
        actorType: 'player',
        atMs: 800,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 3,
        actorType: 'player',
        atMs: 800,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        boon: 'Might',
        duration: 9,
        stacks: 3,
        atMs: 800,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.SEARING_FISSURE]: {
    implemented: true,
    quicknessCastTimeMs: 600,
    interruptCommitMs: 480,
    cooldown: 3,
    energyCost: 5,
    comboFields: [
      {
        ownerId: 'revenant',
        fieldType: 'Fire',
        duration: 3,
        startAnchor: 'castEnd'
      }
    ],
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        name: 'Initial Strike',
        actorType: 'player',
        atMs: 480,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'strike',
        coefficient: 0.75,
        hits: 3,
        name: 'Pulsing Strikes',
        actorType: 'player',
        atMs: 1480,
        intervalMs: 1000,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        metadata: {}
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 3,
        duration: 3,
        actorType: 'player',
        atMs: 480,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 1,
        applications: 3,
        atMs: 1480,
        intervalMs: 1000,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player',
        persistsAfterInterrupt: true
      }
    ]
  }
});
