/**
 * Troubadour-owned formulas and mechanic classifications.
 */
import { MESMER_SKILL_IDS as ID } from "../../data/ids.js";
import type {
  MesmerAmbushAttack,
  MesmerCloneAttack,
  MesmerInstrument,
  MesmerPhantasmAttackTiming,
  MesmerShatter,
  MesmerTraitDamage,
} from "../../types.js";

export const MESMER_TROUBADOUR_WEAPON_STRENGTH: Readonly<
  Record<string, number>
> = Object.freeze({});
export const MESMER_TROUBADOUR_CLONE_ATTACKS: Readonly<
  Record<string, MesmerCloneAttack>
> = Object.freeze({});
export const MESMER_TROUBADOUR_AMBUSH_ATTACKS: Readonly<
  Record<string, MesmerAmbushAttack>
> = Object.freeze({});
export const MESMER_TROUBADOUR_PHANTASM_ATTACK_TIMINGS: Readonly<
  Record<number, Partial<MesmerPhantasmAttackTiming>>
> = Object.freeze({});
export const MESMER_TROUBADOUR_TRAIT_DAMAGE: Readonly<
  Record<string, MesmerTraitDamage>
> = Object.freeze({
  Syncopate: {
    coefficient: 0.75,
    hits: 1,
  },
});
export const MESMER_TROUBADOUR_SHATTERS: Readonly<
  Record<number, MesmerShatter>
> = Object.freeze({});
export const MESMER_TROUBADOUR_CONTROL_SKILLS: ReadonlySet<number> =
  new Set<number>([ID.FLUSTERING_FLUTE, ID.DEAFENING_DRUM]);
export const MESMER_TROUBADOUR_BLIND_SKILLS: ReadonlySet<number> =
  new Set<number>([]);
export const MESMER_TROUBADOUR_ARISTOCRACY_SKILLS: ReadonlySet<number> =
  new Set<number>([]);
export const MESMER_TROUBADOUR_PEITHA_SKILLS: ReadonlySet<number> =
  new Set<number>([]);
export const MESMER_TROUBADOUR_INSTRUMENTS: Readonly<
  Record<number, MesmerInstrument>
> = Object.freeze({
  [ID.LIVELY_LUTE]: {
    slot: 1,
    instrument: "Lute",
    coefficient: 3,
    hits: 3,
    damageAtMs: 435,
    intervalMs: 200,
  },
  [ID.FLUSTERING_FLUTE]: {
    slot: 2,
    instrument: "Flute",
    coefficient: 1,
    hits: 1,
    damageAtMs: 367,
    conditions: [
      {
        name: "Confusion",
        duration: 4,
        stacks: 3,
      },
    ],
  },
  [ID.HARMONIOUS_HARP]: {
    slot: 4,
    instrument: "Harp",
    coefficient: 0,
    hits: 0,
  },
  [ID.HARMONIOUS_HARP_ALTERNATE]: {
    slot: 4,
    instrument: "Harp",
    coefficient: 0,
    hits: 0,
  },
  [ID.DEAFENING_DRUM]: {
    slot: 3,
    instrument: "Drum",
    coefficient: 2,
    hits: 1,
    damageAtMs: 518,
  },
  [ID.LIVELY_LUTE_ALTERNATE]: {
    slot: 1,
    instrument: "Lute",
    coefficient: 3,
    hits: 3,
    damageAtMs: 435,
    intervalMs: 200,
  },
});
