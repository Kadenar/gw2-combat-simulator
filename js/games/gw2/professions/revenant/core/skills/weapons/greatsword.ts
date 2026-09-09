/** Canonical Core revenant skill fragments grouped by their GW2 owner. */
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const REVENANT_WEAPONS_GREATSWORD_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.MIST_SLASH]: {
    castTimeMs: 600,
    // The strike survives a committed aftercast cancel without shortening the normal auto chain.
    interruptCommitMs: 520,
    unaffectedByQuickness: true,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 400, coefficient: 0.8 }],
        name: 'Mist Slash',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 400, condition: 'Vulnerability', stacks: 1, duration: 10 }],
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.MIST_UNLEASHED]: {
    quicknessCastTimeMs: 520,
    // Commit the attack at 480 ms while reserving the remaining skill lockout.
    interruptCommitMs: 440,
    retainsCastLockoutAfterInterrupt: true,
    cooldown: 3,
    energyCost: 5,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 400, coefficient: 1.6 }],
        name: 'Mist Unleashed',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 3,
        duration: 10,
        actorType: 'player'
      }
    ]
  },
  [ID.ARCING_MISTS]: {
    castTimeMs: 680,
    // A committed cancel retains the strike and conditions during the remaining aftercast.
    interruptCommitMs: 480,
    unaffectedByQuickness: true,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 440, coefficient: 1.2 }],
        name: 'Arcing Mists',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 440, condition: 'Chilled', stacks: 1, duration: 3 }],
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 440, condition: 'Vulnerability', stacks: 2, duration: 10 }],
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.TRUE_STRIKE]: {
    castTimeMs: 750,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        name: 'True Strike (vindicator) — Packet 1',
        actorType: 'player'
      }
    ]
  },
  [ID.PHANTOMS_ONSLAUGHT]: {
    // Keep the 40 ms dash and the 600/400 ms follow-up on 40 ms action frames.
    castTimeMs: 640,
    quicknessCastTimeMs: 440,
    dashTimeMs: 40,
    hitDelayMs: 400,
    cooldown: 8,
    rechargeAnchor: 'castStart',
    // Recharge begins when the dash completes, while the follow-up strike is still casting.
    rechargeOffsetMs: 40,
    energyCost: 8,
    effects: [
      {
        type: 'strike',
        coefficient: 1.6,
        hits: 1,
        name: "Phantom's Onslaught",
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Chilled',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.MIST_SWING]: {
    // Recorded 365 ms casts land their strike and advance to Mist Slash on the 360 ms action frame.
    interruptCommitMs: 360,
    castTimeMs: 400,
    unaffectedByQuickness: true,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.7,
        hits: 1,
        name: 'Mist Swing',
        actorType: 'player',
        persistsAfterInterrupt: true
      }
    ]
  },
  [ID.IMPERIAL_GUARD]: {
    castTimeMs: 2000,
    unaffectedByQuickness: true,
    defaultInterruptMs: 80,
    cooldown: 12,
    energyCost: 10,
    effects: []
  },
  [ID.ETERNITYS_REQUIEM]: {
    quicknessCastTimeMs: 840,
    // Preserve the impacts when the cast is interrupted after committing at 800 ms.
    interruptCommitMs: 800,
    cooldown: 15,
    energyCost: 10,
    effects: [
      {
        type: 'strike',
        name: "Eternity's Requiem",
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        // Committed impacts continue landing after the cast is interrupted.
        persistsAfterInterrupt: true,
        ticks: [
          // Median packet positions by hit rank, snapped independently to 40 ms action ticks.
          // Individual uses vary from six to ten target hits.
          { atMs: 320, coefficient: 1 },
          { atMs: 400, coefficient: 0.9 },
          { atMs: 520, coefficient: 0.8 },
          { atMs: 600, coefficient: 0.7 },
          { atMs: 640, coefficient: 0.6 },
          { atMs: 720, coefficient: 0.5 },
          { atMs: 840, coefficient: 0.4 },
          { atMs: 920, coefficient: 0.3 },
          // Large targets overlap all nine random and five guaranteed impact areas.
          { atMs: 1000, coefficient: 0.3, metadata: { largeHitboxOnly: true } },
          { atMs: 1080, coefficient: 0.3, metadata: { largeHitboxOnly: true } },
          { atMs: 1160, coefficient: 0.3, metadata: { largeHitboxOnly: true } },
          { atMs: 1240, coefficient: 0.3, metadata: { largeHitboxOnly: true } },
          { atMs: 1320, coefficient: 0.3, metadata: { largeHitboxOnly: true } },
          { atMs: 1400, coefficient: 0.3, metadata: { largeHitboxOnly: true } }
        ],
        metadata: {}
      }
    ]
  }
});
