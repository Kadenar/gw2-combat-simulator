import type { BalanceProfile } from '../../../../platform/engine/types.js';
import { MESMER_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import { mesmerAmbushProfile } from '../../core/profiles.js';
import { MESMER_MIRAGE_AMBUSH_ATTACKS } from './mechanics.js';

export const MIRAGE_BALANCE_PROFILE_IDS = Object.freeze({
  mechanics: 'mesmer.mirage.mechanics',
  nominalEndurance: TRAIT.NOMADS_ENDURANCE,
  selfDeception: TRAIT.SELF_DECEPTION,
  renewingOasis: TRAIT.RENEWING_OASIS,
  riddleOfSand: TRAIT.RIDDLE_OF_SAND,
  desertDistortion: TRAIT.DESERT_DISTORTION,
  mirageMantle: TRAIT.MIRAGE_MANTLE,
  phantomPain: TRAIT.PHANTOM_PAIN,
  elusiveMind: TRAIT.ELUSIVE_MIND,
  duneCloak: TRAIT.DUNE_CLOAK,
  imaginaryAxes: 'mesmer.mirage.imaginary-axes',
  phantomRazor: 'mesmer.mirage.phantom-razor',
  splitSurge: 'mesmer.mirage.split-surge',
  effervescence: 'mesmer.mirage.effervescence',
  etherBarrage: 'mesmer.mirage.ether-barrage',
  fracturedGlass: 'mesmer.mirage.fractured-glass',
  chaosVortex: 'mesmer.mirage.chaos-vortex',
  mirageThrust: 'mesmer.mirage.mirage-thrust'
});

export const MIRAGE_AMBUSH_PROFILE_IDS: Readonly<Record<string, string>> = Object.freeze({
  Axe: MIRAGE_BALANCE_PROFILE_IDS.imaginaryAxes,
  Dagger: MIRAGE_BALANCE_PROFILE_IDS.phantomRazor,
  Greatsword: MIRAGE_BALANCE_PROFILE_IDS.splitSurge,
  Rifle: MIRAGE_BALANCE_PROFILE_IDS.effervescence,
  Scepter: MIRAGE_BALANCE_PROFILE_IDS.etherBarrage,
  Spear: MIRAGE_BALANCE_PROFILE_IDS.fracturedGlass,
  Staff: MIRAGE_BALANCE_PROFILE_IDS.chaosVortex,
  Sword: MIRAGE_BALANCE_PROFILE_IDS.mirageThrust
});

const trait = (id: number, name: string, fields: Readonly<Record<string, unknown>> = {}): BalanceProfile => ({
  id,
  name,
  profileKind: 'trait',
  categories: ['Trait'],
  skillFamily: 'Trait',
  effects: [],
  ...fields
});

export const MIRAGE_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: MIRAGE_BALANCE_PROFILE_IDS.mechanics,
    name: 'Mirage Cloak and Mirrors',
    profileKind: 'mechanic',
    durationMultiplier: 0.75,
    durationPerTier: 1.5,
    initialDelay: 0.32,
    effects: [
      { type: 'strike', coefficient: 0.6, hits: 1 },
      { type: 'buff', kind: 'mirage-mirror', duration: 8, stacks: 1 }
    ]
  },
  ...Object.entries(MESMER_MIRAGE_AMBUSH_ATTACKS).map(([weapon, attack]) =>
    mesmerAmbushProfile(MIRAGE_AMBUSH_PROFILE_IDS[weapon], attack)
  ),
  trait(MIRAGE_BALANCE_PROFILE_IDS.nominalEndurance, "Nomad's Endurance", {
    effects: [{ type: 'boon', boon: 'vigor', duration: 3, stacks: 1 }]
  }),
  trait(MIRAGE_BALANCE_PROFILE_IDS.selfDeception, 'Self-Deception', {
    resourceGain: 1
  }),
  trait(MIRAGE_BALANCE_PROFILE_IDS.renewingOasis, 'Renewing Oasis', {
    effects: [{ type: 'boon', boon: 'regeneration', duration: 4, stacks: 1 }]
  }),
  trait(MIRAGE_BALANCE_PROFILE_IDS.riddleOfSand, 'Riddle of Sand', {
    effects: [
      {
        type: 'condition',
        condition: 'Confusion',
        duration: 4,
        stacks: 2
      }
    ]
  }),
  trait(MIRAGE_BALANCE_PROFILE_IDS.desertDistortion, 'Desert Distortion', {
    resourceGain: 1
  }),
  trait(MIRAGE_BALANCE_PROFILE_IDS.mirageMantle, 'Mirage Mantle', {
    effects: [{ type: 'boon', boon: 'alacrity', duration: 4, stacks: 1 }]
  }),
  trait(MIRAGE_BALANCE_PROFILE_IDS.phantomPain, 'Phantom Pain', {
    maximumStacks: 4,
    durationMultiplier: 10
  }),
  trait(MIRAGE_BALANCE_PROFILE_IDS.elusiveMind, 'Elusive Mind', {
    maximumStacks: 3
  }),
  trait(MIRAGE_BALANCE_PROFILE_IDS.duneCloak, 'Dune Cloak', {
    threshold: 3,
    rechargeReduction: 1,
    durationMultiplier: 1
  })
]);
