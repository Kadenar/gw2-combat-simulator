/** Owns sigil grouping and active-proc declarations separately from passive sigil data. */
import { SIGIL_DATA, SIGIL_NAMES } from '#gw2/platform/equipment/sigils/data.js';

// ─── Sigil Data ───────────────────────────────────────────────────────────────
// Stat values are percentages stored as numbers (e.g. 7 = 7%).
// Only non-zero fields are listed; all others default to 0 when accessed with ||0.
// Proc-only sigils have no passive numeric fields. Their active effect values
// remain in sigil data/rules rather than being folded into aggregate stats.
const CONDITION_SIGILS = new Set([
  'Agony',
  'Blight',
  'Bursting',
  'Demons',
  'Doom',
  'Earth',
  'Geomancy',
  'Ice',
  'Malice',
  'Smoldering',
  'Torment',
  'Venom'
]);

export const SIGIL_GROUPS = [
  {
    label: 'Power',
    items: SIGIL_NAMES.filter((name) => !CONDITION_SIGILS.has(name))
  },
  {
    label: 'Condition',
    items: SIGIL_NAMES.filter((name) => CONDITION_SIGILS.has(name))
  }
];

export const SIGIL_PROCS = Object.freeze({
  Air: {
    trigger: 'crit',
    cooldown: 3,
    effect: 'strike',
    coefficient: 1.1,
    canCrit: false,
    icon: SIGIL_DATA.Air.icon
  },
  Torment: {
    trigger: 'crit',
    cooldown: 5,
    effect: 'condition',
    condition: 'Torment',
    stacks: 2,
    duration: 5,
    icon: SIGIL_DATA.Torment.icon
  },
  Earth: {
    trigger: 'crit',
    cooldown: 2,
    effect: 'condition',
    condition: 'Bleeding',
    stacks: 1,
    duration: 6,
    icon: SIGIL_DATA.Earth.icon
  },
  Blight: {
    trigger: 'crit',
    cooldown: 8,
    effect: 'condition',
    condition: 'Poisoned',
    stacks: 2,
    duration: 4,
    icon: SIGIL_DATA.Blight.icon
  },
  Doom: {
    trigger: 'swap',
    cooldown: 9,
    effect: 'next-hit-condition',
    condition: 'Poisoned',
    stacks: 3,
    duration: 8,
    icon: SIGIL_DATA.Doom.icon
  },
  Geomancy: {
    trigger: 'swap',
    cooldown: 9,
    effect: 'strike-condition',
    coefficient: 0.25,
    canCrit: true,
    condition: 'Bleeding',
    stacks: 3,
    duration: 8,
    icon: SIGIL_DATA.Geomancy.icon
  },
  Hydromancy: {
    trigger: 'swap',
    cooldown: 9,
    effect: 'strike-condition',
    coefficient: 1,
    canCrit: true,
    condition: 'Chilled',
    stacks: 1,
    duration: 2,
    icon: SIGIL_DATA.Hydromancy.icon
  },
  Ice: {
    // "Chill a foe for 2s after striking ... when they are defiant." The sim
    // target is always defiant, so any player strike arms the 10s cooldown.
    trigger: 'strike',
    cooldown: 10,
    effect: 'condition',
    condition: 'Chilled',
    stacks: 1,
    duration: 2,
    icon: SIGIL_DATA.Ice.icon
  },
  Energy: {
    trigger: 'swap',
    cooldown: 9,
    effect: 'endurance',
    amount: 50,
    icon: SIGIL_DATA.Energy.icon
  },
  Severance: {
    trigger: 'control',
    cooldown: 1,
    effect: 'severance',
    duration: 4,
    icon: SIGIL_DATA.Severance.icon
  }
});
