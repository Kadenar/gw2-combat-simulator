/** Core Engineer Grenade Kit skill mechanics. */
import { ENGINEER_SKILL_IDS as ID } from '../../data/ids.js';
import type { SkillFragment } from '../../../../platform/engine/types.js';

// Grenade projectiles commit together during the quickened cast, so later impacts survive aftercast truncation.
const GRENADE_THROW_INTERRUPT_COMMIT_MS = 360;

// Owns the equip action, palette skills, stow action, and linked toolbelt skill for Grenade Kit.
export const ENGINEER_GRENADE_KIT_SKILL_MECHANICS: Readonly<Record<string, SkillFragment>> = Object.freeze({
  [ID.GRENADE_KIT]: {
    implemented: true,
    handlerId: 'engineer.kit-equip',
    castTimeMs: 0,
    cooldown: 0,
    effects: [],
    kitName: 'Grenade Kit'
  },
  [ID.POISON_GRENADE]: {
    implemented: true,
    quicknessCastTimeMs: 680,
    cooldown: 20,
    interruptCommitMs: GRENADE_THROW_INTERRUPT_COMMIT_MS,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 400, coefficient: 0.75 },
          { atMs: 440, coefficient: 0.75 },
          { atMs: 440, coefficient: 0.75 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        name: 'Poison Grenade',
        actorType: 'player',
        metadata: {
          damageKind: 'explosion',
          projectile: true
        }
      },
      {
        type: 'condition',
        ticks: [
          { atMs: 400, condition: 'Poisoned', stacks: 3, duration: 8 },
          { atMs: 440, condition: 'Poisoned', stacks: 3, duration: 8 },
          { atMs: 440, condition: 'Poisoned', stacks: 3, duration: 8 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        actorType: 'player'
      }
    ],
    kit: 'Grenade Kit'
  },
  [ID.SHRAPNEL_GRENADE]: {
    implemented: true,
    quicknessCastTimeMs: 680,
    cooldown: 5,
    interruptCommitMs: GRENADE_THROW_INTERRUPT_COMMIT_MS,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 400, coefficient: 0.63 },
          { atMs: 440, coefficient: 0.63 },
          { atMs: 440, coefficient: 0.63 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        name: 'Shrapnel Grenade',
        actorType: 'player',
        metadata: {
          damageKind: 'explosion'
        }
      },
      {
        type: 'condition',
        ticks: [
          { atMs: 400, condition: 'Bleeding', stacks: 1, duration: 7 },
          { atMs: 440, condition: 'Bleeding', stacks: 1, duration: 7 },
          { atMs: 440, condition: 'Bleeding', stacks: 1, duration: 7 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        actorType: 'player'
      }
    ],
    kit: 'Grenade Kit'
  },
  [ID.FLASH_GRENADE]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 10,
    effects: [
      {
        type: 'strike',
        // Each of the three packets has a 0.1 coefficient; explicit ticks avoid interpreting 0.1 as a split total.
        ticks: [
          { atMs: 120, coefficient: 0.1 },
          { atMs: 240, coefficient: 0.1 },
          { atMs: 360, coefficient: 0.1 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        name: 'Flash Grenade',
        actorType: 'player',
        metadata: {
          damageKind: 'explosion'
        }
      },
      {
        type: 'blind',
        actorType: 'player',
        metadata: {
          duration: 5
        }
      }
    ],
    kit: 'Grenade Kit'
  },
  [ID.FREEZE_GRENADE]: {
    implemented: true,
    quicknessCastTimeMs: 680,
    cooldown: 20,
    // Freeze Grenade is an explosion and does not perform a projectile combo finisher.
    interruptCommitMs: GRENADE_THROW_INTERRUPT_COMMIT_MS,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 400, coefficient: 0.75 },
          { atMs: 440, coefficient: 0.75 },
          { atMs: 440, coefficient: 0.75 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        name: 'Freeze Grenade',
        actorType: 'player',
        metadata: {
          damageKind: 'explosion'
        }
      },
      {
        type: 'condition',
        ticks: [
          { atMs: 400, condition: 'Chilled', stacks: 1, duration: 2 },
          { atMs: 440, condition: 'Chilled', stacks: 1, duration: 2 },
          { atMs: 440, condition: 'Chilled', stacks: 1, duration: 2 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        actorType: 'player'
      }
    ],
    kit: 'Grenade Kit'
  },
  [ID.GRENADE_BARRAGE]: {
    implemented: true,
    quicknessCastTimeMs: 680,
    cooldown: 25,
    // Grenade Barrage is an explosion and does not perform a projectile combo finisher.
    effects: [
      {
        type: 'strike',
        // Six grenades at 0.6 coefficient each.
        coefficient: 3.6,
        hits: 6,
        atMs: 112.88,
        intervalMs: 112.88,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        name: 'Grenade Barrage',
        weapon: 'Profession mechanic',
        actorType: 'player',
        metadata: {
          damageKind: 'explosion'
        }
      }
    ],
    toolbeltParentName: 'Grenade Kit'
  },
  [ID.GRENADE]: {
    implemented: true,
    quicknessCastTimeMs: 680,
    cooldown: 0,
    interruptCommitMs: GRENADE_THROW_INTERRUPT_COMMIT_MS,
    comboFinishers: [
      {
        ownerId: 'engineer',
        finisherType: 'Projectile',
        chance: 0.2,
        preferredFieldTypes: ['Fire'],
        ambiguousFieldSelection: 'oldest'
      }
    ],
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 400, coefficient: 0.33 },
          { atMs: 440, coefficient: 0.33 },
          { atMs: 440, coefficient: 0.33 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        name: 'Grenade',
        actorType: 'player',
        metadata: {
          damageKind: 'explosion'
        }
      }
    ],
    kit: 'Grenade Kit'
  },
  [ID.STOW_GRENADE_KIT]: {
    implemented: true,
    handlerId: 'engineer.kit-stow',
    paletteFlip: false,
    castTimeMs: 0,
    cooldown: 0,
    effects: [],
    kit: 'Grenade Kit'
  }
});
