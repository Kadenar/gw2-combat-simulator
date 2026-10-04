/** Canonical Core guardian skill fragments grouped by their GW2 owner. */
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

export const GUARDIAN_WEAPONS_MACE_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.PROTECTORS_STRIKE]: {
    castTimeMs: 520,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1
      },
      // The modeled counterattack grants its boons alongside the strike.
      { type: 'boon', boon: 'protection', duration: 3, stacks: 1, audience: { recipients: 'party' } },
      { type: 'boon', boon: 'aegis', duration: 6, stacks: 1, audience: { recipients: 'party' } }
    ]
  },
  [ID.FAITHFUL_STRIKE]: {
    castTimeMs: 520,
    effects: [
      {
        type: 'strike',
        coefficient: 1.55,
        hits: 1
      }
    ]
  },
  [ID.TRUE_STRIKE]: {
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1
      }
    ]
  },
  [ID.PURE_STRIKE]: {
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      }
    ]
  },
  [ID.SYMBOL_OF_FAITH]: {
    // Author symbol identity independently of the skill's display text.
    tags: ['symbol'],
    castTimeMs: 520,
    // The Light field begins with the first symbol pulse and lasts through the fifth.
    comboFields: [{ ownerId: 'guardian', fieldType: 'Light', duration: 4, startMs: 760, startAnchor: 'castStart' }],
    effects: [
      {
        type: 'strike',
        metadata: { guardianSymbol: true },
        ticks: Array.from({ length: 5 }, (_, index) => ({ atMs: 760 + index * 1000, coefficient: 3.25 / 5 })),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      // Regeneration follows the symbol's pulses so mace boon-duration traits affect actual applications.
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 1,
        stacks: 1,
        applications: 5,
        atMs: 760,
        intervalMs: 1000,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        audience: { recipients: 'party' }
      }
    ]
  }
});
