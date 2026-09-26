/**
 * Owns Weaver stance, profession, heal, and elite skill fragments.
 * Dual-weapon fragments remain under `skills/weapons/`.
 */
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type { ElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';
import { PRIMORDIAL_STANCE_EFFECTS } from '#gw2/professions/elementalist/specializations/weaver/profiles.js';

/** Shares stance timing while retaining independent effect arrays and stable patch selectors for each variant. */
function primordialStance(attunement: ElementalistAttunement): Partial<Skill> {
  const offsets = [0, 1000, 2000, 3000, 4000, 5000];
  const { condition, stacks, duration } = PRIMORDIAL_STANCE_EFFECTS[attunement];
  return {
    name: `Primordial Stance (${attunement})`,
    type: 'Utility',
    slot: 'Utility',
    specialization: 'Weaver',
    attunement,
    categories: ['Stance'],
    castTimeMs: 0,
    cooldown: 5,
    ammo: 2,
    ammoRecharge: 20,
    skillFamily: 'Stance',

    effects: [
      {
        type: 'strike',
        ticks: offsets.map((atMs) => ({
          atMs,
          coefficient: PRIMORDIAL_STANCE_EFFECTS.strike.coefficient,
          damageKind: 'field-tick'
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: offsets.map((atMs) => ({ atMs, condition, stacks, duration })),
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  };
}

/** Declares Weaver-owned non-weapon skills for composition by `index.ts`. */
// Shared impact timing keeps companion payloads independent and in their authored order.
export const WEAVER_SLOT_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.AQUATIC_STANCE]: {
    name: 'Aquatic Stance',
    type: 'Heal',
    slot: 'Heal',
    specialization: 'Weaver',
    categories: ['Stance'],
    castTimeMs: 640,
    cooldown: 20,
    resourceGain: 50,
    skillFamily: 'Stance',
    effects: []
  },
  [ID.PRIMORDIAL_STANCE_FIRE]: primordialStance('Fire'),
  [ID.PRIMORDIAL_STANCE_WATER]: primordialStance('Water'),
  [ID.PRIMORDIAL_STANCE_AIR]: primordialStance('Air'),
  [ID.PRIMORDIAL_STANCE_EARTH]: primordialStance('Earth'),
  // Weave Self and Tailored Victory chain into each other: completing Weave Self
  // opens the Perfect Weave flipover, and Tailored Victory consumes it.
  [ID.WEAVE_SELF]: {
    name: 'Weave Self',
    type: 'Elite',
    slot: 'Elite',
    specialization: 'Weaver',
    categories: ['Stance'],
    castTimeMs: 800,
    cooldown: 90,
    nextChainId: ID.TAILORED_VICTORY,
    skillFamily: 'Stance',
    effects: []
  },
  [ID.TAILORED_VICTORY]: {
    name: 'Tailored Victory',
    type: 'Elite',
    slot: 'Elite',
    specialization: 'Weaver',
    categories: ['Stance'],
    castTimeMs: 560,
    cooldown: 0,
    nextChainId: ID.WEAVE_SELF,
    skillFamily: 'Stance',
    // Tailored Victory consumes the Perfect Weave flip window when it completes.
    elementalistTasks: [
      {
        type: 'elementalist.weaver.consume-perfect-weave',
        timingAnchor: 'castEnd'
      }
    ],
    effects: impactEffects({ atMs: 0, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.75, canCrit: true },
      { type: 'control', applications: 1, controlKind: 'crowd-control' }
    ])
  },
  [ID.UNRAVEL]: {
    name: 'Unravel',
    type: 'Profession',
    slot: 'Profession_5',
    specialization: 'Weaver',
    categories: ['Stance'],
    mechanicSlot: 5,
    castTimeMs: 0,
    cooldown: 25,
    skillFamily: 'Stance',
    effects: []
  },
  [ID.FERVENT_STANCE]: {
    name: 'Fervent Stance',
    type: 'Utility',
    slot: 'Utility',
    specialization: 'Weaver',
    categories: ['Stance'],
    castTimeMs: 0,
    cooldown: 20,
    skillFamily: 'Stance',
    // Fervent Stance arms its dual-attack might window after completion.
    elementalistTasks: [
      {
        type: 'elementalist.weaver.arm-fervent-stance',
        timingAnchor: 'castEnd'
      }
    ],
    effects: impactEffects({ atMs: 0, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'boon', boon: 'Swiftness', stacks: 1, duration: 6, metadata: {} },
      { type: 'boon', boon: 'Fury', stacks: 1, duration: 6, metadata: {} },
      { type: 'boon', boon: 'Quickness', stacks: 1, duration: 6, metadata: {} }
    ])
  }
});
