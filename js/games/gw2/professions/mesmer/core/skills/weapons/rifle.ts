/** Canonical Core mesmer skill fragments grouped by their GW2 owner. */
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const MESMER_WEAPONS_RIFLE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.FRIENDLY_FIRE]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 500,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        name: 'Damage',
        actorType: 'player',
        weapon: 'rifle'
      }
    ]
  },
  [ID.JOURNEY]: {
    castTimeMs: 333.333333333,
    resource: {
      mode: 'add',
      count: 1
    },
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        name: 'Damage',
        actorType: 'player',
        weapon: 'rifle'
      }
    ]
  },
  [ID.INSPIRING_IMAGERY]: {
    castTimeMs: 500,
    // The image grants boons after its field expires unless Abstraction detonates it first.
    handlerId: 'mesmer.inspiring-imagery',
    comboFields: [{ ownerId: 'mesmer', fieldType: 'Ethereal', duration: 2, startAnchor: 'castEnd' }],
    mechanicTriggers: [{ type: 'mesmer.core.imagery-expire', atMs: 2000, timingAnchor: 'castEnd' }],
    effects: [
      { type: 'boon', boon: 'might', stacks: 12, duration: 9 },
      { type: 'boon', boon: 'fury', duration: 9 }
    ]
  },
  [ID.PHANTASMAL_SHARPSHOOTER]: {
    castTimeMs: 500,
    phantasm: true,
    resource: {
      mode: 'phantasm',
      count: 1
    },
    effects: [
      // The phantasm's shot supplies the stun, at its own impact rather than the player's cast completion.
      {
        type: 'control',
        source: 'Phantasm',
        actorType: 'summon',
        summonKind: 'phantasm',
        controlKind: 'stun',
        atMs: 0,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        coefficient: 2.28,
        hits: 1,
        name: 'Phantasm shot',
        actorType: 'summon',
        summonKind: 'phantasm',
        weapon: 'rifle'
      }
    ]
  },
  [ID.SINGULARITY_SHOT]: {
    castTimeMs: 333.333333333,
    effects: []
  }
});
