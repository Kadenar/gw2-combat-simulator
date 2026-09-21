/** Owns Conduit Release Potential skill variants. */
import { REVENANT_LEGEND_IDS as LEGEND, REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';

export const CONDUIT_RELEASE_POTENTIAL_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.RELEASE_POTENTIAL_MONK]: {
    // Custom: Selects and materializes the affinity-specific release profile; see `execution/release-potential.ts`.
    handlerId: 'revenant.release-potential',
    castTimeMs: 360,
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
    castTimeMs: 440,
    cooldown: 10,
    energyCost: 0,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 280, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.98,
        hits: 1,
        name: 'Release Potential: Mesmer',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 2,
        duration: 3,
        durationPerAffinity: 0.1,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 1,
        duration: 8,
        durationReductionPerAffinity: 0.15,
        actorType: 'player',
        target: 'self'
      },
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'daze'
      }
    ])
  },
  [ID.RELEASE_POTENTIAL_DERVISH]: {
    // Custom: Selects and materializes the affinity-specific release profile; see `execution/release-potential.ts`.
    handlerId: 'revenant.release-potential',
    castTimeMs: 680,
    // Dervish commits its impact before the remaining animation can be cancelled.
    interruptCommitMs: 560,
    cooldown: 10,
    energyCost: 0,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 560, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.98,
        hits: 1,
        name: 'Release Potential: Dervish',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 3,
        duration: 6,
        actorType: 'player',
        metadata: { legendId: LEGEND.DEMON }
      },
      {
        type: 'boon',
        boon: 'might',
        stacks: 10,
        duration: 8,
        metadata: { legendId: LEGEND.CENTAUR }
      },
      {
        type: 'boon',
        boon: 'fury',
        stacks: 1,
        duration: 8,
        metadata: { legendId: LEGEND.CENTAUR }
      }
    ])
  },
  [ID.RELEASE_POTENTIAL_ASSASSIN]: {
    // Custom: Selects and materializes the affinity-specific release profile; see `execution/release-potential.ts`.
    handlerId: 'revenant.release-potential',
    // Assassin releases the cast lane at 720 ms; the final strike follows at 800 ms.
    castTimeMs: 720,
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
      // Share one impact timing while preserving independent payloads and declaration order.
      ...impactEffects({ atMs: 800, timingAnchor: 'castStart', timingScale: 'fixed' }, [
        {
          type: 'condition',
          condition: 'Crippled',
          stacks: 1,
          duration: 2,
          durationPerAffinity: 0.2,
          actorType: 'player'
        },
        {
          type: 'condition',
          condition: 'Immobilized',
          stacks: 1,
          duration: 2,
          durationPerAffinity: 0.2,
          actorType: 'player'
        }
      ])
    ]
  },
  [ID.RELEASE_POTENTIAL_WARRIOR]: {
    // Custom: Selects and materializes the affinity-specific release profile; see `execution/release-potential.ts`.
    handlerId: 'revenant.release-potential',
    castTimeMs: 520,
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
