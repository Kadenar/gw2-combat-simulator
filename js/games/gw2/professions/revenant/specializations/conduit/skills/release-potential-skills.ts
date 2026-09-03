/** Owns Conduit Release Potential skill variants. */
import { REVENANT_LEGEND_IDS as LEGEND, REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const CONDUIT_RELEASE_POTENTIAL_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.RELEASE_POTENTIAL_MONK]: {
    // Custom: Selects and materializes the affinity-specific release profile; see `execution/release-potential.ts`.
    handlerId: 'revenant.release-potential',
    castTimeMs: 500,
    cooldown: 10,
    energyCost: 0,
    effects: [
      { type: 'boon', boon: 'resistance', duration: 2, stacks: 1 },
      { type: 'boon', boon: 'regeneration', duration: 6, stacks: 1 }
    ]
  },
  [ID.RELEASE_POTENTIAL_MESMER]: {
    // Custom: Selects and materializes the affinity-specific release profile; see `execution/release-potential.ts`.
    handlerId: 'revenant.release-potential',
    quicknessCastTimeMs: 440,
    cooldown: 10,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 280, coefficient: 1.98 }],
        name: 'Release Potential: Mesmer',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 280, condition: 'Torment', stacks: 2, duration: 3 }],
        durationPerAffinity: 0.1,
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 280, condition: 'Torment', stacks: 1, duration: 8 }],
        durationReductionPerAffinity: 0.15,
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        target: 'self'
      },
      {
        type: 'control',
        duration: 2,
        actorType: 'player',
        atMs: 280,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        controlKind: 'daze',
        breakbar: 200
      }
    ]
  },
  [ID.RELEASE_POTENTIAL_DERVISH]: {
    // Custom: Selects and materializes the affinity-specific release profile; see `execution/release-potential.ts`.
    handlerId: 'revenant.release-potential',
    quicknessCastTimeMs: 680,
    cooldown: 10,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 560, coefficient: 1.98 }],
        name: 'Release Potential: Dervish',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 560, condition: 'Bleeding', stacks: 3, duration: 6 }],
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        metadata: { legendId: LEGEND.DEMON }
      },
      {
        type: 'boon',
        boon: 'might',
        stacks: 10,
        duration: 8,
        atMs: 560,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        metadata: { legendId: LEGEND.CENTAUR }
      },
      {
        type: 'boon',
        boon: 'fury',
        stacks: 1,
        duration: 8,
        atMs: 560,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        metadata: { legendId: LEGEND.CENTAUR }
      }
    ]
  },
  [ID.RELEASE_POTENTIAL_ASSASSIN]: {
    // Custom: Selects and materializes the affinity-specific release profile; see `execution/release-potential.ts`.
    handlerId: 'revenant.release-potential',
    quicknessCastTimeMs: 740,
    cooldown: 10,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        name: 'Release Potential: Assassin',
        actorType: 'player',
        ticks: [160, 480, 800].map((atMs) => ({
          atMs,
          coefficient: 0.6
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 800, condition: 'Crippled', stacks: 1, duration: 2 }],
        durationPerAffinity: 0.2,
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 800, condition: 'Immobilized', stacks: 1, duration: 2 }],
        durationPerAffinity: 0.2,
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.RELEASE_POTENTIAL_WARRIOR]: {
    // Custom: Selects and materializes the affinity-specific release profile; see `execution/release-potential.ts`.
    handlerId: 'revenant.release-potential',
    castTimeMs: 750,
    cooldown: 10,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.649,
        hits: 1,
        name: 'Release Potential: Warrior',
        actorType: 'player'
      }
    ]
  }
});
