/**
 * Chronomancer-owned formulas and mechanic classifications.
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

export const MESMER_CHRONOMANCER_WEAPON_STRENGTH: Readonly<
  Record<string, number>
> = Object.freeze({});
export const MESMER_CHRONOMANCER_CLONE_ATTACKS: Readonly<
  Record<string, MesmerCloneAttack>
> = Object.freeze({});
export const MESMER_CHRONOMANCER_AMBUSH_ATTACKS: Readonly<
  Record<string, MesmerAmbushAttack>
> = Object.freeze({});
export const MESMER_CHRONOMANCER_PHANTASM_ATTACK_TIMINGS: Readonly<
  Record<number, Partial<MesmerPhantasmAttackTiming>>
> = Object.freeze({
  [ID.PHANTASMAL_SWORDSMAN]: {
    chronophantasmaDamageAtMs: 6330,
    chronophantasmaSpawnAtMs: 7450,
  },
  [ID.PHANTASMAL_DUELIST]: {
    chronophantasmaDamageAtMs: 5530,
    chronophantasmaSpawnAtMs: 6010,
  },
  [ID.PHANTASMAL_MAGE]: {
    chronophantasmaDamageAtMs: 5040,
    chronophantasmaSpawnAtMs: 5290,
  },
  [ID.PHANTASMAL_WARLOCK]: {
    chronophantasmaDamageAtMs: 7450,
    chronophantasmaSpawnAtMs: 8730,
  },
  [ID.PHANTASMAL_BERSERKER]: {
    chronophantasmaDamageAtMs: 4290,
    chronophantasmaSpawnAtMs: 5370,
  },
  [ID.PHANTASMAL_DISENCHANTER]: {
    chronophantasmaDamageAtMs: 3240,
    chronophantasmaSpawnAtMs: 3930,
  },
  [ID.PHANTASMAL_WARDEN]: {
    chronophantasmaDamageAtMs: 12530,
    chronophantasmaSpawnAtMs: 14730,
  },
  [ID.PHANTASMAL_DEFENDER]: {
    chronophantasmaDamageAtMs: 8560,
    chronophantasmaSpawnAtMs: 9270,
  },
  [ID.ECHO_OF_MEMORY]: {
    chronophantasmaDamageAtMs: 2950,
    chronophantasmaSpawnAtMs: 3710,
  },
  [ID.PHANTASMAL_SHARPSHOOTER]: {
    chronophantasmaDamageAtMs: 2600,
    chronophantasmaSpawnAtMs: 2600,
  },
  [ID.PHANTASMAL_LANCER]: {
    chronophantasmaDamageAtMs: 1833.3333333,
    chronophantasmaSpawnAtMs: 1833.3333333,
  },
});
export const MESMER_CHRONOMANCER_TRAIT_DAMAGE: Readonly<
  Record<string, MesmerTraitDamage>
> = Object.freeze({
  "Time Bomb": {
    coefficient: 3,
    hits: 1,
    duration: 5,
    damageIncrease: 0.1,
  },
});
export const MESMER_CHRONOMANCER_SHATTERS: Readonly<
  Record<number, MesmerShatter>
> = Object.freeze({
  [ID.CONTINUUM_SPLIT]: {
    slot: 5,
    kind: "continuum",
    coefficients: [0, 0, 0, 0],
  },
  [ID.TIME_SINK]: {
    slot: 3,
    kind: "control",
    coefficients: [0, 0, 0, 0],
  },
  [ID.REWINDER]: {
    slot: 2,
    kind: "chrono-confusion",
    coefficients: [0.38, 0.76, 1.14, 1.52],
    rechargeReductionPerSource: 3,
  },
  [ID.SPLIT_SECOND]: {
    slot: 1,
    kind: "chrono-power",
    coefficients: [1.53, 3.07, 3.68, 4.3],
  },
});
export const MESMER_CHRONOMANCER_CONTROL_SKILLS: ReadonlySet<number> =
  new Set<number>([ID.GRAVITY_WELL, ID.TIME_SINK]);
export const MESMER_CHRONOMANCER_BLIND_SKILLS: ReadonlySet<number> =
  new Set<number>([]);
export const MESMER_CHRONOMANCER_ARISTOCRACY_SKILLS: ReadonlySet<number> =
  new Set<number>([]);
export const MESMER_CHRONOMANCER_PEITHA_SKILLS: ReadonlySet<number> =
  new Set<number>([]);
export const MESMER_CHRONOMANCER_INSTRUMENTS: Readonly<
  Record<number, MesmerInstrument>
> = Object.freeze({});
